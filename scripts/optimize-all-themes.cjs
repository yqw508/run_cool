const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const GAME_WIDTH = 390;
const GAME_HEIGHT = 720;

// 主题映射
const themes = [
  { id: 'campus', src: 'runner-garden-1.png', desc: '校园 - 粉色树' },
  { id: 'mall', src: 'runner-garden-2.png', desc: '商场 - 水晶石' },
  { id: 'zoo', src: 'runner-garden-3.png', desc: '动物园 - 郁金香' },
  { id: 'amusement', src: 'runner-garden-4.png', desc: '游乐园 - 魔法蘑菇' }
];

async function optimizeAll() {
  console.log('🎨 优化所有主题的背景图...\n');
  
  for (const theme of themes) {
    try {
      const srcPath = path.join(__dirname, `../img/review/${theme.src}`);
      const destPath = path.join(__dirname, `../src/assets/backgrounds/runner-${theme.id}.png`);
      
      console.log(`处理 ${theme.desc}...`);
      
      const metadata = await sharp(srcPath).metadata();
      const originalStats = fs.statSync(srcPath);
      
      await sharp(srcPath)
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
        .toFile(destPath);
      
      const finalStats = fs.statSync(destPath);
      const finalMeta = await sharp(destPath).metadata();
      
      console.log(`  ✓ ${theme.id}: ${(originalStats.size / 1024 / 1024).toFixed(2)}MB → ${(finalStats.size / 1024).toFixed(2)}KB (压缩 ${(1 - finalStats.size / originalStats.size) * 100})`);
    } catch (err) {
      console.error(`  ✗ ${theme.id} 失败:`, err.message);
    }
  }
  
  console.log('\n✅ 所有主题优化完成！');
}

optimizeAll();
