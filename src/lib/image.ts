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

/**
 * Sample the middle of a photo (where the cake usually is) as RGB pixels, on the phone.
 * The edges are skipped because they are mostly table, wall or plate.
 */
export async function samplePixels(dataUrl: string, size = 48, keep = 0.6): Promise<Array<[number, number, number]>> {
  const img = new Image();
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error('unreadable'));
    img.src = dataUrl;
  });
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];
  const sw = img.naturalWidth * keep;
  const sh = img.naturalHeight * keep;
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, 0, 0, size, size);
  const d = ctx.getImageData(0, 0, size, size).data;
  const out: Array<[number, number, number]> = [];
  for (let i = 0; i < d.length; i += 4) if ((d[i + 3] ?? 0) > 200) out.push([d[i]!, d[i + 1]!, d[i + 2]!]);
  return out;
}
