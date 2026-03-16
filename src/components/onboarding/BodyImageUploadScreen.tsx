import React from 'react';
import { Button } from '../ui/Button';
import { PhotoUpload } from '../ui/PhotoUpload';
import { ShieldCheck } from 'lucide-react';
import { getOnboardingLanguage } from './onboardingI18n';
interface BodyImageUploadScreenProps {
  onNext: (images?: string[]) => void;
  onDataChange?: (data: any) => void;
  onboardingData?: any;
}
export function BodyImageUploadScreen({ onNext, onDataChange, onboardingData }: BodyImageUploadScreenProps) {
  const language = getOnboardingLanguage();
  const isArabic = language === 'ar';
  const [images, setImages] = React.useState<string[]>(
    Array.isArray(onboardingData?.bodyImages)
      ? onboardingData.bodyImages.map((entry: unknown) => String(entry || '')).filter(Boolean)
      : [],
  );

  const handleImageUpload = (index: number, base64Image: string) => {
    const newImages = [...images];
    newImages[index] = base64Image;
    setImages(newImages);
    onDataChange?.({ bodyImages: newImages.filter((img) => img) });
  };

  const handleNext = () => {
    const validImages = images.filter(img => img);
    if (validImages.length > 0 && onDataChange) {
      onDataChange({ bodyImages: validImages });
    }
    onNext(validImages);
  };
  return (
    <div className="flex-1 flex flex-col space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-light text-white">{isArabic ? 'تحليل الجسم' : 'Body Analysis'}</h2>
        <p className="text-text-secondary">
          {isArabic ? 'ارفع صورًا لتحليل تركيب الجسم بالذكاء الاصطناعي.' : 'Upload photos for AI body composition analysis.'}
        </p>
        <div className="rounded-xl border border-amber-400/45 bg-amber-400/12 px-3 py-2">
          <p className="text-xs text-amber-100">
            {isArabic
              ? 'ملاحظة: رفع الصور هنا غير إلزامي. يساعد الذكاء الاصطناعي على تحليل جسمك بشكل أفضل فقط.'
              : 'Note: Importing images here is not required. It only helps our AI analyze your body better.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <PhotoUpload label={isArabic ? 'أمام' : 'Front'} onImageSelect={(img) => handleImageUpload(0, img)} />
        <PhotoUpload label={isArabic ? 'جانب' : 'Side'} onImageSelect={(img) => handleImageUpload(1, img)} />
        <PhotoUpload label={isArabic ? 'خلف' : 'Back'} onImageSelect={(img) => handleImageUpload(2, img)} />
      </div>

      <div className="bg-card rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-medium text-white">{isArabic ? 'إرشادات' : 'Guidelines'}</h3>
        <ul className="text-xs text-text-secondary space-y-2 list-disc pl-4">
          <li>{isArabic ? 'ارتدِ ملابس ضيقة أو ملابس سباحة' : 'Wear tight-fitting clothing or swimwear'}</li>
          <li>{isArabic ? 'تأكد من وجود إضاءة جيدة' : 'Ensure good lighting'}</li>
          <li>{isArabic ? 'قف مستقيمًا مع إبعاد الذراعين قليلًا عن الجسم' : 'Stand straight with arms slightly away from body'}</li>
          <li>{isArabic ? 'الوجه غير مطلوب' : 'Face is not required'}</li>
        </ul>
      </div>

      <div className="flex items-center gap-2 justify-center py-2">
        <ShieldCheck size={16} className="text-green-500" />
        <span className="text-xs text-text-tertiary">
          {isArabic ? 'الصور مشفرة وخاصة' : 'Photos are encrypted and private'}
        </span>
      </div>

      <div className="flex-1" />

      <Button onClick={handleNext}>{isArabic ? 'حلّل الصور' : 'Analyze Photos'}</Button>
    </div>);

}
