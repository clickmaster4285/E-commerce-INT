// Client-side image compression — draws the file into a canvas, scales it down
// and re-encodes as WebP so uploads stay small regardless of the original size.
export const compressImage = (file, { maxSize = 512, quality = 0.82, type = "image/webp" } = {}) =>
  new Promise((resolve, reject) => {
    if (!file || !file.type || !file.type.startsWith("image/")) {
      reject(new Error("Not an image file."));
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSize / Math.max(img.width || maxSize, img.height || maxSize));
      const width = Math.max(1, Math.round((img.width || maxSize) * scale));
      const height = Math.max(1, Math.round((img.height || maxSize) * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Image could not be compressed."));
            return;
          }
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(new Error("Compressed image could not be read."));
          reader.readAsDataURL(blob);
        },
        type,
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image could not be loaded."));
    };
    img.src = url;
  });
