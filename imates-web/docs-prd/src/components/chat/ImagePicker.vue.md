# ImagePicker.vue PRD 文档

## 📋 概述

**文件路径**：`src/components/chat/ImagePicker.vue`  
**文件类型**：`Vue 组件`  
**主要职责**：提供图片选择对话框，支持从相机拍照和从相册选择图片，用于聊天中发送图片消息

## 🎯 功能需求

### 1. 核心功能
- **图片选择对话框**：显示模态对话框，提供"相机"和"相册"两个选项
- **相机拍照**：调用原生 Android Bridge 打开相机，拍照后获取图片数据
- **相册选择**：调用原生 Android Bridge 打开相册，选择图片后获取图片数据
- **图片数据处理**：接收原生返回的图片数据（base64DataUrl），构造 ImageData 对象
- **Promise 机制**：通过全局 composable 管理图片选择 Promise，支持取消和成功回调
- **错误处理**：处理相机/相册打开失败、图片处理失败等错误情况
- **防重复处理**：使用标记防止重复处理同一图片结果

### 2. 功能边界
- **负责的功能**：
  - 显示图片选择对话框 UI
  - 调用原生相机和相册功能
  - 处理原生返回的图片数据
  - 通过 Promise 机制返回选择结果
  - 错误处理和用户提示
- **不负责的功能**：
  - 图片上传（由 API 服务负责）
  - 图片显示（由 ImageMessage 组件负责）
  - 图片压缩（由原生端负责）

## 🔧 技术实现

### 1. 依赖关系
- **导入依赖**：
  ```typescript
  // 主要依赖
  ```
- **被依赖**：
  - `[文件路径]`：`[使用方式]`

### 2. 关键代码逻辑
```vue
// ImagePicker.vue 的核心代码
<template>
  <div class="image-picker">
    <!-- 图片选择对话框 -->
    <q-dialog v-model="isPickerVisible" class="image-picker-dialog">
      <div class="picker-modal">
        <!-- 标题栏 -->
        <div class="picker-header">
          <div class="picker-title">选择图片</div>
          <div class="picker-close" @click="closeDialog">×</div>
        </div>
        
        <!-- 选项区域 -->
        <div class="picker-options">
          <!-- 相机选项 -->
          <div class="picker-option" @click="captureFromCamera">
            <q-icon name="camera_alt" size="48px" class="option-icon" />
            <span class="option-label">相机</span>
          </div>
          
          <!-- 相册选项 -->
          <div class="picker-option" @click="selectFromGallery">
            <q-icon name="photo_library" size="48px" class="option-icon" />
            <span class="option-label">相册</span>
          </div>
        </div>
      </div>
    </q-dialog>
  </div>
</template>
```

### 3. UI 设计特点
- **简洁的模态对话框**：白色背景，圆角设计，居中显示
- **标题栏**：左上角显示"选择图片"标题，右上角显示关闭按钮（×）
- **选项按钮**：两个选项水平排列，每个选项包含：
  - 紫色图标（48px 大小）
  - 选项文字（"相机"或"相册"）
  - 浅灰色背景（#f5f5f5），圆角矩形
  - 悬停和点击交互效果
- **颜色方案**：
  - 图标颜色：紫色（#9c27b0）
  - 选项背景：浅灰色（#f5f5f5）
  - 文字颜色：深灰色（#333333）

## 🔄 迁移到 React Native

### 1. 等价实现
- **当前实现**：`待补充`
- **React Native 实现**：`待补充`

### 2. 需要的第三方库
- `[库名]`：`[用途说明]`

### 3. 迁移步骤
1. `[步骤1]`
2. `[步骤2]`

### 4. 注意事项
- `[注意点1]`
- `[注意点2]`

## 📝 迁移代码示例

### Vue 实现
```typescript
// 当前 Vue 实现代码
```

### React Native 实现
```typescript
// React Native 实现代码
```

## ⚠️ 迁移风险

### 高风险项
- `[风险项]`：`[风险说明]` - `[解决方案]`

## 🧪 测试要点

### 功能测试
- `[测试场景1]`
- `[测试场景2]`

## 📚 参考资源

- `[相关文档链接]`

---

**文档版本**：v1.0  
**创建日期**：2025-11-03  
**维护者**：开发团队
