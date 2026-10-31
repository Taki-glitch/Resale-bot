/** Réduit une photo (1024 px max) et la convertit en JPEG base64 pour l'analyse IA. Rien n'est stocké. */
export async function fileToJpegBase64(
  file: File,
  maxSize = 1024,
  quality = 0.8,
): Promise<{ media_type: string; data: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Impossible de traiter la photo sur cet appareil.');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return { media_type: 'image/jpeg', data: dataUrl.split(',')[1] };
}
