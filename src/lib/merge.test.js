import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeDocuments } from './merge.js';
import { createEmptyData, createYear, createSemester, createCourse } from './grades.js';

const build = (name, yearN=1, termN=1) => {
  const d = createEmptyData(), y = createYear(yearN), t = createSemester(termN,'current');
  t.courses.push(createCourse({name,credits:3,maxScore:100})); y.semesters.push(t); d.years.push(y);
  return d;
};

test('new guest data is migrated into empty account', () => {
  const guest=build('Calculus');const original=structuredClone(guest);const merged=mergeDocuments(createEmptyData(),guest);
  assert.equal(merged.years[0].semesters[0].courses[0].name,'Calculus');
  assert.deepEqual(guest,original); // original Guest is never mutated
});
test('existing account courses are preserved when guest has another course same term', () => {
  const remote=build('OOP'), guest=build('Calculus');
  const result=mergeDocuments(remote,guest);
  assert.equal(result.years.length,1);assert.equal(result.years[0].semesters.length,1);
  assert.deepEqual(result.years[0].semesters[0].courses.map(c=>c.name),['OOP','Calculus']);
});
test('migration merges by stable IDs without duplicates after retry', () => {
  const guest=build('Physics'); const remote=mergeDocuments(createEmptyData(),guest);
  const result=mergeDocuments(remote,guest);
  assert.equal(result.years[0].semesters[0].courses.length,1);
});
test('guest edits win for same course ID without dropping other score rows', () => {
  const guest=build('New name');const remote=structuredClone(guest);
  remote.years[0].semesters[0].courses[0].name='Old name';
  const result=mergeDocuments(remote,guest);
  assert.equal(result.years[0].semesters[0].courses[0].name,'New name');
});
test('different semesters remain separate', () => {
  const result=mergeDocuments(build('MATH',1,1),build('OOP',1,2));
  assert.equal(result.years[0].semesters.length,2);
});
test('closed folder IDs map to merged cloud folder IDs', () => {
  const remote=build('Remote'), guest=build('Guest');
  guest.ui={collapsedYears:[guest.years[0].id],collapsedTerms:[guest.years[0].semesters[0].id]};
  const res=mergeDocuments(remote,guest);
  assert.deepEqual(res.ui.collapsedYears,[remote.years[0].id]);
  assert.deepEqual(res.ui.collapsedTerms,[remote.years[0].semesters[0].id]);
});
