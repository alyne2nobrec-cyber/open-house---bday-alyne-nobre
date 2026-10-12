/**
 * Utilities for validating and previewing meme URLs (GIF, WebP, MP4, etc.)
 */

/**
 * Normalizes user-entered meme URLs: trims, ensures https:// prefix, and converts Giphy view URLs.
 */
export function normalizeMemeUrl(raw?: string): string {
  if (!raw) return '';
  let trimmed = raw.trim();
  if (!trimmed) return '';

  // If user pasted without protocol, add https://
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = 'https://' + trimmed;
  }

  // Convert Giphy page URLs (e.g., https://giphy.com/gifs/funny-cat-abc123XYZ or https://giphy.com/gifs/abc123XYZ)
  // to direct media URLs: https://media.giphy.com/media/ID/giphy.gif
  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname.toLowerCase().endsWith('giphy.com') && parsed.pathname.includes('/gifs/')) {
      const parts = parsed.pathname.split('/').filter(Boolean);
      // Usually parts are ['gifs', 'slug-or-id'] or ['gifs', 'title', 'id']
      const lastPart = parts[parts.length - 1];
      if (lastPart) {
        // ID is after the last hyphen or the full part if no hyphen
        const id = lastPart.includes('-') ? lastPart.split('-').pop() : lastPart;
        if (id) {
          return `https://media.giphy.com/media/${id}/giphy.gif`;
        }
      }
    }
    return parsed.href;
  } catch {
    return '';
  }
}

/**
 * Determines whether the URL is a direct playable video, a direct image/gif, or invalid.
 */
export function getMemeKind(url: string): 'video' | 'image' | 'invalid' {
  if (!url) return 'invalid';
  const normalized = normalizeMemeUrl(url);
  if (!normalized) return 'invalid';

  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();

    // Direct video formats
    if (pathname.endsWith('.mp4') || pathname.endsWith('.webm')) {
      return 'video';
    }

    // Direct image formats
    if (
      pathname.endsWith('.gif') ||
      pathname.endsWith('.webp') ||
      pathname.endsWith('.png') ||
      pathname.endsWith('.jpg') ||
      pathname.endsWith('.jpeg') ||
      pathname.endsWith('.avif')
    ) {
      return 'image';
    }

    // Known direct gif/media hostnames
    if (
      host === 'media.giphy.com' ||
      host === 'i.giphy.com' ||
      host === 'media.tenor.com' ||
      host === 'c.tenor.com'
    ) {
      return 'image';
    }

    return 'invalid';
  } catch {
    return 'invalid';
  }
}
