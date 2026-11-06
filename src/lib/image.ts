/**
 * Shrink an inspo photo in the browser before anything else happens.
 * Keeps uploads small on mobile data. The photo is never saved by Cakeita.
 */
export interface SmallImage {
  dataUrl: string;
  base64: string;
  mimeType: 'image/jpeg';
}

export async function resizeImage(file: File, maxPx = 1024, quality = 0.82): Promise<SmallImage> {
  if (!file.type.startsWith('image/')) throw new Error('not-image');
  if (file.size > 25 * 1024 * 1024) throw new Error('too-big');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('unreadable')); // e.g. HEIC on some browsers
      img.src = url;
    });
    const ratio = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * ratio));
    const h = Math.max(1, Math.round(img.naturalHeight * ratio));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('no-canvas');
    ctx.drawImage(img, 0, 0, w, h);
    const dataUrl = c.toDataURL('image/jpeg', quality);
    return { dataUrl, base64: dataUrl.split(',')[1] ?? '', mimeType: 'image/jpeg' };
  } finally {
    URL.revokeObjectURL(url);
  }
}
