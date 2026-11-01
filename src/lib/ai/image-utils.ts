/**
 * Resizes an image to max 1024px on its longest edge, re-draws it on a 2D canvas
 * (which strips all EXIF, GPS location, and camera metadata), and encodes as JPEG (~0.8 quality).
 * Never uploads or persists the image anywhere.
 */
export async function preparePlantImageForScan(
  file: Blob,
  maxDimension: number = 1024,
  quality: number = 0.8
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please select a valid image file.');
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error('Image file is too large (max 20 MB).');
  }

  const bitmap = await createImageBitmap(file);
  try {
    if (!bitmap.width || !bitmap.height) {
      throw new Error('Invalid image dimensions.');
    }
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context is unavailable.');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    bitmap.close();
  }
}

/**
 * Captures a frame from a live HTMLVideoElement, resizing to max 1024px and encoding as JPEG ~0.8.
 */
export function captureVideoFrameForScan(
  video: HTMLVideoElement,
  maxDimension: number = 1024,
  quality: number = 0.8
): string {
  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 480;
  const scale = Math.min(1, maxDimension / Math.max(vw, vh));
  const width = Math.max(1, Math.round(vw * scale));
  const height = Math.max(1, Math.round(vh * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context is unavailable.');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(video, 0, 0, width, height);

  return canvas.toDataURL('image/jpeg', quality);
}
