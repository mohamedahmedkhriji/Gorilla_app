import React from 'react';
import { Button } from '../ui/Button';
import { getOnboardingLanguage } from './onboardingI18n';

interface CustomPlanBuilderScreenProps {
  onNext: () => void;
}

export function CustomPlanBuilderScreen({ onNext }: CustomPlanBuilderScreenProps) {
  const language = getOnboardingLanguage();
  const isArabic = language === 'ar';

  return (
    <div className="flex-1 flex flex-col space-y-5">
      <div className="space-y-2">
        <h2 className="text-2xl font-light text-white">
          {isArabic ? 'صفحة جديدة لقوالب الخطة' : 'New Template Builder Page'}
        </h2>
        <p className="text-text-secondary">
          {isArabic
            ? 'تمت إضافة هذه الخطوة داخل الـ onboarding. يمكنك تطوير هذه الصفحة لاحقًا كما تريد.'
            : 'This step has been added to onboarding. You can build this page later however you want.'}
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-card/70 p-4 text-sm text-text-secondary">
        {isArabic
          ? 'اضغط متابعة للانتقال إلى صفحة إنشاء قوالب الأسابيع يدويًا.'
          : 'Tap continue to open the manual weekly template builder page.'}
      </div>

      <div className="flex-1" />

      <Button onClick={onNext}>
        {isArabic ? 'متابعة' : 'Continue'}
      </Button>
    </div>
  );
}
