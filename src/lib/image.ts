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
 * Sample a photo as RGB pixels, on the phone: the middle (where the cake usually is)
 * and the outer edge (usually the table, wall or board) so the background can be removed.
 */
export async function samplePhoto(dataUrl: string, size = 64): Promise<{ center: Array<[number, number, number]>; border: Array<[number, number, number]> }> {
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
  if (!ctx) return { center: [], border: [] };
  ctx.drawImage(img, 0, 0, size, size);
  const d = ctx.getImageData(0, 0, size, size).data;
  const center: Array<[number, number, number]> = [];
  const border: Array<[number, number, number]> = [];
  const edge = Math.round(size * 0.08);
  const lo = Math.round(size * 0.2);
  const hi = size - lo;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if ((d[i + 3] ?? 0) < 200) continue;
      const px: [number, number, number] = [d[i]!, d[i + 1]!, d[i + 2]!];
      if (x < edge || y < edge || x >= size - edge || y >= size - edge) border.push(px);
      else if (x >= lo && x < hi && y >= lo && y < hi) center.push(px);
    }
  }
  return { center, border };
}
