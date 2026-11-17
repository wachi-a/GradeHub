/** Self-contained GPA sandbox. It NEVER writes into years/semesters/courses. */
import { DEFAULT_SCALE, gradeForScore } from './grades.js';

export const DRAFT_KEY = 'calculatorDraft';
export const NEW_ROW_ID = 'calculator-initial-row';
export const emptyCalculatorRow = (id = NEW_ROW_ID) => ({ id, name: '', credits: '', score: '' });

/** Old v1.7 backups don't have a draft; keep them readable. */
export function calculatorRows(document) {
  const rows = document?.[DRAFT_KEY]?.rows;
  if (!Array.isArray(rows)) return [];
  return rows.filter(row => row && typeof row === 'object' && typeof row.id === 'string')
    .map(row => ({
      id: row.id, name: String(row.name ?? ''),
      credits: String(row.credits ?? ''), score: String(row.score ?? ''),
    }));
}

export function hasCalculatorInputs(document) {
  return calculatorRows(document).some(row =>
    row.name.trim() !== '' || row.credits.trim() !== '' || row.score.trim() !== '');
}

/** Merge two drafts without dropping subjects from an existing online account.
 *  Guest wins when the same row ID has different values. The initial placeholder
 *  row is allowed to appear independently on different devices. */
export function mergeCalculatorDrafts(remoteDocument, guestDocument) {
  const online = calculatorRows(remoteDocument).filter(hasContent);
  const guest = calculatorRows(guestDocument).filter(hasContent);
  if (!online.length && !guest.length) return null;
  const merged = online.map(row => ({ ...row }));
  for (const row of guest) {
    const index = merged.findIndex(existing => existing.id === row.id);
    if (index === -1) merged.push({ ...row });
    else if (row.id === NEW_ROW_ID && !equalContent(merged[index], row)) {
      // Both devices may use the same default first-row ID. Give Guest an
      // idempotent content-derived ID so retries don't duplicate it.
      const unique = `${NEW_ROW_ID}-guest-${hashRow(row)}`;
      if (!merged.some(existing => existing.id === unique)) merged.push({ ...row, id: unique });
    } else merged[index] = { ...row };
  }
  return { rows: merged };
}

function hasContent(row) {
  return row.name.trim() !== '' || row.credits.trim() !== '' || row.score.trim() !== '';
}
function equalContent(a,b) {
  return a.name === b.name && a.credits === b.credits && a.score === b.score;
}
function hashRow(row) {
  const value = JSON.stringify([row.name,row.credits,row.score]);
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return hash.toString(36);
}

/** Absolute score 0–100, Gradeculator's default cutoff. Weighted by credits. */
export function calculateDraftGpa(rows) {
  const details = (rows ?? []).map(row => {
    const name = String(row.name ?? '').trim();
    const creditsText = String(row.credits ?? '').trim();
    const scoreText = String(row.score ?? '').trim();
    const credits = Number(creditsText);
    const score = Number(scoreText);
    const complete = Boolean(name && creditsText && scoreText && Number.isFinite(credits) && credits > 0 && Number.isFinite(score) && score >= 0 && score <= 100);
    const letter = complete ? gradeForScore(score, 100, DEFAULT_SCALE) : null;
    const points = letter === null ? null : DEFAULT_SCALE.find(g => g.letter === letter)?.point ?? null;
    return { id: row.id, complete, letter, points, credits: complete ? credits : 0 };
  });
  const completeRows = details.filter(d => d.complete && d.points !== null);
  const totalCredits = completeRows.reduce((n,d)=>n+d.credits,0);
  const weightedPoints = completeRows.reduce((n,d)=>n+d.credits*d.points,0);
  return {
    gpa: totalCredits > 0 ? weightedPoints / totalCredits : null,
    totalCredits, included: completeRows.length,
    incomplete: details.length - completeRows.length,
    details,
  };
}

/** Any actual Guest coursework OR scratchpad draft should migrate at login. */
export function hasAnyGradeculatorData(document) {
  return Boolean((Array.isArray(document?.years) && document.years.length > 0) || hasCalculatorInputs(document));
}

// Keep the legacy export for existing extensions/tests and older code.
export const hasAnyGradeHubData = hasAnyGradeculatorData;
