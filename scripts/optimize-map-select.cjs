const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const sourceFile = path.join(__dirname, '../img/draft/map_select_v2/map_select_v2.png');
const outputFile = path.join(__dirname, '../src/assets/backgrounds/map-select.png');

async function optimizeImage() {
  try {
    console.log('🎨 Optimizing map_select_v2.png for MAP SELECT page background...\n');

    const metadata = await sharp(sourceFile).metadata();
    console.log('📐 Original dimensions:', metadata.width, 'x', metadata.height);

    const originalStats = fs.statSync(sourceFile);
    console.log('📦 Original size:', (originalStats.size / 1024 / 1024).toFixed(2), 'MB\n');

    // Resize to fit game viewport - map select needs good coverage
    await sharp(sourceFile)
      .resize(1136, 640, {
        fit: 'cover',
        position: 'center'
      })
      .png({
        compressionLevel: 9,
        adaptiveFiltering: true,
        palette: false,
        effort: 10
      })
      .toFile(outputFile);

    const optimizedStats = fs.statSync(outputFile);
    const optMetadata = await sharp(outputFile).metadata();

    console.log('✅ Optimization complete!');
    console.log('📐 New dimensions:', optMetadata.width, 'x', optMetadata.height);
    console.log('📦 New size:', (optimizedStats.size / 1024).toFixed(2), 'KB');
    console.log('📉 Reduction:', ((1 - optimizedStats.size / originalStats.size) * 100).toFixed(1), '%');

    const oldMapSelectStats = fs.statSync(path.join(__dirname, '../src/assets/backgrounds/map-select.png'));
    console.log('\n📊 Compared to old map-select.png:');
    console.log('   Old:', (oldMapSelectStats.size / 1024).toFixed(2), 'KB');
    console.log('   New:', (optimizedStats.size / 1024).toFixed(2), 'KB');
    console.log('   Savings:', (((oldMapSelectStats.size - optimizedStats.size) / oldMapSelectStats.size) * 100).toFixed(1), '%');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

optimizeImage();
