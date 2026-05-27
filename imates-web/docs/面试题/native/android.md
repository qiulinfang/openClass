# Android 原生开发面试题

> 本面试题基于项目实际代码实现，深入探讨技术细节与业务难点。

## 1. 架构与工程化 (Architecture)

### Q1: 项目采用 MVVM + Clean Architecture，请结合代码说明各层的职责边界是什么？DataBinding 和 ViewBinding 有什么区别，为什么选择其中一种？
- **View (Activity/Fragment)**: 仅负责 UI 渲染和用户交互，不执行业务逻辑。
- **ViewModel**: 持有 UI 状态，处理业务逻辑，通过 LiveData/StateFlow 向 View 层分发数据。
- **Repository**: 数据抽象层，统一管理本地（Room/SharedPreferences）和远程数据源。
- **DataBinding vs ViewBinding**: DataBinding 支持在 XML 中直接绑定表达式（如 `@{user.name}`），但有运行时开销；ViewBinding 只生成绑定类，无表达式支持，性能更好。本项目使用 **ViewBinding + DataBinding 混合**模式。

### Q2: 项目中如何处理多模块依赖和组件化？build.gradle 中的 productFlavors 是什么作用？
- **组件化**: 项目按功能拆分为多个 Module（app, image 等），通过 `settings.gradle` 统一管理依赖关系。
- **productFlavors**: 用于区分不同发布渠道（如 dev, production），每个 Flavor 可以有不同的：
  - `applicationIdSuffix`（避免覆盖已安装的应用）
  - `app_name`（如"开发版学伴"）
  - `UPDATE_URL`（更新检测地址）

### Q3: 为什么 Kotlin 协程比 Java 线程池更适合处理异步任务？请结合 Retrofit + OkHttp 的集成说明。
- **轻量级**: 协程是用户态线程，一个线程可以运行成千上万个协程。
- **取消机制**: 协程支持结构化取消，自动传播取消信号。
- **Retrofit + OkHttp**: Retrofit 底层使用 OkHttp，两者天然支持协程，通过 `suspend` 函数即可实现同步调用。

## 2. 性能优化 (Performance)

### Q4: 项目中如何处理大文件下载和 MD5 校验？请说明流式下载和分块合并的原理。
- **流式下载**: 使用 OkHttp 的 `Call.enqueue` 配合 `Callback`，通过 `Response.body.byteStream()` 获取 `InputStream`，边下载边写入，避免内存溢出。
- **MD5 校验**: 下载完成后，使用 `MessageDigest` 计算文件的 MD5 值，与服务器返回的 checksum 比对。
- **分块合并**: 参考 Web 端的 `mergeChunksEfficiently` 方法，将多个 `Uint8Array` 合并为一个大数组。

### Q5: CameraX 的生命周期感知是如何工作的？为什么能减少内存泄漏？
- CameraX 的 `CameraProvider` 会绑定到宿主 Activity 的生命周期。
- 当 Activity 进入 `onStop` 时，Camera 会自动释放资源；进入 `onResume` 时自动恢复。
- 开发者无需手动管理相机的打开/关闭，避免了因生命周期不匹配导致的泄漏。

### Q6: FFmpeg 在项目中用于哪些场景？集成时需要注意哪些兼容性问题？
- **应用场景**: 视频剪辑、格式转换（如 MP4 转 FLV）、音视频流处理。
- **兼容性**: 需要处理不同 CPU 架构（arm64-v8a, armeabi-v7a, x86）的 SO 库加载，使用 `FFmpegKit` 时需确保引入正确的 ABI 过滤。

## 3. 混合开发与通信 (Hybrid)

### Q7: Webview 与原生是如何通信的？Capacitor 的 JS Bridge 机制是什么？
- **Web 调用原生**: Capacitor 在 `window` 对象上暴露了 `Capacitor` 全局对象，通过 `Capacitor.nativeCallback` 发送消息到原生层。
- **原生调用 Web**: 原生通过 `WebView.evaluateJavaScript` 执行 JS 代码。
- **插件机制**: 每个 Capacitor 插件（如 Camera, Filesystem）都对应一个原生实现，通过统一的 Bridge 协议通信。

### Q8: 项目如何实现离线资源管理？本地存储架构是怎样的？
- **分离存储**: 元数据存储在 `textbooks` 表，二进制文件存储在 `textbook_files` 表。
- **用户隔离**: 使用 `userId` 作为数据库名前缀（如 `TextbookStorage_${userId}`），实现多账号数据隔离。
- **降级策略**: 查询时优先使用索引，索引不存在时降级到全表扫描（兼容旧数据库）。

## 4. 业务难点 (Business)

### Q9: 项目中如何渲染复杂的数学公式（LaTeX）？MathLive 和 KaTeX 的区别是什么？
- **MathLive**: 提供可交互的公式编辑器，支持虚拟键盘，适合用户输入场景。
- **KaTeX**: 纯渲染引擎，性能极高（比 MathJax 快 10 倍以上），适合静态展示。
- **混合使用**: 用户输入时使用 MathLive 组件，预览时转换为 KaTeX 渲染。

### Q10: PDF 标注功能是如何实现的？Canvas 层叠方案有哪些优势？
- **双层 Canvas**: 底层 Canvas 渲染 PDF 页面，上层 Canvas 渲染用户手写笔迹。
- **优势**: PDF 只需渲染一次，笔迹变更时只需重绘上层，极大降低渲染开销。
- **坐标转换**: 需要处理 `devicePixelRatio` 和缩放比例，确保笔迹与 PDF 底图对齐。
