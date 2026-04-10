import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { SelectionCheck } from '../ui/SelectionCheck';
import {
  emojiBasketball,
  emojiBodybuilding,
  emojiCombatSports,
  emojiCardio,
  emojiFootball,
  emojiHandball,
  emojiSwimming,
  emojiWoman,
} from '../../services/emojiTheme';
import {
  DEFAULT_ONBOARDING_CONFIG,
  type AthleteOption,
  type AthleteSubGroup,
  type AthleteSubItem,
} from '../../config/onboardingConfig';
import { getOnboardingLanguage, localizeAthleteOptions } from './onboardingI18n';

interface AthleteIdentityScreenProps {
  onNext: () => void;
  onDataChange?: (data: Record<string, unknown>) => void;
  onboardingData?: {
    athleteIdentity?: string;
    athleteSubCategoryId?: string;
    athleteSubCategoryIds?: string[];
    athleteSubCategorySelections?: Record<string, string[]>;
    gender?: string;
  };
  options?: AthleteOption[];
  groupSelectionLimits?: Record<string, number>;
}

type GroupSelectionMap = Record<string, string[]>;
const DEFAULT_ICON_MAP: Record<string, string> = {
  bodybuilding: emojiBodybuilding,
  cardio: emojiCardio,
  football: emojiFootball,
  basketball: emojiBasketball,
  handball: emojiHandball,
  swimming: emojiSwimming,
  combat_sports: emojiCombatSports,
};

const LEGACY_MAIN_ID_MAP: Record<string, string> = {
  bodybuilder: 'bodybuilding',
  fotballer: 'football',
  basketballer: 'basketball',
  handballer: 'handball',
  swimmer: 'swimming',
};

const getGroupLimit = (groupId: string, limits: Record<string, number>) => limits[groupId] ?? 1;

const coerceSelectionMap = (value: unknown): GroupSelectionMap => {
  if (!value || typeof value !== 'object') return {};
  const entries = Object.entries(value as Record<string, unknown>);
  return entries.reduce<GroupSelectionMap>((acc, [groupId, ids]) => {
    if (Array.isArray(ids)) {
      acc[groupId] = ids.map((id) => String(id)).filter(Boolean);
    }
    return acc;
  }, {});
};

const pickGroupForItem = (option: AthleteOption, itemId: string) =>
  option.subGroups.find((group) => group.items.some((item) => item.id === itemId));

const applyLimit = (current: string[], nextId: string, limit: number) => {
  if (limit <= 1) return [nextId];
  if (current.includes(nextId)) return current;
  if (current.length < limit) return [...current, nextId];
  return [...current.slice(1), nextId];
};

export function AthleteIdentityScreen({
  onNext,
  onDataChange,
  onboardingData,
  options,
  groupSelectionLimits,
}: AthleteIdentityScreenProps) {
  const language = getOnboardingLanguage();
  const isArabic = language === 'ar';
  const copy = language === 'ar'
    ? {
        title: '\u0623\u0646\u0627',
        subtitle: '\u0627\u062e\u062a\u0631 \u0645\u0644\u0641\u064b\u0627 \u0648\u0627\u062d\u062f\u064b\u0627 \u0648\u0647\u062f\u0641\u064b\u0627 \u0645\u062d\u062f\u062f\u064b\u0627.',
        fitnessSection: '\u0644\u064a\u0627\u0642\u0629 / \u0647\u064a\u0626\u0629',
        fitnessSectionFemale: '\u0644\u064a\u0627\u0642\u0629 / \u0647\u064a\u0626\u0629 (\u0644\u0644\u0646\u0633\u0627\u0621)',
        athleteSection: '\u0631\u064a\u0627\u0636\u0627\u062a \u0627\u0644\u0631\u064a\u0627\u0636\u064a\u064a\u0646',
        subCategories: '\u0627\u0644\u0641\u0626\u0627\u062a \u0627\u0644\u0641\u0631\u0639\u064a\u0629',
        chooseUpTo: '\u0627\u062e\u062a\u0631 \u062d\u062a\u0649',
        cta: '\u0645\u062a\u0627\u0628\u0639\u0629',
      }
    : language === 'it'
      ? {
          title: 'Profilo',
          subtitle: 'Scegli un profilo e un obiettivo specifico.',
          fitnessSection: 'FITNESS / FISICO',
          fitnessSectionFemale: 'FITNESS / FISICO (DONNA)',
          athleteSection: 'SPORT ATLETICI',
          subCategories: 'Sotto-categorie',
          chooseUpTo: 'Scegli fino a',
          cta: 'Continua',
        }
      : language === 'de'
        ? {
            title: 'ICH BIN',
            subtitle: 'Waehle ein Profil und ein konkretes Ziel.',
            fitnessSection: 'FITNESS / PHYSIQUE',
            fitnessSectionFemale: 'FITNESS / FIGUR (FRAU)',
            athleteSection: 'ATHLETISCHE SPORTARTEN',
            subCategories: 'Unterkategorien',
            chooseUpTo: 'Waehle bis zu',
            cta: 'Weiter',
          }
        : language === 'fr'
          ? {
              title: 'PROFIL',
              subtitle: 'Choisis un profil et un objectif specifique.',
              fitnessSection: 'FITNESS / PHYSIQUE',
              fitnessSectionFemale: 'FITNESS / PHYSIQUE (FEMME)',
              athleteSection: 'SPORTS ATHLETIQUES',
              subCategories: 'Sous-categories',
              chooseUpTo: 'Choisis jusqu a',
              cta: 'Continuer',
            }
        : {
            title: 'I AM',
            subtitle: 'Choose one profile and one specific goal.',
            fitnessSection: 'FITNESS / PHYSIQUE',
            fitnessSectionFemale: 'FITNESS / PHYSIQUE (WOMEN)',
            athleteSection: 'ATHLETE SPORTS',
            subCategories: 'Sub-Categories',
            chooseUpTo: 'Choose up to',
            cta: 'Continue',
          };
  const normalizedGender = String(onboardingData?.gender || '').trim().toLowerCase();
  const isFemale = normalizedGender === 'female' || normalizedGender === 'woman' || normalizedGender === 'f';
  const athleteOptions = options?.length
    ? options
    : DEFAULT_ONBOARDING_CONFIG.options.athleteIdentity;
  const localizedOptions = localizeAthleteOptions(athleteOptions, language, normalizedGender);
  const visibleOptions = useMemo(
    () => localizedOptions.filter((option) => !isFemale || option.category === 'fitness'),
    [isFemale, localizedOptions],
  );
  const selectionLimits = groupSelectionLimits
    ? { ...DEFAULT_ONBOARDING_CONFIG.options.athleteIdentityGroupLimits, ...groupSelectionLimits }
    : DEFAULT_ONBOARDING_CONFIG.options.athleteIdentityGroupLimits;
  const resolveIconUrl = (option: AthleteOption) =>
    (isFemale && option.id === 'bodybuilding'
      ? emojiWoman
      : option.iconUrl || DEFAULT_ICON_MAP[option.iconKey || option.id] || '');

  const initialSelection = useMemo(() => {
    const saved = String(onboardingData?.athleteIdentity || '').trim().toLowerCase();
    const normalized = LEGACY_MAIN_ID_MAP[saved] || saved;
    return visibleOptions.some((option) => option.id === normalized) ? normalized : '';
  }, [visibleOptions, onboardingData?.athleteIdentity]);

  const [selectedId, setSelectedId] = useState(initialSelection);
  const [selectedSubItemsByGroup, setSelectedSubItemsByGroup] = useState<GroupSelectionMap>(() => {
    const option = visibleOptions.find((entry) => entry.id === initialSelection);
    if (!option) return {};

    const fromMap = coerceSelectionMap(onboardingData?.athleteSubCategorySelections);
    if (Object.keys(fromMap).length > 0) return fromMap;

    const fromIds = Array.isArray(onboardingData?.athleteSubCategoryIds)
      ? onboardingData?.athleteSubCategoryIds.map((id) => String(id))
      : [];
    const fromSingle = String(onboardingData?.athleteSubCategoryId || '').trim();
    const rawIds = [...fromIds, fromSingle].filter(Boolean);
    if (rawIds.length === 0) return {};

    return rawIds.reduce<GroupSelectionMap>((acc, id) => {
      const group = pickGroupForItem(option, id);
      if (!group) return acc;
      const limit = getGroupLimit(group.id, selectionLimits);
      const existing = acc[group.id] ?? [];
      acc[group.id] = applyLimit(existing, id, limit);
      return acc;
    }, {});
  });

  const selectedOption = useMemo(
    () => visibleOptions.find((option) => option.id === selectedId) || null,
    [visibleOptions, selectedId],
  );

  const fitnessOptions = useMemo(
    () => visibleOptions.filter((option) => option.category === 'fitness'),
    [visibleOptions],
  );
  const athleteSportOptions = useMemo(
    () => visibleOptions.filter((option) => option.category === 'athlete_sports'),
    [visibleOptions],
  );

  const availableSubItemsByGroup = useMemo(
    () =>
      selectedOption
        ? selectedOption.subGroups.reduce<Record<string, Set<string>>>((acc, group) => {
            acc[group.id] = new Set(group.items.map((item) => item.id));
            return acc;
          }, {})
        : {},
    [selectedOption],
  );

  const effectiveSelections = useMemo(() => {
    if (!selectedOption) return {};
    return selectedOption.subGroups.reduce<GroupSelectionMap>((acc, group) => {
      const available = availableSubItemsByGroup[group.id] ?? new Set<string>();
      const limit = getGroupLimit(group.id, selectionLimits);
      const current = (selectedSubItemsByGroup[group.id] ?? []).filter((id) => available.has(id));
      acc[group.id] = limit > 0 ? current.slice(-limit) : current;
      return acc;
    }, {});
  }, [availableSubItemsByGroup, selectedOption, selectedSubItemsByGroup, selectionLimits]);

  const persistMainSelection = (option: AthleteOption) => {
    onDataChange?.({
      athleteIdentity: option.id,
      athleteIdentityLabel: option.label,
      athleteIdentityCategory: option.category,
    });
  };

  const clearAllSelection = () => {
    setSelectedSubItemsByGroup({});
    onDataChange?.({
      athleteIdentity: '',
      athleteIdentityLabel: '',
      athleteIdentityCategory: '',
      athleteSubCategoryId: '',
      athleteSubCategoryLabel: '',
      athleteSubCategoryIds: [],
      athleteSubCategoryLabels: [],
      athleteSubCategorySelections: {},
      athleteSubCategoryGroupId: '',
      athleteSubCategoryGroupLabel: '',
      athleteGoal: '',
    });
  };

  useEffect(() => {
    if (!selectedId) return;
    if (visibleOptions.some((option) => option.id === selectedId)) return;
    setSelectedId('');
    clearAllSelection();
  }, [selectedId, visibleOptions]);

  const handleSelectMain = (nextId: string) => {
    const selected = athleteOptions.find((option) => option.id === nextId);
    if (!selected) return;

    if (selectedId === nextId) {
      setSelectedId('');
      clearAllSelection();
      return;
    }

    setSelectedId(nextId);
    setSelectedSubItemsByGroup({});
    onDataChange?.({
      athleteSubCategoryId: '',
      athleteSubCategoryLabel: '',
      athleteSubCategoryIds: [],
      athleteSubCategoryLabels: [],
      athleteSubCategorySelections: {},
      athleteSubCategoryGroupId: '',
      athleteSubCategoryGroupLabel: '',
      athleteGoal: '',
    });
    persistMainSelection(selected);
  };

  const persistSubSelections = (option: AthleteOption, selections: GroupSelectionMap) => {
    const groupDetails = option.subGroups.map((group) => {
      const ids = selections[group.id] ?? [];
      const labels = group.items.filter((item) => ids.includes(item.id)).map((item) => item.label);
      return {
        groupId: group.id,
        groupTitle: group.title,
        ids,
        labels,
      };
    });

    const allIds = groupDetails.flatMap((group) => group.ids);
    const allLabels = groupDetails.flatMap((group) => group.labels);
    const primaryGroup = groupDetails.find((group) => group.ids.length > 0);
    const combinedLabel = allLabels.join(', ');

    onDataChange?.({
      athleteIdentity: option.id,
      athleteIdentityLabel: option.label,
      athleteIdentityCategory: option.category,
      athleteSubCategoryId: allIds[0] || '',
      athleteSubCategoryLabel: combinedLabel,
      athleteSubCategoryIds: allIds,
      athleteSubCategoryLabels: allLabels,
      athleteSubCategorySelections: selections,
      athleteSubCategoryGroupId: primaryGroup?.groupId || '',
      athleteSubCategoryGroupLabel: primaryGroup?.groupTitle || '',
      athleteGoal: combinedLabel,
    });
  };

  const handleSelectSub = (option: AthleteOption, group: AthleteSubGroup, item: AthleteSubItem) => {
    setSelectedId(option.id);
    const current = selectedSubItemsByGroup[group.id] ?? [];
    const limit = getGroupLimit(group.id, selectionLimits);
    const nextSelection = current.includes(item.id)
      ? current.filter((id) => id !== item.id)
      : applyLimit(current, item.id, limit);

    const next = {
      ...selectedSubItemsByGroup,
      [group.id]: nextSelection,
    };

    setSelectedSubItemsByGroup(next);
    persistSubSelections(option, next);
  };

  const renderSubCategoryPanel = (option: AthleteOption) => (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-card/60 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">
        {isArabic ? `${option.label} - ${copy.subCategories}` : `${option.label.toUpperCase()} - ${copy.subCategories}`}
      </h3>

      {option.subGroups.map((group) => (
        <div key={group.id} className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-white">{group.title}</p>
            {getGroupLimit(group.id, selectionLimits) > 1 ? (
              <span className="text-[11px] uppercase tracking-[0.12em] text-text-tertiary">
                {`${copy.chooseUpTo} ${getGroupLimit(group.id, selectionLimits)}`}
              </span>
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {group.items.map((item) => {
              const isSelected = Boolean(effectiveSelections[group.id]?.includes(item.id));
              return (
                <button
                  key={`${group.id}-${item.id}`}
                  type="button"
                  onClick={() => handleSelectSub(option, group, item)}
                  className={`w-full min-h-[64px] rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
                    isSelected
                      ? 'border-accent bg-accent/15 text-white'
                      : 'border-white/10 bg-background/55 text-text-secondary hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span>{item.label}</span>
                    <SelectionCheck selected={isSelected} size={18} className="shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  const renderMainOptionCard = (option: AthleteOption) => {
    const isSelected = selectedId === option.id;
    return (
      <div key={option.id} className="space-y-2">
        <button
          type="button"
          onClick={() => handleSelectMain(option.id)}
          className={`w-full min-h-[108px] rounded-2xl border px-5 py-4 text-left transition-colors ${
            isSelected
              ? 'bg-accent/12 border-accent text-white'
              : 'bg-card border-white/10 text-text-secondary hover:bg-white/5'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <p className="text-base font-semibold leading-snug text-white">
                <span className="inline-flex items-center gap-2">
                {resolveIconUrl(option) ? (
                  <img src={resolveIconUrl(option)} alt={`${option.label} icon`} className="h-6 w-6 object-contain" />
                ) : null}
                  <span>{option.label}</span>
                </span>
              </p>
              <p className="text-sm leading-relaxed text-text-secondary">{option.description}</p>
            </div>
            <SelectionCheck selected={isSelected} size={22} className="mt-1 shrink-0" />
          </div>
        </button>
        {isSelected && renderSubCategoryPanel(option)}
      </div>
    );
  };

  const canContinue = Boolean(
    selectedOption &&
      selectedOption.subGroups.every((group) => (effectiveSelections[group.id]?.length ?? 0) >= 1),
  );

  return (
    <div className="flex-1 flex flex-col space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-light text-white">{copy.title}</h2>
        <p className="text-text-secondary">
          {copy.subtitle}
        </p>
      </div>

      <div className="space-y-5">
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
            {isFemale ? copy.fitnessSectionFemale : copy.fitnessSection}
          </h3>
          <div className="space-y-3">{fitnessOptions.map(renderMainOptionCard)}</div>
        </div>

        {athleteSportOptions.length ? (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
              {copy.athleteSection}
            </h3>
            <div className="space-y-3">{athleteSportOptions.map(renderMainOptionCard)}</div>
          </div>
        ) : null}
      </div>

      <div className="flex-1" />

      <Button onClick={onNext} disabled={!canContinue}>
        {copy.cta}
      </Button>
    </div>
  );
}
