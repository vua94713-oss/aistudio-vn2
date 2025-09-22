import { Style } from './types';

export const STYLES: Style[] = [
  {
    id: 'polaroid',
    name: 'Polaroid',
    prompt: "Create a Polaroid-style photo of a couple. The photo should have a nostalgic, slightly blurred look with a direct flash effect as if taken in a dimly lit room. Do not alter their faces. The background should be a simple white curtain. The man is playfully poking the woman's cheek, and she is smiling with her eyes closed. Both are expressing genuine joy and affection."
  },
  {
    id: '3d-hot-trend',
    name: '3D Hot Trend',
    prompt: "Use the nano-banana model to create a 1/7 scale commercialized figure of the character in the illustration, in a realistic style and environment. Place the figure on a computer desk, using a circular transparent acrylic base without any text. On the computer screen, display the ZBrush modeling process of the figure. Next to the computer screen, place a BANDAI-style toy packaging box printed with the original artwork."
  },
  {
    id: 'photo-restoration',
    name: 'Phục chế ảnh',
    prompt: "Use the provided photo as the reference image. Restore and inpaint only the damaged/missing areas while preserving the original face, pose and expression. Remove all stains, peeling paper, scratches, cracks and dirt; reconstruct missing facial features and clothing realistically and consistently with the reference. Restore natural, realistic colorization (warm neutral skin tones, natural black/dark-brown hair) while keeping a subtle vintage film look if necessary. Preserve original lighting, shadows and grain; reconstruct fine details (eyes, eyelashes, hair strands, lips, collar seam, texture of fabric). Keep identity and proportions exactly — do NOT change age, expression, face shape or add accessories (no glasses, jewelry, modern props). Recreate a plain neutral background matching the original tone.\nFinal output: photorealistic, high-detail restoration suitable for printing. Output resolution: 3840×2160 (4K) — if that is not available, 1920×1080 (Full HD). Use the image as the primary guide and only fill masked damaged areas."
  },
  {
    id: 'anime-portrait',
    name: 'Chân dung Anime',
    prompt: "Transform the person in the provided photo into a vibrant, high-quality anime portrait. Capture their key facial features, hair style, and expression, but render them in a classic anime art style. Use clean lines, cel-shading, and large, expressive eyes. The background should be a simple, soft-focus gradient that complements the character's colors. Do not change the original pose or character identity."
  },
  {
    id: 'cyberpunk-glow',
    name: 'Tỏa sáng Cyberpunk',
    prompt: "Reimagine the subject of the photo in a cyberpunk world. Integrate futuristic elements like neon lights, holographic interfaces, and cybernetic enhancements subtly onto their person and clothing. The background should be a dark, rainy city street illuminated by vibrant neon signs. Enhance the lighting to create dramatic contrasts with glowing highlights and deep shadows, giving the image a Blade Runner-esque atmosphere. Keep the original face recognizable."
  },
  {
    id: 'vintage-film',
    name: 'Phim Cũ',
    prompt: "Give the provided photo the aesthetic of a vintage 35mm film photograph from the 1980s. Apply a warm color cast, slightly muted tones, and visible but pleasant film grain. Add a subtle light leak effect in a corner. The focus should be slightly soft, mimicking the characteristics of vintage lenses. Do not alter the subjects or the composition, only apply the film effect."
  },
  {
    id: 'watercolor-painting',
    name: 'Tranh màu nước',
    prompt: "Convert the provided image into a beautiful watercolor painting. The final result should have visible brush strokes, soft-blended colors, and the characteristic texture of watercolor paper. Retain the overall composition and key elements of the original photo, but interpret them with an artistic, painterly feel. Pay attention to light and shadow, rendering them with translucent washes of color."
  }
];

export const AFFILIATE_LINK = 'https://s.shopee.vn/1BD1Zka4mm';
export const ZALO_LINK = 'https://zalo.me/g/uktqiz531';
export const TIKTOK_LINK = 'https://www.tiktok.com/@googlegeminiveo3?_t=ZS-8znn3m7wBrl&_r=1';