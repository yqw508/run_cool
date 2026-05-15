const sharp = require('sharp');
const path = require('path');

const inputFile = path.join(__dirname, '../src/assets/backgrounds/lobby-garden.png');
const outputFile = path.join(__dirname, '../src/assets/backgrounds/lobby-garden.png');

async function optimizeImage() {
  try {
    const metadata = await sharp(inputFile).metadata();
    console.log('Original dimensions:', metadata.width, 'x', metadata.height);
    console.log('Original format:', metadata.format);

    const originalStats = require('fs').statSync(inputFile);
    console.log('Original size:', (originalStats.size / 1024 / 1024).toFixed(2), 'MB');

    await sharp(inputFile)
      .resize(1136, 640, {
        fit: 'cover',
        position: 'center'
      })
      .png({
        quality: 80,
        compressionLevel: 9,
        adaptiveFiltering: true,
        forceRGBA: false
      })
      .toFile(outputFile.replace('.png', '-optimized.png'));

    const optimizedStats = require('fs').statSync(outputFile.replace('.png', '-optimized.png'));
    console.log('\nOptimized size:', (optimizedStats.size / 1024).toFixed(2), 'KB');
    console.log('Reduction:', ((1 - optimizedStats.size / originalStats.size) * 100).toFixed(1), '%');

    const optMetadata = await sharp(outputFile.replace('.png', '-optimized.png')).metadata();
    console.log('New dimensions:', optMetadata.width, 'x', optMetadata.height);

  } catch (error) {
    console.error('Error optimizing image:', error);
    process.exit(1);
  }
}

optimizeImage();
