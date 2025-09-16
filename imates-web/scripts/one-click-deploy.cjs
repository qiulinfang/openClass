#!/usr/bin/env node

/**
 * 一键构建和部署脚本
 * 支持：
 * 1. 构建所有页面：构建 WebView 页面 -> 部署到 Android -> 构建 Android 项目
 * 2. 构建单个页面：构建指定页面 -> 部署到 Android -> 构建 Android 项目
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

// 页面配置
const PAGES = {
  exercise: {
    name: '习题解答',
    buildCommand: 'node scripts/build-webview-pages.js exerciseSolve'
  },
  find: {
    name: '习题查找',
    buildCommand: 'node scripts/build-webview-pages.js findExercise'
  }
}

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
 * 执行命令并显示输出
 */
function runCommand(command, description, options = {}) {
  try {
    logInfo(`执行: ${command}`)
    const result = execSync(command, { 
      stdio: 'inherit', 
      cwd: options.cwd || process.cwd(),
      ...options 
    })
    return result
  } catch (error) {
    logError(`${description} 失败: ${error.message}`)
    throw error
  }
}

/**
 * 检查文件是否存在
 */
function checkFileExists(filePath, description) {
  if (!fs.existsSync(filePath)) {
    logError(`${description} 不存在: ${filePath}`)
    return false
  }
  return true
}

/**
 * 构建单个页面
 */
async function buildSinglePage(pageKey, buildType = 'debug') {
  const startTime = Date.now()
  const page = PAGES[pageKey]
  
  if (!page) {
    logError(`未知页面: ${pageKey}`)
    logInfo('可用页面: ' + Object.keys(PAGES).join(', '))
    process.exit(1)
  }
  
  log(`🚀 开始构建 ${page.name} 页面...`, 'bright')
  log('='.repeat(50), 'cyan')

  try {
    // 步骤 1: 检查环境
    logStep(1, '检查环境')
    
    // 检查 Node.js 和 npm
    try {
      execSync('node --version', { stdio: 'pipe' })
      execSync('npm --version', { stdio: 'pipe' })
      logSuccess('Node.js 和 npm 环境正常')
    } catch (error) {
      logError('Node.js 或 npm 未安装')
      process.exit(1)
    }

    // 检查 Android 项目
    const androidProjectPath = path.join(__dirname, '../../')
    const gradlewPath = path.join(androidProjectPath, 'gradlew.bat')
    if (!checkFileExists(gradlewPath, 'Android 项目 gradlew.bat')) {
      logError('Android 项目未找到，请确保在正确的目录下运行')
      process.exit(1)
    }
    logSuccess('Android 项目检查通过')
    
    // 检测操作系统
    const isWindows = process.platform === 'win32'
    const gradlewCommand = isWindows ? 'gradlew.bat' : './gradlew'
    logInfo(`检测到操作系统: ${process.platform}, 使用命令: ${gradlewCommand}`)

    // 步骤 2: 构建指定页面
    logStep(2, `构建 ${page.name} 页面`)
    runCommand(page.buildCommand, `${page.name} 页面构建`)
    logSuccess(`${page.name} 页面构建完成`)

    // 步骤 3: 部署到 Android
    logStep(3, '部署到 Android 项目')
    runCommand(`node scripts/deploy-android.cjs deploy ${pageKey}`, 'Android 项目部署')
    logSuccess('Android 项目部署完成')

    // 步骤 4: 构建 Android 项目
    logStep(4, '构建 Android 项目')
    
    const buildCommand = buildType === 'release' ? 'assembleRelease' : 'assembleDebug'
    
    logInfo(`构建类型: ${buildType}`)
    runCommand(`${gradlewCommand} ${buildCommand}`, 'Android 项目构建', { 
      cwd: androidProjectPath 
    })
    logSuccess('Android 项目构建完成')

    // 步骤 5: 显示结果
    logStep(5, '显示构建结果')
    
    const endTime = Date.now()
    const duration = ((endTime - startTime) / 1000).toFixed(2)
    
    log(`\n🎉 ${page.name} 页面构建和部署完成！`, 'green')
    log(`⏱️  总耗时: ${duration} 秒`, 'blue')
    
    // 显示 APK 位置
    const apkPath = buildType === 'release' 
      ? path.join(androidProjectPath, 'app/build/outputs/apk/release/app-release.apk')
      : path.join(androidProjectPath, 'app/build/outputs/apk/debug/app-debug.apk')
    
    if (fs.existsSync(apkPath)) {
      const stats = fs.statSync(apkPath)
      const size = (stats.size / 1024 / 1024).toFixed(2)
      log(`📱 APK 文件: ${apkPath}`, 'yellow')
      log(`📦 APK 大小: ${size} MB`, 'yellow')
    }

    // 步骤 6: 清理源目录
    logStep(6, '清理源目录')
    const distWebviewPath = path.join(__dirname, '../dist-webview')
    try {
      if (fs.existsSync(distWebviewPath)) {
        fs.rmSync(distWebviewPath, { recursive: true, force: true })
        logSuccess('已删除 dist-webview 目录')
      } else {
        logInfo('dist-webview 目录不存在，无需清理')
      }
    } catch (error) {
      logWarning(`清理 dist-webview 目录失败: ${error.message}`)
    }

    // 显示使用说明
    log('\n📖 使用说明:', 'bright')
    log('1. 安装 APK 到设备进行测试', 'reset')
    log('2. 如需重新构建，再次运行此脚本', 'reset')
    log(`3. 支持参数: node one-click-deploy.cjs ${pageKey} [debug|release]`, 'reset')

  } catch (error) {
    logError(`${page.name} 页面构建和部署失败: ${error.message}`)
    process.exit(1)
  }
}

/**
 * 构建所有页面
 */
async function oneClickDeploy() {
  const startTime = Date.now()
  
  log('🚀 开始一键构建和部署...', 'bright')
  log('='.repeat(50), 'cyan')

  try {
    // 步骤 1: 检查环境
    logStep(1, '检查环境')
    
    // 检查 Node.js 和 npm
    try {
      execSync('node --version', { stdio: 'pipe' })
      execSync('npm --version', { stdio: 'pipe' })
      logSuccess('Node.js 和 npm 环境正常')
    } catch (error) {
      logError('Node.js 或 npm 未安装')
      process.exit(1)
    }

    // 检查 Android 项目
    const androidProjectPath = path.join(__dirname, '../../')
    const gradlewPath = path.join(androidProjectPath, 'gradlew.bat')
    if (!checkFileExists(gradlewPath, 'Android 项目 gradlew.bat')) {
      logError('Android 项目未找到，请确保在正确的目录下运行')
      process.exit(1)
    }
    logSuccess('Android 项目检查通过')
    
    // 检测操作系统
    const isWindows = process.platform === 'win32'
    const gradlewCommand = isWindows ? 'gradlew.bat' : './gradlew'
    logInfo(`检测到操作系统: ${process.platform}, 使用命令: ${gradlewCommand}`)

    // 步骤 2: 构建 WebView 页面
    logStep(2, '构建 WebView 页面')
    runCommand('node scripts/build-webview-pages.js', 'WebView 页面构建')
    logSuccess('WebView 页面构建完成')

    // 步骤 3: 部署到 Android
    logStep(3, '部署到 Android 项目')
    runCommand('node scripts/deploy-android.cjs deploy all', 'Android 项目部署')
    logSuccess('Android 项目部署完成')

    // 步骤 4: 构建 Android 项目
    logStep(4, '构建 Android 项目')
    
    // 检查构建类型
    const buildType = process.argv[2] || 'debug'
    const buildCommand = buildType === 'release' ? 'assembleRelease' : 'assembleDebug'
    
    logInfo(`构建类型: ${buildType}`)
    runCommand(`${gradlewCommand} ${buildCommand}`, 'Android 项目构建', { 
      cwd: androidProjectPath 
    })
    logSuccess('Android 项目构建完成')

    // 步骤 5: 显示结果
    logStep(5, '显示构建结果')
    
    const endTime = Date.now()
    const duration = ((endTime - startTime) / 1000).toFixed(2)
    
    log('\n🎉 一键构建和部署完成！', 'green')
    log(`⏱️  总耗时: ${duration} 秒`, 'blue')
    
    // 显示 APK 位置
    const apkPath = buildType === 'release' 
      ? path.join(androidProjectPath, 'app/build/outputs/apk/release/app-release.apk')
      : path.join(androidProjectPath, 'app/build/outputs/apk/debug/app-debug.apk')
    
    if (fs.existsSync(apkPath)) {
      const stats = fs.statSync(apkPath)
      const size = (stats.size / 1024 / 1024).toFixed(2)
      log(`📱 APK 文件: ${apkPath}`, 'yellow')
      log(`📦 APK 大小: ${size} MB`, 'yellow')
    }

    // 步骤 6: 清理源目录
    logStep(6, '清理源目录')
    const distWebviewPath = path.join(__dirname, '../dist-webview')
    try {
      if (fs.existsSync(distWebviewPath)) {
        fs.rmSync(distWebviewPath, { recursive: true, force: true })
        logSuccess('已删除 dist-webview 目录')
      } else {
        logInfo('dist-webview 目录不存在，无需清理')
      }
    } catch (error) {
      logWarning(`清理 dist-webview 目录失败: ${error.message}`)
    }

    // 显示使用说明
    log('\n📖 使用说明:', 'bright')
    log('1. 安装 APK 到设备进行测试', 'reset')
    log('2. 如需重新构建，再次运行此脚本', 'reset')
    log('3. 支持参数: node one-click-deploy.cjs [debug|release]', 'reset')

  } catch (error) {
    logError(`一键构建和部署失败: ${error.message}`)
    process.exit(1)
  }
}

/**
 * 显示帮助信息
 */
function showHelp() {
  log('📖 一键构建和部署脚本使用说明:', 'bright')
  
  log('\n构建所有页面:', 'yellow')
  log('  node one-click-deploy.cjs              - 构建所有页面 (Debug)', 'reset')
  log('  node one-click-deploy.cjs debug        - 构建所有页面 (Debug)', 'reset')
  log('  node one-click-deploy.cjs release      - 构建所有页面 (Release)', 'reset')
  
  log('\n构建单个页面:', 'yellow')
  log('  node one-click-deploy.cjs exercise     - 构建习题解答页面 (Debug)', 'reset')
  log('  node one-click-deploy.cjs exercise debug   - 构建习题解答页面 (Debug)', 'reset')
  log('  node one-click-deploy.cjs exercise release - 构建习题解答页面 (Release)', 'reset')
  log('  node one-click-deploy.cjs find         - 构建习题查找页面 (Debug)', 'reset')
  log('  node one-click-deploy.cjs find debug   - 构建习题查找页面 (Debug)', 'reset')
  log('  node one-click-deploy.cjs find release - 构建习题查找页面 (Release)', 'reset')
  
  log('\n帮助信息:', 'yellow')
  log('  node one-click-deploy.cjs help         - 显示帮助信息', 'reset')
  
  log('\n可用页面:', 'yellow')
  Object.entries(PAGES).forEach(([key, page]) => {
    log(`  ${key.padEnd(10)} - ${page.name}`, 'reset')
  })
  
  log('\n功能说明:', 'yellow')
  log('  ✅ 支持构建所有页面或单个页面', 'reset')
  log('  ✅ 自动部署到 Android 项目', 'reset')
  log('  ✅ 自动构建 Android APK', 'reset')
  log('  ✅ 显示详细的构建日志', 'reset')
  log('  ✅ 显示 APK 文件位置和大小', 'reset')
  
  log('\n注意事项:', 'yellow')
  log('  • 确保 Android 项目路径正确', 'reset')
  log('  • 确保已安装 Android SDK 和 Gradle', 'reset')
  log('  • 首次构建可能需要较长时间', 'reset')
  log('  • 构建过程中请勿关闭终端', 'reset')
}

// 命令行参数处理
const args = process.argv.slice(2)
const command = args[0]
const buildType = args[1] || 'debug'

switch (command) {
  case 'help':
  case '--help':
  case '-h':
    showHelp()
    break
  case 'debug':
  case 'release':
  case undefined:
    // 构建所有页面
    oneClickDeploy()
    break
  default:
    // 检查是否是单个页面构建
    if (PAGES[command]) {
      buildSinglePage(command, buildType)
    } else {
      logError(`未知参数: ${command}`)
      showHelp()
      process.exit(1)
    }
}
