import sharp from 'sharp';
import { readdirSync, writeFileSync } from 'fs';
import { join, extname, basename } from 'path';
import { fileURLToPath } from 'url';

const imagesDir = join(fileURLToPath(import.meta.url), '../../public/images');
const manifestPath = join(fileURLToPath(import.meta.url), '../../src/image-manifest.json');
const SUPPORTED = new Set(['.jpg', '.jpeg', '.png']);
const QUALITY = 82;

// Szerokości wariantów responsywnych — dobrane pod faktyczne miejsca użycia:
// 200 — miniatury atrakcji (72/96 CSS px @2x), 400 — kafelki galerii na mobile,
// 800 — kafelki galerii na desktopie, 1600 — hero i podgląd w lightboxie @2x.
const WIDTHS = [200, 400, 800, 1600];
// Wariant "pełny" (bez sufiksu) nie przekracza tej szerokości — lightbox pokazuje
// obraz w max 90vw/80vh, więc oryginały 1920–2400px to czysty narzut transferu.
const MAX_FULL = 1600;

const files = readdirSync(imagesDir).filter((f) => SUPPORTED.has(extname(f).toLowerCase()));

async function convert(file) {
  const input = join(imagesDir, file);
  const name = basename(file, extname(file));
  const meta = await sharp(input).metadata();

  const fullWidth = Math.min(meta.width, MAX_FULL);
  const fullHeight = Math.round((meta.height * fullWidth) / meta.width);

  // Tylko warianty mniejsze od pełnego — nie skalujemy w górę.
  const smaller = WIDTHS.filter((w) => w < fullWidth);

  const sizes = await Promise.all([
    ...smaller.map((w) =>
      sharp(input)
        .resize({ width: w })
        .webp({ quality: QUALITY })
        .toFile(join(imagesDir, `${name}-${w}.webp`))
        .then((info) => info.size)
    ),
    sharp(input)
      .resize({ width: fullWidth, withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toFile(join(imagesDir, `${name}.webp`))
      .then((info) => info.size),
  ]);

  return {
    name,
    bytes: sizes.reduce((a, b) => a + b, 0),
    entry: { w: fullWidth, h: fullHeight, widths: [...smaller, fullWidth] },
  };
}

const results = await Promise.allSettled(files.map(convert));

const manifest = {};
let converted = 0;
let failed = 0;
let totalBytes = 0;

results.forEach((r, i) => {
  if (r.status === 'fulfilled') {
    manifest[r.value.name] = r.value.entry;
    totalBytes += r.value.bytes;
    const { widths } = r.value.entry;
    process.stdout.write(
      `  ✓ ${files[i]} → ${widths.length} wariantów (${widths.join('/')}px), ${(r.value.bytes / 1024).toFixed(0)} KB\n`
    );
    converted++;
  } else {
    process.stderr.write(`  ✗ ${files[i]}: ${r.reason.message}\n`);
    failed++;
  }
});

// Manifest jest importowany przez src/render.js — daje poprawne deskryptory `w`
// w srcset oraz intrinsic width/height (rezerwacja miejsca zanim obraz dojdzie).
const sorted = Object.fromEntries(Object.keys(manifest).sort().map((k) => [k, manifest[k]]));
writeFileSync(manifestPath, JSON.stringify(sorted, null, 2) + '\n');

console.log(
  `\nWebP: ${converted} obrazów, ${(totalBytes / 1048576).toFixed(1)} MB łącznie${failed ? `, ${failed} błędów` : ''}`
);
