const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const sourceFile = path.join(__dirname, '../../img/draft/map_select_v2/map_select_v2.png');
const outputFile = path.join(__dirname, '../src/assets/backgrounds/lobby-garden.png');

async function optimizeImage() {
  try {
    console.log('🎨 Optimizing map_select_v2.png for lobby background...\n');

    const metadata = await sharp(sourceFile).metadata();
    console.log('📐 Original dimensions:', metadata.width, 'x', metadata.height);

    const originalStats = fs.statSync(sourceFile);
    console.log('📦 Original size:', (originalStats.size / 1024 / 1024).toFixed(2), 'MB\n');

    // Resize to landscape game viewport with high quality
    await sharp(sourceFile)
      .resize(1136, 640, {
        fit: 'cover',
        position: 'center'
      })
      .png({
        compressionLevel: 9,
        adaptiveFiltering: true,
        palette: false, // Keep full color for quality
        effort: 10 // Maximum compression effort
      })
      .toFile(outputFile);

    const optimizedStats = fs.statSync(outputFile);
    const optMetadata = await sharp(outputFile).metadata();

    console.log('✅ Optimization complete!');
    console.log('📐 New dimensions:', optMetadata.width, 'x', optMetadata.height);
    console.log('📦 New size:', (optimizedStats.size / 1024).toFixed(2), 'KB');
    console.log('📉 Reduction:', ((1 - optimizedStats.size / originalStats.size) * 100).toFixed(1), '%');

    if (optimizedStats.size < 500 * 1024) {
      console.log('\n🎯 Target met: Under 500 KB!');
    } else {
      console.log('\n⚠️ Warning: Over 500 KB, may need further optimization');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

optimizeImage();
