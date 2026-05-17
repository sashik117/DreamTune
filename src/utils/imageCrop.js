const loadImage = (src) => new Promise((resolve, reject) => {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = src;
});

export async function cropImageToDataUrl(src, position = { x: 50, y: 50 }, zoom = 1, size = 512, quality = 0.82) {
  const image = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const safeZoom = Math.max(1, Number(zoom) || 1);
  const objectX = Math.max(0, Math.min(100, Number(position?.x ?? 50))) / 100;
  const objectY = Math.max(0, Math.min(100, Number(position?.y ?? 50))) / 100;
  const drawScale = Math.max(size / image.width, size / image.height) * safeZoom;
  const drawWidth = image.width * drawScale;
  const drawHeight = image.height * drawScale;
  const dx = (size * objectX) - (drawWidth * objectX);
  const dy = (size * objectY) - (drawHeight * objectY);

  ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
  return canvas.toDataURL('image/jpeg', quality);
}

export async function dataUrlToFile(dataUrl, filename = 'image.jpg') {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type || 'image/jpeg' });
}
