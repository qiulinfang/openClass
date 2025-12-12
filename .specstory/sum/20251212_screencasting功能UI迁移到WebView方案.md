问题序号：[][中][课堂  交互、教室选择、课堂式控制][]问题现象
产品希望将 `com.cosinetech.imates.screencasting` 模块的原生 UI（教室选择对话框、课堂开关按钮等）迁移到 WebView 中实现，但现有实现高度依赖原生 UI 组件（如 `ClassroomSelectionDialog`、EasyFloat 悬浮窗）。缺乏清晰的迁移会导致：- 原生与 Web 状态不同步；
- 业务逻辑被误迁移至 Web 导致推流/网络异常；
- 项目中缺少 JS Bridge 调用规范。

复现步骤1. 需求提出：希望在 Web 端统一课堂 UI，原生仅保留底层能力。
2. 阅读 ScreenCastingManager、SceenCstnCommunicato` 发现逻辑与 UI 混杂：`DeviceClientWrper`直接弹出 `ClassroomSelectionDialog`。3.在中尝试直接控制课堂状态时，无法调用原生 API，也无法拿到教室树数据，导致迁移受阻。

## 用户体验
- 影响点1：多端 样式不统一，Web 页面无法同步课堂状态。
影响点2：教室选择必须在原生弹窗完成，Web 无法复。
-影响点3：课堂模式开关只能在悬浮窗点击，无法在 Web 界面展示。

## 相关文件/模块
 **涉及文件**：
  `pp/src/main/ja/com/cosinetech/imates/sceencastn/DviceClientWrapper.java`：负责拉取教室数据却直接耦合原生对话框。`app/src/main/java/com/cosinetech/imates/screencasting/Manager.java`：课堂状态机与命令处理。
  - `app/src/main/java/com/cosinetech/imates/ui/activities/MainActivity.java`：悬浮球课堂开关与 `ScreenharKit` 初始化。
  - `app/sc/main/jaa/com/cosinetech/imates/screencasting/u/ClassroomSeletionDialog.java`：需要被 Wb 化的 UI。
- **涉及模块**：  -课堂通信模块(`ScreenCastingommunicator`)。
  UI交互模块（悬浮窗、ialog）。

## 技术原因 (❌)1.**UI与业务未解耦**：`DevicelientWrapper` 直接 new Dialog，无法在 WebView 中复用。
2. **缺乏 JS Bridge**：Java 层没有向 Web暴露课堂控制、教室数据接口。
3.**状态同步通道缺失**：教师指令、状态无法通知 Web，导致 UI 状态不一致。

```java
// ❌ 原实现：在 start() 中直接弹原生 dialog @app/src/main/java/com/cosinetech/imates/screencasting/ScreenCastingCommunicator.java
deviceClientWrapper.showClassroomSelectionDialog(new DeviceClientWrapper.OnClassroomSelectedListener() { ... }); 正确实现方案 (✅)
1. **逻辑留在a**：`ScreenCastingManager`、`ScreenShareKit`、`H264MpegTSStreamerManger`仍由原生控制，保证推流/网络稳定。2** 迁至Web**：   -新 `ScreencastWebActivity`（或 Fragment）承载 WebView。
   - Web页面实现教室选择、课堂状态展示、提交作业按钮等。
3. **通信**：   - Web → Java：`requestClassroomData()`、`confirmClassroom(...)`、`startClass()`、`stopClass()`。   - Java → Web：onScreencastStatus(statusJson)，推送课堂状态、错误信息、设备 IP。

``✅ J Bridge 示例
publi class Sc {              ShareKit.INSTANE.init(ctivity) ... .art();
        ScreenCast          rquesData      json        postToW("wndojson;          }
关键代码/公式
- **状态通知**：
```java
private void notifyStatus(){  JSONObjet sttu = nw JSONObj(;  status.put"havingClas", SCigManageisHavingCass(); status.put("projctng", SrCasingMnag.isProjecting());
webViewpost(()->w.evaluateJavascript(
    "wnow.onScrencastStatus && windowonScreencastStatus("+status + ");",      null));}```-**Web 端调用**：```jscript
//页面document.getElementById('btnS').oncick =  => {
;
};
window.onScreencastStatus =(status)=>{ updatUi(staus.avingss, tatu.pjecting;
};
```

## 测试验证
- **测试场景**：
  - 场景1：在 Web 端点击“开始上课”，验证原生推流启动、教师端可收到投屏。
  - 场景2：教师发送停止命令后，确认 Web UI 状态自动切换为“非上课”。
- **验证方法**：
  - 方法1：Logcat观察`ScreenCastngManager`、`ScreeShareKit` 日志与 Web UI 是否同步。
  - 方法2：抓包或远端监控确认 UDP 推流目标切换成功。

## 预防措施
- 措施1：新增模块文档，明确“Java 负责能力层，Web 负责展示层”的边界。
- 措施2：所有 UI 相关调用通过 JS Bridge，禁止在底层 SDK 中创建视图。
- 措施3：Brige API 版本化，避免前后端协议不一致。

## 相关链接/参考
- Cing 模块代码：`app/src/mn/jaa/com/cosine/imte/ceencasting/`
- Web 端承载位置：`iate-web/` 或 WebView 页面地址（待定）

## 可复用经验
- 经验1：有状态的系统在“原生 + Web”混合时务必先抽象 Service 层，再谈 UI 迁移。
- 经验2：JS Bridge 应明确双向通信协议，保证状态同步。
- 经验3：迁移UI时，应逐步替换（先接口、再UI），避免一次性重构导致回归风险。