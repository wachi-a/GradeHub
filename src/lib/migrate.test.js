import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateGuestToAccount } from './migrate.js';
import { createEmptyData, createYear, createSemester, createCourse } from './grades.js';

function sample(name) {
  const doc = createEmptyData(); const y = createYear(1);const sem=createSemester(1,'current');
  sem.courses.push(createCourse({name,credits:3,maxScore:100}));y.semesters.push(sem);doc.years.push(y);return doc;
}

test('guest migration uploads full guest data and returns saved revision', async () => {
  const guest=sample('Calculus');const saves=[];
  const result=await migrateGuestToAccount({
    userId:'u1',guest,initialRemote:null,
    read:async()=>null,write:async (...args)=>{saves.push(args);return {revision:1,conflict:false};},
  });
  assert.equal(result.revision,1);assert.equal(saves.length,1);
  assert.equal(result.document.years[0].semesters[0].courses[0].name,'Calculus');
});
test('conflicting cloud revision re-reads and preserves both cloud + guest courses', async () => {
  const guest=sample('Guest'),remote=sample('Online');let calls=0;
  const result=await migrateGuestToAccount({
    userId:'u1',guest,initialRemote:{data:remote,revision:1},
    read:async()=>({data:remote,revision:2}),
    write:async(_id,document,revision)=>{
      calls++;
      if(calls===1){assert.equal(revision,1);return {conflict:true};}
      assert.equal(revision,2);
      assert.deepEqual(document.years[0].semesters[0].courses.map(c=>c.name),['Online','Guest']);
      return {conflict:false,revision:3};
    },
  });
  assert.equal(calls,2);assert.equal(result.revision,3);
});
test('write failure does not clear the source guest document', async () => {
  const guest=sample('Guest');const before=structuredClone(guest);
  await assert.rejects(migrateGuestToAccount({
    userId:'u1',guest,initialRemote:null,read:async()=>null,
    write:async()=>{throw new Error('offline');},
  }), /offline/);
  assert.deepEqual(guest,before);
});
test('abandoned account switch prevents a commit attempt', async () => {
  let wrote=false;
  const result=await migrateGuestToAccount({userId:'u1',guest:sample('Guest'),initialRemote:null,
    isCurrent:()=>false,read:async()=>null,write:async()=>{wrote=true;return {revision:1};}});
  assert.equal(result.aborted,true);assert.equal(wrote,false);
});
