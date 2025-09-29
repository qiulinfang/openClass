#!/usr/bin/env node

/**
 * 测试 Source Map 生成脚本
 * 验证构建后的文件是否包含 source map
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.join(__dirname, '..')

// 检查文件是否包含 source map
function checkSourceMap(filePath) {
  if (!fs.existsSync(filePath)) {
    return { exists: false, hasSourceMap: false, size: 0 }
  }
  
  const content = fs.readFileSync(filePath, 'utf8')
  const size = fs.statSync(filePath).size
  
  // 检查是否包含 source map 注释
  const hasSourceMapComment = content.includes('//# sourceMappingURL=')
  const hasInlineSourceMap = content.includes('//# sourceMappingURL=data:')
  
  return {
    exists: true,
    hasSourceMap: hasSourceMapComment || hasInlineSourceMap,
    hasInlineSourceMap,
    size,
    content: content.substring(0, 200) + '...' // 只显示前200个字符
  }
}

// 检查目录中的所有 JS 文件
function checkDirectory(dirPath) {
  console.log(`\n🔍 检查目录: ${dirPath}`)
  
  if (!fs.existsSync(dirPath)) {
    console.log('❌ 目录不存在')
    return
  }
  
  const files = fs.readdirSync(dirPath)
  const jsFiles = files.filter(file => file.endsWith('.js'))
  
  if (jsFiles.length === 0) {
    console.log('❌ 没有找到 JS 文件')
    return
  }
  
  let totalFiles = 0
  let filesWithSourceMap = 0
  
  jsFiles.forEach(file => {
    const filePath = path.join(dirPath, file)
    const result = checkSourceMap(filePath)
    totalFiles++
    
    console.log(`\n📄 ${file}`)
    console.log(`   大小: ${(result.size / 1024).toFixed(2)} KB`)
    console.log(`   Source Map: ${result.hasSourceMap ? '✅ 有' : '❌ 无'}`)
    
    if (result.hasSourceMap) {
      filesWithSourceMap++
      if (result.hasInlineSourceMap) {
        console.log(`   类型: 内联 Source Map`)
      } else {
        console.log(`   类型: 外部 Source Map`)
      }
    }
    
    // 显示文件开头内容
    if (result.content) {
      console.log(`   内容预览: ${result.content}`)
    }
  })
  
  console.log(`\n📊 统计:`)
  console.log(`   总文件数: ${totalFiles}`)
  console.log(`   包含 Source Map: ${filesWithSourceMap}`)
  console.log(`   Source Map 覆盖率: ${((filesWithSourceMap / totalFiles) * 100).toFixed(1)}%`)
}

// 主函数
function main() {
  console.log('🧪 Source Map 测试工具')
  console.log('=' * 50)
  
  // 检查 findExercise 目录
  const findExerciseDir = path.join(projectRoot, 'dist-webview', 'findExercise', 'assets')
  checkDirectory(findExerciseDir)
  
  // 检查 exerciseSolve 目录
  const exerciseSolveDir = path.join(projectRoot, 'dist-webview', 'exerciseSolve', 'assets')
  checkDirectory(exerciseSolveDir)
  
  console.log('\n🎯 建议:')
  console.log('1. 如果 Source Map 覆盖率为 0%，请运行: npm run build:find:debug')
  console.log('2. 在浏览器开发者工具中检查 Sources 标签页')
  console.log('3. 确保 Vue DevTools 扩展已安装并启用')
}

// 运行测试
main()
