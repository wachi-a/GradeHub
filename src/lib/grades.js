// Gradeculator grading and projection rules. No UI dependency: easy to test and
// replace the persistence layer when the Android app is packaged.

export const DEFAULT_SCALE = [
  { letter: 'A', min: 80, point: 4.0 },
  { letter: 'B+', min: 75, point: 3.5 },
  { letter: 'B', min: 70, point: 3.0 },
  { letter: 'C+', min: 65, point: 2.5 },
  { letter: 'C', min: 60, point: 2.0 },
  { letter: 'D+', min: 55, point: 1.5 },
  { letter: 'D', min: 50, point: 1.0 },
  { letter: 'F', min: 0, point: 0.0 },
];

export const GRADE_LETTERS = DEFAULT_SCALE.map(item => item.letter);
export const CREDIT_GOAL = 129;
export const DEFAULT_FUTURE_CREDITS = 21;
// Reuse original storage keys (mean/sd/min/max/n) so older backups remain compatible.
export const GROUP_EXAM_FIELDS = [
  { key: 'min', label: 'Min' },
  { key: 'max', label: 'Max' },
  { key: 'mean', label: 'Avg' },
  { key: 'sd', label: 'Std' },
  { key: 'n', label: 'N' },
];

/** Link an optional exam score row to its existing saved stats bucket. */
export function examKeyForAssessment(assessment) {
  if (!assessment || assessment.type === 'bonus') return null;
  const name = String(assessment.label ?? '').trim();
  if (/mid[\s-]?term|กลางภาค/i.test(name)) return 'midterm';
  if (/final|ปลายภาค/i.test(name)) return 'final';
  return null;
}

export const makeEmptyExamStats = () => ({mean:'',median:'',sd:'',min:'',max:'',n:''});

/** Move an assessment to the location of another. Does not mutate the input. */
export function reorderAssessments(items, fromId, toId) {
  const from = items.findIndex(item => item.id === fromId);
  const to = items.findIndex(item => item.id === toId);
  if (from < 0 || to < 0 || from === to) return items;
  const copy = [...items];
  const [moved] = copy.splice(from, 1);
  copy.splice(to, 0, moved);
  return copy;
}


export const uid = () =>
  (globalThis.crypto?.randomUUID?.() ?? `gh-${Date.now()}-${Math.random().toString(36).slice(2)}`);

export function createEmptyData() {
  return { version: 1, years: [] };
}

export function createYear(number) {
  return { id: uid(), number: Number(number), semesters: [] };
}

export function createSemester(number, status = 'planned') {
  return { id: uid(), number: Number(number), status, includeInGpa: true, courses: [] };
}

export function createCourse({ name, code = '', credits, maxScore = 100, gradingMode = 'automatic', manualGrade = 'A', groupGrade = '', groupCutoffA = '', groupCutoffF = '', classMeanGpa = '', groupStats = null, scale = DEFAULT_SCALE, bonusBreakdown = '', bonusPoints = '' }) {
  return {
    id: uid(), name: String(name).trim(), code: String(code).trim(),
    credits: Number(credits), maxScore: Number(maxScore),
    gradingMode, manualGrade, groupGrade, groupCutoffA, groupCutoffF, classMeanGpa, bonusBreakdown, bonusPoints,
    groupStats: groupStats ?? { midterm: makeEmptyExamStats(), final: makeEmptyExamStats() },
    scale: scale.map(row => ({ ...row })), assessments: [],
  };
}

export function gradeForScore(score, fullScore = 100, scale = DEFAULT_SCALE) {
  if (!Number.isFinite(Number(score)) || !Number.isFinite(Number(fullScore)) || Number(fullScore) <= 0 || Number(score) < 0 || Number(score) > Number(fullScore)) return null;
  // Grade thresholds are absolute raw points, not percentages.
  const matched = [...scale].sort((a, b) => Number(b.min) - Number(a.min))
    .find(row => Number(score) + 1e-9 >= Number(row.min));
  return matched?.letter ?? 'F';
}

export function evaluateCourse(course) {
  const assessments = course.assessments ?? [];
  const scored = assessments.filter(item => item.type !== 'bonus');
  const bonuses = assessments.filter(item => item.type === 'bonus');
  const maxScore = Number(course.maxScore);
  const totalAllocated = scored.reduce((sum, item) => sum + Number(item.maxPoints || 0), 0);
  const assessmentEarned = scored.reduce((sum, item) => sum + (item.earned === '' || item.earned === null || item.earned === undefined ? 0 : Number(item.earned)), 0);
  // Legacy v1.4 fields still work until backup data is migrated to a bonus row.
  const hasBonusRow = bonuses.length > 0;
  const legacyBonus = hasBonusRow || course.bonusPoints === '' || course.bonusPoints == null ? 0 : Number(course.bonusPoints);
  const bonusPoints = bonuses.reduce((sum, item) => sum + (item.earned === '' || item.earned == null ? 0 : Number(item.earned)), 0) + legacyBonus;
  const earned = assessmentEarned + bonusPoints;
  const anyRecorded = scored.some(item => item.earned !== '' && item.earned !== null && item.earned !== undefined);
  const allRecorded = scored.length > 0 && scored.every(item => item.earned !== '' && item.earned !== null && item.earned !== undefined && Number.isFinite(Number(item.earned)) && Number(item.earned) >= 0 && Number(item.earned) <= Number(item.maxPoints));
  const allocationMatches = Math.abs(totalAllocated - maxScore) < 1e-7;
  const validBonuses = bonuses.every(item => item.earned === '' || item.earned == null || (Number.isFinite(Number(item.earned)) && Number(item.earned) >= 0));
  const validValues = validBonuses && Number.isFinite(earned) && Number.isFinite(bonusPoints) && bonusPoints >= 0 && Number.isFinite(totalAllocated) && Number.isFinite(maxScore) && maxScore > 0 && totalAllocated <= maxScore + 1e-7;
  const isManual = course.gradingMode === 'manual';
  const isGrouped = course.gradingMode === 'group';
  const isFinal = isManual ? GRADE_LETTERS.includes(course.manualGrade)
    : isGrouped ? GRADE_LETTERS.includes(course.groupGrade)
    : allRecorded && allocationMatches && validValues;
  const grade = !isFinal ? null : isManual ? course.manualGrade
    : isGrouped ? course.groupGrade
    : gradeForScore(Math.min(maxScore, earned), maxScore, course.scale ?? DEFAULT_SCALE);
  const points = grade === null ? null : DEFAULT_SCALE.find(row => row.letter === grade)?.point ?? null;
  return { totalAllocated, assessmentEarned, bonusPoints, earned, anyRecorded, allRecorded, allocationMatches, isFinal: Boolean(isFinal && grade !== null), grade, points, percentage: validValues ? Math.min(100, earned / maxScore * 100) : 0 };
}

export function semesterStats(semester) {
  const courses = semester.courses ?? [];
  const credits = courses.reduce((sum, course) => sum + Number(course.credits || 0), 0);
  const finals = courses.map(course => ({ course, evaluation: evaluateCourse(course) })).filter(x => x.evaluation.isFinal);
  const gradedCredits = finals.reduce((sum, x) => sum + Number(x.course.credits), 0);
  const weighted = finals.reduce((sum, x) => sum + Number(x.course.credits) * x.evaluation.points, 0);
  return {
    credits, gradedCredits, weighted,
    gpa: gradedCredits > 0 ? weighted / gradedCredits : null,
    passed: finals.filter(x => x.evaluation.grade !== 'F').length,
    failed: finals.filter(x => x.evaluation.grade === 'F').length,
    total: courses.length,
    pending: courses.length - finals.length,
  };
}

/** Year GPA is weighted by graded credits across the year's semesters, not a mean of term GPAs. */
export function yearStats(year) {
  const terms = (year?.semesters ?? []).filter(semester => semester.includeInGpa !== false).map(semesterStats);
  const gradedCredits = terms.reduce((sum, term) => sum + term.gradedCredits, 0);
  const weighted = terms.reduce((sum, term) => sum + term.weighted, 0);
  return { gradedCredits, weighted, gpa: gradedCredits ? weighted / gradedCredits : null };
}

export function allSemesters(data) {
  return (data.years ?? [])
    .flatMap(year => (year.semesters ?? []).map(semester => ({ year, semester, order: termOrder(year.number, semester.number) })))
    .sort((a, b) => a.order - b.order);
}

export function cumulativeStats(data) {
  const terms = allSemesters(data);
  const stats = terms.map(({ semester }) => semesterStats(semester));
  const includedTerms = terms.filter(({ semester }) => semester.includeInGpa !== false);
  const includedStats = includedTerms.map(({ semester }) => semesterStats(semester));
  const gradedCredits = includedStats.reduce((sum, x) => sum + x.gradedCredits, 0);
  const weighted = includedStats.reduce((sum, x) => sum + x.weighted, 0);
  return {
    gpa: gradedCredits ? weighted / gradedCredits : null,
    gradedCredits,
    passedCredits: includedTerms.reduce((sum, {semester}) => sum + semester.courses.reduce((acc,c) => { const evaled=evaluateCourse(c); return acc + (evaled.isFinal && evaled.grade !== 'F' ? Number(c.credits) : 0); }, 0), 0),
    credits: stats.reduce((sum, x) => sum + x.credits, 0),
    weighted,
    passed: stats.reduce((sum, x) => sum + x.passed, 0),
    failed: stats.reduce((sum, x) => sum + x.failed, 0),
    pending: stats.reduce((sum, x) => sum + x.pending, 0),
    total: stats.reduce((sum, x) => sum + x.total, 0),
  };
}

export function termOrder(year, term) {
  return (Number(year) - 1) * 2 + Number(term);
}

export function lastCurrentTermOrder(data) {
  const terms = allSemesters(data);
  const known = terms.filter(({ semester }) => semester.status === 'current' || semester.status === 'completed');
  return known.length ? Math.max(...known.map(x => x.order)) : 0;
}

/**
 * Planning assumptions:
 * - All already-final grades (including F) contribute to GPA.
 * - Incomplete registered courses are future grade-bearing credits.
 * - For each future semester up to the target, use registered planned credits
 *   when present; otherwise use the selected estimated credits/semester.
 * - Cap estimated credits so the projection does not exceed 129 programme credits.
 * - A target must be AFTER the most recent current/completed semester.
 */
export function projectGoal(data, targetGpa, year, term, estimatedPerTerm = DEFAULT_FUTURE_CREDITS) {
  const target = Number(targetGpa);
  const destinationOrder = termOrder(year, term);
  const boundary = lastCurrentTermOrder(data);
  if (!Number.isFinite(target) || target < 0 || target > 4) return { error: 'กรุณาใส่ GPA เป้าหมายระหว่าง 0.00–4.00' };
  if (!Number.isInteger(destinationOrder) || ![1, 2].includes(Number(term)) || Number(year) < 1 || destinationOrder <= boundary) return { error: 'เลือกเทอมที่อยู่หลังเทอมปัจจุบันเท่านั้น' };
  if (!Number.isFinite(Number(estimatedPerTerm)) || Number(estimatedPerTerm) < 18 || Number(estimatedPerTerm) > 25) return { error: 'หน่วยกิตประมาณการต่อเทอมต้องอยู่ระหว่าง 18–25' };
  const overall = cumulativeStats(data);
  const futureRegistered = allSemesters(data).filter(t => t.order > boundary && t.order <= destinationOrder);
  const pendingCurrentCredits = allSemesters(data).filter(t => t.order <= boundary).reduce((sum, { semester }) =>
    sum + (semester.courses ?? []).reduce((acc, c) => acc + (evaluateCourse(c).isFinal ? 0 : Number(c.credits)), 0), 0);
  // Failed credits affect GPA but do not count as credits earned toward graduation.
  const gradeCapacity = Math.max(0, CREDIT_GOAL - overall.passedCredits);
  let expectedFuture = Math.min(pendingCurrentCredits, gradeCapacity);
  const schedule = [];
  for (let order = boundary + 1; order <= destinationOrder; order++) {
    const record = futureRegistered.find(t => t.order === order);
    const plannedCredits = record ? record.semester.courses.reduce((sum, course) => sum + Number(course.credits || 0), 0) : 0;
    const expected = plannedCredits > 0 ? plannedCredits : Number(estimatedPerTerm);
    const canAdd = Math.max(0, gradeCapacity - expectedFuture);
    const applied = Math.min(canAdd, expected);
    expectedFuture += applied;
    schedule.push({ year: Math.ceil(order / 2), term: order % 2 === 1 ? 1 : 2, credits: applied, fromPlan: plannedCredits > 0 });
  }
  if (expectedFuture <= 0) return { error: 'ไม่มีหน่วยกิตเหลือสำหรับการคาดการณ์ก่อนถึงเทอมเป้าหมาย' };
  const totalByTarget = overall.gradedCredits + expectedFuture;
  const requiredGpa = (target * totalByTarget - overall.weighted) / expectedFuture;
  const maximumGpa = (overall.weighted + expectedFuture * 4) / totalByTarget;
  return {
    targetGpa: target, currentGpa: overall.gpa, completedCredits: overall.gradedCredits, passedCredits: overall.passedCredits,
    remainingCredits: expectedFuture, totalByTarget, requiredGpa, maximumGpa,
    possible: requiredGpa <= 4 + 1e-9, alreadySatisfied: requiredGpa <= 0,
    estimatedPerTerm: Number(estimatedPerTerm), pendingCurrentCredits, schedule,
  };
}

export function makeSampleData() {
  const firstYear = createYear(1);
  const firstTerm = createSemester(1, 'completed');
  const specs = [
    ['Introduction to Computer Science', 'ICS', 3, 91.64],
    ['Calculus I', 'MATH101', 3, 77],
    ['Programming Fundamentals', 'IT101', 3, 71],
    ['English Communication', 'ENG101', 3, 52],
  ];
  firstTerm.courses = specs.map(([name, code, credits, score]) => {
    const course = createCourse({ name, code, credits, maxScore: 100 });
    course.assessments = [{ id: uid(), label: 'คะแนนรวม', maxPoints: 100, earned: String(score), status: 'green' }];
    return course;
  });
  firstYear.semesters = [firstTerm, createSemester(2, 'current')];
  return { version: 1, years: [firstYear] };
}
