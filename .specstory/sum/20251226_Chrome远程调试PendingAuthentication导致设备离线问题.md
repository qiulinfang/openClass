问题3：Chrome远程调试PendingAuthentication导致设备离线问题

## 问题元信息
- **问题分类**：`兼容性`
- **严重程度**：`中`
- **影响范围**：`移动端(WebView)远程调试能力；无法抓取 Network/Console 日志，阻碍代理/接口问题排查`
- **发现日期**：`2025-12-18`
- **解决状态**：`待解决`

## 问题现象
- 在 PC Chrome 打开 `chrome://inspect/#devices` 时：
  - 设备显示 `Offline`
  - 并提示：`Pending authentication: please accept debugging session on the device.`
  - 同时可能提示：`Device information is stale.`
- 结果：无法打开 WebView 的 Inspect 窗口，无法查看移动端网络请求与控制台日志。

## 复现步骤
1. Android 设备连接电脑（USB）
2. PC Chrome 进入 `chrome://inspect/#devices`
3. 勾选 `Discover USB devices`
4. 观察设备状态
5. 结果：设备显示 Offline，并出现 Pending authentication 提示

## 用户体验
- 无法远程调试移动端页面
- 无法定位移动端特有问题（如 TLS 证书、代理、CORS、资源加载失败）
- 排查成本大幅提升，需要改为抓包/日志埋点等替代手段

## 相关文件/模块
- **涉及文件**：
  - 无（主要为开发环境/设备设置问题）
- **涉及模块**：
  - Chrome DevTools Remote Debugging
  - Android USB Debugging / ADB
  - WebView 调试开关（应用侧可能需要开启）

## 技术原因 (❌)
1. 设备端未授权本次调试会话：
   - 设备上未点击“允许 USB 调试/允许远程调试”弹窗，导致 ADB 处于 `unauthorized` 或调试会话未建立
2. USB/ADB 连接不稳定或权限模式不正确：
   - 数据线/USB 口不稳定
   - 设备处于“仅充电”模式，未切换到 MTP/文件传输（部分机型会影响）
3. 开发者选项未开启关键开关：
   - 未开启 USB 调试
   - MIUI/鸿蒙等可能需要额外开启安全相关调试开关

错误提示示例：
```text
Offline
Pending authentication: please accept debugging session on the device.
Device information is stale.
```

## 正确实现方案 (✅)
1. 设备端接受授权：
   - 出现“允许 USB 调试吗？”时勾选“始终允许此计算机”并允许
   - 出现“允许调试此 WebView/远程调试”时点击允许
2. 确认 ADB 状态：
   - 运行 `adb devices`
   - 期望设备状态为 `device`（不是 `unauthorized`）
3. 重置连接（常用兜底）：
   - 重新插拔 USB
   - 更换数据线/USB 口
   - 重启 adb server（如 `adb kill-server` / `adb start-server`）
4. 确认应用侧 WebView 允许调试（如使用自定义 WebView 内核/关闭调试）：
   - 确认应用未禁用 WebView 调试功能

## 关键代码/公式
- 无（非业务代码问题）

## 测试验证
- **测试场景**：
  - 场景1：连接设备后打开 `chrome://inspect/#devices`
    - 预期：设备在线，且可看到 WebView 页面条目并点击 Inspect
  - 场景2：执行 `adb devices`
    - 预期：显示 `device` 状态
- **验证方法**：
  - 方法1：Inspect 后在 DevTools Network 能看到移动端请求（如图片/TLS/接口）
  - 方法2：Console 可看到页面日志输出

## 预防措施
- 团队内沉淀一份“移动端远程调试检查清单”（USB 调试、授权弹窗、adb 状态、MTP 模式）
- 对移动端关键网络错误增加可视化提示/埋点，降低对远程调试的单点依赖

## 相关链接/参考
- Chrome 远程调试入口：`chrome://inspect/#devices`

## 可复用经验
- 出现 `Pending authentication` 时，优先检查设备上是否有“允许调试”弹窗
- `adb devices` 的状态是判断问题归因（线/权限/授权）的最快手段
