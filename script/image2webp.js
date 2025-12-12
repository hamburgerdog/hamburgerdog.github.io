#!/usr/bin/env node
/**
 * 图片转 WebP 脚本
 * 使用 cwebp 处理 assets 目录下的图片，并更新 Markdown 文件中的引用
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { basename, dirname, extname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

// 配置
const ASSETS_DIR = join(PROJECT_ROOT, 'src/assets');
const BLOG_DIR = join(PROJECT_ROOT, 'src/content/blog');
const SUPPORTED_FORMATS = ['.png', '.jpg', '.jpeg'];
const WEBP_QUALITY = 80; // WebP 质量 (0-100)

/**
 * 检查 cwebp 是否可用
 */
function checkCwebp() {
  try {
    execSync('which cwebp', { stdio: 'ignore' });
    return true;
  } catch {
    console.error('错误: 未找到 cwebp 命令，请先安装: brew install webp');
    process.exit(1);
  }
}

/**
 * 递归获取目录下所有图片文件
 * @param {string} dir - 目录路径
 * @param {string[]} fileList - 文件列表（递归使用）
 * @returns {string[]} 图片文件路径数组
 */
function getAllImageFiles(dir, fileList = []) {
  const files = readdirSync(dir);

  files.forEach((file) => {
    const filePath = join(dir, file);
    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      getAllImageFiles(filePath, fileList);
    } else {
      const ext = extname(file).toLowerCase();
      if (SUPPORTED_FORMATS.includes(ext)) {
        fileList.push(filePath);
      }
    }
  });

  return fileList;
}

/**
 * 将图片转换为 WebP 格式
 * @param {string} inputPath - 输入图片路径
 * @param {string} outputPath - 输出 WebP 路径
 * @returns {boolean} 是否成功
 */
function convertToWebp(inputPath, outputPath) {
  try {
    // 使用 cwebp 转换，质量设置为 80
    execSync(`cwebp -q ${WEBP_QUALITY} "${inputPath}" -o "${outputPath}"`, { stdio: 'pipe' });
    return true;
  } catch (error) {
    console.error(`转换失败: ${inputPath}`, error.message);
    return false;
  }
}

/**
 * 获取相对于项目根目录的路径
 * @param {string} filePath - 文件路径
 * @returns {string} 相对路径
 */
function getRelativePath(filePath) {
  return relative(PROJECT_ROOT, filePath);
}

/**
 * 更新 Markdown 文件中的图片引用
 * @param {string} markdownPath - Markdown 文件路径
 * @param {Map<string, string>} imageMap - 图片路径映射 (原路径 -> WebP 路径)
 * @returns {boolean} 是否进行了修改
 */
function updateMarkdownReferences(markdownPath, imageMap) {
  let content = readFileSync(markdownPath, 'utf-8');
  let modified = false;

  // 构建文件名到 WebP 文件名的映射（用于快速查找）
  const fileNameMap = new Map();
  imageMap.forEach((webpPath, originalPath) => {
    const fileName = basename(originalPath);
    const webpFileName = basename(webpPath);
    // 使用小写文件名作为 key，支持大小写不敏感的匹配
    fileNameMap.set(fileName.toLowerCase(), {
      originalFileName: fileName,
      webpFileName: webpFileName,
    });
  });

  // 匹配 Markdown 图片引用格式: ![alt](path/to/image.png)
  // 支持相对路径和绝对路径
  const imageRefPattern = /!\[([^\]]*)\]\(([^)]+\.(png|jpg|jpeg))\)/gi;

  content = content.replace(imageRefPattern, (match, altText, imagePath, ext) => {
    // 只处理 assets 目录下的图片
    if (!imagePath.includes('assets')) {
      return match;
    }

    // 提取文件名（包含扩展名）
    const fileName = basename(imagePath);
    const fileInfo = fileNameMap.get(fileName.toLowerCase());

    // 如果找到了对应的 WebP 文件信息，进行替换
    if (fileInfo && fileName === fileInfo.originalFileName) {
      // 保留原始路径结构，只替换文件名
      const dirPath = dirname(imagePath);
      // 处理相对路径，确保使用正确的路径分隔符
      let newPath;
      if (dirPath === '.' || dirPath === '') {
        newPath = fileInfo.webpFileName;
      } else {
        // 保持原有的路径分隔符风格
        const separator = imagePath.includes('/') ? '/' : '\\';
        newPath = `${dirPath}${separator}${fileInfo.webpFileName}`;
      }
      modified = true;
      return `![${altText}](${newPath})`;
    }

    return match;
  });

  if (modified) {
    writeFileSync(markdownPath, content, 'utf-8');
  }

  return modified;
}

/**
 * 获取所有 Markdown 文件
 * @returns {string[]} Markdown 文件路径数组
 */
function getAllMarkdownFiles() {
  const files = readdirSync(BLOG_DIR);
  return files.filter((file) => file.endsWith('.md')).map((file) => join(BLOG_DIR, file));
}

/**
 * 主函数
 */
function main() {
  console.log('开始处理图片转 WebP...\n');

  // 检查 cwebp
  checkCwebp();

  // 获取所有图片文件
  console.log('扫描图片文件...');
  const imageFiles = getAllImageFiles(ASSETS_DIR);
  console.log(`找到 ${imageFiles.length} 个图片文件\n`);

  if (imageFiles.length === 0) {
    console.log('没有找到需要转换的图片文件');
    return;
  }

  // 创建图片路径映射
  const imageMap = new Map();
  let convertedCount = 0;
  let skippedCount = 0;

  // 转换图片
  console.log('开始转换图片...');
  imageFiles.forEach((imagePath, index) => {
    const ext = extname(imagePath);
    const webpPath = imagePath.replace(/\.(png|jpg|jpeg)$/i, '.webp');
    const relativeImagePath = getRelativePath(imagePath);
    const relativeWebpPath = getRelativePath(webpPath);

    // 如果 WebP 文件已存在，跳过
    if (existsSync(webpPath)) {
      console.log(`[${index + 1}/${imageFiles.length}] 跳过 (已存在): ${relativeWebpPath}`);
      skippedCount++;
      imageMap.set(relativeImagePath, relativeWebpPath);
      return;
    }

    // 转换图片
    console.log(`[${index + 1}/${imageFiles.length}] 转换: ${relativeImagePath} -> ${relativeWebpPath}`);
    if (convertToWebp(imagePath, webpPath)) {
      convertedCount++;
      imageMap.set(relativeImagePath, relativeWebpPath);
    }
  });

  console.log(`\n转换完成: ${convertedCount} 个新文件, ${skippedCount} 个已存在\n`);

  // 更新 Markdown 文件引用
  console.log('更新 Markdown 文件中的图片引用...');
  const markdownFiles = getAllMarkdownFiles();
  let updatedFiles = 0;

  markdownFiles.forEach((mdPath) => {
    const relativeMdPath = getRelativePath(mdPath);
    if (updateMarkdownReferences(mdPath, imageMap)) {
      console.log(`更新: ${relativeMdPath}`);
      updatedFiles++;
    }
  });

  console.log(`\n更新完成: ${updatedFiles} 个 Markdown 文件已更新`);
  console.log('\n处理完成！');
}

// 运行主函数
main();
