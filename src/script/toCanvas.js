import QRCodeLib from 'qrcode';

export async function renderPosterToCanvas(title, time = new Date().toLocaleString()) {
  const url = window.location.href;
  const imageSrc = '/scorpion.webp';
  const img = new Image();
  img.src = imageSrc;
  await img.decode();

  const viewWidth = 402;
  const viewHeight = 842;

  const canvas = document.createElement('canvas');
  canvas.width = viewWidth;
  canvas.height = viewHeight;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#21262A';
  ctx.fillRect(0, 0, viewWidth, viewHeight);

  ctx.drawImage(img, 0, 0, viewWidth, viewWidth);

  const paddingPercent = 0.1;
  const padding = viewWidth * paddingPercent;
  const lineHeight = 24;

  const titleFontSize = '20px';
  const timeFontSize = '14px';
  ctx.fillStyle = '#f7f7f7';
  ctx.textAlign = 'left';
  // 测量宽度避免超宽
  const titleWidth = ctx.measureText(title).width;
  const isOverWidth = titleWidth > viewWidth - padding * 2;
  if (isOverWidth) {
    titleFontSize = '16px';
    timeFontSize = '12px';
  }
  ctx.font = titleFontSize + ' "Space Grotesk Variable", "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(title, padding, viewWidth + padding + lineHeight);

  ctx.font = timeFontSize + ' "Space Grotesk Variable", "Helvetica Neue", Arial, sans-serif';
  ctx.fillStyle = '#cccccc';
  ctx.fillText(time, padding, viewWidth + padding + lineHeight * 2);

  const qrCodeWidth = viewWidth * 0.6;
  const qrCodeDataUrl = await QRCodeLib.toDataURL(url, { width: qrCodeWidth, margin: 1 });
  const qrCodeImg = new Image();
  qrCodeImg.src = qrCodeDataUrl;
  await qrCodeImg.decode();
  ctx.drawImage(qrCodeImg, padding, viewWidth + padding + lineHeight * 3, qrCodeWidth, qrCodeWidth);
  return canvas.toDataURL();
}

export async function renderAndDownloadPosterToCanvas(title, time = new Date().toLocaleString()) {
  const dataUrl = await renderPosterToCanvas(title, time);
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `${title || 'poster'}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
