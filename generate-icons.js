const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

const svgBuffer = fs.readFileSync('./assets/icon.svg');
const resDir = './android/app/src/main/res';

Promise.all(
  Object.entries(sizes).map(([folder, size]) =>
    sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(resDir, folder, 'ic_launcher.png'))
      .then(() =>
        sharp(svgBuffer)
          .resize(size, size)
          .png()
          .toFile(path.join(resDir, folder, 'ic_launcher_round.png')),
      ),
  ),
).then(() => console.log('Ícones gerados com sucesso!'));
