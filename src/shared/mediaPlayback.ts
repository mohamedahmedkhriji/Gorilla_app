export const playMediaSafely = async (media: HTMLMediaElement | null | undefined) => {
  if (!media) return false;

  try {
    await media.play();
    return true;
  } catch {
    // Browsers reject play() during quick pause/unmount/visibility changes.
    return false;
  }
};
