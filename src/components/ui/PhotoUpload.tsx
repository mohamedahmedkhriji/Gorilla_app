import React from 'react';
import { Camera } from 'lucide-react';
interface PhotoUploadProps {
  label: string;
  onImageSelect?: (base64Image: string) => void;
}
export function PhotoUpload({ label, onImageSelect }: PhotoUploadProps) {
  const [preview, setPreview] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const convertToOptimizedDataUrl = React.useCallback(async (file: File) => {
    const rawDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        if (!result) {
          reject(new Error('Failed to read image'));
          return;
        }
        resolve(result);
      };
      reader.onerror = () => reject(new Error('Failed to read image'));
      reader.readAsDataURL(file);
    });

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = rawDataUrl;
    });

    const maxEdge = 1280;
    const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
    const targetWidth = Math.max(1, Math.round(image.width * scale));
    const targetHeight = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext('2d');
    if (!context) return rawDataUrl;
    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
    return optimizedDataUrl || rawDataUrl;
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void convertToOptimizedDataUrl(file)
        .then((dataUrl) => {
          setPreview(dataUrl);
          onImageSelect?.(dataUrl);
        })
        .catch((error) => {
          console.error('Failed to process image upload:', error);
        });
    }
  };
  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-text-secondary ml-1">
        {label}
      </span>
      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-full aspect-[3/4] rounded-2xl border-2 border-dashed border-white/10 bg-card hover:bg-white/5 transition-colors flex flex-col items-center justify-center gap-3 group relative overflow-hidden">

        {preview ? (
          <img src={preview} alt={label} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-text-tertiary group-hover:text-accent transition-colors">
              <Camera size={24} />
            </div>
            <span className="text-sm text-text-tertiary group-hover:text-text-secondary">
              Tap to upload
            </span>
          </>
        )}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>);

}
