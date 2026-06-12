const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')

const app = express()

// 端口和上传根路径配置（可通过环境变量配置）
const PORT = process.env.PORT || 8201
const UPLOAD_ROOT = process.env.UPLOAD_FOLDER || '/data/docker/upload/img'

// 确保上传根目录存在
if (!fs.existsSync(UPLOAD_ROOT)) {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true })
}

// 磁盘存储配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 动态拼接日期子目录，格式如 YYYYMMDD
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '') // 例如 20260612
    const targetDir = path.join(UPLOAD_ROOT, dateStr)

    // 确保目标子目录存在
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }

    cb(null, targetDir)
  },
  filename: (req, file, cb) => {
    // 生成 UUID 并保留原始后缀名
    const uniqueId = crypto.randomUUID()
    const ext = path.extname(file.originalname)
    cb(null, `${uniqueId}${ext}`)
  },
})

// multer 配置
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 限制 10MB
  },
})

// 图片上传路由，对接后端接口路径 /api/system/uploadImg
app.post('/api/system/uploadImg', (req, res) => {
  upload.single('file')(req, res, (err) => {
    // 校验异常
    if (err) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: err.message || '图片上传失败',
        data: null,
      })
    }

    // 校验文件是否存在
    if (!req.file) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '未上传文件',
        data: null,
      })
    }

    try {
      // 计算返回的相对路径
      const absolutePath = req.file.path
      // UPLOAD_ROOT 已经是 /data/docker/upload/img，所以相对绝对路径的差集为 20260612/uuid.jpg
      const relativePart = path.relative(UPLOAD_ROOT, absolutePath).replace(/\\/g, '/')
      // 前端与接口要求以 /img/ 开头，例如 /img/20260612/uuid.jpg
      const relativePath = '/img/' + relativePart

      // 对齐后端返回格式
      return res.json({
        code: 200,
        success: true,
        message: '成功',
        data: {
          id: null,
          path: relativePath,
        },
      })
    } catch (error) {
      return res.status(500).json({
        code: 500,
        success: false,
        message: error.message || '服务异常',
        data: null,
      })
    }
  })
})

// 健康检查接口
app.get('/health', (req, res) => {
  res.json({ status: 'UP' })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Image upload server is running on http://0.0.0.0:${PORT}`)
  console.log(`Upload root folder is: ${UPLOAD_ROOT}`)
})
