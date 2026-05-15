const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const GAME_WIDTH = 390;
const GAME_HEIGHT = 720;

const themes = [
  { id: 'campus', folder: 'runner-campus_v2', desc: '校园主题' },
  { id: 'mall', folder: 'runner-mall', desc: '商场主题' },
  { id: 'zoo', folder: 'runner-zoo', desc: '动物园主题' },
  { id: 'amusement', folder: 'runner-amusement', desc: '游乐园主题' }
];

async function optimizeThemes() {
  console.log('🎨 优化主题背景图...\n');
  
  for (const theme of themes) {
    const folderPath = path.join(__dirname, `../img/draft/${theme.folder}`);
    
    if (!fs.existsSync(folderPath)) {
      console.log(`⚠️  ${theme.desc} 文件夹不存在，跳过`);
      continue;
    }
    
    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.png'));
    
    if (files.length === 0) {
      console.log(`⚠️  ${theme.desc} 文件夹中没有PNG文件，跳过`);
      continue;
    }
    
    const srcPath = path.join(folderPath, files[0]);
    const destPath = path.join(__dirname, `../src/assets/backgrounds/runner-${theme.id}.png`);
    
    try {
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
      
      console.log(`  ✓ 成功: ${(originalStats.size / 1024 / 1024).toFixed(2)}MB → ${(finalStats.size / 1024).toFixed(2)}KB (压缩 ${((1 - finalStats.size / originalStats.size) * 100).toFixed(1)}%)`);
    } catch (err) {
      console.error(`  ✗ 失败:`, err.message);
    }
  }
  
  console.log('\n✅ 处理完成！');
}

optimizeThemes();
