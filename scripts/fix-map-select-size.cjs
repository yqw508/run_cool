const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const sourceFile = path.join(__dirname, '../img/draft/map_select_v2/map_select_v2.png');
const outputFile = path.join(__dirname, '../src/assets/backgrounds/map-select.png');

// Game viewport size
const GAME_WIDTH = 390;
const GAME_HEIGHT = 720;

async function fixImageSize() {
  try {
    console.log('🎨 Fixing map_select_v2.png size for correct aspect ratio...\n');

    const metadata = await sharp(sourceFile).metadata();
    console.log('📐 Original dimensions:', metadata.width, 'x', metadata.height);
    console.log('🎯 Target dimensions:', GAME_WIDTH, 'x', GAME_HEIGHT);

    // Resize to fit game viewport - use 'cover' to fill the screen
    // but keep the aspect ratio correct
    await sharp(sourceFile)
      .resize(GAME_WIDTH, GAME_HEIGHT, {
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

    const fixedStats = fs.statSync(outputFile);
    const optMetadata = await sharp(outputFile).metadata();

    console.log('\n✅ Fix complete!');
    console.log('📐 New dimensions:', optMetadata.width, 'x', optMetadata.height);
    console.log('📦 New size:', (fixedStats.size / 1024).toFixed(2), 'KB');
    console.log('\n🎮 This should now display correctly at 390x720!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixImageSize();
