# Web 面试题 - 设计模式

## 项目背景

在 `@imates-web` 的代码库中，设计模式被广泛应用于解耦复杂逻辑、处理环境差异以及提高组件的可重用性。以下是几个典型的应用实例：

### 1. 策略模式 (Strategy Pattern)
这是本项目中使用最频繁的设计模式，用于处理不同业务场景下的逻辑差异，而不需要在 UI 组件中使用大量的 `if-else`。

*   **聊天系统 (`ChatView.vue`)**:
    *   **实现**: `@imates-web/src/components/chat/strategies`
    *   **场景**: `ChatView` 组件通过 `ChatStrategy` 接口支持多种对话模式（通用 AI、题目辅导、作业、教材、人工老师等）。
    *   **代码参考**: `ChatStrategyFactory.create(props.type)` 根据类型创建不同的策略类（如 `AiExerciseStrategy`, `TeacherStrategy`），每种策略负责自己的消息发送逻辑、欢迎语和功能限制。

*   **题目列表 (`QuestionList.vue`)**:
    *   **实现**: `@imates-web/src/components/question/strategies`
    *   **场景**: 同一个 `QuestionList` 组件用于展示“我的习题”、“我的作业”和“错题本”。
    *   **代码参考**: `createQuestionListStrategy(props.type)` 会根据类型返回 `MyExerciseStrategy`, `MyHomeworkStrategy` 或 `MistakeStrategy`。这些策略定义了列表是否支持“发送给 AI”、是否可以“置顶”或“删除”。

### 2. 工厂模式 (Factory Pattern)
用于封装对象的创建过程，特别是涉及环境判断时。

*   **图片选择适配器工厂**:
    *   **文件**: `@imates-web/src/adapters/ImagePickerAdapterFactory.ts`
    *   **场景**: 拍照和选图功能需要同时支持 Android 原生环境和纯 Web 环境。
    *   **实现**: `ImagePickerAdapterFactory.getAdapter()` 会检测 `androidBridge` 是否可用，从而决定返回 `AndroidImagePickerAdapter` 还是 `WebImagePickerAdapter`。

### 3. 适配器模式 (Adapter Pattern)
用于抹平不同底层实现的差异，提供统一的 API。

*   **图片选择适配器**:
    *   **接口**: `@imates-web/src/adapters/IImagePickerAdapter.ts`
    *   **实现**: `AndroidImagePickerAdapter` 内部调用原生 Bridge，而 `WebImagePickerAdapter` 内部调用浏览器 `input[type="file"]`。对调用方来说，只需调用 `captureFromCamera()`，无需关心底层实现。

### 4. 依赖注入 (Provide / Inject)
Vue 3 提供的这种模式在项目中用于解决深层组件通信问题。

*   **知识图谱调试与参数**:
    *   **场景**: `KnowledgeGraphView.vue` 作为顶级容器，通过 `provide` 向深层的 `GraphNode.vue` 注入角度配置、调试状态等响应式数据。
    *   **价值**: 避免了繁琐的 Props Drilling（属性逐层传递）。

### 5. 单例模式 (Singleton Pattern)
*   **Pinia Stores**: 项目中的 `aiExerciseChatStore.ts`, `aiGeneralChatStore.ts` 等本质上都是单例模式的应用，确保整个 Web 应用在运行时共享同一个状态实例。
*   **Android Bridge**: `@imates-web/src/services/business/android-bridge.ts` 导出的实例通常作为单例使用，统一管理与 Android 原生的通信。

### 6. 命令模式 (Command Pattern) 的思想
*   **Canvas 标注系统**: 在 PDF 标注功能中，用户的每一笔划被抽象为 `Stroke` 对象，存入 `undoStack` 和 `redoStack`。这种将操作抽象为对象以便撤销/重做的做法，正是命令模式的核心思想。

### 总结
这些设计模式的结合使用，使得 `imates-web` 能够在一个复杂的 Hybrid 环境下保持代码的整洁：**策略模式处理业务差异，适配器模式处理环境差异，工厂模式负责选择，注入模式负责通信。**
> 本面试题基于项目实际代码，深入探讨技术实现细节与业务难点。



在 `@imates-web` 的代码库中，设计模式被广泛应用于解耦复杂逻辑、处理环境差异以及提高组件的可重用性。以下是几个典型的应用实例：

### 1. 策略模式 (Strategy Pattern)
这是本项目中使用最频繁的设计模式，用于处理不同业务场景下的逻辑差异，而不需要在 UI 组件中使用大量的 `if-else`。

*   **聊天系统 (`ChatView.vue`)**:
    *   **实现**: `@imates-web/src/components/chat/strategies`
    *   **场景**: `ChatView` 组件通过 `ChatStrategy` 接口支持多种对话模式（通用 AI、题目辅导、作业、教材、人工老师等）。
    *   **代码参考**: `ChatStrategyFactory.create(props.type)` 根据类型创建不同的策略类（如 `AiExerciseStrategy`, `TeacherStrategy`），每种策略负责自己的消息发送逻辑、欢迎语和功能限制。

*   **题目列表 (`QuestionList.vue`)**:
    *   **实现**: `@imates-web/src/components/question/strategies`
    *   **场景**: 同一个 `QuestionList` 组件用于展示“我的习题”、“我的作业”和“错题本”。
    *   **代码参考**: `createQuestionListStrategy(props.type)` 会根据类型返回 `MyExerciseStrategy`, `MyHomeworkStrategy` 或 `MistakeStrategy`。这些策略定义了列表是否支持“发送给 AI”、是否可以“置顶”或“删除”。

### 2. 工厂模式 (Factory Pattern)
用于封装对象的创建过程，特别是涉及环境判断时。

*   **图片选择适配器工厂**:
    *   **文件**: `@imates-web/src/adapters/ImagePickerAdapterFactory.ts`
    *   **场景**: 拍照和选图功能需要同时支持 Android 原生环境和纯 Web 环境。
    *   **实现**: `ImagePickerAdapterFactory.getAdapter()` 会检测 `androidBridge` 是否可用，从而决定返回 `AndroidImagePickerAdapter` 还是 `WebImagePickerAdapter`。

### 3. 适配器模式 (Adapter Pattern)
用于抹平不同底层实现的差异，提供统一的 API。

*   **图片选择适配器**:
    *   **接口**: `@imates-web/src/adapters/IImagePickerAdapter.ts`
    *   **实现**: `AndroidImagePickerAdapter` 内部调用原生 Bridge，而 `WebImagePickerAdapter` 内部调用浏览器 `input[type="file"]`。对调用方来说，只需调用 `captureFromCamera()`，无需关心底层实现。

### 4. 依赖注入 (Provide / Inject)
Vue 3 提供的这种模式在项目中用于解决深层组件通信问题。

*   **知识图谱调试与参数**:
    *   **场景**: `KnowledgeGraphView.vue` 作为顶级容器，通过 `provide` 向深层的 `GraphNode.vue` 注入角度配置、调试状态等响应式数据。
    *   **价值**: 避免了繁琐的 Props Drilling（属性逐层传递）。

### 5. 单例模式 (Singleton Pattern)
*   **Pinia Stores**: 项目中的 `aiExerciseChatStore.ts`, `aiGeneralChatStore.ts` 等本质上都是单例模式的应用，确保整个 Web 应用在运行时共享同一个状态实例。
*   **Android Bridge**: `@imates-web/src/services/business/android-bridge.ts` 导出的实例通常作为单例使用，统一管理与 Android 原生的通信。

### 6. 命令模式 (Command Pattern) 的思想
*   **Canvas 标注系统**: 在 PDF 标注功能中，用户的每一笔划被抽象为 `Stroke` 对象，存入 `undoStack` 和 `redoStack`。这种将操作抽象为对象以便撤销/重做的做法，正是命令模式的核心思想。

1. 认识对象

2. 抽象对象能力(API)

3. 识别业务动作

4. 用多个API组合实现业务动作

5. 将业务动作封装成Command

6. 让系统围绕Command进行调度


### 总结
这些设计模式的结合使用，使得 `imates-web` 能够在一个复杂的 Hybrid 环境下保持代码的整洁：**策略模式处理业务差异，适配器模式处理环境差异，工厂模式负责选择，注入模式负责通信。**



## 1. 常用设计模式实践

### Q1: 项目中如何应用"依赖注入"（DI）模式来解耦组件？
- **场景**: 知识图谱预览（`KnowledgeGraphView.vue`）和调试面板。
- **项目实践**: 
  - **Provider**: `KnowledgeGraphView.vue` 使用 `provide('knowledgeGraphAngleData', ...)` 提供全局的角度配置和调试参数。
  - **Consumer**: 深层嵌套的 `GraphNode.vue` 或调试面板组件使用 `inject` 获取这些数据，而无需通过 Props 层层传递。
- **价值**: 避免了 "Props Drilling" 问题，使得图形渲染组件能够独立于控制面板逻辑。

### Q2: 在复杂的 Store（如 `aiExerciseChatStore`）中，是如何体现"组合优于继承"设计思想的？
- **背景**: AI 对话功能涉及流式输出、历史记录持久化、错误重试、Markdown 渲染等复杂逻辑。
- **项目实践**: 
  - 将逻辑抽离为多个 **Composables**:
    - `useChatEngine`: 负责打字机效果和 DOM 滚动。
    - `useChatPersistence`: 负责 `IndexedDB/LocalForage` 读写。
    - `useChatRetry`: 负责指数退避重连算法。
- **设计原则**: 体现了 **单一职责原则 (SRP)**。每个 Composable 都是一个独立的逻辑单元，Store 作为一个"协调者"将它们组合在一起。

### Q3: 谈谈项目中"策略模式" (Strategy) 在多媒体消息渲染中的应用。
- **场景**: AI 聊天列表需要支持多种消息类型：文本、公式、图片、PDF 引用、Lottie 动画。
- **项目实践**: 
  - **策略定义**: 定义一个组件映射表 `messageComponentMap`。
  - **策略调度**: 根据后端返回的 `messageType`，通过动态组件 `<component :is="getComponent(type)" />` 自动选择渲染器。
- **价值**: 符合 **开闭原则 (OCP)**，新增一种媒体类型（如语音消息）时，只需增加一个新的策略组件并在 Map 中注册，无需修改现有的渲染逻辑。

### Q4: 项目中的"命令模式" (Command) 或撤销重做逻辑是如何实现的？
- **场景**: PDF 标注系统的画笔笔迹、擦除操作。
- **项目实践**: 
  - 将每一次书写或擦除抽象为一个 **Action 对象**（包含类型、路径数据、坐标等）。
  - 使用 `undoStack` 和 `redoStack` 存储这些对象。
- **实现**: `pdfViewerStore` 中的 `undo/redo` 方法通过弹出/压入栈来重新计算 Canvas 的渲染路径。

### Q5: "观察者模式" (Observer) 在跨端通信中是如何体现的？
- **场景**: 原生 Android 端与 Web 端的交互。
- **项目实践**: 
  - Web 端使用 `Capacitor.addListener` 订阅原生事件（如 `backButton`、`networkStatusChange`）。
  - 当原生端状态改变时，会通知所有注册的监听器。
- **价值**: 实现了原生能力与 Web 逻辑的异步解耦。

### Q6: 装饰器模式 (Decorator) 在自定义指令中的体现。
- **场景**: `v-mathjax-preview` 和 `v-paste-to-draft`。
- **项目实践**: 
  - 并不修改原始组件的逻辑，而是通过指令在 `mounted` 生命周期为 DOM 元素"装饰"额外的功能（如点击预览、公式渲染）。
- **价值**: 增强了 Markdown 渲染容器的功能，同时保持了渲染组件的纯净。

### Q7: 谈谈项目中的单例模式（Singleton）的应用。
- **场景**: Pinia Store 与原生桥接 (Android Bridge)。
- **项目实践**: 
  - **Pinia**: 所有 Store（如 `aiExerciseChatStore`）通过 `defineStore` 创建，在应用生命周期内是唯一的，确保全局状态一致。
  - **Bridge**: `@imates-web/src/services/business/android-bridge.ts` 导出的实例作为全局单例，统一管理与 Android 原生的通信。

### Q8: 适配器模式 (Adapter) 与 工厂模式 (Factory) 如何解决跨端差异？
- **背景**: 拍照和选图功能需要同时支持 Android 原生（调用相机）和 Web 环境（上传文件）。
- **项目实践**:
  - **接口定义**: `IImagePickerAdapter` 定义了统一的 `captureFromCamera` 接口。
  - **具体适配器**: `AndroidImagePickerAdapter`（通过桥接调用原生）和 `WebImagePickerAdapter`（使用 HTML5 Input）。
  - **工厂选择**: `ImagePickerAdapterFactory.getAdapter()` 自动检测环境并返回正确的适配器实例。
- **价值**: UI 组件只需调用工厂方法，无需关心当前运行在 Web 还是 WebView 中。

## 2. 架构模式与项目回顾

### Q8: 谈谈 MVVM 模式在 Vue 3 中的体现。
- **Model**: Pinia Store 或响应式数据。
- **View**: Vue 模板。
- **ViewModel**: Vue 组件逻辑（script setup），负责数据绑定 and 事件处理。
- **核心**: 数据双向绑定（v-model）和声明式渲染。

### Q10: 项目架构回顾：你是如何通过设计模式提升复杂 Web 项目可维护性的？
- **核心痛点**: 
  1. **场景爆炸**: 聊天视图需要适配 7+ 种不同的业务场景。
  2. **端差异**: 同样的业务逻辑需要运行在 Web 和 Android WebView 中。
  3. **组件臃肿**: 核心组件（如 `ChatView`）逻辑过重，难以维护。
- **解决方案回顾**:
  - **策略模式解耦场景**: 通过 `ChatStrategy` 接口将业务逻辑（发送、转发、欢迎语）从 UI 中剥离，新增场景只需增加策略文件，无需改动 `ChatView`。
  - **适配器模式抹平环境**: 建立 `Adapter` 层处理图片选择、截图捕获等原生能力差异，使上层代码实现 "Write Once, Run Everywhere"。
  - **组合式 API (Composables) 实现逻辑拆分**: 将 Store 中的重度逻辑（重试、持久化）拆分为独立的 Composable，遵循单一职责原则。
- **成果**: 
  - 组件代码量大幅减少，核心逻辑更加清晰。
  - 成功支撑了从单一 AI 对话到多学科、多场景（作业、教材、老师）的平滑扩展。
  - 极大地降低了 Web 环境与 Hybrid 环境切换时的维护成本。
