import React from 'react';
import { Camera, Upload } from 'lucide-react';
interface PhotoUploadProps {
  label: string;
  onImageSelect?: (base64Image: string) => void;
}
export function PhotoUpload({ label, onImageSelect }: PhotoUploadProps) {
  const [preview, setPreview] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setPreview(base64);
        onImageSelect?.(base64);
      };
      reader.readAsDataURL(file);
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
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>);

}