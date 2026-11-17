import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyData, createCourse, createYear, createSemester, gradeForScore, evaluateCourse, semesterStats, cumulativeStats, yearStats, projectGoal, reorderAssessments } from './grades.js';

test('Grade boundaries align with screenshot; decimal grades supported', () => {
  const cases = [[100,'A'],[80,'A'],[79.99,'B+'],[75,'B+'],[70,'B'],[65,'C+'],[60,'C'],[55,'D+'],[50,'D'],[49.99,'F'],[0,'F']];
  cases.forEach(([score, letter]) => assert.equal(gradeForScore(score), letter));
});

test('Incomplete scores are never silently treated as final grades', () => {
  const course = createCourse({ name: 'Example', credits: 3 });
  course.assessments = [
    { id: '1', label: 'Quiz', maxPoints: 30, earned: '24', status: 'green' },
    { id: '2', label: 'Final', maxPoints: 70, earned: '', status: 'red' },
  ];
  assert.equal(evaluateCourse(course).isFinal, false);
  course.assessments[1].earned = '56';
  assert.equal(evaluateCourse(course).grade, 'A');
  assert.equal(evaluateCourse(course).isFinal, true);
});

test('Weighted GPA includes F but excludes unfinished courses', () => {
  const a = createCourse({ name: 'A', credits: 3, gradingMode: 'manual', manualGrade: 'A' });
  const f = createCourse({ name: 'F', credits: 1, gradingMode: 'manual', manualGrade: 'F' });
  const pending = createCourse({ name: 'Pending', credits: 4 });
  const term = createSemester(1, 'completed'); term.courses = [a, f, pending];
  const stats = semesterStats(term);
  assert.equal(stats.gradedCredits, 4);
  assert.equal(stats.credits, 8);
  assert.equal(stats.gpa, 3);
  assert.equal(stats.passed, 1);
  assert.equal(stats.failed, 1);
  assert.equal(stats.pending, 1);
  const year = createYear(1); year.semesters = [term];
  assert.equal(cumulativeStats({version:1, years:[year]}).gpa, 3);
});

test('Destination rejects past and impossible goals', () => {
  const year = createYear(1);
  const sem = createSemester(1, 'current');
  sem.courses = [createCourse({ name: 'X', credits: 3, gradingMode: 'manual', manualGrade: 'F' })];
  year.semesters = [sem];
  const data = {version:1,years:[year]};
  assert.ok(projectGoal(data, 3.5, 1, 1).error);
  const projected = projectGoal(data, 3.5, 2, 2, 20);
  assert.equal(projected.completedCredits, 3);
  assert.equal(projected.passedCredits, 0);
  assert.equal(projected.remainingCredits, 60);
  assert.equal(projected.requiredGpa, 3.675);
  assert.equal(projected.possible, true);
});

test('Destination caps projection at programme credit limit', () => {
  const data = {version:1,years:[]};
  const result = projectGoal(data, 3.5, 5, 2, 25);
  assert.equal(result.totalByTarget, 129);
  assert.equal(result.remainingCredits, 129);
});

test('Failed credits never count as earned graduation credits', () => {
  const course = createCourse({name:'Retake', credits:3, gradingMode:'manual', manualGrade:'F'});
  const sem=createSemester(1,'completed');sem.courses=[course];
  const year=createYear(1);year.semesters=[sem];
  const data={version:1,years:[year]};
  const stats=cumulativeStats(data);
  assert.equal(stats.gradedCredits,3);
  assert.equal(stats.passedCredits,0);
  assert.equal(projectGoal(data,3,6,2,25).remainingCredits,129);
});

test('Optional screenshot-like sample shows a 2.88 GPA with 12 credits', async () => {
 const {makeSampleData}=await import('./grades.js');
 const stats=cumulativeStats(makeSampleData());
 assert.equal(stats.gpa,2.875);
 assert.equal(stats.gradedCredits,12);
 assert.equal(stats.passed,4);
 assert.equal(stats.failed,0);
});

test('Group-based grading remains pending until an actual grade is announced', () => {
 const grouped = createCourse({name:'Probability', credits:3, gradingMode:'group', groupGrade:'', groupCutoffA:80, groupCutoffF:40, classMeanGpa:2.85});
 grouped.assessments = [{ id:'mid', label:'Midterm', maxPoints:100, earned:'96', status:'green' }];
 assert.equal(evaluateCourse(grouped).grade,null);
 assert.equal(evaluateCourse(grouped).isFinal,false);
 grouped.groupGrade='B+';
 assert.equal(evaluateCourse(grouped).grade,'B+');
 assert.equal(evaluateCourse(grouped).points,3.5);
 grouped.groupStats.midterm.mean='51.2';
 grouped.groupCutoffA=20;
 assert.equal(evaluateCourse(grouped).grade,'B+');
});

test('Assessment ordering handles upward/downward drops immutably', () => {
 const scores=[{id:'a'},{id:'b'},{id:'c'}];
 assert.deepEqual(reorderAssessments(scores,'c','a').map(x=>x.id),['c','a','b']);
 assert.deepEqual(reorderAssessments(scores,'a','c').map(x=>x.id),['b','c','a']);
 assert.equal(scores[0].id,'a');
 assert.equal(reorderAssessments(scores,'a','missing'),scores);
});

test('Awarded bonus is included in score and can move a complete course into the next grade', () => {
  const course = createCourse({ name:'Physics', credits:3, maxScore:100, bonusBreakdown:'+1+2+1+5', bonusPoints:'4' });
  course.assessments = [
    { id:'m', label:'Midterm', maxPoints:30, earned:'24', status:'green' },
    { id:'f', label:'Final', maxPoints:70, earned:'52', status:'green' },
  ];
  const info = evaluateCourse(course);
  assert.equal(info.assessmentEarned, 76);
  assert.equal(info.bonusPoints, 4);
  assert.equal(info.earned, 80);
  assert.equal(info.grade, 'A');
  assert.equal(info.isFinal, true);
});

test('Bonus notes alone do not add points; incomplete course never gets a final grade', () => {
  const course = createCourse({ name:'Chemistry', credits:3, bonusBreakdown:'+1+2+1+5', bonusPoints:'' });
  assert.equal(evaluateCourse(course).earned, 0);
  course.bonusPoints='5';
  assert.equal(evaluateCourse(course).earned, 5);
  assert.equal(evaluateCourse(course).isFinal, false);
  course.assessments=[{id:'m',label:'Midterm',maxPoints:100,earned:'99',status:'green'}];
  const result = evaluateCourse(course);
  assert.equal(result.earned, 104);
  assert.equal(result.grade, 'A');
  assert.equal(result.percentage, 100);
});

test('Absolute grade thresholds: 80 points out of 120 is A, not 96', () => {
  assert.equal(gradeForScore(80, 120), 'A');
  assert.equal(gradeForScore(79.99, 120), 'B+');
  assert.equal(gradeForScore(75, 120), 'B+');
  assert.equal(gradeForScore(70, 120), 'B');
  const course=createCourse({name:'120-point course',credits:3,maxScore:120});
  course.assessments=[
    {id:'m',label:'Midterm',maxPoints:30,earned:'20'},
    {id:'f',label:'Final',maxPoints:90,earned:'60'},
  ];
  assert.equal(evaluateCourse(course).grade, 'A');
  assert.equal(evaluateCourse(course).totalAllocated,120);
});

test('Inline Bonus adds earned points but does not take up normal score allocation', () => {
  const course=createCourse({name:'Bonus demo',credits:3,maxScore:120});
  course.assessments=[
    {id:'m',label:'Midterm',maxPoints:30,earned:'20'},
    {id:'bonus',type:'bonus',label:'Bonus',breakdown:'+1+2',earned:'5',status:'green'},
    {id:'f',label:'Final',maxPoints:90,earned:''},
  ];
  let stats=evaluateCourse(course);
  assert.equal(stats.totalAllocated,120);
  assert.equal(stats.earned,25);
  assert.equal(stats.isFinal,false);
  course.assessments[2].earned='55';
  stats=evaluateCourse(course);
  assert.equal(stats.grade,'A');
  assert.equal(stats.earned,80);
  assert.equal(stats.bonusPoints,5);
  const reordered=reorderAssessments(course.assessments,'bonus','m');
  assert.deepEqual(reordered.map(x=>x.id),['bonus','m','f']);
});


test('Year GPA combines graded credit weights; excludes pending course grades', async () => {
  const {yearStats} = await import('./grades.js');
  const year = createYear(1);
  const s1 = createSemester(1,'completed');
  s1.courses=[createCourse({name:'A',credits:3,gradingMode:'manual',manualGrade:'A'})];
  const s2 = createSemester(2,'current');
  s2.courses=[createCourse({name:'B',credits:1,gradingMode:'manual',manualGrade:'B'}),createCourse({name:'Waiting',credits:3,gradingMode:'group',groupGrade:''})];
  year.semesters=[s1,s2];
  assert.equal(yearStats(year).gpa,3.75);
  assert.equal(yearStats(year).gradedCredits,4);
});

test('Inline grouped-exam stats keep original keys and never change GPA', async () => {
  const {examKeyForAssessment, GROUP_EXAM_FIELDS} = await import('./grades.js');
  assert.equal(examKeyForAssessment({label:'Midterm'}),'midterm');
  assert.equal(examKeyForAssessment({label:'สอบปลายภาค'}),'final');
  assert.equal(examKeyForAssessment({label:'Quiz'}),null);
  assert.equal(examKeyForAssessment({label:'Bonus',type:'bonus'}),null);
  assert.deepEqual(GROUP_EXAM_FIELDS.map(x=>x.key), ['min','max','mean','sd','n']);
  const course=createCourse({name:'Group Stats',credits:3,gradingMode:'group',groupGrade:''});
  course.groupStats.midterm={min:'1',max:'29',mean:'20',sd:'3',n:'45',median:'18'};
  assert.equal(evaluateCourse(course).isFinal,false);
  course.groupGrade='B+';
  assert.equal(evaluateCourse(course).points,3.5);
});

test('excluding a term removes it from cumulative GPA and completed credits while retaining its own GPA', () => {
  const document = createEmptyData(), year = createYear(1);
  const first = createSemester(1,'completed'), second = createSemester(2,'completed');
  first.courses.push(createCourse({name:'First',credits:3,gradingMode:'manual',manualGrade:'A'}));
  second.courses.push(createCourse({name:'Second',credits:3,gradingMode:'manual',manualGrade:'D'}));
  year.semesters.push(first,second); document.years.push(year);
  assert.equal(first.includeInGpa,true);
  assert.equal(cumulativeStats(document).gpa,2.5);
  second.includeInGpa = false;
  assert.equal(cumulativeStats(document).gpa,4);
  assert.equal(cumulativeStats(document).passedCredits,6);
  assert.equal(yearStats(year).gpa,4);
  assert.equal(semesterStats(second).gpa,1);
});
