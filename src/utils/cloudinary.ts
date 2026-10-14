/**
 * Cloudinary Media Storage Utility
 * Replaces Firebase Storage for high-speed, generous-quota image & video hosting.
 */

export interface CloudinaryConfig {
  cloudName: string;
  uploadPreset: string;
}

export interface CloudinaryUploadResult {
  url: string;
  secureUrl: string;
  thumbnailUrl?: string;
  publicId: string;
  format: string;
  resourceType: 'image' | 'video' | 'raw';
  bytes: number;
  width?: number;
  height?: number;
  duration?: number;
}

const LOCAL_STORAGE_CLOUD_NAME = 'alyne_cloudinary_cloud_name_v1';
const LOCAL_STORAGE_UPLOAD_PRESET = 'alyne_cloudinary_upload_preset_v1';

/**
 * Resolves active Cloudinary configuration.
 * Checks environment variables first, then localStorage cache, then optional passed fallback.
 */
export function getCloudinaryConfig(fallbackSettings?: {
  cloudinaryCloudName?: string;
  cloudinaryUploadPreset?: string;
}): CloudinaryConfig {
  const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : ({} as any);

  const envCloudName = env.VITE_CLOUDINARY_CLOUD_NAME || env.CLOUDINARY_CLOUD_NAME || '';
  const envPreset = env.VITE_CLOUDINARY_UPLOAD_PRESET || env.CLOUDINARY_UPLOAD_PRESET || '';

  const localCloudName = typeof localStorage !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_CLOUD_NAME) || '' : '';
  const localPreset = typeof localStorage !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_UPLOAD_PRESET) || '' : '';

  const settingsCloudName = fallbackSettings?.cloudinaryCloudName || '';
  const settingsPreset = fallbackSettings?.cloudinaryUploadPreset || '';

  const cloudName = (envCloudName || settingsCloudName || localCloudName).trim();
  const uploadPreset = (envPreset || settingsPreset || localPreset).trim();

  return { cloudName, uploadPreset };
}

/**
 * Saves Cloudinary credentials to local storage for instant client-side availability.
 */
export function saveCloudinaryConfigLocally(config: CloudinaryConfig): void {
  if (typeof localStorage === 'undefined') return;
  if (config.cloudName) {
    localStorage.setItem(LOCAL_STORAGE_CLOUD_NAME, config.cloudName.trim());
  } else {
    localStorage.removeItem(LOCAL_STORAGE_CLOUD_NAME);
  }

  if (config.uploadPreset) {
    localStorage.setItem(LOCAL_STORAGE_UPLOAD_PRESET, config.uploadPreset.trim());
  } else {
    localStorage.removeItem(LOCAL_STORAGE_UPLOAD_PRESET);
  }
}

/**
 * Checks whether Cloudinary credentials are configured.
 */
export function isCloudinaryConfigured(fallbackSettings?: {
  cloudinaryCloudName?: string;
  cloudinaryUploadPreset?: string;
}): boolean {
  const { cloudName, uploadPreset } = getCloudinaryConfig(fallbackSettings);
  return Boolean(cloudName && uploadPreset);
}

/**
 * Generates an automatic video poster / thumbnail URL using Cloudinary transformations.
 * Extracts the frame at start-offset 0 with high visual quality and responsive dimensions.
 */
export function getCloudinaryVideoThumbnail(videoUrl: string, options: { width?: number; height?: number } = {}): string {
  if (!videoUrl) return '';

  const { width = 800 } = options;

  // If this is a Cloudinary video URL: https://res.cloudinary.com/<cloud>/video/upload/...
  if (videoUrl.includes('cloudinary.com') && videoUrl.includes('/video/upload/')) {
    // Replace the video extension (.mp4, .mov, etc.) with .jpg
    const jpgUrl = videoUrl.replace(/\.[a-zA-Z0-9]+(\?.*)?$/, '.jpg$1');
    // Inject thumbnail transformation: start offset 0s, auto quality, auto format, width limit
    const transform = `so_0,w_${width},c_limit,q_auto,f_auto/`;
    return jpgUrl.replace('/video/upload/', `/video/upload/${transform}`);
  }

  // Fallback for non-Cloudinary or already image URLs
  return videoUrl;
}

/**
 * Generates an optimized image URL using Cloudinary transformations (auto format + auto quality).
 */
export function getCloudinaryOptimizedImageUrl(imageUrl: string, options: { width?: number; quality?: string } = {}): string {
  if (!imageUrl || !imageUrl.includes('cloudinary.com') || !imageUrl.includes('/image/upload/')) {
    return imageUrl;
  }
  const { width = 1600 } = options;
  const transform = `w_${width},c_limit,q_auto,f_auto/`;
  return imageUrl.replace('/image/upload/', `/image/upload/${transform}`);
}

/**
 * Uploads a file directly to Cloudinary using an unsigned upload preset.
 * Supports live progress tracking via XMLHttpRequest.
 */
export async function uploadToCloudinary(
  fileOrBlob: File | Blob,
  options: {
    folder?: string;
    resourceType?: 'image' | 'video' | 'auto';
    customFileName?: string;
    onProgress?: (percent: number) => void;
    fallbackSettings?: { cloudinaryCloudName?: string; cloudinaryUploadPreset?: string };
  } = {}
): Promise<CloudinaryUploadResult> {
  const { cloudName, uploadPreset } = getCloudinaryConfig(options.fallbackSettings);

  if (!cloudName || !uploadPreset) {
    throw new Error(
      'Cloudinary não configurado. Por favor, informe o Cloud Name e o Upload Preset na aba de Galeria ou Personalizar Evento.'
    );
  }

  // Determine resource type
  let resourceType = options.resourceType || 'auto';
  if (resourceType === 'auto') {
    const isVideo =
      fileOrBlob.type.startsWith('video/') ||
      (fileOrBlob instanceof File && /\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(fileOrBlob.name));
    resourceType = isVideo ? 'video' : 'image';
  }

  const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/${resourceType}/upload`;

  const formData = new FormData();
  const fileName = options.customFileName || (fileOrBlob instanceof File ? fileOrBlob.name : 'upload.jpg');
  formData.append('file', fileOrBlob, fileName);
  formData.append('upload_preset', uploadPreset);

  if (options.folder) {
    formData.append('folder', options.folder);
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open('POST', endpoint, true);

    if (xhr.upload && options.onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.min(99, Math.round((event.loaded / event.total) * 100));
          options.onProgress?.(percent);
        }
      };
    }

    xhr.onload = () => {
      let responseJson: any = null;
      try {
        responseJson = JSON.parse(xhr.responseText);
      } catch {
        // Non-JSON response
      }

      if (xhr.status >= 200 && xhr.status < 300 && responseJson) {
        options.onProgress?.(100);

        const secureUrl = responseJson.secure_url || responseJson.url;
        let thumbnailUrl: string | undefined = undefined;

        if (responseJson.resource_type === 'video' || resourceType === 'video') {
          thumbnailUrl = getCloudinaryVideoThumbnail(secureUrl, { width: 800 });
        }

        resolve({
          url: responseJson.url || secureUrl,
          secureUrl,
          thumbnailUrl,
          publicId: responseJson.public_id,
          format: responseJson.format || '',
          resourceType: responseJson.resource_type || (resourceType as any),
          bytes: responseJson.bytes || 0,
          width: responseJson.width,
          height: responseJson.height,
          duration: responseJson.duration,
        });
      } else {
        const errorMsg =
          responseJson?.error?.message ||
          `Erro HTTP ${xhr.status} no upload para o Cloudinary. Verifique se o Cloud Name ("${cloudName}") e o Upload Preset ("${uploadPreset}") estão corretos e marcados como "Unsigned".`;
        reject(new Error(errorMsg));
      }
    };

    xhr.onerror = () => {
      reject(
        new Error(
          'Falha de rede ao conectar com o Cloudinary. Verifique sua conexão ou se há bloqueadores de requisições.'
        )
      );
    };

    xhr.ontimeout = () => {
      reject(new Error('Tempo limite excedido ao enviar arquivo para o Cloudinary.'));
    };

    // 2 minute timeout for larger videos
    xhr.timeout = 120000;

    xhr.send(formData);
  });
}

/**
 * Tests a Cloudinary connection by uploading a tiny 1x1 GIF / PNG to verify credentials.
 */
export async function testCloudinaryConnection(
  cloudName: string,
  uploadPreset: string
): Promise<{ success: boolean; message: string }> {
  const cleanCloud = cloudName.trim();
  const cleanPreset = uploadPreset.trim();

  if (!cleanCloud) {
    return { success: false, message: 'Cloud Name não pode ficar em branco.' };
  }
  if (!cleanPreset) {
    return { success: false, message: 'Upload Preset não pode ficar em branco.' };
  }

  try {
    // 1x1 transparent PNG data URI
    const transparentPixel =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const res = await fetch(transparentPixel);
    const blob = await res.blob();

    const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cleanCloud)}/image/upload`;
    const formData = new FormData();
    formData.append('file', blob, 'connection_test.png');
    formData.append('upload_preset', cleanPreset);
    formData.append('folder', 'chadecasa/test');

    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (response.ok && (data.secure_url || data.url)) {
      return {
        success: true,
        message: `Conexão bem sucedida com Cloudinary! (Cloud: ${cleanCloud})`,
      };
    } else {
      const errorMsg = data?.error?.message || 'Falha desconhecida na validação.';
      return {
        success: false,
        message: `Erro do Cloudinary: ${errorMsg}`,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `Erro ao testar conexão: ${err.message || 'Verifique sua conexão.'}`,
    };
  }
}
