import type { AppLanguage } from './language';
import type { BookId } from './bookUsage';

export type AssignedBookPlan = {
  id: BookId | null;
  name: string | null;
};

const STORAGE_KEY = 'assignedProgramTemplate';
const TANK1_PATTERN = /\btank-?1\b/i;
const T2_PATTERN = /\bt-?2\b/i;
const BULK_PATTERN = /\bbulk(ing)?\b|تضخيم|massa|masse/i;
const CUT_PATTERN = /\bcut(ting)?\b|تنشيف|cardio/i;

const safeParseJson = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const getStoredAssignedProgram = () => {
  if (typeof window === 'undefined') return null;
  return safeParseJson<Record<string, unknown> | null>(window.localStorage.getItem(STORAGE_KEY), null);
};

const getCandidateNames = (program: Record<string, unknown> | null) => ([
  program?.planName,
  program?.name,
  program?.description,
]).map((value) => String(value || '').trim()).filter(Boolean);

export const getAssignedBookPlan = (): AssignedBookPlan => {
  const program = getStoredAssignedProgram();
  if (!program) return { id: null, name: null };

  const candidates = getCandidateNames(program);
  const resolvedName = candidates[0] || null;

  if ((program?.premiumBulkingConfig as { planKind?: string } | undefined)?.planKind === 't2-bulk') {
    return { id: 't-2-bulk', name: resolvedName };
  }

  if ((program?.premiumPlanConfig as { planKind?: string } | undefined)?.planKind === 't2-cut') {
    return { id: 't-2', name: resolvedName };
  }

  if (candidates.some((value) => TANK1_PATTERN.test(value))) {
    return { id: 'tank-1', name: resolvedName };
  }

  if (candidates.some((value) => T2_PATTERN.test(value) && BULK_PATTERN.test(value))) {
    return { id: 't-2-bulk', name: resolvedName };
  }

  if (candidates.some((value) => T2_PATTERN.test(value) && CUT_PATTERN.test(value))) {
    return { id: 't-2', name: resolvedName };
  }

  return { id: null, name: resolvedName };
};

export const getPlanSwitchPrompt = ({
  language,
  currentPlanName,
  nextPlanName,
}: {
  language: AppLanguage;
  currentPlanName: string;
  nextPlanName: string;
}) => {
  if (language === 'ar') {
    return {
      title: `هل تريد تغيير خطتك من ${currentPlanName} إلى ${nextPlanName}؟`,
      body: `خطتك الحالية هي ${currentPlanName}. هل أنت متأكد أنك تريد استبدالها بـ ${nextPlanName} داخل صفحة خطتي؟`,
      hint: `سيتم تعيين ${nextPlanName} كخطة نشطة بدلًا من ${currentPlanName}.`,
    };
  }

  if (language === 'it') {
    return {
      title: `Vuoi cambiare il tuo piano da ${currentPlanName} a ${nextPlanName}?`,
      body: `Il tuo piano attuale e ${currentPlanName}. Sei sicuro di volerlo sostituire con ${nextPlanName} nella pagina My Plan?`,
      hint: `${nextPlanName} diventera il tuo piano attivo al posto di ${currentPlanName}.`,
    };
  }

  if (language === 'de') {
    return {
      title: `Moechtest du deinen Plan von ${currentPlanName} zu ${nextPlanName} wechseln?`,
      body: `Dein aktueller Plan ist ${currentPlanName}. Bist du sicher, dass du ihn auf der Seite My Plan durch ${nextPlanName} ersetzen willst?`,
      hint: `${nextPlanName} wird als aktiver Plan anstelle von ${currentPlanName} gesetzt.`,
    };
  }

  return {
    title: `Switch your plan from ${currentPlanName} to ${nextPlanName}?`,
    body: `Your current plan is ${currentPlanName}. Are you sure you want to replace it with ${nextPlanName} on the My Plan page?`,
    hint: `${nextPlanName} will become your active plan instead of ${currentPlanName}.`,
  };
};
