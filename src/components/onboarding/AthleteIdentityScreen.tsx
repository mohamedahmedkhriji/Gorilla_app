import React, { useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { SelectionCheck } from '../ui/SelectionCheck';
import {
  emojiBasketball,
  emojiBodybuilding,
  emojiCombatSports,
  emojiFootball,
  emojiHandball,
  emojiSwimming,
} from '../../services/emojiTheme';

interface AthleteIdentityScreenProps {
  onNext: () => void;
  onDataChange?: (data: Record<string, unknown>) => void;
  onboardingData?: {
    athleteIdentity?: string;
    athleteSubCategoryId?: string;
  };
}

type AthleteSubItem = {
  id: string;
  label: string;
};

type AthleteSubGroup = {
  id: string;
  title: string;
  items: AthleteSubItem[];
};

type AthleteOption = {
  id: string;
  label: string;
  description: string;
  icon: string;
  category: 'fitness' | 'athlete_sports';
  subGroups: AthleteSubGroup[];
};

const ATHLETE_OPTIONS: AthleteOption[] = [
  {
    id: 'bodybuilding',
    label: 'Bodybuilding',
    description: 'Build muscle size, symmetry, and physique-focused strength.',
    icon: emojiBodybuilding,
    category: 'fitness',
    subGroups: [
      {
        id: 'bodybuilding_category',
        title: 'By Category',
        items: [
          { id: 'hypertrophy', label: 'Hypertrophy' },
          { id: 'powerlifting', label: 'Powerlifting' },
          { id: 'cutting', label: 'Cutting' },
          { id: 'bulking', label: 'Bulking' },
          { id: 'beginner_gym', label: 'Beginner gym' },
          { id: 'natural_athlete', label: 'Natural athlete' },
          { id: 'classic_physique', label: 'Classic physique' },
        ],
      },
    ],
  },
  {
    id: 'football',
    label: 'Football',
    description: 'Improve speed, agility, power, and match endurance.',
    icon: emojiFootball,
    category: 'athlete_sports',
    subGroups: [
      {
        id: 'football_position',
        title: 'By Position',
        items: [
          { id: 'striker', label: 'Striker' },
          { id: 'winger', label: 'Winger' },
          { id: 'midfielder', label: 'Midfielder' },
          { id: 'defender', label: 'Defender' },
          { id: 'goalkeeper', label: 'Goalkeeper' },
        ],
      },
      {
        id: 'football_goal',
        title: 'By Training Goal',
        items: [
          { id: 'speed_acceleration', label: 'Speed & acceleration' },
          { id: 'match_endurance', label: 'Match endurance' },
          { id: 'shooting_power', label: 'Shooting power' },
          { id: 'injury_prevention', label: 'Injury prevention' },
          { id: 'strength_duels', label: 'Strength & duels' },
        ],
      },
      {
        id: 'football_phase',
        title: 'By Season Phase (VERY PRO FEATURE)',
        items: [
          { id: 'pre_season', label: 'Pre-season' },
          { id: 'in_season', label: 'In-season' },
          { id: 'off_season', label: 'Off-season' },
        ],
      },
    ],
  },
  {
    id: 'basketball',
    label: 'Basketball',
    description: 'Train explosiveness, vertical power, and court conditioning.',
    icon: emojiBasketball,
    category: 'athlete_sports',
    subGroups: [
      {
        id: 'basketball_role',
        title: 'By Role',
        items: [
          { id: 'guard', label: 'Guard' },
          { id: 'forward', label: 'Forward' },
          { id: 'center', label: 'Center' },
        ],
      },
      {
        id: 'basketball_goal',
        title: 'By Goal',
        items: [
          { id: 'vertical_jump', label: 'Vertical jump' },
          { id: 'explosive_speed', label: 'Explosive speed' },
          { id: 'lateral_agility', label: 'Lateral agility' },
          { id: 'knee_injury_prevention', label: 'Knee injury prevention' },
          { id: 'core_stability', label: 'Core stability' },
        ],
      },
      {
        id: 'basketball_phase',
        title: 'By Phase',
        items: [
          { id: 'pre_season', label: 'Pre-season' },
          { id: 'in_season', label: 'In-season' },
          { id: 'off_season', label: 'Off-season' },
        ],
      },
    ],
  },
  {
    id: 'handball',
    label: 'Handball',
    description: 'Boost rotational power, acceleration, and repeat stamina.',
    icon: emojiHandball,
    category: 'athlete_sports',
    subGroups: [
      {
        id: 'handball_position',
        title: 'By Position',
        items: [
          { id: 'wing', label: 'Wing' },
          { id: 'backcourt', label: 'Backcourt' },
          { id: 'pivot', label: 'Pivot' },
          { id: 'goalkeeper', label: 'Goalkeeper' },
        ],
      },
      {
        id: 'handball_goal',
        title: 'By Goal',
        items: [
          { id: 'throwing_power', label: 'Throwing power' },
          { id: 'jump_explosiveness', label: 'Jump explosiveness' },
          { id: 'shoulder_strength', label: 'Shoulder strength' },
          { id: 'sprint_endurance', label: 'Sprint endurance' },
        ],
      },
      {
        id: 'handball_phase',
        title: 'By Phase',
        items: [
          { id: 'pre_season', label: 'Pre-season' },
          { id: 'in_season', label: 'In-season' },
          { id: 'off_season', label: 'Off-season' },
        ],
      },
    ],
  },
  {
    id: 'swimming',
    label: 'Swimming',
    description: 'Develop full-body endurance, lung capacity, and control.',
    icon: emojiSwimming,
    category: 'athlete_sports',
    subGroups: [
      {
        id: 'swimming_stroke',
        title: 'By Stroke',
        items: [
          { id: 'freestyle', label: 'Freestyle' },
          { id: 'breaststroke', label: 'Breaststroke' },
          { id: 'butterfly', label: 'Butterfly' },
          { id: 'backstroke', label: 'Backstroke' },
        ],
      },
      {
        id: 'swimming_goal',
        title: 'By Goal',
        items: [
          { id: 'shoulder_mobility', label: 'Shoulder mobility' },
          { id: 'core_endurance', label: 'Core endurance' },
          { id: 'breathing_capacity', label: 'Breathing capacity' },
          { id: 'technique_strength', label: 'Technique strength' },
        ],
      },
      {
        id: 'swimming_phase',
        title: 'By Phase',
        items: [
          { id: 'conditioning_phase', label: 'Conditioning phase' },
          { id: 'competition_phase', label: 'Competition phase' },
          { id: 'recovery_phase', label: 'Recovery phase' },
        ],
      },
    ],
  },
  {
    id: 'combat_sports',
    label: 'Combat sports',
    description: 'Build conditioning, reaction speed, and functional power.',
    icon: emojiCombatSports,
    category: 'athlete_sports',
    subGroups: [
      {
        id: 'combat_sport_type',
        title: 'By Sport Type',
        items: [
          { id: 'boxing', label: 'Boxing' },
          { id: 'mma', label: 'MMA' },
          { id: 'muay_thai', label: 'Muay Thai' },
          { id: 'wrestling', label: 'Wrestling' },
          { id: 'judo', label: 'Judo' },
        ],
      },
      {
        id: 'combat_goal',
        title: 'By Goal',
        items: [
          { id: 'power_endurance', label: 'Power endurance' },
          { id: 'speed_reaction', label: 'Speed & reaction' },
          { id: 'weight_cut_conditioning', label: 'Weight cut conditioning' },
          { id: 'neck_core_strength', label: 'Neck & core strength' },
        ],
      },
      {
        id: 'combat_phase',
        title: 'By Phase',
        items: [
          { id: 'fight_camp', label: 'Fight camp' },
          { id: 'off_camp', label: 'Off-camp' },
          { id: 'recovery', label: 'Recovery' },
        ],
      },
    ],
  },
];

const LEGACY_MAIN_ID_MAP: Record<string, string> = {
  bodybuilder: 'bodybuilding',
  fotballer: 'football',
  basketballer: 'basketball',
  handballer: 'handball',
  swimmer: 'swimming',
};

export function AthleteIdentityScreen({ onNext, onDataChange, onboardingData }: AthleteIdentityScreenProps) {
  const initialSelection = useMemo(() => {
    const saved = String(onboardingData?.athleteIdentity || '').trim().toLowerCase();
    const normalized = LEGACY_MAIN_ID_MAP[saved] || saved;
    return ATHLETE_OPTIONS.some((option) => option.id === normalized) ? normalized : '';
  }, [onboardingData?.athleteIdentity]);

  const [selectedId, setSelectedId] = useState(initialSelection);
  const [selectedSubItemId, setSelectedSubItemId] = useState(String(onboardingData?.athleteSubCategoryId || '').trim());

  const selectedOption = useMemo(
    () => ATHLETE_OPTIONS.find((option) => option.id === selectedId) || null,
    [selectedId],
  );

  const availableSubItems = useMemo(
    () => (selectedOption ? selectedOption.subGroups.flatMap((group) => group.items.map((item) => item.id)) : []),
    [selectedOption],
  );

  const effectiveSubItemId = useMemo(
    () => (availableSubItems.includes(selectedSubItemId) ? selectedSubItemId : ''),
    [availableSubItems, selectedSubItemId],
  );

  const persistMainSelection = (option: AthleteOption) => {
    onDataChange?.({
      athleteIdentity: option.id,
      athleteIdentityLabel: option.label,
      athleteIdentityCategory: option.category,
    });
  };

  const clearAllSelection = () => {
    setSelectedSubItemId('');
    onDataChange?.({
      athleteIdentity: '',
      athleteIdentityLabel: '',
      athleteIdentityCategory: '',
      athleteSubCategoryId: '',
      athleteSubCategoryLabel: '',
      athleteSubCategoryGroupId: '',
      athleteSubCategoryGroupLabel: '',
      athleteGoal: '',
    });
  };

  const handleSelectMain = (nextId: string) => {
    const selected = ATHLETE_OPTIONS.find((option) => option.id === nextId);
    if (!selected) return;

    if (selectedId === nextId) {
      setSelectedId('');
      clearAllSelection();
      return;
    }

    setSelectedId(nextId);
    setSelectedSubItemId('');
    onDataChange?.({
      athleteSubCategoryId: '',
      athleteSubCategoryLabel: '',
      athleteSubCategoryGroupId: '',
      athleteSubCategoryGroupLabel: '',
      athleteGoal: '',
    });
    persistMainSelection(selected);
  };

  const handleSelectSub = (option: AthleteOption, group: AthleteSubGroup, item: AthleteSubItem) => {
    setSelectedId(option.id);
    setSelectedSubItemId(item.id);
    onDataChange?.({
      athleteIdentity: option.id,
      athleteIdentityLabel: option.label,
      athleteIdentityCategory: option.category,
      athleteSubCategoryId: item.id,
      athleteSubCategoryLabel: item.label,
      athleteSubCategoryGroupId: group.id,
      athleteSubCategoryGroupLabel: group.title,
      athleteGoal: item.label,
    });
  };

  const renderSubCategoryPanel = (option: AthleteOption) => (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-card/60 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">
        {option.label.toUpperCase()} - Sub-Categories
      </h3>

      {option.subGroups.map((group) => (
        <div key={group.id} className="space-y-2">
          <p className="text-sm font-semibold text-white">{group.title}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {group.items.map((item) => {
              const isSelected = effectiveSubItemId === item.id;
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
                  <img src={option.icon} alt={`${option.label} icon`} className="h-6 w-6 object-contain" />
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

  const canContinue = Boolean(selectedOption && effectiveSubItemId);

  return (
    <div className="flex-1 flex flex-col space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-light text-white">I AM</h2>
        <p className="text-text-secondary">Choose one profile and one specific goal.</p>
      </div>

      <div className="space-y-5">
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">FITNESS / PHYSIQUE</h3>
          <div className="space-y-3">{ATHLETE_OPTIONS.filter((option) => option.category === 'fitness').map(renderMainOptionCard)}</div>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">ATHLETE SPORTS</h3>
          <div className="space-y-3">{ATHLETE_OPTIONS.filter((option) => option.category === 'athlete_sports').map(renderMainOptionCard)}</div>
        </div>
      </div>

      <div className="flex-1" />

      <Button onClick={onNext} disabled={!canContinue}>
        Continue
      </Button>
    </div>
  );
}
