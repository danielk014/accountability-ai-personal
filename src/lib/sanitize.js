const ALLOWED_PROTOCOLS = ['data:', 'https:'];

/**
 * Sanitize a URL for use in an <img> src attribute.
 * Returns the URL string if it uses an allowed protocol, or null otherwise.
 */
export function sanitizeImageSrc(src) {
  if (typeof src !== 'string' || src.length === 0) {
    return null;
  }

  // data: URIs don't parse well with URL constructor, handle separately
  if (src.startsWith('data:')) {
    return src;
  }

  try {
    const parsed = new URL(src);
    if (ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
      return parsed.href;
    }
  } catch {
    // invalid URL
  }

  return null;
}
