问题1：移动端temporaryImg图片HTTPS证书域名不匹配导致加载失败问题

## 问题元信息
- **问题分类**：`兼容性`
- **严重程度**：`高`
- **影响范围**：`移动端(WebView/手机浏览器)题目图片(temporaryImg)显示；题目截图/转图片流程`
- **发现日期**：`2025-12-18`
- **解决状态**：`已解决`

## 问题现象
- 同一张图片：
  - PC Web 可正常加载
  - 移动端加载失败
- 典型链接：
  - `https://imates.com.cn/temporaryImg/20251217/dc1e7b3425e34a329e09320fcc790d29.png`
- 证书校验失败特征（不同端表现不同）：
  - 移动端可能直接显示图片加载失败
  - DevTools/抓包可能出现：`ERR_CERT_COMMON_NAME_INVALID` / `SSL handshake failed`

## 复现步骤
1. 在移动端页面渲染包含 `https://imates.com.cn/temporaryImg/...` 的 `<img>`
2. 观察图片加载
3. 结果：移动端加载失败；PC Web 可能可加载（可能存在用户手动绕过证书提示/缓存例外等差异）

## 用户体验
- 图片不展示，题目内容不完整
- 依赖图片的题目截图/白板背景图生成可能失败或变空白
- 同链接在 PC/移动端表现不一致，增加排查成本

## 相关文件/模块
- **涉及文件**：
  - `imates-web/src/views/HomeworkAnswerView.vue`：题目 HTML 渲染后对图片 URL 做重写、截图生成
- **涉及模块**：
  - 题目渲染与截图（`html-to-image`）
  - 图片资源域名与证书配置

## 技术原因 (❌)
1. 资源域名使用了裸域名 `imates.com.cn`，但服务器 HTTPS 证书只覆盖 `*.imates.com.cn`（通配符子域），不覆盖裸域名
2. 移动端 WebView/网络栈对 TLS 校验更严格，证书域名不匹配时直接拦截，无法像部分桌面浏览器一样让用户“继续访问”
3. 业务侧使用了 `https://imates.com.cn/temporaryImg/...` 这种“看似安全但实际证书不合法”的地址，导致端上表现分裂

错误示例：
```text
https://imates.com.cn/temporaryImg/...
```

## 正确实现方案 (✅)
1. **优先使用证书覆盖的子域名**（推荐）：
   - 将 `https://imates.com.cn/temporaryImg/...` 统一替换为 `https://www.imates.com.cn/temporaryImg/...`
2. 长期根治（服务端）：
   - 证书同时覆盖 `imates.com.cn` 与 `*.imates.com.cn`
3. 开发环境兜底：
   - 可通过 Vite proxy 将 `/temporaryImg/...` 代理到资源服务器/老域名，避免前端直连带来的 CORS/TLS 问题（仅限开发调试）

正确示例：
```text
https://www.imates.com.cn/temporaryImg/...
```

## 关键代码/公式
- 关键思路：
  - 在 DEV 环境下仍可改写为 `/temporaryImg/...` 走代理
  - 对于 `https://imates.com.cn/temporaryImg/` 先规范化为 `https://www.imates.com.cn/temporaryImg/`，再按需改写

代码片段（节选，✅ 方案A落地）：
```ts
const httpsPrefix = 'https://imates.com.cn/temporaryImg/'

if (newSrc.startsWith(httpsPrefix)) {
  newSrc = 'https://www.imates.com.cn/temporaryImg/' + newSrc.substring(httpsPrefix.length)
}
```

## 测试验证
- **测试场景**：
  - 场景1：移动端打开包含 `temporaryImg` 图片的题目/作业作答页
    - 预期：图片正常显示，不再出现证书错误
  - 场景2：本地 DEV 环境
    - 预期：图片可被改写为 `/temporaryImg/...` 并成功通过 Vite 代理加载
- **验证方法**：
  - 方法1：移动端远程调试/抓包检查图片请求域名是否为 `www.imates.com.cn`
  - 方法2：观察 Network 中图片请求不再出现 `ERR_CERT_*`

## 预防措施
- 统一资源域名规范：禁止在代码/接口中返回裸域名 HTTPS（若证书不覆盖）
- 在接口层输出资源链接时做统一域名映射/规范化
- 增加移动端 WebView 的网络错误埋点（区分 DNS/TLS/HTTP）

## 相关链接/参考
- 相关文件：`imates-web/src/views/HomeworkAnswerView.vue`

## 可复用经验
- HTTPS 证书通配符 `*.example.com` **不覆盖** 裸域名 `example.com`
- PC 浏览器“能打开”不等于移动端/应用内 WebView 一定能打开
- 资源域名应在服务端统一收敛，避免前端在多处做兼容
