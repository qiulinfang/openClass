# 研伴图片上传服务 (Node.js版)

本服务是 Java 端 `FileService.java` 中 `/api/system/uploadImg` 接口的 Node.js/Express 替代实现。

## 功能特性
1. **自动生成 UUID 文件名**：保留原始文件扩展名，确保上传文件不重名。
2. **动态日期子目录**：自动在存储目录下创建 `img/YYYYMMDD` 的子层级目录。
3. **返回相对路径**：移除上传根路径，仅返回 `/img/YYYYMMDD/xxxx.jpg`，对齐后端数据存储格式。
4. **环境适配**：支持使用环境变量配置服务端口和物理存储根路径。

## 快速启动

### 1. 安装依赖
```bash
npm install
```

### 2. 运行服务
*   **默认配置运行**（端口 `8201`，存储路径 `/usr/files/upload`）：
    ```bash
    npm start
    ```
*   **自定义配置运行**（例如本地开发测试）：
    ```bash
    # Windows PowerShell
    $env:PORT="8201"; $env:UPLOAD_FOLDER="./upload"; npm start

    # Windows CMD
    set PORT=8201&&set UPLOAD_FOLDER=./upload&&npm start

    # Linux / macOS
    PORT=8201 UPLOAD_FOLDER=./upload npm start
    ```
