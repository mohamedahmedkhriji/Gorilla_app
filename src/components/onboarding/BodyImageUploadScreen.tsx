import React from 'react';
import { Button } from '../ui/Button';
import { PhotoUpload } from '../ui/PhotoUpload';
import { ShieldCheck } from 'lucide-react';
interface BodyImageUploadScreenProps {
  onNext: (images?: string[]) => void;
  onDataChange?: (data: any) => void;
}
export function BodyImageUploadScreen({ onNext, onDataChange }: BodyImageUploadScreenProps) {
  const [images, setImages] = React.useState<string[]>([]);

  const handleImageUpload = (index: number, base64Image: string) => {
    const newImages = [...images];
    newImages[index] = base64Image;
    setImages(newImages);
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
        <h2 className="text-2xl font-light text-white">Body Analysis</h2>
        <p className="text-text-secondary">
          Upload photos for AI body composition analysis.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <PhotoUpload label="Front" onImageSelect={(img) => handleImageUpload(0, img)} />
        <PhotoUpload label="Side" onImageSelect={(img) => handleImageUpload(1, img)} />
        <PhotoUpload label="Back" onImageSelect={(img) => handleImageUpload(2, img)} />
      </div>

      <div className="bg-card rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-medium text-white">Guidelines</h3>
        <ul className="text-xs text-text-secondary space-y-2 list-disc pl-4">
          <li>Wear tight-fitting clothing or swimwear</li>
          <li>Ensure good lighting</li>
          <li>Stand straight with arms slightly away from body</li>
          <li>Face is not required</li>
        </ul>
      </div>

      <div className="flex items-center gap-2 justify-center py-2">
        <ShieldCheck size={16} className="text-green-500" />
        <span className="text-xs text-text-tertiary">
          Photos are encrypted and private
        </span>
      </div>

      <div className="flex-1" />

      <Button onClick={handleNext}>Analyze Photos</Button>
    </div>);

}