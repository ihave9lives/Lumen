const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SOURCE = path.resolve(__dirname, 'source_icon.png');
const ICONS_DIR = path.resolve(__dirname, '..', 'src-tauri', 'icons');

async function main() {
  console.log('Source:', SOURCE);
  console.log('Icons dir:', ICONS_DIR);

  if (!fs.existsSync(SOURCE)) {
    // Try alternative location
    console.error('Source icon not found at:', SOURCE);
    return;
  }

  // Generate PNG sizes
  const sizes = [
    { name: '32x32.png', size: 32 },
    { name: '128x128.png', size: 128 },
    { name: '128x128@2x.png', size: 256 },
  ];

  for (const { name, size } of sizes) {
    await sharp(SOURCE)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(ICONS_DIR, name));
    console.log(`Created ${name}`);
  }

  // Generate ICO (use 256x256 PNG as the source for the ico)
  // For ICO, we'll create multiple sizes embedded
  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  const pngBuffers = [];
  for (const size of icoSizes) {
    const buf = await sharp(SOURCE)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    pngBuffers.push({ size, buf });
  }

  // Build ICO file manually
  const icoBuffer = buildIco(pngBuffers);
  fs.writeFileSync(path.join(ICONS_DIR, 'icon.ico'), icoBuffer);
  console.log('Created icon.ico');

  // For macOS icns, just copy the 256x256 as a placeholder
  // (proper icns would need iconutil on macOS)
  await sharp(SOURCE)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(ICONS_DIR, 'icon.icns.png'));
  // Copy as icns (Tauri will handle it on macOS builds)
  fs.copyFileSync(
    path.join(ICONS_DIR, '128x128@2x.png'),
    path.join(ICONS_DIR, 'icon.icns')
  );
  console.log('Created icon.icns (placeholder)');

  console.log('All icons generated!');
}

function buildIco(images) {
  // ICO format: header + directory entries + image data
  const numImages = images.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = dirEntrySize * numImages;
  let dataOffset = headerSize + dirSize;

  // Header
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);       // reserved
  header.writeUInt16LE(1, 2);       // type: 1 = ICO
  header.writeUInt16LE(numImages, 4); // count

  const dirEntries = [];
  const dataBuffers = [];

  for (const { size, buf } of images) {
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);   // width (0 = 256)
    entry.writeUInt8(size >= 256 ? 0 : size, 1);   // height (0 = 256)
    entry.writeUInt8(0, 2);          // color palette
    entry.writeUInt8(0, 3);          // reserved
    entry.writeUInt16LE(1, 4);       // color planes
    entry.writeUInt16LE(32, 6);      // bits per pixel
    entry.writeUInt32LE(buf.length, 8);   // image size
    entry.writeUInt32LE(dataOffset, 12);  // offset
    dirEntries.push(entry);
    dataBuffers.push(buf);
    dataOffset += buf.length;
  }

  return Buffer.concat([header, ...dirEntries, ...dataBuffers]);
}

main().catch(console.error);
