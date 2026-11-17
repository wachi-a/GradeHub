import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyData, semesterStats, createYear, createSemester, createCourse } from './grades.js';
import { calculatorRows, calculateDraftGpa, mergeCalculatorDrafts, hasCalculatorInputs, hasAnyGradeHubData, NEW_ROW_ID } from './calculator.js';
import { mergeDocuments } from './merge.js';
import { normalizeData, isValidData } from './storage.js';

const row=(id, name,credits,score)=>({id,name,credits,score});

test('calculator uses the default 100-point grade thresholds including edges',()=>{
  const rows=[row('a','Calculus','3','80'),row('b','OOP','2','75'),row('c','Physics','1','49.99')];
  const res=calculateDraftGpa(rows);
  assert.deepEqual(res.details.map(d=>d.letter),['A','B+','F']);
  assert.equal(res.totalCredits,6);
  assert.equal(res.gpa,(3*4+2*3.5+1*0)/6);
});
test('missing values excluded but zero is a valid F score',()=>{
  const res=calculateDraftGpa([row('a','Science','2','0'),row('b','','3','90'),row('c','Music','3','')]);
  assert.equal(res.included,1);
  assert.equal(res.incomplete,2);
  assert.equal(res.gpa,0);
});
test('does not accept scores outside 0-100 or missing/zero credits',()=>{
  const res=calculateDraftGpa([row('a','A','3','101'),row('b','B','0','80'),row('c','C','2','-1')]);
  assert.equal(res.gpa,null);
  assert.equal(res.included,0);
});
test('a calculator entry is independent of semester GPA',()=>{
  const d=createEmptyData(),y=createYear(1),s=createSemester(1,'completed');
  s.courses.push(createCourse({name:'Actual',credits:3,maxScore:100,gradingMode:'manual',manualGrade:'B'}));y.semesters.push(s);d.years.push(y);
  const before=semesterStats(s).gpa;
  d.calculatorDraft={rows:[row('scratch','Test Subject','12','100')]};
  assert.equal(semesterStats(d.years[0].semesters[0]).gpa,before);
  assert.equal(before,3);
});
test('only scratch data counts for automatic guest migration',()=>{
  const d=createEmptyData(); d.calculatorDraft={rows:[row('scratch','My Subject','3','89')]};
  assert.equal(hasCalculatorInputs(d),true);
  assert.equal(hasAnyGradeHubData(d),true);
  assert.equal(hasAnyGradeHubData(createEmptyData()),false);
  assert.equal(hasAnyGradeHubData({version:1,years:[],calculatorDraft:{rows:[row(NEW_ROW_ID,'','','')]}}),false);
});
test('guest scratchpad is preserved on first login even without course years',()=>{
  const guest=createEmptyData();guest.calculatorDraft={rows:[row(NEW_ROW_ID,'Test','3','83')]};
  const merged=mergeDocuments(createEmptyData(),guest);
  assert.deepEqual(calculatorRows(merged),calculatorRows(guest));
});
test('existing cloud draft and guest draft combine without losing either',()=>{
  const online=createEmptyData(), guest=createEmptyData();
  online.calculatorDraft={rows:[row(NEW_ROW_ID,'Cloud Subject','3','90')]};
  guest.calculatorDraft={rows:[row(NEW_ROW_ID,'Guest Subject','4','81')]};
  const merged=mergeDocuments(online,guest);
  assert.equal(calculatorRows(merged).length,2);
  assert.deepEqual(calculatorRows(merged).map(r=>r.name),['Cloud Subject','Guest Subject']);
});
test('calculator data survives existing v1 schema and normalize',()=>{
  const d=createEmptyData();d.calculatorDraft={rows:[row('1','Math','3','77')]};
  assert.equal(isValidData(d),true);
  assert.deepEqual(normalizeData(d).calculatorDraft,d.calculatorDraft);
});
test('clear scratchpad leaves real Courses untouched',()=>{
  const d=createEmptyData(), y=createYear(1);y.semesters.push(createSemester(1,'current'));d.years.push(y);
  d.calculatorDraft={rows:[row('1','Math','3','77')]};
  d.calculatorDraft={rows:[]};
  assert.equal(d.years.length,1);
  assert.equal(calculatorRows(d).length,0);
});

test('guest/cloud starter conflict is idempotent across retries',()=>{
  const cloud=createEmptyData(), guest=createEmptyData();
  cloud.calculatorDraft={rows:[row(NEW_ROW_ID,'Online','3','78')]};
  guest.calculatorDraft={rows:[row(NEW_ROW_ID,'Guest','2','88')]};
  const first=mergeDocuments(cloud,guest);
  const twice=mergeDocuments(first,guest);
  assert.deepEqual(calculatorRows(twice),calculatorRows(first));
});
