import type { Role } from '../domain/survey';

/** Survey progress on this phone (kept outside the lazy survey page so the reminder can use it). */
const KEY = 'cakeita.survey.v1';
export interface SurveyState {
  ref: string;
  role: Role | null;
  done1: boolean;
  done2: boolean;
}

export function readSurvey(): SurveyState | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null') as SurveyState | null;
    return v && typeof v.ref === 'string' ? v : null;
  } catch {
    return null;
  }
}
export function saveSurvey(s: SurveyState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage blocked */
  }
  window.dispatchEvent(new Event('cakeita-survey'));
}

export function surveyUrl(role?: Role): string {
  const base = `${window.location.origin}${window.location.pathname}#/survey`;
  return role ? `${base}?role=${role}` : base;
}

export const TRY_LINK: Record<Role, string> = { customer: '/b/sample', baker: '/demo' };

