# 项目面试题集合

> 本面试题集合基于项目实际代码实现，深入探讨技术细节与业务难点。题目设计旨在展示对项目的透彻理解，涵盖原生（Android）和 Web（Vue 3）两端的核心技术与工程实践。

---

## 面试题特色

- **深度**: 基于项目真实代码实现，而非泛泛而谈的理论知识。
- **实战**: 题目来源于项目中的实际业务场景和技术挑战。
- **全面**: 覆盖前端、后端、移动端、混合开发等多个领域。

---

## 目录

### [1. 原生开发 - Android](native/android.md)

- **架构与工程化**: MVVM + Clean Architecture、DataBinding vs ViewBinding、组件化与 productFlavors
- **性能优化**: 大文件下载与 MD5 校验、CameraX 生命周期、FFmpeg 集成
- **混合开发**: Capacitor JS Bridge、离线资源管理、IndexedDB 分离存储
- **业务难点**: 数学公式渲染（MathLive/KaTeX）、PDF 标注与双层 Canvas

### 2. Web 开发 (按模块划分)

#### [核心框架与状态管理](web/vue-core.md)
- Vue 3 响应式系统（ref vs reactive、shallowRef）
- 性能优化（v-memo、Virtual DOM 靶向更新）
- Pinia 状态管理（storeToRefs、热更新）
- TypeScript 类型最佳实践

#### [UI 框架与样式](web/styling-ui.md)
- Tailwind CSS JIT 模式与配置
- Quasar 响应式断点与插件系统
- 滚动优化（@better-scroll）
- Lottie 动画与性能优化

#### [图形与交互](web/canvas-graphics.md)
- 双层 Canvas 架构与坐标对齐
- 贝塞尔曲线平滑算法
- 空间索引与图形拾取
- 性能优化（离屏渲染、脏矩形）
- Fabric.js vs Konva 对比

#### [富文本、文档与公式](web/rich-text-pdf.md)
- Tiptap 自定义节点与图片上传
- PDF.js vs MuPDF 选型理由
- LaTeX 多格式预处理与缓存
- KaTeX vs MathJax 性能对比
- MathLive 虚拟键盘集成

#### [移动端混合开发](web/mobile-hybrid.md)
- Capacitor vs Cordova 架构对比
- JS Bridge 通信原理
- IndexedDB 性能优化与分离存储
- 资源下载与断点续传
- Webview 首屏优化与权限管理

#### [实时通信与 AI 对话](web/communication-ai.md)
- WebSocket 心跳与指数退避重连
- 单连接多会话消息分发架构
- AI 流式输出缓冲区处理
- 消息发送幂等性与重试机制

#### [工程化与质量保证](web/engineering-qa.md)
- 多框架共存架构（Vue & React）下的构建挑战
- Webview 离线包构建优化策略
- 复杂交互的自动化测试 (Vitest + Playwright)
- Webview 性能监控与异常上报

---

## 核心技术栈

| 领域 | 技术 |
|------|------|
| 前端框架 | Vue 3 (Composition API), Pinia, Vue Router 4 |
| UI 框架 | Quasar, Tailwind CSS |
| Canvas 图形 | Fabric.js, Konva, 原生 Canvas |
| 富文本 | Tiptap, Quill |
| 文档处理 | PDF.js, MuPDF (WASM) |
| 数学公式 | KaTeX, MathLive |
| 移动端 | Capacitor, Android (Kotlin) |
| 存储 | IndexedDB, localforage |
| 构建工具 | Vite, Gradle |

---

## 业务亮点

- **复杂公式渲染**: 支持 MathLive 输入、KaTeX 渲染、多种 LaTeX 格式预处理
- **PDF 标注系统**: 双层 Canvas、撤销/重做、空间索引优化
- **离线资源管理**: 分离存储架构、用户隔离、增量更新
- **混合开发**: Capacitor 深度集成、原生能力调用

---

*这些题目不仅考察通用技术知识，还紧密结合了本项目的业务场景（如复杂的数学公式渲染、PDF 编辑、多媒体处理等），是展示技术深度和项目理解的最佳素材。*
