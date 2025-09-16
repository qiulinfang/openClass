#!/usr/bin/env node

/**
 * Android 自动部署脚本
 * 将 dist-webview/ 目录复制到 Android 项目的 assets/ 目录
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// 配置路径
const ANDROID_ASSETS_PATH = path.join(__dirname, '../../app/src/main/assets')
const WEBVIEW_SOURCE_PATH = path.join(__dirname, '../dist-webview')

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logStep(step, message) {
  log(`\n${step}. ${message}`, 'cyan')
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green')
}

function logError(message) {
  log(`❌ ${message}`, 'red')
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow')
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue')
}

/**
 * 检查路径是否存在
 */
function checkPathExists(path, description) {
  if (!fs.existsSync(path)) {
    logError(`${description} 不存在: ${path}`)
    return false
  }
  return true
}

/**
 * 递归复制目录
 */
function copyDirectory(src, dest) {
  try {
    // 确保目标目录存在
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true })
    }

    // 读取源目录内容
    const items = fs.readdirSync(src)

    for (const item of items) {
      const srcPath = path.join(src, item)
      const destPath = path.join(dest, item)
      const stat = fs.statSync(srcPath)

      if (stat.isDirectory()) {
        // 递归复制子目录
        copyDirectory(srcPath, destPath)
      } else {
        // 复制文件
        fs.copyFileSync(srcPath, destPath)
      }
    }

    return true
  } catch (error) {
    logError(`复制目录失败: ${error.message}`)
    return false
  }
}

/**
 * 获取目录大小
 */
function getDirectorySize(dirPath) {
  let totalSize = 0
  
  function calculateSize(itemPath) {
    const stat = fs.statSync(itemPath)
    if (stat.isDirectory()) {
      const items = fs.readdirSync(itemPath)
      for (const item of items) {
        calculateSize(path.join(itemPath, item))
      }
    } else {
      totalSize += stat.size
    }
  }
  
  calculateSize(dirPath)
  return totalSize
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes) {
  const sizes = ['B', 'KB', 'MB', 'GB']
  if (bytes === 0) return '0 B'
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
}

/**
 * 显示目录结构
 */
function showDirectoryStructure(dirPath, prefix = '') {
  try {
    const items = fs.readdirSync(dirPath)
    const dirs = []
    const files = []

    // 分离目录和文件
    for (const item of items) {
      const itemPath = path.join(dirPath, item)
      const stat = fs.statSync(itemPath)
      if (stat.isDirectory()) {
        dirs.push(item)
      } else {
        files.push(item)
      }
    }

    // 显示目录
    for (const dir of dirs) {
      log(`${prefix}├── ${dir}/`, 'magenta')
      showDirectoryStructure(path.join(dirPath, dir), prefix + '│   ')
    }

    // 显示文件
    for (const file of files) {
      const filePath = path.join(dirPath, file)
      const stat = fs.statSync(filePath)
      const size = formatFileSize(stat.size)
      log(`${prefix}├── ${file} (${size})`, 'reset')
    }
  } catch (error) {
    logError(`显示目录结构失败: ${error.message}`)
  }
}

/**
 * 主部署函数
 */
async function deployToAndroid() {
  log('🚀 开始部署 WebView 页面到 Android 项目...', 'bright')

  // 步骤 1: 检查源目录
  logStep(1, '检查源目录')
  if (!checkPathExists(WEBVIEW_SOURCE_PATH, 'WebView 构建目录')) {
    logError('请先运行构建命令: npm run build:webview')
    process.exit(1)
  }

  // 步骤 2: 检查 Android 项目目录
  logStep(2, '检查 Android 项目目录')
  if (!checkPathExists(ANDROID_ASSETS_PATH, 'Android assets 目录')) {
    logError('Android 项目目录不存在，请检查路径配置')
    process.exit(1)
  }

  // 步骤 3: 清理目标目录中的旧文件
  logStep(3, '清理目标目录')
  try {
    // 只清理webview目录，保留现有的页面目录
    const webviewDir = path.join(ANDROID_ASSETS_PATH, 'webview')
    if (fs.existsSync(webviewDir)) {
      fs.rmSync(webviewDir, { recursive: true, force: true })
      logSuccess('已清理旧webview目录')
    }
    
    // 只清理当前要部署的页面目录
    const pageDirToClean = getPageDirToClean(pageType)
    if (pageDirToClean) {
      const pagePath = path.join(ANDROID_ASSETS_PATH, pageDirToClean)
      if (fs.existsSync(pagePath)) {
        fs.rmSync(pagePath, { recursive: true, force: true })
        logSuccess(`已清理旧页面目录: ${pageDirToClean}`)
      } else {
        logInfo(`页面目录不存在，无需清理: ${pageDirToClean}`)
      }
    } else {
      logInfo('未指定页面类型，跳过页面目录清理')
    }
    
    logSuccess('目标目录清理完成')
  } catch (error) {
    logError(`清理目标目录失败: ${error.message}`)
    process.exit(1)
  }

  // 步骤 4: 复制文件
  logStep(4, '复制 WebView 文件')
  if (copyDirectory(WEBVIEW_SOURCE_PATH, ANDROID_ASSETS_PATH)) {
    logSuccess('文件复制完成')
  } else {
    logError('文件复制失败')
    process.exit(1)
  }

  // 步骤 5: 验证部署结果
  logStep(5, '验证部署结果')
  const deployedSize = getDirectorySize(ANDROID_ASSETS_PATH)
  logSuccess(`部署完成，总大小: ${formatFileSize(deployedSize)}`)

  // 步骤 6: 显示目录结构
  logStep(6, '显示部署后的目录结构')
  log('\n📁 部署后的目录结构:', 'bright')
  showDirectoryStructure(ANDROID_ASSETS_PATH)

  // 步骤 7: 显示使用说明
  logStep(7, '使用说明')
  log('\n📱 Android WebView 集成说明:', 'bright')
  log('1. 在 Android 代码中加载页面:', 'yellow')
  log('   String url = "file:///android_asset/exerciseSolve/index.html";', 'reset')
  log('   webView.loadUrl(url);', 'reset')
  
  log('\n2. 可用的页面路径:', 'yellow')
  log('   - 习题解答: file:///android_asset/exerciseSolve/index.html', 'reset')
  log('   - 习题查找: file:///android_asset/findExercise/index.html', 'reset')

  log('\n3. 重新构建 Android 项目:', 'yellow')
  log('   ./gradlew assembleDebug', 'reset')

  log('\n🎉 部署完成！', 'green')
  
  // 步骤 8: 清理源目录
  logStep(8, '清理源目录')
  try {
    if (fs.existsSync(WEBVIEW_SOURCE_PATH)) {
      fs.rmSync(WEBVIEW_SOURCE_PATH, { recursive: true, force: true })
      logSuccess('已删除 dist-webview 目录')
    } else {
      logInfo('dist-webview 目录不存在，无需清理')
    }
  } catch (error) {
    logWarning(`清理 dist-webview 目录失败: ${error.message}`)
  }
}

/**
 * 清理备份文件
 */
function cleanupBackups() {
  log('🧹 清理备份文件...', 'bright')
  
  try {
    const items = fs.readdirSync(ANDROID_ASSETS_PATH)
    const backupDirs = items.filter(item => item.startsWith('webview-backup-'))
    
    if (backupDirs.length === 0) {
      logInfo('没有找到备份文件')
      return
    }

    for (const backupDir of backupDirs) {
      const backupPath = path.join(ANDROID_ASSETS_PATH, backupDir)
      fs.rmSync(backupPath, { recursive: true, force: true })
      logSuccess(`已删除备份: ${backupDir}`)
    }
  } catch (error) {
    logError(`清理备份失败: ${error.message}`)
  }
}

// 命令行参数处理
const args = process.argv.slice(2)
const command = args[0]
const pageType = args[1] // 获取页面类型参数

// 根据页面类型确定要清理的目录
function getPageDirToClean(pageType) {
  switch (pageType) {
    case 'exercise':
    case 'exerciseSolve':
      return 'exerciseSolve'
    case 'find':
    case 'findExercise':
      return 'findExercise'
    case 'all':
      return null // 部署所有页面时，不清理任何页面目录
    default:
      return null // 不清理任何页面目录
  }
}

switch (command) {
  case 'deploy':
    deployToAndroid()
    break
  case 'cleanup':
    cleanupBackups()
    break
  case 'help':
  default:
    log('📖 Android 部署脚本使用说明:', 'bright')
    log('\n可用命令:', 'yellow')
    log('  node deploy-android.js deploy [pageType]  - 部署 WebView 页面到 Android 项目', 'reset')
    log('  node deploy-android.js cleanup            - 清理备份文件', 'reset')
    log('  node deploy-android.js help               - 显示帮助信息', 'reset')
    log('\n页面类型:', 'yellow')
    log('  exercise 或 exerciseSolve  - 习题解答页面', 'reset')
    log('  find 或 findExercise       - 习题查找页面', 'reset')
    log('\n示例:', 'yellow')
    log('  npm run deploy:android          - 构建并部署', 'reset')
    log('  npm run deploy:android:cleanup  - 清理备份', 'reset')
    break
}
