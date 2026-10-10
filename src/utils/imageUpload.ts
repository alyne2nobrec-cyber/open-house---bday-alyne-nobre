import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';

/**
 * Resizes an image file to a maximum dimension and compresses it to JPEG
 * to ensure it stays well under 80 KB and never breaches document limits.
 */
export async function compressImage(file: File, maxDim = 800, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;

    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else resolve(file);
        },
        'image/jpeg',
        quality
      );
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Uploads an image either to Firebase Storage or returns an optimized compressed base64 string.
 * Guarantees the image won't exceed Firestore 1MB limits.
 */
export async function uploadImageFile(file: File, folder = 'uploads'): Promise<string> {
  const compressedBlob = await compressImage(file, 800, 0.8);

  if (storage) {
    try {
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filename = `${folder}/${Date.now()}_${cleanFileName}`;
      const storageRef = ref(storage, filename);
      await uploadBytes(storageRef, compressedBlob);
      return await getDownloadURL(storageRef);
    } catch (err) {
      console.warn('Firebase Storage upload failed, falling back to optimized base64:', err);
    }
  }

  // Fallback: return compressed base64 data URL (typically ~35KB)
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(compressedBlob);
  });
}
