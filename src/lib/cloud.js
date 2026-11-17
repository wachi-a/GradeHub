/**
 * Cloud persistence for GradeHub.
 * No Supabase project secrets belong here. The publishable/anon key is designed
 * to be shipped with browser clients; RLS is the actual access boundary.
 */
import { createClient } from '@supabase/supabase-js';
import { createEmptyData } from './grades.js';
import { normalizeData, isValidData, STORAGE_KEY } from './storage.js';
import { hasAnyGradeHubData } from './calculator.js';

const url = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
const publishableKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim();
export const cloudConfigured = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url) &&
  publishableKey.length > 15 && !publishableKey.includes('YOUR_');
export const supabase = cloudConfigured
  ? createClient(url, publishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;
export const ENTRY_KEY = 'gradehub.entry.mode.v1';

export const hasAnyData = hasAnyGradeHubData;
export const cacheKey = id => `gradehub.account.cache.v1.${id}`;

export function loadCloudCache(userId) {
  if (!userId) return null;
  try {
    const saved = JSON.parse(localStorage.getItem(cacheKey(userId)) || 'null');
    if (!saved || !isValidData(saved.data)) return null;
    return { data: normalizeData(saved.data), revision: saved.revision ?? null, pending: Boolean(saved.pending) };
  } catch (error) { console.error('GradeHub cached account read failed', error); return null; }
}

export function saveCloudCache(userId, data, revision, pending) {
  if (!userId || !isValidData(data)) throw new Error('ข้อมูลบัญชีไม่ถูกต้อง');
  localStorage.setItem(cacheKey(userId), JSON.stringify({ data, revision: revision ?? null, pending: Boolean(pending) }));
}

export function archiveGuestData(data, userId) {
  if (!hasAnyData(data)) return;
  // Archive a recoverable local snapshot before removing the active guest data.
  // Keep one backup per account rather than filling localStorage on every login.
  const key = `gradehub.guest.migrated.backup.${userId}`;
  if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ movedAt: new Date().toISOString(), data }));
}

export async function readCloud(userId) {
  if (!supabase) throw new Error('ยังไม่ได้ตั้งค่า Supabase');
  const { data, error } = await supabase.from('gradehub_documents')
    .select('document, revision').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (!isValidData(data.document)) throw new Error('ข้อมูลออนไลน์ไม่ใช่เอกสาร GradeHub ที่รองรับ กรุณาสำรองและตรวจสอบข้อมูล');
  return { data: normalizeData(data.document), revision: Number(data.revision) };
}

/**
 * Atomic optimistic concurrency: UPDATE ... WHERE revision=<expected>.
 * A second device cannot silently overwrite a newer revision.
 * Returns {conflict:true} instead of overwriting.
 */
export async function writeCloud(userId, data, expectedRevision) {
  if (!supabase) throw new Error('ยังไม่ได้ตั้งค่า Supabase');
  if (!isValidData(data)) throw new Error('ข้อมูลที่จะบันทึกไม่ถูกต้อง');
  if (expectedRevision == null) {
    const { data: inserted, error } = await supabase.from('gradehub_documents')
      .insert({ user_id: userId, document: data, revision: 1 }).select('revision').maybeSingle();
    if (error?.code === '23505') return { conflict: true };
    if (error) throw error;
    return { revision: Number(inserted?.revision ?? 1), conflict: false };
  }
  const next = Number(expectedRevision) + 1;
  const { data: saved, error } = await supabase.from('gradehub_documents')
    .update({ document: data, revision: next, updated_at: new Date().toISOString() })
    .eq('user_id', userId).eq('revision', Number(expectedRevision))
    .select('revision').maybeSingle();
  if (error) throw error;
  if (!saved) return { conflict: true };
  return { revision: Number(saved.revision), conflict: false };
}

/** Preserve the original guest key for old versions, until migration has
 * actually been acknowledged by the cloud database. */
export { STORAGE_KEY };
export function emptyDocument() { return createEmptyData(); }
