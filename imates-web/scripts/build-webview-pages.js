#!/usr/bin/env node

/**
 * WebView 页面单独构建脚本
 * 支持构建单个页面或所有页面
 */

import { build } from 'vite'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import path from 'path'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = path.join(__dirname, '..')

// 页面配置
const PAGES = {
  exerciseSolve: {
    name: '习题解答',
    entry: 'src/views/ExerciseSolveView.vue'
  },
  findExercise: {
    name: '习题查找',
    entry: 'src/views/FindExerciseView.vue'
  }
}

// 创建 HTML 模板
function createHtmlTemplate(pageName, title) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f7fa;
    }
    #app {
      width: 100%;
      height: 100vh;
    }
  </style>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main-webview.ts"></script>
</body>
</html>`
}

// 构建单个页面
async function buildPage(pageKey, pageConfig) {
  console.log(`🚀 开始构建 ${pageConfig.name} 页面...`)
  
  try {
    // 创建临时 HTML 文件
    const tempHtmlPath = join(projectRoot, `temp-${pageKey}.html`)
    fs.writeFileSync(tempHtmlPath, createHtmlTemplate(pageKey, pageConfig.name))
    
    // 为每个页面创建独立的输出目录
    const pageOutputDir = join(projectRoot, 'dist-webview', pageKey)
    
    // 清理该页面的输出目录
    if (fs.existsSync(pageOutputDir)) {
      fs.rmSync(pageOutputDir, { recursive: true, force: true })
    }
    
    // 构建配置 - 直接输出到页面目录
    const buildConfig = {
      configFile: 'vite.config.webview.ts',
      build: {
        outDir: pageOutputDir,
        // 强制启用 source map 用于调试
        sourcemap: 'inline',
        // 保留函数名便于调试
        minify: false,
        rollupOptions: {
          input: {
            [pageKey]: tempHtmlPath
          }
        }
      }
    }
    
    // 执行构建
    await build(buildConfig)
    
    // 重命名输出文件 - 直接在页面目录中重命名
    const oldFile = join(pageOutputDir, `temp-${pageKey}.html`)
    const newFile = join(pageOutputDir, 'index.html')
    
    if (fs.existsSync(oldFile)) {
      fs.renameSync(oldFile, newFile)
      console.log(`✅ ${pageConfig.name} 页面构建成功: ${pageOutputDir}/index.html`)
    } else {
      console.error(`❌ 构建失败: 找不到输出文件 ${oldFile}`)
    }
    
    // 清理临时文件
    if (fs.existsSync(tempHtmlPath)) {
      fs.unlinkSync(tempHtmlPath)
    }
    
  } catch (error) {
    console.error(`❌ 构建 ${pageConfig.name} 页面失败:`, error.message)
    throw error
  }
}

// 构建所有页面
async function buildAllPages() {
  console.log('🚀 开始构建所有 WebView 页面...\n')
  
  const startTime = Date.now()
  
  try {
    // 清理整个输出目录
    const distPath = join(projectRoot, 'dist-webview')
    if (fs.existsSync(distPath)) {
      fs.rmSync(distPath, { recursive: true, force: true })
      console.log('🧹 已清理 dist-webview 目录')
    }
    
    // 构建所有页面
    for (const [pageKey, pageConfig] of Object.entries(PAGES)) {
      await buildPage(pageKey, pageConfig)
      console.log('') // 空行分隔
    }
    
    const endTime = Date.now()
    const duration = ((endTime - startTime) / 1000).toFixed(2)
    
    console.log(`🎉 所有页面构建完成！耗时: ${duration}s`)
    console.log('\n📁 输出目录结构:')
    console.log('dist-webview/')
    Object.entries(PAGES).forEach(([key, page]) => {
      console.log(`├── ${key}/`)
      console.log(`│   ├── index.html`)
      console.log(`│   └── assets/`)
    })
    console.log('\n📄 页面访问路径:')
    Object.entries(PAGES).forEach(([key, page]) => {
      console.log(`   - ${page.name}: dist-webview/${key}/index.html`)
    })
    
  } catch (error) {
    console.error('❌ 构建失败:', error.message)
    process.exit(1)
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2)
  const pageKey = args[0]
  
  if (pageKey && PAGES[pageKey]) {
    // 构建指定页面
    await buildPage(pageKey, PAGES[pageKey])
  } else if (pageKey) {
    console.error(`❌ 未知的页面: ${pageKey}`)
    console.log('可用的页面:', Object.keys(PAGES).join(', '))
    process.exit(1)
  } else {
    // 构建所有页面
    await buildAllPages()
  }
}

// 运行
main().catch(error => {
  console.error('❌ 构建过程出错:', error)
  process.exit(1)
})
