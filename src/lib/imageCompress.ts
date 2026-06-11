/**
 * Verkleinert ein Bild im Browser vor dem Upload.
 * Begrenzt die längste Kante auf maxEdge und exportiert als JPEG.
 * Fällt bei Fehlern auf die Originaldatei zurück.
 */
export const compressImage = async (
  file: File,
  maxEdge = 1600,
  quality = 0.8,
): Promise<File> => {
  if (!file.type.startsWith("image/")) return file;

  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = dataUrl;
    });

    const { width, height } = img;
    const scale = Math.min(1, maxEdge / Math.max(width, height));
    // Nichts zu tun, wenn das Bild bereits klein genug ist und kein JPEG erzwungen werden muss
    const targetW = Math.round(width * scale);
    const targetH = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) return file;

    // Falls die Komprimierung größer ist als das Original, Original behalten
    if (blob.size >= file.size && scale === 1) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "foto";
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
};
