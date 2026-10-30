const { app, nativeImage } = require('electron');
const { mkdir, writeFile } = require('node:fs/promises');
const { resolve, join } = require('node:path');

app.whenReady().then(async () => {
  try {
    const output = resolve(__dirname, '../build/installer-assets');
    await mkdir(output, { recursive: true });
    const image = nativeImage.createFromPath(resolve(__dirname, '../../../src/assets/images/icon.png'));
    if (image.isEmpty()) throw Error('Missing MMPlayer icon');
    const png = image.resize({ width: 256, height: 256 }).toPNG();
    const header = Buffer.alloc(22);
    header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4); header.writeUInt16LE(1, 10);
    header.writeUInt16LE(32, 12); header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18);
    await writeFile(join(output, 'icon.ico'), Buffer.concat([header, png]));
    const logo = nativeImage.createFromPath(resolve(__dirname, '../../../src/assets/images/splash-icon.png'));
    async function bitmap(name, width, height, size, x, y) {
      const rowSize = (width * 3 + 3) & ~3, pixels = Buffer.alloc(rowSize * height);
      const foreground = logo.resize({ width: size, height: size }).toBitmap();
      for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) {
        const amount = (row / height + col / width) / 2;
        let rgb = [17 + amount * 39, 14 + amount * 12, 26 + amount * 69];
        if (col >= x && col < x + size && row >= y && row < y + size) {
          const i = ((row - y) * size + col - x) * 4, alpha = foreground[i + 3] / 255;
          rgb = rgb.map((v, c) => v * (1 - alpha) + foreground[i + 2 - c] * alpha);
        }
        const target = (height - row - 1) * rowSize + col * 3;
        rgb.forEach((value, c) => pixels[target + 2 - c] = Math.round(value));
      }
      const bmp = Buffer.alloc(54);
      bmp.write('BM'); bmp.writeUInt32LE(54 + pixels.length, 2); bmp.writeUInt32LE(54, 10);
      bmp.writeUInt32LE(40, 14); bmp.writeInt32LE(width, 18); bmp.writeInt32LE(height, 22);
      bmp.writeUInt16LE(1, 26); bmp.writeUInt16LE(24, 28); bmp.writeUInt32LE(pixels.length, 34);
      await writeFile(join(output, name), Buffer.concat([bmp, pixels]));
    }
    await bitmap('sidebar.bmp', 164, 314, 104, 30, 48);
    await bitmap('header.bmp', 150, 57, 48, 94, 4);
    app.exit(0);
  } catch (error) { console.error(error); app.exit(1); }
});
