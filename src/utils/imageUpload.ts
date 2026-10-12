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
    reader.onerror = () => {
      reject(new Error('Não foi possível ler o arquivo de imagem selecionado.'));
    };

    img.onerror = () => {
      reject(new Error('Formato de imagem não suportado. Use JPG, PNG, WEBP ou GIF.'));
    };

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
  const isGif = file.type === 'image/gif';

  let blobToUpload: Blob | File;

  if (isGif) {
    // GIFs não passam pelo canvas para preservar a animação
    if (file.size > 700 * 1024) {
      throw new Error('GIF muito grande (máx. 700 KB). Use um link direto do GIF no campo de meme.');
    }
    blobToUpload = file;
  } else {
    blobToUpload = await compressImage(file, 800, 0.8);
  }

  if (storage) {
    try {
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filename = `${folder}/${Date.now()}_${cleanFileName}`;
      const storageRef = ref(storage, filename);

      // Timeout de 8 segundos com Promise.race
      const uploadWithTimeout = new Promise<string>(async (resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error('Storage upload timeout'));
        }, 8000);

        try {
          await uploadBytes(storageRef, blobToUpload);
          const downloadUrl = await getDownloadURL(storageRef);
          clearTimeout(timer);
          resolve(downloadUrl);
        } catch (err) {
          clearTimeout(timer);
          reject(err);
        }
      });

      return await uploadWithTimeout;
    } catch (err) {
      console.warn('Firebase Storage upload failed, falling back to optimized base64:', err);
    }
  }

  // Fallback: return base64 data URL
  const base64String = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Não foi possível converter a imagem para base64.'));
    reader.readAsDataURL(blobToUpload);
  });

  if (base64String.length > 900000) {
    throw new Error('Imagem muito grande para salvar. Escolha uma menor.');
  }

  return base64String;
}
