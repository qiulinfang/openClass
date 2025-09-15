#!/usr/bin/env node

/**
 * Android WebView 构建脚本
 * 将Vue.js应用打包并复制到Android项目的assets目录
 */

import { execSync } from 'child_process'
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 配置路径
const DIST_DIR = join(__dirname, 'dist')
const ANDROID_ASSETS_DIR = join(__dirname, '../../../app/src/main/assets/exercise-solve')

console.log('🚀 开始构建 ExerciseSolve Android WebView 应用...')

try {
  // 1. 清理并构建Vue应用
  console.log('📦 构建Vue.js应用...')
  execSync('npm run build', { 
    stdio: 'inherit',
    cwd: __dirname 
  })

  // 2. 确保Android assets目录存在
  console.log('📁 准备Android assets目录...')
  if (!existsSync(ANDROID_ASSETS_DIR)) {
    mkdirSync(ANDROID_ASSETS_DIR, { recursive: true })
  }

  // 3. 复制构建产物到Android assets
  console.log('📋 复制文件到Android项目...')
  copyDirectoryRecursive(DIST_DIR, ANDROID_ASSETS_DIR)

  // 4. 验证关键文件
  const indexPath = join(ANDROID_ASSETS_DIR, 'index.html')
  if (existsSync(indexPath)) {
    console.log('✅ 构建成功！文件已复制到:', ANDROID_ASSETS_DIR)
    console.log('📱 现在可以在Android应用中使用WebView加载: file:///android_asset/exercise-solve/index.html')
  } else {
    throw new Error('index.html 文件未找到')
  }

} catch (error) {
  console.error('❌ 构建失败:', error.message)
  process.exit(1)
}

/**
 * 递归复制目录
 */
function copyDirectoryRecursive(src, dest) {
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true })
  }

  const files = readdirSync(src)
  
  for (const file of files) {
    const srcPath = join(src, file)
    const destPath = join(dest, file)
    
    if (statSync(srcPath).isDirectory()) {
      copyDirectoryRecursive(srcPath, destPath)
    } else {
      copyFileSync(srcPath, destPath)
      console.log(`  ✓ ${file}`)
    }
  }
}