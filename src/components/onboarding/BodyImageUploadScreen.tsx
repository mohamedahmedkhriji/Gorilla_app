import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button } from '../ui/Button';
import { PhotoUpload } from '../ui/PhotoUpload';
import { getOnboardingLanguage } from './onboardingI18n';

interface BodyImageUploadScreenProps {
  onNext: (images?: string[]) => void;
  onDataChange?: (data: any) => void;
  onboardingData?: any;
}

const COPY = {
  en: {
    title: 'Optional AI body scan',
    subtitle: 'Add photos to improve AI precision.',
    note: 'Optional step. You can continue without photos anytime.',
    front: 'Front',
    side: 'Side',
    back: 'Back',
    guidelines: 'Guidelines',
    guide1: 'Wear tight-fitting clothing or swimwear',
    guide2: 'Ensure good lighting',
    guide3: 'Stand straight with arms slightly away from body',
    guide4: 'Face is not required',
    privacy: 'Photos are encrypted and private',
    cta: 'Analyze Photos',
    ctaSkip: 'Continue without photos',
  },
  ar: {
    title: '\u062a\u062d\u0644\u064a\u0644 \u0627\u0644\u062c\u0633\u0645',
    subtitle: '\u0627\u0631\u0641\u0639 \u0635\u0648\u0631\u064b\u0627 \u0644\u062a\u062d\u0644\u064a\u0644 \u062a\u0631\u0643\u064a\u0628 \u0627\u0644\u062c\u0633\u0645 \u0628\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a.',
    note: '\u0645\u0644\u0627\u062d\u0638\u0629: \u0631\u0641\u0639 \u0627\u0644\u0635\u0648\u0631 \u0647\u0646\u0627 \u063a\u064a\u0631 \u0625\u0644\u0632\u0627\u0645\u064a. \u064a\u0633\u0627\u0639\u062f \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a \u0639\u0644\u0649 \u062a\u062d\u0644\u064a\u0644 \u062c\u0633\u0645\u0643 \u0628\u0634\u0643\u0644 \u0623\u0641\u0636\u0644 \u0641\u0642\u0637.',
    front: '\u0623\u0645\u0627\u0645',
    side: '\u062c\u0627\u0646\u0628',
    back: '\u062e\u0644\u0641',
    guidelines: '\u0625\u0631\u0634\u0627\u062f\u0627\u062a',
    guide1: '\u0627\u0631\u062a\u062f\u0650 \u0645\u0644\u0627\u0628\u0633 \u0636\u064a\u0642\u0629 \u0623\u0648 \u0645\u0644\u0627\u0628\u0633 \u0633\u0628\u0627\u062d\u0629',
    guide2: '\u062a\u0623\u0643\u062f \u0645\u0646 \u0648\u062c\u0648\u062f \u0625\u0636\u0627\u0621\u0629 \u062c\u064a\u062f\u0629',
    guide3: '\u0642\u0641 \u0645\u0633\u062a\u0642\u064a\u0645\u064b\u0627 \u0645\u0639 \u0625\u0628\u0639\u0627\u062f \u0627\u0644\u0630\u0631\u0627\u0639\u064a\u0646 \u0642\u0644\u064a\u0644\u064b\u0627 \u0639\u0646 \u0627\u0644\u062c\u0633\u0645',
    guide4: '\u0627\u0644\u0648\u062c\u0647 \u063a\u064a\u0631 \u0645\u0637\u0644\u0648\u0628',
    privacy: '\u0627\u0644\u0635\u0648\u0631 \u0645\u0634\u0641\u0631\u0629 \u0648\u062e\u0627\u0635\u0629',
    cta: '\u062d\u0644\u0644 \u0627\u0644\u0635\u0648\u0631',
  },
  it: {
    title: 'Analisi del corpo',
    subtitle: 'Carica foto per l analisi AI della composizione corporea.',
    note: 'Nota: caricare immagini qui non e obbligatorio. Aiuta solo la nostra AI ad analizzare meglio il tuo corpo.',
    front: 'Fronte',
    side: 'Lato',
    back: 'Retro',
    guidelines: 'Linee guida',
    guide1: 'Indossa abiti aderenti o costume',
    guide2: 'Assicurati di avere una buona illuminazione',
    guide3: 'Stai dritto con le braccia leggermente lontane dal corpo',
    guide4: 'Il viso non e richiesto',
    privacy: 'Le foto sono criptate e private',
    cta: 'Analizza foto',
  },
  de: {
    title: 'Koerperanalyse',
    subtitle: 'Lade Fotos fuer die KI-Koerperanalyse hoch.',
    note: 'Hinweis: Bilder hier hochzuladen ist nicht verpflichtend. Es hilft unserer KI nur, deinen Koerper besser zu analysieren.',
    front: 'Vorne',
    side: 'Seite',
    back: 'Hinten',
    guidelines: 'Hinweise',
    guide1: 'Trage enge Kleidung oder Badebekleidung',
    guide2: 'Sorge fuer gutes Licht',
    guide3: 'Stehe gerade mit den Armen leicht vom Koerper weg',
    guide4: 'Das Gesicht ist nicht erforderlich',
    privacy: 'Fotos sind verschluesselt und privat',
    cta: 'Fotos analysieren',
  },
  fr: {
    title: 'Analyse du corps',
    subtitle: 'Ajoute des photos pour une analyse IA de la composition corporelle.',
    note: 'Note : importer des images ici n est pas obligatoire. Cela aide simplement notre IA a mieux analyser ton corps.',
    front: 'Face',
    side: 'Profil',
    back: 'Dos',
    guidelines: 'Consignes',
    guide1: 'Porte des vetements pres du corps ou un maillot',
    guide2: 'Assure-toi d avoir une bonne lumiere',
    guide3: 'Tiens-toi droit avec les bras legerement ecartes du corps',
    guide4: 'Le visage n est pas necessaire',
    privacy: 'Les photos sont chiffrees et privees',
    cta: 'Analyser les photos',
  },
} as const;

export function BodyImageUploadScreen({ onNext, onDataChange, onboardingData }: BodyImageUploadScreenProps) {
  const language = getOnboardingLanguage();
  const copy = COPY[language as keyof typeof COPY] ?? COPY.en;
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
    const validImages = images.filter((img) => img);
    if (validImages.length > 0) {
      onDataChange?.({ bodyImages: validImages });
    }
    onNext(validImages);
  };

  const ctaLabel = images.filter((img) => img).length > 0 ? copy.cta : (copy as any).ctaSkip || copy.cta;

  return (
    <div className="flex-1 flex flex-col space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-light text-white">{copy.title}</h2>
        <p className="text-text-secondary">{copy.subtitle}</p>
        <div className="rounded-xl border border-amber-400/45 bg-amber-400/12 px-3 py-2">
          <p className="text-xs text-amber-100">{copy.note}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <PhotoUpload label={copy.front} onImageSelect={(img) => handleImageUpload(0, img)} />
        <PhotoUpload label={copy.side} onImageSelect={(img) => handleImageUpload(1, img)} />
        <PhotoUpload label={copy.back} onImageSelect={(img) => handleImageUpload(2, img)} />
      </div>

      <div className="bg-card rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-medium text-white">{copy.guidelines}</h3>
        <ul className="text-xs text-text-secondary space-y-2 list-disc pl-4">
          <li>{copy.guide1}</li>
          <li>{copy.guide2}</li>
          <li>{copy.guide3}</li>
          <li>{copy.guide4}</li>
        </ul>
      </div>

      <div className="flex items-center gap-2 justify-center py-2">
        <ShieldCheck size={16} className="text-green-500" />
        <span className="text-xs text-text-tertiary">{copy.privacy}</span>
      </div>

      <div className="flex-1" />

      <Button onClick={handleNext}>{ctaLabel}</Button>
    </div>
  );
}
