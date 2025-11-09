# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **IMates Education Platform** - a comprehensive educational application consisting of an Android app with integrated Vue.js web components for AI-powered tutoring, PDF viewing, screen sharing, and knowledge graph visualization. The project serves teachers and students with intelligent teaching tools and real-time communication features.

## Project Structure

```
xuebanqianduan/
├── app/                    # Main Android application (Java/Kotlin)
├── imates-web/             # Vue.js web application for WebView
├── imates-RN/              # React Native components (legacy)
├── pdflibrary/             # PDF processing module
├── image/                  # Image processing module
├── mupdf-android-1.9-modify/ # Custom MuPDF PDF engine
└── 项目文档/                # Project documentation
```

## Development Commands

### Vue.js Web Development (imates-web/)

```bash
# Development server
npm run dev                 # Start dev server on all interfaces
npm run dev:webview        # Start dev server with WebView config

# Building
npm run build              # Production build
npm run build:webview      # Build for WebView deployment
npm run build:exercise     # Build exercise page only
npm run build:find         # Build find exercise page only
npm run build:full         # Build all pages

# Deployment
npm run deploy             # One-click deploy to Android assets
npm run deploy:exercise    # Deploy exercise page only
npm run deploy:find        # Deploy find page only
npm run deploy:full        # Deploy all pages

# Testing & Quality
npm run test:unit          # Run unit tests with Vitest
npm run test:e2e          # Run E2E tests with Playwright
npm run lint              # ESLint with auto-fix
npm run format            # Prettier formatting
npm run type-check        # TypeScript type checking
```

### Android Development

```bash
# Build commands
./gradlew assembleDebug           # Build debug APK
./gradlew assembleRelease         # Build release APK
./gradlew installDebug           # Build and install debug APK

# Product flavors (avoid app conflicts)
./gradlew assembleProductionRelease    # Production build
./gradlew assembleStagingRelease       # Staging build
./gradlew assembleDevDebug            # Development build

# Testing
./gradlew test                    # Run unit tests
./gradlew connectedAndroidTest    # Run instrumentation tests

# Clean
./gradlew clean                   # Clean build artifacts
```

## Core Architecture

### Hybrid Architecture (Android + Web)
- **Android App**: Native container providing WebView bridge, camera, PDF processing, networking
- **Vue.js WebView**: Chat interfaces, knowledge graphs, exercise solving, PDF annotation
- **Communication**: JavaScript bridge (`WebAppInterface.java`) enables bidirectional communication

### Chat System Strategy Pattern
The chat system uses a sophisticated strategy pattern:

```
ChatView (Vue component)
├── ChatStrategy (interface)
├── AiGeneralStrategy (general AI chat)
├── AiExerciseStrategy (exercise-specific chat)
├── AiTextbookStrategy (textbook-based chat)
├── TeacherStrategy (teacher communication)
└── ForwardMessageHelper (message forwarding utilities)
```

**Key Features:**
- Message forwarding between AI and teacher chats
- Support for text, image, and voice messages
- Session management with automatic storage
- Context-aware responses based on exercise/textbook content

### State Management (Pinia Stores)
- `aiExerciseChatStore` - AI exercise conversations
- `teacherExerciseChatStore` - Teacher exercise discussions
- `teacherGeneralChatStore` - General teacher conversations
- `questionStore` - Exercise data and current selections
- `userStore` - Authentication and user preferences
- `pdfViewerStore` - PDF annotation and viewing state
- `KnowledgeGraphStore` - Knowledge graph navigation

### Message Forwarding System
Complex message forwarding between AI chats and teacher communications:
- **Session Types**: `'general'` for AI general/textbook → teacher general, `'exercise'` for AI exercise → teacher exercise
- **Storage**: IndexedDB with immediate persistence (no debouncing)
- **Types**: Single message and batch message forwarding
- **Android Integration**: RabbitMQ messaging via `MessagingManager`

## Key Configuration

### Environment Variables
- `VITE_ENABLE_DEBUG=true` - Enable debug features in web components

### Build Targets
- **Android API**: Min 24 (Android 6.0), Target 34 (Android 14)
- **Vue.js Target**: ES2015 for WebView compatibility
- **Java Version**: JDK 17

### Product Flavors (Android)
- `production` - Release version (`com.cosinetech.imates.bj101`)
- `staging` - Testing version (`com.cosinetech.imates.bj101.staging`)
- `dev` - Development version (`com.cosinetech.imates.bj101.dev`)

## Important Implementation Notes

### WebView-Android Bridge
- Located in `app/src/main/java/.../WebAppInterface.java`
- Provides methods for camera, file operations, messaging
- Critical for chat message forwarding: `forwardAiChatToTeacher()`

### Message Storage Architecture
- **Chat History**: IndexedDB with keys like `teacher-general-{sessionId}`
- **Sessions**: LocalStorage with keys like `{userId}_teacher-general-sessions`
- **Format**: `ChatHistoryData` interface with messages array + metadata

### PDF Integration
- Custom MuPDF engine for advanced PDF processing
- WebView integration for annotations and highlighting
- File handling through Android native bridge

### API Proxy Configuration (Development)
Vite proxy setup for CORS and development:
- `/blw-edu-yb/api` → `https://www.imates.com.cn:9099`
- `/admin` → `http://www.imates.com.cn:8222/blw-edu-service-alc`
- `/knowledge` → `http://www.imates.com.cn:8090`

## Project-Specific Patterns

### Error Handling
- Frontend: Console logging with structured error objects
- Android: Response objects with success/failure status
- Chat strategies: Graceful fallbacks for failed operations

### Performance Optimizations
- Message debouncing for chat history saves (except forwarding)
- Chunk splitting for large dependencies (MathLive, Quasar)
- Image optimization and WebP support

### Security Considerations
- APK signing with multiple keystores for different flavors
- Token-based authentication with automatic refresh
- Input sanitization for LaTeX/markdown content

## Testing Strategy

### Vue.js Testing
- **Unit**: Vitest for component logic
- **E2E**: Playwright for full user flows
- **Visual**: Screenshot testing for chat interfaces

### Android Testing
- **Unit**: JUnit for business logic
- **Integration**: Android Test framework
- **Manual**: Device testing across API levels 24-34

## Deployment Process

1. **Web Build**: Run `npm run deploy:full` to build and copy assets to Android
2. **Android Build**: Run `./gradlew assembleProductionRelease`
3. **APK Output**: `app/build/outputs/apk/production/release/`
4. **Metadata**: JSON files with MD5 checksums generated automatically

## Cursor Configuration

The project uses custom Cursor rules (`.cursorrules`) that implement automatic summarization logic. Key rules:
- Only summarize complex, completed problems with learning value
- Avoid summarizing simple fixes or ongoing work
- Ask user confirmation before generating summaries
- Store summaries in `.specstory/sum/` directory


代码修改和分析要求
分析思路展示：不要仅仅是改代码，需要在过程中穿插详细展示分析思路
文件生成限制
如果需要详细的分析，用md文档进行记录
禁止生成测试文档和各种说明、总结文档报告、test文件
语言要求
永远用中文回答
设计原则
禁止过度设计
遵循奥卡姆剃刀原则：所有方案需要遵循奥卡姆剃刀原则
代码质量要求
代码有效性分析：每次回答之后，必须分析生成的代码哪些是真正解决问题的，哪些代码是无用的，删除无用的
禁止过度优化：没有您的指令禁止进一步优化解决方案，如禁止更直接的解决方案、更有效的解决方案等等，完成功能即可
依赖管理
包管理器要求：使用npm+镜像下载
开发流程
任务分析优先：无论完成什么任务，都需要先详细分析任务讲解设计方案并生成md文件，待我进行决策之后再进行编码
代码复用优先：如果实现一个功能必须先查看是否有已有的实现方案，如果有则需要复用，不需要新建
代码规范
注释格式：函数为单位，以流程的形式写注释，例如第1步，第2步，...
调试语句：生成的代码禁止出现调试语句，保留console.error和console.warn这些真正的错误警告
事件监听：禁止使用document.addEventListener，使用事件监听指令替换
禁止墓碑注释：禁止生成墓碑注释
Java代码要求
导入语句：如果修改.java代码，需要import对应的类
技术栈要求
Vue技术栈：技术使用vue技术栈
如果需要对文件复制删除，使用powershell命令
修改了任何文件都要更新imates-web\docs-prd下的对应的文档
永远不要使用setTimeout和window.addEventListener