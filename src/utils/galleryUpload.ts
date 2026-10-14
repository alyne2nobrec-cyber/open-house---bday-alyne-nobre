import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';

export interface GalleryUploadResult {
  url: string;
  thumbnailUrl?: string;
  type: 'image' | 'video';
  fileName: string;
  fileSize: number;
}

export interface GalleryUploadProgress {
  percent: number;
  status: 'compressing' | 'uploading' | 'thumbnail' | 'done' | 'error';
  error?: string;
}

const MAX_VIDEO_SIZE = 30 * 1024 * 1024; // 30 MB
const MAX_GIF_SIZE = 5 * 1024 * 1024; // 5 MB

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
 * Generates a thumbnail image from the first frame of a video file.
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
    }, 8000);

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
          0.8
        );
      } catch (err) {
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
 * Uploads a photo or video to Firebase Storage in the gallery/ folder with live progress tracking.
 */
export async function uploadGalleryMediaFile(
  file: File,
  onProgress?: (progress: GalleryUploadProgress) => void
): Promise<GalleryUploadResult> {
  if (!storage) {
    throw new Error('Firebase Storage não está configurado neste ambiente.');
  }

  const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|avi)$/i.test(file.name);
  const isGif = file.type === 'image/gif' || /\.gif$/i.test(file.name);

  // 1. Validations
  if (isVideo) {
    if (file.size > MAX_VIDEO_SIZE) {
      throw new Error(`Vídeo excede o limite de 30 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB). Reduza o vídeo antes de enviar.`);
    }
  } else if (isGif) {
    if (file.size > MAX_GIF_SIZE) {
      throw new Error(`GIF excede o limite de 5 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB).`);
    }
  }

  let uploadBlob: Blob | File = file;
  let mimeType = file.type || (isVideo ? 'video/mp4' : 'image/jpeg');

  // 2. Image compression (if not GIF or Video)
  if (!isVideo && !isGif) {
    onProgress?.({ percent: 10, status: 'compressing' });
    try {
      uploadBlob = await compressGalleryImage(file, 1600, 0.85);
      mimeType = 'image/jpeg';
    } catch {
      uploadBlob = file;
    }
  }

  // 3. Generate video thumbnail if video
  let thumbnailBlob: Blob | null = null;
  if (isVideo) {
    onProgress?.({ percent: 20, status: 'thumbnail' });
    try {
      thumbnailBlob = await generateVideoThumbnail(file, 800);
    } catch (err) {
      console.warn('Could not generate video thumbnail:', err);
    }
  }

  // 4. Upload main media file
  onProgress?.({ percent: 25, status: 'uploading' });
  const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const mainFilename = `gallery/${Date.now()}_${cleanName}`;
  const mainRef = ref(storage, mainFilename);

  const uploadTask = uploadBytesResumable(mainRef, uploadBlob, {
    contentType: mimeType,
  });

  const mainUrl = await new Promise<string>((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 70; // 25% to 95%
        onProgress?.({ percent: Math.round(25 + progress), status: 'uploading' });
      },
      (error) => {
        let msg = error.message;
        if (error.code === 'storage/unauthorized') {
          msg = 'Permissão negada no Firebase Storage. Verifique se você está conectada como anfitriã e se as storage.rules foram publicadas.';
        }
        reject(new Error(msg));
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadUrl);
        } catch (err) {
          reject(err);
        }
      }
    );
  });

  // 5. Upload thumbnail if available
  let thumbnailUrl: string | undefined;
  if (thumbnailBlob) {
    try {
      const thumbFilename = `gallery/thumbnails/${Date.now()}_thumb_${cleanName.replace(/\.[^.]+$/, '')}.jpg`;
      const thumbRef = ref(storage, thumbFilename);
      const thumbTask = uploadBytesResumable(thumbRef, thumbnailBlob, {
        contentType: 'image/jpeg',
      });
      thumbnailUrl = await new Promise<string>((resolve, reject) => {
        thumbTask.on(
          'state_changed',
          null,
          (err) => reject(err),
          async () => {
            const url = await getDownloadURL(thumbTask.snapshot.ref);
            resolve(url);
          }
        );
      });
    } catch (err) {
      console.warn('Could not upload video thumbnail, will use video URL as fallback:', err);
    }
  }

  onProgress?.({ percent: 100, status: 'done' });

  return {
    url: mainUrl,
    thumbnailUrl,
    type: isVideo ? 'video' : 'image',
    fileName: file.name,
    fileSize: file.size,
  };
}
