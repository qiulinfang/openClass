2025-11-19 更新：新增“WebAppInterface课堂接口与MainActivity一致性分析”小节

问题序号：WebAppInterface课堂接口与MainActivity一致性分析

## 问题元信息
- **问题分类**：架构
- **严重程度**：中
- **影响范围**：WebView 课堂入口、原生课堂投屏模式
- **发现日期**：2025-12-12
- **解决状态**：已解决

## 问题现象
Web 端开展课堂功能需要调用 `androidBridge.joinClassroom/exitClassroom`，但缺乏一份明确说明其是否与原生 `MyProfileActivity` 同步的资料，导致团队难以确认 Web 入口与原生入口的行为是否一致，存在重复实现或状态不一致的风险。

## 复现步骤
1. 在 WebView 中打开 `MyProfileView.vue` 页面并点击“加入课堂”。
2. 由于缺少文档，团队需手动查看 `WebAppInterface` 与 `MyProfileActivity` 的实现来判断是否相同。
3. 该确认流程复杂且易遗漏，造成沟通成本高。

## 用户体验
- 用户无法确信 Web 入口与原生入口的课堂状态保持一致。
- 研发人员需要多次对照代码，效率低。
- 若误判导致重复实现，可能引入课堂状态错乱。

## 相关文件/模块
- **涉及文件**：
  - `app/src/main/java/com/cosinetech/imates/ui/webview/common/WebAppInterface.java`：Web 与原生桥接层。
  - `app/src/main/java/com/cosinetech/imates/ui/activities/MyProfileActivity.java`：原生课堂入口 Activity。
  - `imates-web/src/views/MyProfileView.vue`：Web 端 UI。
- **涉及模块**：
  - `screencasting`：课堂投屏核心能力。
  - `ScreenShareKit` / `ScreenCastingManager`：课堂状态管理。

## 技术原因 (❌)
1. 文档空缺：没有集中描述 `WebAppInterface` 如何封装 `screencasting` 能力。
2. 逻辑分散：Web 与原生各自维护一套流程，缺乏显式对比。
3. 状态传播路径复杂：`ScreenShareKit` + `H264MpegTSStreamerManager` + JS 事件链未在同一文档说明。

```java
@JavascriptInterface
public String joinClassroom(String studentId, String studentName, boolean isGuest) {
    if (ScreenCastingManager.isHavingClass()) {
        return createResponse(false, "已在课堂中", null);
    }
    if (isGuest || userId.equals("guest000")) {
        ApplicationModelShared.getInstance().fakeClassMode = true;
        executeJavaScript("window.onClassroomJoined(...)");
        return createResponseWithJsonData(true, "游客模式加入课堂成功", "{\"mode\":\"guest\",\"isInClass\":true}");
    }
    ScreenShareKit.INSTANCE.init(activity)
        .config(...)
        .onH264(...)
        .onStart(() -> {
            ScreenCastingManager.setClassMode(true);
            h264ToTsStreamer.start();
            executeJavaScript("window.onClassroomJoined(...)");
        }).start();
    return createResponseWithJsonData(true, "正在加入课堂", "{\"mode\":\"formal\",\"isJoining\":true}");
}
```

## 正确实现方案 (✅)
1. 统一结论：`WebAppInterface` 内部完全复用 `ScreenCastingManager`、`ScreenShareKit` 等原生实现，行为与 `MyProfileActivity` 保持一致，仅多一层 Web 事件通知。
2. 游客模式：沿用 `ApplicationModelShared.fakeClassMode`，仅在 Web 层模拟课堂，不触发真实投屏。
3. 正式模式：在 UI 线程初始化 `ScreenShareKit`，推送 H264 → TS → UDP，成功后触发 `window.onClassroomJoined`。

```java
ScreenShareKit.INSTANCE.init(activity)
    .config(1920, 1080, H264MpegTSStreamerManager.ENCODE_FRAME_RATE, 8000000,
            EncodeBuilder.SCREEN_DATA_TYPE.H264, false, 44100, 2)
    .onH264((buffer, isKeyFrame, width, height, ts) -> {
        byte[] bytes = new byte[buffer.remaining()];
        buffer.get(bytes);
        h264ToTsStreamer.onH264DataReceived(bytes, ts);
        if (isKeyFrame) {
            H264IFrameCache.getInstance().onH264Frame(bytes);
        }
    })
    .onStart(() -> {
        ScreenCastingManager.setClassMode(true);
        h264ToTsStreamer.start();
        executeJavaScript("window.onClassroomJoined(...)");
    })
    .onError(errorInfo -> executeJavaScript("window.onClassroomError(...)"))
    .start();
```

## 关键代码/公式
- `WebAppInterface.joinClassroom()`：封装 Web 调用入口。
- `WebAppInterface.exitClassroom()`：与原生一致的退出流程。
- `ScreenCastingManager.setClassMode(boolean)`：课堂状态单一事实源。

## 测试验证
- **测试场景**：
  - 场景1：游客账号通过 Web 入口加入课堂，应只设置 `fakeClassMode`，前端收到 `onClassroomJoined`。
  - 场景2：正式账号加入课堂，应初始化 `ScreenShareKit` 并触发投屏，前端收到状态 JSON。
- **验证方法**：
  - 方法1：抓取日志，确认 Web 与原生均调用 `ScreenCastingManager`。
  - 方法2：在退出课堂后检查 `ScreenShareKit.INSTANCE.stop()` 与 `ScreenCastingManager.setClassMode(false)` 是否触发。

## 预防措施
- 措施1：在 `.specstory/sum` 中沉淀文档，减少重复确认。
- 措施2：对 Web ↔ 原生桥接接口建立对照表。
- 措施3：课堂状态相关变更需同步更新该文档。

## 相关链接/参考
- 相关文档：`app/src/main/java/com/cosinetech/imates/ui/webview/common/WebAppInterface.java`
- 相关Issue：无
- 参考资源：`app/src/main/java/com/cosinetech/imates/ui/activities/MyProfileActivity.java`

## 可复用经验
- 经验1：Web 与原生共用 `ScreenCastingManager` 可保证课堂状态一致。
- 经验2：通过 JS 事件回调立即同步 Web UI 状态。
- 经验3：游客模式与正式模式应在桥接层统一判定，避免多端重复逻辑。
