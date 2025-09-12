// Emoji configuration and helpers

export const EMOJI_CATEGORIES = [
  {
    key: 'bili',
    label: 'bili',
    type: 'image',
    basePath: '/emoji/bili',
    manifest: '/emoji/bili/manifest.json',
    // Try these extensions in order when rendering if needed
    extensions: ['png', 'webp', 'gif'],
  },
];

export function getEmojiCategory(key) {
  return EMOJI_CATEGORIES.find((c) => c.key === key);
}

export function buildEmojiUrl(categoryKey, name, preferredExt = 'png') {
  const cat = getEmojiCategory(categoryKey);
  if (!cat) return '';
  const ext = preferredExt?.replace(/^\./, '') || 'png';
  return `${cat.basePath}/${name}.${ext}`;
}

// Load emoji items for a category from its manifest if available.
// Manifest format (either is accepted):
// - ["weixiao", "shengqi", ...]
// - [{ name: "weixiao", file: "weixiao.png" }, ...]
export async function loadEmojiItems(categoryKey) {
  const cat = getEmojiCategory(categoryKey);
  if (!cat || !cat.manifest) return [];
  try {
    const res = await fetch(cat.manifest, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data)) {
      return data
        .map((item) => {
          if (typeof item === 'string') return { name: item, file: `${item}.png` };
          if (item && typeof item === 'object') return { name: item.name, file: item.file || `${item.name}.png` };
          return null;
        })
        .filter(Boolean);
    }
    return [];
  } catch (e) {
    // Silent fail and return empty list; UI will display guidance
    return [];
  }
}

