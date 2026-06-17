export async function imageElementToDataUrl(imageElement: HTMLImageElement): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = imageElement.naturalWidth || imageElement.width;
  canvas.height = imageElement.naturalHeight || imageElement.height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("image_capture_failed");
  }

  context.drawImage(imageElement, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}
