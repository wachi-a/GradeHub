/** Guest -> Account migration. Preserve every course from BOTH data sets.
 * Years and semesters representing the same academic period are combined.
 * Items with equal IDs are the same original item; guest edits are preferred.
 * This is deterministic, pure, and safe to retry after a concurrent update.
 */
import { createEmptyData } from './grades.js';
import { isValidData, normalizeData } from './storage.js';
import { mergeCalculatorDrafts } from './calculator.js';

const copy = value => structuredClone(value);
const distinct = items => [...new Set(items)];

export function mergeDocuments(cloudInput, guestInput) {
  const cloud = isValidData(cloudInput) ? normalizeData(cloudInput) : createEmptyData();
  const guest = isValidData(guestInput) ? normalizeData(guestInput) : createEmptyData();
  const result = copy(cloud);
  const yearIdMap = new Map(), termIdMap = new Map();
  for (const guestYear of guest.years) {
    let year = result.years.find(y => Number(y.number) === Number(guestYear.number));
    if (!year) {
      year = copy(guestYear);
      result.years.push(year);
      continue;
    }
    yearIdMap.set(guestYear.id, year.id);
    for (const guestTerm of guestYear.semesters) {
      let term = year.semesters.find(t => Number(t.number) === Number(guestTerm.number));
      if (!term) {
        year.semesters.push(copy(guestTerm));
        continue;
      }
      termIdMap.set(guestTerm.id, term.id);
      // Prefer current/completed status if either collection recorded it.
      const rank = { planned:0, current:1, completed:2 };
      if ((rank[guestTerm.status] ?? 0) > (rank[term.status] ?? 0)) term.status = guestTerm.status;
      for (const guestCourse of guestTerm.courses) {
        const at = term.courses.findIndex(c => c.id === guestCourse.id);
        if (at < 0) term.courses.push(copy(guestCourse));
        else {
          const old = term.courses[at];
          const preferred = copy(guestCourse);
          const existingIds = new Set(preferred.assessments.map(item => item.id));
          for (const assessment of old.assessments) {
            if (!existingIds.has(assessment.id)) preferred.assessments.push(copy(assessment));
          }
          term.courses[at] = preferred;
        }
      }
    }
  }
  const cloudUi = cloud.ui ?? {}, guestUi = guest.ui ?? {};
  const translated = (ids, map) => (Array.isArray(ids) ? ids.map(id => map.get(id) ?? id) : []);
  result.ui = {
    ...copy(cloudUi),
    ...copy(guestUi),
    collapsedYears: distinct([...translated(cloudUi.collapsedYears,new Map()), ...translated(guestUi.collapsedYears,yearIdMap)]),
    collapsedTerms: distinct([...translated(cloudUi.collapsedTerms,new Map()), ...translated(guestUi.collapsedTerms,termIdMap)]),
    expandedExamStats: distinct([...(cloudUi.expandedExamStats ?? []), ...(guestUi.expandedExamStats ?? [])]),
  };
  // Calculator is independent of real years/courses. Merge both devices' draft
  // subjects rather than losing a guest scratchpad during the first login.
  const mergedScratchpad = mergeCalculatorDrafts(cloud, guest);
  if (mergedScratchpad) result.calculatorDraft = mergedScratchpad;
  result.years.sort((a, b) => Number(a.number) - Number(b.number));
  for (const year of result.years) year.semesters.sort((a,b) => Number(a.number) - Number(b.number));
  return result;
}
