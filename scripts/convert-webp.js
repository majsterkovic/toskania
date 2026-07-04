import sharp from 'sharp';
import { readdirSync } from 'fs';
import { join, extname, basename } from 'path';
import { fileURLToPath } from 'url';

const imagesDir = join(fileURLToPath(import.meta.url), '../../public/images');
const SUPPORTED = new Set(['.jpg', '.jpeg', '.png']);
const QUALITY = 82;

const files = readdirSync(imagesDir).filter(f => SUPPORTED.has(extname(f).toLowerCase()));

const results = await Promise.allSettled(
  files.map(async file => {
    const input = join(imagesDir, file);
    const output = join(imagesDir, basename(file, extname(file)) + '.webp');
    const info = await sharp(input).webp({ quality: QUALITY }).toFile(output);
    return { file, size: info.size };
  })
);

let converted = 0, failed = 0;
results.forEach((r, i) => {
  if (r.status === 'fulfilled') {
    process.stdout.write(`  ✓ ${files[i]} → ${(r.value.size / 1024).toFixed(0)} KB\n`);
    converted++;
  } else {
    process.stderr.write(`  ✗ ${files[i]}: ${r.reason.message}\n`);
    failed++;
  }
});
console.log(`\nWebP: ${converted} converted${failed ? `, ${failed} failed` : ''}`);
