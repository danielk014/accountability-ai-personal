const ALLOWED_PROTOCOLS = new Set(['data:', 'https:', 'blob:']);

/**
 * Sanitize a URL for use in an <img> src attribute.
 * Only allows data:, https:, and blob: protocols.
 * Returns a new safe string or null — never returns the original reference.
 */
export function sanitizeImageSrc(src) {
  if (typeof src !== 'string' || src.length === 0) {
    return null;
  }

  // data: URIs — validate prefix then return a copy
  if (src.startsWith('data:image/')) {
    return String(src);
  }

  // blob: URIs from URL.createObjectURL — validate and return a copy
  if (src.startsWith('blob:')) {
    try {
      const parsed = new URL(src);
      if (parsed.protocol === 'blob:') {
        return String(parsed.href);
      }
    } catch {
      return null;
    }
  }

  // https: URLs — validate and return a copy
  try {
    const parsed = new URL(src);
    if (parsed.protocol === 'https:') {
      return String(parsed.href);
    }
  } catch {
    // invalid URL
  }

  return null;
}
