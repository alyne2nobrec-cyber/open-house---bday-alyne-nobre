import { uploadToCloudinary, isCloudinaryConfigured } from './cloudinary';

/**
 * Resizes an image file to a maximum dimension and compresses it to JPEG
 * to ensure it stays lightweight and never breaches document limits.
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
 * Uploads an image either to Cloudinary (preferred) or returns an optimized compressed base64 string fallback.
 * Used for gift photos, pix QR codes, and custom assets.
 */
export async function uploadImageFile(file: File, folder = 'uploads'): Promise<string> {
  const isGif = file.type === 'image/gif';

  let blobToUpload: Blob | File;

  if (isGif) {
    if (file.size > 2 * 1024 * 1024) {
      throw new Error('GIF muito grande (máx. 2 MB). Use um link direto do GIF no campo correspondente.');
    }
    blobToUpload = file;
  } else {
    blobToUpload = await compressImage(file, 800, 0.82);
  }

  // 1. Try Cloudinary if configured
  if (isCloudinaryConfigured()) {
    try {
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const result = await uploadToCloudinary(blobToUpload, {
        folder: `chadecasa/${folder}`,
        resourceType: 'image',
        customFileName: `${Date.now()}_${cleanFileName}`,
      });
      return result.secureUrl || result.url;
    } catch (err) {
      console.warn('Cloudinary upload warning, falling back to base64:', err);
    }
  }

  // 2. Fallback: return optimized base64 data URL
  const base64String = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Não foi possível converter a imagem para base64.'));
    reader.readAsDataURL(blobToUpload);
  });

  if (base64String.length > 900000) {
    throw new Error('Imagem muito grande para salvar. Escolha uma imagem menor ou configure o Cloudinary.');
  }

  return base64String;
}
