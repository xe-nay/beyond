// Renders the app icon, splash mark and Android adaptive icon from one SVG.
// Usage: node scripts/make-icons.mjs
import sharp from 'sharp';

const mark = (bg) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <radialGradient id="g" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#0E1A30"/><stop offset="1" stop-color="#000000"/></radialGradient>
    <linearGradient id="a" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#1FB8C9"/><stop offset="1" stop-color="#37E5F3"/></linearGradient>
  </defs>
  ${bg ? '<rect width="1024" height="1024" fill="url(#g)"/>' : ''}
  <path d="M 700 296 A 290 290 0 1 0 802 512" fill="none" stroke="url(#a)" stroke-width="64" stroke-linecap="round"/>
  <circle cx="790" cy="236" r="46" fill="#BEF85A"/>
</svg>`;
await sharp(Buffer.from(mark(true))).png().toFile('assets/icon.png');
await sharp(Buffer.from(mark(false))).resize(400, 400).png().toFile('assets/splash.png');
await sharp(Buffer.from(mark(false))).png().toFile('assets/adaptive-icon.png');
console.log('icons written');
