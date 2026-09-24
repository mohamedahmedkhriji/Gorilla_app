import type { ImgHTMLAttributes, SyntheticEvent, VideoHTMLAttributes } from 'react';
import type { ExerciseRemoteMedia } from '../../services/exerciseVideos';

type ExerciseMediaProps = {
  src: string;
  mediaType?: ExerciseRemoteMedia['mediaType'] | null;
  alt?: string;
  className?: string;
  poster?: string;
  videoProps?: Omit<VideoHTMLAttributes<HTMLVideoElement>, 'src' | 'poster' | 'className'>;
  imageProps?: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt' | 'className'>;
};

const normalizeMediaType = (value: ExerciseMediaProps['mediaType']) => {
  const key = String(value || '').trim().toLowerCase();
  if (key === 'gif' || key === 'image') return 'image';
  return 'video';
};

export function ExerciseMedia({
  src,
  mediaType,
  alt = 'Exercise media',
  className,
  poster,
  videoProps,
  imageProps,
}: ExerciseMediaProps) {
  const playPreview = (event: SyntheticEvent<HTMLVideoElement>) => {
    if (!videoProps?.autoPlay) return;

    const video = event.currentTarget;
    video.muted = true;
    const playResult = video.play();
    if (playResult && typeof playResult.catch === 'function') {
      playResult.catch(() => {
        // Some browsers still block autoplay until the element is visible or interacted with.
      });
    }
  };

  if (normalizeMediaType(mediaType) === 'image') {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        loading="lazy"
        {...imageProps}
      />
    );
  }

  return (
    <video
      src={src}
      poster={poster}
      className={className}
      muted
      loop
      playsInline
      preload={videoProps?.autoPlay ? 'auto' : 'metadata'}
      onCanPlay={playPreview}
      onLoadedData={playPreview}
      {...videoProps}
    />
  );
}
