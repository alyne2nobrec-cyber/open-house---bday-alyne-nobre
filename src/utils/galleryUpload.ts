import {
  uploadToCloudinary,
  isCloudinaryConfigured,
  getCloudinaryVideoThumbnail,
} from './cloudinary';

export interface GalleryUploadResult {
  url: string;
  thumbnailUrl?: string;
  type: 'image' | 'video';
  fileName: string;
  fileSize: number;
  publicId?: string;
}

export interface GalleryUploadProgress {
  percent: number;
  status: 'compressing' | 'uploading' | 'thumbnail' | 'done' | 'error';
  error?: string;
}

const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MB on Cloudinary
const MAX_GIF_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * Resizes an image to maximum 1600px width/height while maintaining aspect ratio and crisp details.
 */
export async function compressGalleryImage(file: File, maxDim = 1600, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      reject(new Error('Não foi possível ler a imagem selecionada.'));
    };

    img.onerror = () => {
      reject(new Error('Formato de imagem inválido ou corrompido. Use JPG, PNG ou WEBP.'));
    };

    img.onload = () => {
      let { width, height } = img;

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

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
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
 * Generates an optional client-side video thumbnail fallback using HTML5 Video + Canvas.
 */
export async function generateVideoThumbnail(file: File, maxDim = 800): Promise<Blob | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
    };

    const timeout = setTimeout(() => {
      cleanup();
      resolve(null);
    }, 6000);

    video.onloadeddata = () => {
      video.currentTime = Math.min(0.5, (video.duration || 1) / 2);
    };

    video.onseeked = () => {
      clearTimeout(timeout);
      try {
        let { videoWidth: width, videoHeight: height } = video;
        if (!width || !height) {
          cleanup();
          resolve(null);
          return;
        }

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
          cleanup();
          resolve(null);
          return;
        }

        ctx.drawImage(video, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            cleanup();
            resolve(blob);
          },
          'image/jpeg',
          0.85
        );
      } catch {
        cleanup();
        resolve(null);
      }
    };

    video.onerror = () => {
      clearTimeout(timeout);
      cleanup();
      resolve(null);
    };
  });
}

/**
 * Uploads a photo or video to Cloudinary with live progress tracking and automatic thumbnail generation.
 */
export async function uploadGalleryMediaFile(
  file: File,
  onProgress?: (progress: GalleryUploadProgress) => void,
  fallbackSettings?: { cloudinaryCloudName?: string; cloudinaryUploadPreset?: string }
): Promise<GalleryUploadResult> {
  if (!isCloudinaryConfigured(fallbackSettings)) {
    throw new Error(
      'Cloudinary não configurado. Clique no botão "Configurar Cloudinary" acima para informar o Cloud Name e o Upload Preset (é 100% gratuito!).'
    );
  }

  const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(file.name);
  const isGif = file.type === 'image/gif' || /\.gif$/i.test(file.name);

  // 1. Validations
  if (isVideo) {
    if (file.size > MAX_VIDEO_SIZE) {
      throw new Error(
        `Vídeo excede o limite de 100 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB). Reduza o vídeo antes de enviar.`
      );
    }
  } else if (isGif) {
    if (file.size > MAX_GIF_SIZE) {
      throw new Error(`GIF excede o limite de 10 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB).`);
    }
  }

  let uploadBlob: Blob | File = file;

  // 2. Pre-process image compression if not video/gif
  if (!isVideo && !isGif) {
    onProgress?.({ percent: 10, status: 'compressing' });
    try {
      uploadBlob = await compressGalleryImage(file, 1600, 0.85);
    } catch {
      uploadBlob = file;
    }
  }

  // 3. Upload to Cloudinary with real progress tracking
  onProgress?.({ percent: 15, status: 'uploading' });

  const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const customFileName = `${Date.now()}_${cleanName}`;

  try {
    const result = await uploadToCloudinary(uploadBlob, {
      folder: 'chadecasa/gallery',
      resourceType: isVideo ? 'video' : 'image',
      customFileName,
      fallbackSettings,
      onProgress: (percent) => {
        // Map 0..100 to 15..95%
        const mapped = Math.round(15 + (percent * 0.8));
        onProgress?.({ percent: mapped, status: 'uploading' });
      },
    });

    onProgress?.({ percent: 95, status: 'thumbnail' });

    let finalThumbnail = result.thumbnailUrl;
    if (isVideo && !finalThumbnail) {
      finalThumbnail = getCloudinaryVideoThumbnail(result.secureUrl, { width: 800 });
    }

    onProgress?.({ percent: 100, status: 'done' });

    return {
      url: result.secureUrl,
      thumbnailUrl: finalThumbnail,
      type: isVideo ? 'video' : 'image',
      fileName: file.name,
      fileSize: file.size,
      publicId: result.publicId,
    };
  } catch (err: any) {
    onProgress?.({ percent: 0, status: 'error', error: err.message });
    throw err;
  }
}
