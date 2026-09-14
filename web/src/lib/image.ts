/**
 * Utilitaires de traitement d'image 100% local (Canvas API) :
 * compression/redimensionnement (perf sur téléphones modestes),
 * rotation, et amélioration simple de lisibilité (contraste/luminosité).
 * NB: la détection automatique des 4 coins du document (perspective
 * correction complète) est une amélioration future documentée dans le
 * README — la V1 fournit une rotation + un recadrage rectangulaire
 * manuel, qui couvre déjà le cas d'usage principal (photo bien cadrée).
 */

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function processImage(
  dataUrl: string,
  options: { maxDimension?: number; rotationDeg?: number; enhance?: boolean } = {},
): Promise<string> {
  const { maxDimension = 2000, rotationDeg = 0, enhance = true } = options;

  const img = await loadImage(dataUrl);
  const angleRad = (rotationDeg * Math.PI) / 180;
  const swap = rotationDeg === 90 || rotationDeg === 270;

  let srcW = img.naturalWidth;
  let srcH = img.naturalHeight;

  // Redimensionnement pour limiter la mémoire consommée (perf téléphones modestes).
  const scale = Math.min(1, maxDimension / Math.max(srcW, srcH));
  srcW = Math.round(srcW * scale);
  srcH = Math.round(srcH * scale);

  const canvas = document.createElement('canvas');
  canvas.width = swap ? srcH : srcW;
  canvas.height = swap ? srcW : srcH;
  const ctx = canvas.getContext('2d')!;

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(angleRad);
  ctx.drawImage(img, -srcW / 2, -srcH / 2, srcW, srcH);
  ctx.restore();

  if (enhance) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    applyContrastBrightness(imageData.data, 15, 10);
    ctx.putImageData(imageData, 0, 0);
  }

  return canvas.toDataURL('image/jpeg', 0.85);
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/** Amélioration simple de lisibilité : +contraste, +luminosité légère. */
function applyContrastBrightness(data: Uint8ClampedArray, contrast: number, brightness: number) {
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const v = data[i + c];
      data[i + c] = clamp(factor * (v - 128) + 128 + brightness);
    }
  }
}

function clamp(v: number) {
  return Math.max(0, Math.min(255, v));
}

export function estimateDataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] ?? '';
  return Math.round((base64.length * 3) / 4);
}
