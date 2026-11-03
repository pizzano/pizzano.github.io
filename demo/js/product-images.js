/* Responsive image URLs for CDNs with a verified resizing API.
 * Unknown hosts, relative paths, signed URLs and data URLs are returned untouched.
 * Never append ?w= to Firebase/Google/other origins that do not support it.
 * This utility does not upload or recompress images stored in Firebase. */
const IMAGE_PRESETS = Object.freeze({
  menu: Object.freeze({ widths: [108, 216, 324], sizes: '(max-width: 360px) 84px, (max-width: 400px) 84px, 108px', ratio: 1, quality: 72 }),
  hero: Object.freeze({ widths: [480, 800, 1200], sizes: '(max-width: 520px) 100vw, 520px', ratio: 0.6, quality: 78 }),
  admin: Object.freeze({ widths: [56, 112, 168], sizes: '46px', ratio: 1, quality: 68 }),
  category: Object.freeze({ widths: [80, 160, 240], sizes: '76px', ratio: 1, quality: 68 }),
});

export function productImageSources(rawUrl, variant = 'menu') {
  const original = String(rawUrl || '').trim();
  const unchanged = { src: original, srcset: '', sizes: '' };
  const preset = IMAGE_PRESETS[variant];
  if (!original || !preset) return unchanged;
  let url;
  try { url = new URL(original); } catch { return unchanged; }

  // Unsplash's images CDN supports auto=format and exact size/quality params.
  // Other image URLs are not modified; appending unsupported params can break them.
  if (url.protocol !== 'https:' || url.hostname !== 'images.unsplash.com' ||
      !/^\/photo-[\w-]+$/.test(url.pathname) ||
      url.username || url.password) return unchanged;

  const makeUrl = width => {
    const resized = new URL(url.href);
    resized.searchParams.set('auto', 'format');
    resized.searchParams.set('fit', 'crop');
    resized.searchParams.set('w', String(width));
    resized.searchParams.set('h', String(Math.round(width * preset.ratio)));
    resized.searchParams.set('q', String(preset.quality));
    return resized.href;
  };

  // If srcset is unsupported, serve the middle resolution as a fallback.
  return {
    src: makeUrl(preset.widths[1]),
    srcset: preset.widths.map(width => makeUrl(width) + ' ' + width + 'w').join(', '),
    sizes: preset.sizes,
  };
}
