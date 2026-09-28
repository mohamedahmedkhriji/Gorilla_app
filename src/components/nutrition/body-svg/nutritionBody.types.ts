export type NutritionBodyType = 'male' | 'female' | 'neutral';
export type NutritionBodyMode = 'overview' | 'hydration' | 'protein' | 'carbs' | 'fat';

export type BodyRegionGroup = 'head' | 'torso' | 'arm' | 'leg' | 'core';

export type BodyRegion = {
  id: string;
  group: BodyRegionGroup;
  d: string;
};

export type BodyGeometry = {
  silhouette: string;
  regions: BodyRegion[];
};

export interface NutritionBodySVGProps {
  bodyType: NutritionBodyType;
  mode: NutritionBodyMode;
  current: number | null | undefined;
  target: number | null | undefined;
  unit: string;
  label: string;
}
