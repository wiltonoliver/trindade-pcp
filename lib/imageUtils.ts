/**
 * Utility functions for handling, compressing and formatting images
 * in factory order entries and production tracking.
 */

/**
 * Compresses an image File or Blob using HTML5 Canvas to a lightweight base64 Data URL.
 * Keeps aspect ratio within maxWidth / maxHeight and applies JPEG/WebP compression.
 */
export async function compressImageFile(
  file: File | Blob,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate proportional scale
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // Fallback to original data URL if 2D context fails
          resolve(readerEvent.target?.result as string);
          return;
        }

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Try webp first, fallback to jpeg
        try {
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        } catch {
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        }
      };

      img.onerror = () => {
        reject(new Error('Erro ao carregar a imagem selecionada.'));
      };

      img.src = readerEvent.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('Erro ao ler o arquivo de imagem.'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Formats byte size into human readable string (KB, MB).
 */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
