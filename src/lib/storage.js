import { createEmptyData } from './grades.js';

export const STORAGE_KEY = 'gradehub.mobile.v1';

export function isValidData(data) {
  return Boolean(data && data.version === 1 && Array.isArray(data.years) &&
    data.years.every(y => y && typeof y.id === 'string' && Number.isInteger(Number(y.number)) && Array.isArray(y.semesters) &&
      y.semesters.every(s => s && typeof s.id === 'string' && [1, 2].includes(Number(s.number)) && Array.isArray(s.courses) &&
        s.courses.every(c => c && typeof c.id === 'string' && typeof c.name === 'string' && Number(c.credits) > 0 && Number(c.maxScore) > 0 && (c.bonusBreakdown === undefined || typeof c.bonusBreakdown === 'string') && (c.bonusPoints === undefined || c.bonusPoints === '' || (Number.isFinite(Number(c.bonusPoints)) && Number(c.bonusPoints) >= 0 && Number(c.bonusPoints) <= Number(c.maxScore))) && Array.isArray(c.assessments) &&
          c.assessments.every(a => a && typeof a.id === 'string' && typeof a.label === 'string' &&
            (a.type === 'bonus' ? ((a.breakdown == null || typeof a.breakdown === 'string') && (a.earned === '' || (Number.isFinite(Number(a.earned)) && Number(a.earned) >= 0))) :
            (Number(a.maxPoints) > 0 && (a.earned === '' || (Number.isFinite(Number(a.earned)) && Number(a.earned) >= 0 && Number(a.earned) <= Number(a.maxPoints))))))))));
}

/** Migrate the v1.4 Bonus panel into a draggable, inline score row. Never double-count it. */
export function normalizeData(data) {
  if (!isValidData(data)) return createEmptyData();
  const copy = structuredClone(data);
  for (const year of copy.years) for (const semester of year.semesters) for (const course of semester.courses) {
    const hadLegacyBonus = (course.bonusBreakdown ?? '') !== '' || (course.bonusPoints ?? '') !== '';
    if (hadLegacyBonus && !course.assessments.some(a => a.type === 'bonus')) {
      course.assessments.push({
        id: `legacy-bonus-${course.id}`, type: 'bonus', label: 'Bonus',
        breakdown: String(course.bonusBreakdown ?? ''), earned: String(course.bonusPoints ?? ''), status: 'green',
      });
    }
    // Clear legacy fields only after making a bonus row, keeping user data safe.
    if (course.assessments.some(a => a.type === 'bonus')) {
      course.bonusBreakdown = '';
      course.bonusPoints = '';
    }
  }
  return copy;
}

export function loadData() {
  try {
    const content = localStorage.getItem(STORAGE_KEY);
    if (!content) return createEmptyData();
    const parsed = JSON.parse(content);
    return isValidData(parsed) ? normalizeData(parsed) : createEmptyData();
  } catch (error) {
    console.error('Failed to load local Gradeculator data', error);
    return createEmptyData();
  }
}

export function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function downloadBackup(data) {
  const content = JSON.stringify(data, null, 2);
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `gradeculator-backup-${date}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
