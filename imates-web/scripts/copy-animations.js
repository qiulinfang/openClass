import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceDir = 'D:\\Project\\2秒';
const targetDir = path.join(__dirname, '..', 'public', 'assets', 'animations', '2秒');

// 确保目标目录存在
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// 复制文件
function copyFiles() {
  try {
    const files = fs.readdirSync(sourceDir);
    let copiedCount = 0;

    files.forEach(file => {
      if (path.extname(file).toLowerCase() === '.jpg') {
        const sourcePath = path.join(sourceDir, file);
        const targetPath = path.join(targetDir, file);

        fs.copyFileSync(sourcePath, targetPath);
        copiedCount++;
      }
    });

    console.log(`✅ 成功复制了 ${copiedCount} 个动画帧文件`);
    console.log(`📁 目标目录: ${targetDir}`);
  } catch (error) {
    console.error('❌ 复制文件时出错:', error.message);
    process.exit(1);
  }
}

copyFiles();
