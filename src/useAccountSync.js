import { useCallback, useEffect, useRef, useState } from 'react';
import { createEmptyData } from './lib/grades.js';
import { loadData, saveData } from './lib/storage.js';
import { migrateGuestToAccount } from './lib/migrate.js';
import { ENTRY_KEY, cloudConfigured, hasAnyData, loadCloudCache, readCloud, saveCloudCache, supabase, writeCloud, archiveGuestData } from './lib/cloud.js';

const same = (a, b) => a?.id === b?.id;

export function useAccountSync(notify) {
  const [data, setData] = useState(loadData);
  const [mode, setMode] = useState('boot'); // boot, entry, guest, choose, cloud, recover, error
  const [user, setUser] = useState(null);
  const [choice, setChoice] = useState(null);
  const [conflict, setConflict] = useState(null);
  const [syncStatus, setSyncStatus] = useState('synced');
  const [loadError, setLoadError] = useState('');
  const revisionRef = useRef(null);
  const syncedJsonRef = useRef('');
  const savingRef = useRef(false);
  const retryRef = useRef(false);
  const blockedRef = useRef(false);
  const dataRef = useRef(data);
  const userRef = useRef(user);
  const modeRef = useRef(mode);
  dataRef.current = data;
  userRef.current = user;
  modeRef.current = mode;

  const initializeDocument = useCallback((document, revision, isPending = false) => {
    const normalized = document || createEmptyData();
    revisionRef.current = revision ?? null;
    syncedJsonRef.current = isPending ? '__pending__' : JSON.stringify(normalized);
    blockedRef.current = false;
    setData(structuredClone(normalized));
    setSyncStatus(isPending ? 'pending' : 'synced');
    setMode('cloud');
  }, []);

  const enterGuest = useCallback(() => {
    localStorage.setItem(ENTRY_KEY, 'guest');
    blockedRef.current = false;
    setChoice(null); setConflict(null); setUser(null);
    setData(loadData());
    setMode('guest');
  }, []);

  // On first successful login, the guest document is AUTOMATICALLY migrated.
  // Never clear Guest data until Supabase has committed the merged document.
  const loadAccount = useCallback(async (account) => {
    if (!account?.id) return;
    setMode('boot'); setChoice(null); setConflict(null); setLoadError('');
    try {
      let remote = await readCloud(account.id);
      if (userRef.current?.id !== account.id) return;
      const cache = loadCloudCache(account.id);
      const guest = loadData();
      const guestNeedsTransfer = hasAnyData(guest);
      if (guestNeedsTransfer) {
        // Retain unsynced account edits as well as BOTH sets of scores.
        const result = await migrateGuestToAccount({
          userId: account.id, guest, initialRemote: remote,
          pendingAccount: cache?.pending ? cache.data : null,
          read: readCloud, write: writeCloud,
          isCurrent: () => userRef.current?.id === account.id,
        });
        if (result.aborted) return;
        saveCloudCache(account.id, result.document, result.revision, false);
        initializeDocument(result.document, result.revision);
        // Never remove active Guest data until the DB confirms the commit.
        archiveGuestData(guest, account.id);
        saveData(createEmptyData());
        localStorage.setItem(ENTRY_KEY, 'guest');
        notify?.('ย้ายข้อมูล Guest เข้าบัญชีสำเร็จแล้ว · ซิงก์ออนไลน์เรียบร้อย');
        return;
      }
      // Account edits made offline on this device are never silently discarded.
      if (cache?.pending && JSON.stringify(cache.data) !== JSON.stringify(remote?.data ?? createEmptyData())) {
        setChoice({ kind: 'recovery', remote, local: cache.data, localRevision: cache.revision });
        setMode('recover');
        return;
      }
      const document = remote?.data ?? createEmptyData();
      initializeDocument(document, remote?.revision ?? null);
      saveCloudCache(account.id, document, remote?.revision ?? null, false);
    } catch (error) {
      console.error('Loading Gradeculator Cloud failed', error);
      if (userRef.current?.id !== account.id) return;
      const guest = loadData();
      // Crucially: if Guest data needs moving, do NOT display account data
      // in its place or accidentally save it to Guest. Keep Guest untouched.
      if (hasAnyData(guest)) {
        setLoadError(`ยังย้ายข้อมูล Guest ไม่สำเร็จ: ${error.message || 'ตรวจสอบอินเทอร์เน็ตและตั้งค่า Supabase'} ข้อมูล Guest ต้นฉบับยังอยู่ในเครื่องนี้ กดลองใหม่ได้`);
        setMode('error');
        return;
      }
      const cached = loadCloudCache(account.id);
      if (cached) {
        initializeDocument(cached.data, cached.revision, cached.pending);
        setSyncStatus('offline');
        notify?.('ใช้งานสำเนาของบัญชีที่เก็บในเครื่องก่อน · ซิงก์เมื่อเชื่อมต่อได้');
      } else {
        setLoadError('ไม่สามารถโหลดข้อมูลออนไลน์ และยังไม่มีข้อมูลบัญชีที่เคยเก็บในเครื่องนี้');
        setMode('error');
      }
    }
  }, [initializeDocument, notify]);
  useEffect(() => {
    if (!cloudConfigured) {
      setMode(localStorage.getItem(ENTRY_KEY) === 'guest' ? 'guest' : 'entry');
      return;
    }
    let active = true;
    supabase.auth.getSession().then(({ data: sessionData, error }) => {
      if (!active) return;
      if (error) console.error('Supabase session', error);
      const current = sessionData?.session?.user ?? null;
      setUser(prev => same(prev, current) ? prev : current);
      if (!current) setMode(localStorage.getItem(ENTRY_KEY) === 'guest' ? 'guest' : 'entry');
    }).catch(error => {
      if (!active) return;
      console.error(error);
      setMode(localStorage.getItem(ENTRY_KEY) === 'guest' ? 'guest' : 'entry');
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setData(loadData());
        setMode(localStorage.getItem(ENTRY_KEY) === 'guest' ? 'guest' : 'entry');
      }
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(prev => same(prev, session.user) ? prev : session.user);
      }
    });
    return () => { active = false; listener?.subscription?.unsubscribe(); };
  }, []);

  useEffect(() => { if (user?.id) loadAccount(user); }, [user?.id, loadAccount]);

  const flush = useCallback(async () => {
    const account = userRef.current;
    if (modeRef.current !== 'cloud' || !account || blockedRef.current) return;
    const document = dataRef.current;
    const serialized = JSON.stringify(document);
    if (serialized === syncedJsonRef.current) { setSyncStatus('synced'); return; }
    if (savingRef.current) { retryRef.current = true; return; }
    savingRef.current = true; setSyncStatus('syncing');
    try {
      const result = await writeCloud(account.id, document, revisionRef.current);
      if (modeRef.current !== 'cloud' || userRef.current?.id !== account.id) return;
      if (result.conflict) {
        blockedRef.current = true;
        setSyncStatus('conflict');
        let remote = null;
        try { remote = await readCloud(account.id); }
        catch (readError) {
          console.error('Failed to load newest cloud revision', readError);
          blockedRef.current = false;
          setSyncStatus('offline');
          saveCloudCache(account.id, dataRef.current, revisionRef.current, true);
          return;
        }
        if (userRef.current?.id === account.id) setConflict({ remote, local: dataRef.current });
        saveCloudCache(account.id, dataRef.current, revisionRef.current, true);
        return;
      }
      revisionRef.current = result.revision;
      syncedJsonRef.current = serialized;
      const changedAgain = JSON.stringify(dataRef.current) !== serialized;
      saveCloudCache(account.id, dataRef.current, result.revision, changedAgain);
      setSyncStatus(changedAgain ? 'pending' : 'synced');
      if (changedAgain) retryRef.current = true;
    } catch (error) {
      console.error('Saving Gradeculator Cloud failed', error);
      saveCloudCache(account.id, dataRef.current, revisionRef.current, true);
      if (modeRef.current === 'cloud') setSyncStatus('offline');
    } finally {
      savingRef.current = false;
      if (retryRef.current && !blockedRef.current && modeRef.current === 'cloud') {
        retryRef.current = false;
        setTimeout(() => flush(), 120);
      }
    }
  }, []);

  // Guest saves to the original LocalStorage key. Cloud is never written to it.
  useEffect(() => {
    if (mode === 'guest') {
      try { saveData(data); } catch (error) { console.error(error); notify?.('บันทึก Guest ไม่สำเร็จ'); }
      return;
    }
    if (mode !== 'cloud' || !user?.id) return;
    const isDirty = JSON.stringify(data) !== syncedJsonRef.current;
    try { saveCloudCache(user.id, data, revisionRef.current, isDirty); }
    catch (error) { console.error(error); notify?.('บันทึกสำเนาข้อมูลในเครื่องไม่สำเร็จ'); }
    if (!isDirty || blockedRef.current) return;
    setSyncStatus(prev => prev === 'offline' ? 'offline' : 'pending');
    const timer = setTimeout(() => flush(), 850);
    return () => clearTimeout(timer);
  }, [data, mode, user?.id, flush, notify]);

  const refresh = useCallback(async () => {
    if (modeRef.current !== 'cloud' || !userRef.current) return;
    if (JSON.stringify(dataRef.current) !== syncedJsonRef.current) { await flush(); return; }
    const accountId = userRef.current.id;
    setSyncStatus('syncing');
    try {
      const remote = await readCloud(accountId);
      if (modeRef.current !== 'cloud' || userRef.current?.id !== accountId) return;
      if ((remote?.revision ?? null) !== revisionRef.current) {
        initializeDocument(remote?.data ?? createEmptyData(), remote?.revision ?? null);
        saveCloudCache(accountId, remote?.data ?? createEmptyData(), remote?.revision ?? null, false);
        notify?.('โหลดข้อมูลออนไลน์ล่าสุดแล้ว');
      } else setSyncStatus('synced');
    } catch (error) { console.error(error); setSyncStatus('offline'); notify?.('ยังโหลดข้อมูลออนไลน์ไม่ได้ ตรวจสอบอินเทอร์เน็ต'); }
  }, [flush, initializeDocument, notify]);
  useEffect(() => {
    const onOnline = () => { if (modeRef.current === 'cloud') refresh(); };
    const onFocus = () => { if (modeRef.current === 'cloud') refresh(); };
    window.addEventListener('online', onOnline);
    window.addEventListener('focus', onFocus);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('focus', onFocus); };
  }, [refresh]);

  const resolveChoice = useCallback(async useLocal => {
    if (!choice || !user) return;
    const { remote, local } = choice;
    setChoice(null);
    if (useLocal) {
      initializeDocument(local, remote?.revision ?? null, true);
      notify?.('ย้ายข้อมูลจากเครื่องนี้แล้ว กำลังส่งขึ้นออนไลน์');
    } else {
      initializeDocument(remote?.data ?? createEmptyData(), remote?.revision ?? null);
      saveCloudCache(user.id, remote?.data ?? createEmptyData(), remote?.revision ?? null, false);
    }
  }, [choice, user, initializeDocument, notify]);

  const resolveConflict = useCallback(async useLocal => {
    if (!conflict || !user) return;
    const { remote, local } = conflict;
    setConflict(null);
    blockedRef.current = false;
    if (useLocal) initializeDocument(local, remote?.revision ?? null, true);
    else {
      initializeDocument(remote?.data ?? createEmptyData(), remote?.revision ?? null);
      saveCloudCache(user.id, remote?.data ?? createEmptyData(), remote?.revision ?? null, false);
    }
  }, [conflict, user, initializeDocument]);

  const logout = useCallback(async () => {
    if (modeRef.current === 'cloud' && JSON.stringify(dataRef.current) !== syncedJsonRef.current) {
      if (!window.confirm('ข้อมูลบัญชีบางส่วนอาจยังไม่ซิงก์ ข้อมูลสำเนาจะยังอยู่ในเครื่องนี้ ยืนยันออกจากระบบ?')) return;
    }
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) { notify?.('ออกจากระบบไม่สำเร็จ: ' + error.message); return; }
    }
    enterGuest();
  }, [enterGuest, notify]);

  return {
    data, setData, mode, user, syncStatus, loadError, choice, conflict,
    enterGuest, refresh, logout, resolveChoice, resolveConflict,
    authenticated: user => { if (user) setUser(prev => same(prev,user)?prev:user); },
    retryLoad: () => { if(user) loadAccount(user); },
  };
}
