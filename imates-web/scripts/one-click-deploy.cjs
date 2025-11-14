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
  },
  full: {
    name: 'Vue.js 整体应用',
    buildCommand: 'npm run build-full-only'
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
 * 递增版本号
 * @param {string} versionName 当前版本号，如 "1.0.18"
 * @returns {string} 递增后的版本号，如 "1.0.19"
 */
function incrementVersionName(versionName) {
  // 去除首尾空格
  const trimmed = versionName.trim()
  const parts = trimmed.split('.')
  if (parts.length >= 3) {
    // 最后一位 +1
    const lastPart = parseInt(parts[parts.length - 1], 10)
    parts[parts.length - 1] = (lastPart + 1).toString()
    return parts.join('.')
  }
  // 如果格式不对，默认返回 1.0.1
  return '1.0.1'
}

/**
 * 读取 build.gradle 文件中的版本号
 * @param {string} androidProjectPath Android 项目路径
 * @returns {Object|null} 返回版本号 {versionCode, versionName}，失败返回 null
 */
function readBuildGradleVersion(androidProjectPath) {
  try {
    const buildGradlePath = path.join(androidProjectPath, 'app/build.gradle')
    
    if (!fs.existsSync(buildGradlePath)) {
      return null
    }
    
    // 读取 build.gradle 文件
    const buildGradleContent = fs.readFileSync(buildGradlePath, 'utf-8')
    
    // 提取当前的 versionCode 和 versionName
    // 匹配 versionCode 19 或 versionCode = 19
    const versionCodeMatch = buildGradleContent.match(/versionCode\s+(\d+)/)
    // 匹配 versionName "1.0.19 " 或 versionName = "1.0.19"
    const versionNameMatch = buildGradleContent.match(/versionName\s+"([^"]+)"/)
    
    if (!versionCodeMatch || !versionNameMatch) {
      return null
    }
    
    const versionCode = parseInt(versionCodeMatch[1], 10)
    const versionName = versionNameMatch[1].trim() // 去除空格
    
    return {
      versionCode,
      versionName
    }
  } catch (error) {
    return null
  }
}

/**
 * 更新 build.gradle 文件中的版本号
 * @param {string} androidProjectPath Android 项目路径
 * @returns {Object|null} 返回更新后的版本号 {versionCode, versionName}，失败返回 null
 */
function updateBuildGradleVersion(androidProjectPath) {
  try {
    const buildGradlePath = path.join(androidProjectPath, 'app/build.gradle')
    
    if (!fs.existsSync(buildGradlePath)) {
      logError(`build.gradle 文件不存在: ${buildGradlePath}`)
      return null
    }
    
    // 读取 build.gradle 文件
    let buildGradleContent = fs.readFileSync(buildGradlePath, 'utf-8')
    
    // 提取当前的 versionCode 和 versionName
    const versionCodeMatch = buildGradleContent.match(/versionCode\s+(\d+)/)
    const versionNameMatch = buildGradleContent.match(/versionName\s+"([^"]+)"/)
    
    if (!versionCodeMatch || !versionNameMatch) {
      logError('无法从 build.gradle 中提取版本号')
      return null
    }
    
    const currentVersionCode = parseInt(versionCodeMatch[1], 10)
    const currentVersionName = versionNameMatch[1].trim()
    
    logInfo(`当前 build.gradle 版本: ${currentVersionName} (${currentVersionCode})`)
    
    // 递增版本号
    const newVersionCode = currentVersionCode + 1
    const newVersionName = incrementVersionName(currentVersionName)
    
    // 替换版本号（保留原有格式，包括引号和可能的空格）
    buildGradleContent = buildGradleContent.replace(
      /versionCode\s+\d+/,
      `versionCode ${newVersionCode}`
    )
    // 替换 versionName，保留引号内的格式（包括可能的尾随空格）
    buildGradleContent = buildGradleContent.replace(
      /versionName\s+"[^"]+"/,
      (match) => {
        // 保留引号前的空格和引号，只替换引号内的内容
        const beforeQuote = match.substring(0, match.indexOf('"') + 1)
        const afterQuote = match.substring(match.lastIndexOf('"'))
        // 检查原版本号是否有尾随空格，如果有则保留
        const originalContent = versionNameMatch[1]
        const hasTrailingSpace = originalContent.endsWith(' ')
        const newContent = hasTrailingSpace ? `${newVersionName} ` : newVersionName
        return `${beforeQuote}${newContent}${afterQuote}`
      }
    )
    
    // 写回文件
    fs.writeFileSync(buildGradlePath, buildGradleContent, 'utf-8')
    
    logSuccess(`build.gradle 版本号已更新: ${currentVersionName} (${currentVersionCode}) -> ${newVersionName} (${newVersionCode})`)
    
    return {
      versionCode: newVersionCode,
      versionName: newVersionName
    }
  } catch (error) {
    logError(`更新 build.gradle 版本号失败: ${error.message}`)
    return null
  }
}

/**
 * 查找最新的 info.json 文件
 * @param {string} androidProjectPath Android 项目路径
 * @returns {string|null} info.json 文件路径
 */
function findLatestInfoJson(androidProjectPath) {
  const apkOutputPath = path.join(androidProjectPath, 'app/build/outputs/apk/production/release')
  
  if (!fs.existsSync(apkOutputPath)) {
    return null
  }
  
  // 查找所有 -info.json 文件
  const files = fs.readdirSync(apkOutputPath)
  const infoJsonFiles = files.filter(file => file.endsWith('-info.json'))
  
  if (infoJsonFiles.length === 0) {
    return null
  }
  
  // 返回最新的文件（按修改时间排序）
  const infoJsonFilesWithStats = infoJsonFiles.map(file => ({
    name: file,
    path: path.join(apkOutputPath, file),
    mtime: fs.statSync(path.join(apkOutputPath, file)).mtime
  }))
  
  infoJsonFilesWithStats.sort((a, b) => b.mtime - a.mtime)
  return infoJsonFilesWithStats[0].path
}

/**
 * 生成版本更新 JSON 文件
 * @param {string} androidProjectPath Android 项目路径
 */
function generateUpdateJson(androidProjectPath) {
  try {
    // 第1步：查找 info.json 文件
    const infoJsonPath = findLatestInfoJson(androidProjectPath)
    if (!infoJsonPath) {
      logError('未找到 info.json 文件，请确保构建成功')
      return
    }
    
    logInfo(`找到 info.json: ${infoJsonPath}`)
    
    // 第2步：读取 info.json
    const infoJsonContent = fs.readFileSync(infoJsonPath, 'utf-8')
    const infoJson = JSON.parse(infoJsonContent)
    
    const apkMd5 = infoJson.md5Checksum || infoJson.ApkMd5
    const apkSize = infoJson.fileSize || infoJson.ApkSize
    const fileName = infoJson.fileName || infoJson.FileName
    
    if (!apkMd5 || !apkSize || !fileName) {
      logError('info.json 文件格式不正确，缺少必要字段')
      return
    }
    
    logSuccess(`读取 APK 信息: ${fileName}, 大小: ${apkSize} 字节, MD5: ${apkMd5}`)
    
    // 第3步：确定 appupdate.json 的路径（和 info.json 在同一目录）
    const apkOutputDir = path.dirname(infoJsonPath)
    const appupdateJsonPath = path.join(apkOutputDir, 'appupdate.json')
    
    // 优先从 build.gradle 读取版本号
    const buildGradleVersion = readBuildGradleVersion(androidProjectPath)
    let currentVersionCode = buildGradleVersion ? buildGradleVersion.versionCode : 11
    let currentVersionName = buildGradleVersion ? buildGradleVersion.versionName : '1.0.11'
    let modifyContent = '问题修复 截图问答聊天记录增加略缩图'
    
    // 如果存在旧的 appupdate.json（在同一目录或项目根目录），读取 ModifyContent
    const oldAppupdateJsonPath = path.join(androidProjectPath, 'appupdate.json')
    if (fs.existsSync(appupdateJsonPath)) {
      try {
        const appupdateContent = fs.readFileSync(appupdateJsonPath, 'utf-8')
        const appupdateJson = JSON.parse(appupdateContent)
        modifyContent = appupdateJson.ModifyContent || modifyContent
        logInfo(`从同目录读取现有更新内容: ${modifyContent}`)
      } catch (error) {
        logWarning(`读取 appupdate.json 失败: ${error.message}`)
      }
    } else if (fs.existsSync(oldAppupdateJsonPath)) {
      try {
        const appupdateContent = fs.readFileSync(oldAppupdateJsonPath, 'utf-8')
        const appupdateJson = JSON.parse(appupdateContent)
        modifyContent = appupdateJson.ModifyContent || modifyContent
        logInfo(`从项目根目录读取现有更新内容: ${modifyContent}`)
      } catch (error) {
        logWarning(`读取旧 appupdate.json 失败: ${error.message}`)
      }
    }
    
    // 如果从 build.gradle 读取到版本号，使用它；否则尝试从旧文件读取
    if (!buildGradleVersion) {
      if (fs.existsSync(appupdateJsonPath)) {
        try {
          const appupdateContent = fs.readFileSync(appupdateJsonPath, 'utf-8')
          const appupdateJson = JSON.parse(appupdateContent)
          currentVersionCode = appupdateJson.VersionCode || currentVersionCode
          currentVersionName = appupdateJson.VersionName || currentVersionName
          logInfo(`从同目录文件读取版本: ${currentVersionName} (${currentVersionCode})`)
        } catch (error) {
          // 忽略错误，继续使用默认值
        }
      } else if (fs.existsSync(oldAppupdateJsonPath)) {
        try {
          const appupdateContent = fs.readFileSync(oldAppupdateJsonPath, 'utf-8')
          const appupdateJson = JSON.parse(appupdateContent)
          currentVersionCode = appupdateJson.VersionCode || currentVersionCode
          currentVersionName = appupdateJson.VersionName || currentVersionName
          logInfo(`从项目根目录文件读取版本: ${currentVersionName} (${currentVersionCode})`)
        } catch (error) {
          logWarning(`读取旧版本号失败，使用默认版本: ${error.message}`)
        }
      }
    } else {
      logInfo(`从 build.gradle 读取版本: ${currentVersionName} (${currentVersionCode})`)
    }
    
    // 第4步：使用 build.gradle 中已更新的版本号（不再递增，因为步骤 4 已经递增过了）
    // 如果从 build.gradle 读取到版本号，直接使用；否则递增旧版本号
    let newVersionCode, newVersionName
    if (buildGradleVersion) {
      // 使用 build.gradle 中已更新的版本号
      newVersionCode = currentVersionCode
      newVersionName = currentVersionName
      logInfo(`使用 build.gradle 中的版本号: ${newVersionName} (${newVersionCode})`)
    } else {
      // 如果没有从 build.gradle 读取到，则递增旧版本号
      newVersionCode = currentVersionCode + 1
      newVersionName = incrementVersionName(currentVersionName)
      logInfo(`版本号递增: ${currentVersionName} (${currentVersionCode}) -> ${newVersionName} (${newVersionCode})`)
    }
    
    // 第5步：构建下载 URL
    const downloadUrl = `https://www.imates.com.cn/bj101/apps/${fileName}`
    
    // 第6步：生成新的 appupdate.json
    const newAppupdateJson = {
      Code: 0,
      Msg: '',
      UpdateStatus: 1,
      VersionCode: newVersionCode,
      VersionName: newVersionName,
      ModifyContent: modifyContent,
      DownloadUrl: downloadUrl,
      ApkSize: '',
      ApkMd5: apkMd5
    }
    
    // 第7步：写入文件（和 info.json 在同一目录）
    fs.writeFileSync(
      appupdateJsonPath,
      JSON.stringify(newAppupdateJson, null, 2),
      'utf-8'
    )
    
    logSuccess(`版本更新信息已生成: ${appupdateJsonPath}`)
    logInfo(`新版本: ${newVersionName} (${newVersionCode})`)
    logInfo(`下载地址: ${downloadUrl}`)
    
  } catch (error) {
    logError(`生成版本更新信息失败: ${error.message}`)
    logWarning('构建已完成，但版本信息生成失败')
  }
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

    // 步骤 4: 更新 build.gradle 版本号
    logStep(4, '更新 build.gradle 版本号')
    const updatedVersion = updateBuildGradleVersion(androidProjectPath)
    if (!updatedVersion) {
      logError('build.gradle 版本号更新失败，终止构建')
      process.exit(1)
    }

    // 步骤 5: 同步 Gradle 配置
    logStep(5, '同步 Gradle 配置')
    logInfo('运行 gradlew help 触发配置重新加载，确保新版本号被 Gradle 识别')
    const syncCommand = `${gradlewCommand} help`
    runCommand(syncCommand, 'Gradle 配置同步', { cwd: androidProjectPath })
    logSuccess('Gradle 配置同步完成')

    // 步骤 6: 构建 Android 生产版本
    logStep(6, '构建 Android 生产版本')
    const gradleCommand = `${gradlewCommand} assembleProductionRelease`
    runCommand(gradleCommand, 'Android 生产版本构建', { cwd: androidProjectPath })
    logSuccess('Android 生产版本构建完成')

    // 步骤 7: 生成版本更新信息
    logStep(7, '生成版本更新信息')
    generateUpdateJson(androidProjectPath)

    // 步骤 8: 显示结果
    logStep(8, '显示构建结果')
    
    const endTime = Date.now()
    const duration = ((endTime - startTime) / 1000).toFixed(2)
    
    log(`\n🎉 ${page.name} 页面构建和部署完成！`, 'green')
    log(`⏱️  总耗时: ${duration} 秒`, 'blue')

    // 步骤 9: 清理源目录
    logStep(9, '清理源目录')
    const distPath = pageKey === 'full' ? 'dist-full' : 'dist-webview'
    const distPathFull = path.join(__dirname, '..', distPath)
    try {
      if (fs.existsSync(distPathFull)) {
        fs.rmSync(distPathFull, { recursive: true, force: true })
        logSuccess(`已删除 ${distPath} 目录`)
      } else {
        logInfo(`${distPath} 目录不存在，无需清理`)
      }
    } catch (error) {
      logWarning(`清理 ${distPath} 目录失败: ${error.message}`)
    }

    // 显示使用说明
    log('\n📖 使用说明:', 'bright')
    log('1. Vue.js应用已部署到Android assets目录', 'reset')
    log('2. Android 生产版本已构建完成', 'reset')
    log('3. 如需重新构建，再次运行此脚本', 'reset')
    log(`4. 支持参数: node one-click-deploy.cjs ${pageKey} [debug|release]`, 'reset')

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

    // 步骤 4: 更新 build.gradle 版本号
    logStep(4, '更新 build.gradle 版本号')
    const updatedVersion = updateBuildGradleVersion(androidProjectPath)
    if (!updatedVersion) {
      logError('build.gradle 版本号更新失败，终止构建')
      process.exit(1)
    }

    // 步骤 5: 同步 Gradle 配置
    logStep(5, '同步 Gradle 配置')
    logInfo('运行 gradlew help 触发配置重新加载，确保新版本号被 Gradle 识别')
    const syncCommand = `${gradlewCommand} help`
    runCommand(syncCommand, 'Gradle 配置同步', { cwd: androidProjectPath })
    logSuccess('Gradle 配置同步完成')

    // 步骤 6: 构建 Android 生产版本
    logStep(6, '构建 Android 生产版本')
    const gradleCommand = `${gradlewCommand} assembleProductionRelease`
    runCommand(gradleCommand, 'Android 生产版本构建', { cwd: androidProjectPath })
    logSuccess('Android 生产版本构建完成')

    // 步骤 7: 生成版本更新信息
    logStep(7, '生成版本更新信息')
    generateUpdateJson(androidProjectPath)

    // 步骤 8: 清理源目录
    logStep(8, '清理源目录')
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
    log('1. Vue.js应用已部署到Android assets目录', 'reset')
    log('2. Android 生产版本已构建完成', 'reset')
    log('3. 如需重新构建，再次运行此脚本', 'reset')
    log('4. 支持参数: node one-click-deploy.cjs [debug|release]', 'reset')

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
  log('  node one-click-deploy.cjs full         - 构建Vue.js整体应用 (Debug)', 'reset')
  log('  node one-click-deploy.cjs full debug  - 构建Vue.js整体应用 (Debug)', 'reset')
  log('  node one-click-deploy.cjs full release - 构建Vue.js整体应用 (Release)', 'reset')
  
  log('\n帮助信息:', 'yellow')
  log('  node one-click-deploy.cjs help         - 显示帮助信息', 'reset')
  
  log('\n可用页面:', 'yellow')
  Object.entries(PAGES).forEach(([key, page]) => {
    log(`  ${key.padEnd(10)} - ${page.name}`, 'reset')
  })
  
  log('\n功能说明:', 'yellow')
  log('  ✅ 支持构建所有页面或单个页面', 'reset')
  log('  ✅ 支持构建Vue.js整体应用', 'reset')
  log('  ✅ 自动部署到 Android 项目', 'reset')
  log('  ✅ 显示详细的构建日志', 'reset')
  log('  ✅ 自动清理临时文件', 'reset')
  
  log('\n注意事项:', 'yellow')
  log('  • 确保 Android 项目路径正确', 'reset')
  log('  • 确保已安装 Node.js 和 npm', 'reset')
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
