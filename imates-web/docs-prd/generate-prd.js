#!/usr/bin/env node

/**
 * PRD 文档生成脚本
 * 为 imates-web 项目中的每个文件生成 PRD 文档框架
 * 
 * 使用方法：
 * node generate-prd.js
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// PRD 模板
const PRD_TEMPLATE = `# [文件名] PRD 文档

## 📋 概述

**文件路径**：\`[文件完整路径]\`  
**文件类型**：\`[文件类型]\`  
**主要职责**：\`[职责说明]\`

## 🎯 功能需求

### 1. 核心功能
- \`[功能点1]\`：\`[功能说明]\`
- \`[功能点2]\`：\`[功能说明]\`

### 2. 功能边界
- \`[负责的功能]\`
- \`[不负责的功能]\`

## 🔧 技术实现

### 1. 依赖关系
- **导入依赖**：
  \`\`\`typescript
  // 主要依赖
  \`\`\`
- **被依赖**：
  - \`[文件路径]\`：\`[使用方式]\`

### 2. 关键代码逻辑
\`\`\`typescript
// 核心代码片段
\`\`\`

## 🔄 迁移到 React Native

### 1. 等价实现
- **当前实现**：\`[当前实现方式]\`
- **React Native 实现**：\`[React Native 实现方式]\`

### 2. 需要的第三方库
- \`[库名]\`：\`[用途说明]\`

### 3. 迁移步骤
1. \`[步骤1]\`
2. \`[步骤2]\`

### 4. 注意事项
- \`[注意点1]\`
- \`[注意点2]\`

## 📝 迁移代码示例

### Vue 实现
\`\`\`typescript
// 当前 Vue 实现代码
\`\`\`

### React Native 实现
\`\`\`typescript
// React Native 实现代码
\`\`\`

## ⚠️ 迁移风险

### 高风险项
- \`[风险项]\`：\`[风险说明]\` - \`[解决方案]\`

## 🧪 测试要点

### 功能测试
- \`[测试场景1]\`
- \`[测试场景2]\`

## 📚 参考资源

- \`[相关文档链接]\`

---

**文档版本**：v1.0  
**创建日期**：${new Date().toISOString().split('T')[0]}  
**维护者**：开发团队
`

// 文件类型映射
const FILE_TYPE_MAP = {
  '.vue': 'Vue 组件',
  '.ts': 'TypeScript 服务/工具',
  '.js': 'JavaScript 文件',
  '.sass': 'SASS 样式文件',
  '.scss': 'SCSS 样式文件',
  '.css': 'CSS 样式文件',
}

// 需要生成 PRD 的目录
const TARGET_DIRS = [
  'src',
  'scripts',
]

// 需要跳过的目录
const SKIP_DIRS = [
  'node_modules',
  'dist',
  'docs-prd',
  '.git',
]

// 需要跳过的文件
const SKIP_FILES = [
  'index.ts',
  'index.js',
]

/**
 * 获取文件类型
 */
function getFileType(filePath) {
  const ext = path.extname(filePath)
  return FILE_TYPE_MAP[ext] || '未知类型'
}

/**
 * 获取相对路径
 */
function getRelativePath(filePath) {
  const projectRoot = path.resolve(__dirname, '..')
  return path.relative(projectRoot, filePath).replace(/\\/g, '/')
}

/**
 * 生成 PRD 文档路径
 */
function getPRDPath(filePath) {
  const relativePath = getRelativePath(filePath)
  const prdPath = path.join(__dirname, relativePath + '.md')
  return prdPath
}

/**
 * 获取目录名称
 */
function getDirName(filePath) {
  const dir = path.dirname(filePath)
  const relativeDir = getRelativePath(dir)
  return relativeDir || '根目录'
}

/**
 * 填充模板
 */
function fillTemplate(filePath, content) {
  const relativePath = getRelativePath(filePath)
  const fileName = path.basename(filePath)
  const fileType = getFileType(filePath)
  const dirName = getDirName(filePath)
  
  // 读取源文件内容（前50行）用于分析
  let filePreview = ''
  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8')
    const lines = fileContent.split('\n').slice(0, 50)
    filePreview = lines.join('\n')
  } catch (error) {
    filePreview = '// 无法读取文件内容'
  }
  
  return PRD_TEMPLATE
    .replace(/\[文件名\]/g, fileName)
    .replace(/\[文件完整路径\]/g, relativePath)
    .replace(/\[文件类型\]/g, fileType)
    .replace(/\[职责说明\]/g, `位于 ${dirName} 目录的 ${fileType}`)
    .replace(/\[功能说明\]/g, '待补充')
    .replace(/\[当前实现方式\]/g, '待补充')
    .replace(/\[React Native 实现方式\]/g, '待补充')
    .replace(/\/\/ 核心代码片段/g, `// ${fileName} 的核心代码\n${filePreview.substring(0, 500)}`)
}

/**
 * 递归遍历目录
 */
function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) {
    return
  }
  
  const files = fs.readdirSync(dir)
  
  for (const file of files) {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)
    
    // 跳过不需要的目录
    if (stat.isDirectory()) {
      if (SKIP_DIRS.includes(file)) {
        continue
      }
      walkDir(filePath, callback)
    } else {
      // 跳过不需要的文件
      if (SKIP_FILES.includes(file)) {
        continue
      }
      
      // 只处理 src 目录下的文件
      const relativePath = getRelativePath(filePath)
      if (relativePath.startsWith('src/') || relativePath.startsWith('scripts/')) {
        callback(filePath)
      }
    }
  }
}

/**
 * 确保目录存在
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

/**
 * 主函数
 */
function main() {
  const projectRoot = path.resolve(__dirname, '..')
  const prdRoot = path.resolve(__dirname)
  
  console.log('🚀 开始生成 PRD 文档...')
  console.log(`项目根目录: ${projectRoot}`)
  console.log(`PRD 文档目录: ${prdRoot}`)
  console.log('')
  
  let fileCount = 0
  let skippedCount = 0
  
  // 遍历目标目录
  for (const targetDir of TARGET_DIRS) {
    const dirPath = path.join(projectRoot, targetDir)
    
    if (!fs.existsSync(dirPath)) {
      console.log(`⚠️  目录不存在: ${dirPath}`)
      continue
    }
    
    walkDir(dirPath, (filePath) => {
      const prdPath = getPRDPath(filePath)
      const prdDir = path.dirname(prdPath)
      
      // 如果 PRD 文件已存在，跳过
      if (fs.existsSync(prdPath)) {
        console.log(`⏭️  跳过（已存在）: ${getRelativePath(filePath)}`)
        skippedCount++
        return
      }
      
      // 确保目录存在
      ensureDir(prdDir)
      
      // 生成 PRD 内容
      const prdContent = fillTemplate(filePath, '')
      
      // 写入文件
      try {
        fs.writeFileSync(prdPath, prdContent, 'utf-8')
        console.log(`✅ 生成: ${getRelativePath(filePath)}`)
        fileCount++
      } catch (error) {
        console.error(`❌ 生成失败: ${getRelativePath(filePath)}`, error.message)
      }
    })
  }
  
  console.log('')
  console.log('='.repeat(50))
  console.log(`✅ 生成完成！`)
  console.log(`   生成文件数: ${fileCount}`)
  console.log(`   跳过文件数: ${skippedCount}`)
  console.log('='.repeat(50))
  console.log('')
  console.log('💡 提示：')
  console.log('   1. 已生成的 PRD 文档都是框架，需要手动补充详细内容')
  console.log('   2. 可以参考已完成的 PRD 文档作为示例')
  console.log('   3. 使用 PRD-模板.md 作为编写新 PRD 的参考')
}

// 运行主函数
main()

