# MainWebViewActivity全屏设置分析

## 问题分析

### 当前状态
1. **AndroidManifest配置缺失**：MainWebViewActivity没有设置全屏主题，而其他Activity都使用了`@style/Theme.IMatesApp.FullScreen`
2. **WindowUtils.setFullScreenMode问题**：
   - 强制设置横屏（`ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE`），与AndroidManifest中portrait设置冲突
   - 方法逻辑混乱，同时调用了hideSystemUI又设置了不同的systemUiVisibility
3. **代码执行顺序**：虽然onCreate中调用了全屏方法，但可能因为主题未设置导致效果不理想

## 解决方案

### 方案1：在AndroidManifest中设置全屏主题（推荐）
- **优点**：主题级配置，启动即生效，无需代码干预
- **实现**：在AndroidManifest.xml中为MainWebViewActivity添加`android:theme="@style/Theme.IMatesApp.FullScreen"`

### 方案2：优化代码中的全屏设置
- **修复WindowUtils.setFullScreenMode**：移除强制横屏设置，优化逻辑
- **优化onCreate顺序**：确保全屏设置在setContentView之前执行

### 方案3：组合方案（最优）
- 同时使用主题配置和代码设置，确保全屏效果在所有Android版本上都能正常工作

## 实施步骤

1. ✅ 在AndroidManifest.xml中为MainWebViewActivity添加全屏主题
2. ✅ 优化WindowUtils.setFullScreenMode方法，移除强制横屏设置
3. ✅ 确保MainWebViewActivity的onCreate中全屏设置在setContentView之前

## 代码修改点

### 1. AndroidManifest.xml
- **文件路径**：`app/src/main/AndroidManifest.xml`
- **修改内容**：为MainWebViewActivity添加`android:theme="@style/Theme.IMatesApp.FullScreen"`属性
- **效果**：Activity启动时自动应用全屏主题

### 2. WindowUtils.java
- **文件路径**：`app/src/main/java/com/cosinetech/imates/utils/WindowUtils.java`
- **修改内容**：
  - 移除强制横屏设置（`ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE`）
  - 简化setFullScreenMode方法逻辑，移除重复的systemUiVisibility设置
  - 添加流程注释（第1步、第2步、第3步）
- **效果**：全屏设置不再强制横屏，逻辑更清晰

### 3. MainWebViewActivity.java
- **文件路径**：`app/src/main/java/com/cosinetech/imates/ui/webview/MainWebViewActivity.java`
- **修改内容**：
  - 调整onCreate中全屏设置调用顺序
  - setFullScreenMode在setContentView之前调用
  - hideSystemUI在setContentView之后调用（确保能正确获取DecorView）
  - 添加流程注释说明
- **效果**：全屏设置在正确的时机执行，确保启动即全屏

## 实现效果

通过以上修改，MainWebViewActivity在启动时将会：
1. 应用全屏主题（AndroidManifest配置）
2. 隐藏系统状态栏和导航栏
3. 占据整个屏幕空间
4. 保持竖屏方向（不强制横屏）

## 注意事项

1. **主题配置**：全屏主题已在AndroidManifest中配置，这是最可靠的方式
2. **代码设置**：代码中的全屏设置作为补充，确保在不同Android版本上都能正常工作
3. **生命周期**：onResume和onWindowFocusChanged中也会调用hideSystemUI，确保从其他Activity返回时保持全屏

