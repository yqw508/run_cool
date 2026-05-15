const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// 选择第2张图（最匹配当前风格）
const sourceFile = path.join(__dirname, '../img/draft/runner-garden_v2/jimeng-2026-05-15-9189-生成一张精美萌系 2D 无尽跑酷游戏背景，主题是魔法花园。竖版手机 9_16 构....png');
const outputFile = path.join(__dirname, '../src/assets/backgrounds/runner-garden.png');

const GAME_WIDTH = 390;
const GAME_HEIGHT = 720;

async function optimizeImage() {
  try {
    console.log('🎨 优化魔法花园跑酷背景图...\n');

    const metadata = await sharp(sourceFile).metadata();
    console.log('📐 原始尺寸:', metadata.width, 'x', metadata.height);

    const originalStats = fs.statSync(sourceFile);
    console.log('📦 原始大小:', (originalStats.size / 1024 / 1024).toFixed(2), 'MB\n');

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

    const optimizedStats = fs.statSync(outputFile);
    const optMetadata = await sharp(outputFile).metadata();

    console.log('✅ 优化完成！');
    console.log('📐 新尺寸:', optMetadata.width, 'x', optMetadata.height);
    console.log('📦 新大小:', (optimizedStats.size / 1024).toFixed(2), 'KB');
    console.log('📉 压缩率:', ((1 - optimizedStats.size / originalStats.size) * 100).toFixed(1), '%\n');
    console.log('🎮 现在刷新浏览器查看魔法花园背景效果！');

  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

optimizeImage();
