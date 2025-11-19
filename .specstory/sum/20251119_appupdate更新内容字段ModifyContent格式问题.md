问题序号：appupdate 更新内容字段 ModifyContent 格式问题

## 问题元信息
- **问题分类**：`前端`
- **严重程度**：`低`
- **影响范围**：`一键构建部署脚本生成的 appupdate.json 及更新说明展示`
- **发现日期**：`2025-11-19`
- **解决状态**：`已解决`

## 问题现象
构建 Android 生产版本后，脚本生成的 `appupdate.json` 中 `ModifyContent` 字段格式不明确，仅为一行简短字符串，缺乏结构和多行更新说明，不利于后续维护和阅读更新日志。

## 复现步骤
1. 在项目根目录执行一键构建并生成 APK（示例）：
   - `node imates-web/scripts/one-click-deploy.cjs exercise release deploy:build`
2. 构建完成后，在 `app/build/outputs/apk/production/release/` 目录查看生成的 `appupdate.json`。
3. 观察文件中的 `ModifyContent` 字段，仅为一行简单字符串，更新内容不够清晰。

## 用户体验
- 更新说明缺乏结构化描述，阅读成本较高。
- 无法快速分辨本次版本修复了哪些问题、增加了哪些功能。
- 后续版本迭代时，更新日志难以统一规范。

## 相关文件/模块
- **涉及文件**：
  - `imates-web/scripts/one-click-deploy.cjs`：负责生成 `appupdate.json` 的脚本，内含 `generateUpdateJson` 方法和 `modifyContent` 变量。
  - `app/build/outputs/apk/production/release/appupdate.json`：构建完成后生成的更新信息文件。
- **涉及模块**：
  - 一键构建与部署脚本模块：负责打包、生成版本信息和更新描述。

## 技术原因 (❌)
1. `ModifyContent` 仅被实现为一个简单字符串变量：
   - 默认值：`"问题修复 截图问答聊天记录增加略缩图"`。
2. 没有统一定义更新说明的格式规范（如多行、项目符号、分类等），导致后续维护者不知道应如何编写。
3. 没有在脚本层面提供多行或结构化内容的示例，使得 `ModifyContent` 的使用方式不够直观。

❌ 当前相关代码示例（节选）：
```javascript
// imates-web/scripts/one-click-deploy.cjs

// ... 省略前置代码

// 第3步：确定 appupdate.json 的路径（和 info.json 在同一目录）
const apkOutputDir = path.dirname(infoJsonPath)
const appupdateJsonPath = path.join(apkOutputDir, 'appupdate.json')

// 优先从 build.gradle 读取版本号
const buildGradleVersion = readBuildGradleVersion(androidProjectPath)
let currentVersionCode = buildGradleVersion ? buildGradleVersion.versionCode : 11
let currentVersionName = buildGradleVersion ? buildGradleVersion.versionName : '1.0.11'
let modifyContent = '问题修复 截图问答聊天记录增加略缩图'

// 如果存在旧的 appupdate.json（在同一目录或项目根目录），读取 ModifyContent
const oldAppupdateJsonPath = path.join(androidProjectPath, 'appupdate.json')
if (fs.existsSync(appupdateJsonPath)) {
  try {
    const appupdateContent = fs.readFileSync(appupdateJsonPath, 'utf-8')
    const appupdateJson = JSON.parse(appupdateContent)
    modifyContent = appupdateJson.ModifyContent || modifyContent
    logInfo(`从同目录读取现有更新内容: ${modifyContent}`)
  } catch (error) {
    logWarning(`读取 appupdate.json 失败: ${error.message}`)
  }
}

// ... 省略中间逻辑

const newAppupdateJson = {
  Code: 0,
  Msg: '',
  UpdateStatus: 1,
  VersionCode: newVersionCode,
  VersionName: newVersionName,
  ModifyContent: modifyContent,
  DownloadUrl: downloadUrl,
  ApkSize: '',
  ApkMd5: apkMd5
}
```

## 正确实现方案 (✅)
1. 明确 `ModifyContent` 的定位：作为**更新说明字符串**，建议支持多行和分条描述，而非单一短句。
2. 在脚本中为 `modifyContent` 提供一个结构化、多行的默认示例，便于后续维护者照葫芦画瓢填写。
3. 保持 `appupdate.json` 向后兼容：仍使用字符串字段 `ModifyContent`，但字符串内容内部可以使用换行符和序号。

✅ 推荐实现示例：
```javascript
// 使用多行更新说明示例
typeof modifyContent === 'string'

let modifyContent = [
  '1. 修复截图问答聊天记录缩略图显示问题',
  '2. 优化截图搜题结果加载性能',
  '3. 改进部分界面文案与交互提示'
].join('\n')

// 后续仍保持读取旧 appupdate.json 的逻辑
if (fs.existsSync(appupdateJsonPath)) {
  try {
    const appupdateContent = fs.readFileSync(appupdateJsonPath, 'utf-8')
    const appupdateJson = JSON.parse(appupdateContent)
    modifyContent = appupdateJson.ModifyContent || modifyContent
  } catch (error) {
    logWarning(`读取 appupdate.json 失败: ${error.message}`)
  }
}

const newAppupdateJson = {
  Code: 0,
  Msg: '',
  UpdateStatus: 1,
  VersionCode: newVersionCode,
  VersionName: newVersionName,
  ModifyContent: modifyContent,
  DownloadUrl: downloadUrl,
  ApkSize: '',
  ApkMd5: apkMd5
}
```

## 关键代码/公式
- **关键点1：默认多行更新说明写法**
```javascript
let modifyContent = [
  '1. 修复已知崩溃问题',
  '2. 优化截图问答体验',
  '3. 提升整体性能和稳定性'
].join('\n')
```

- **关键点2：从旧文件继承更新说明**
```javascript
if (fs.existsSync(appupdateJsonPath)) {
  const appupdateContent = fs.readFileSync(appupdateJsonPath, 'utf-8')
  const appupdateJson = JSON.parse(appupdateContent)
  modifyContent = appupdateJson.ModifyContent || modifyContent
}
```

## 测试验证
- **测试场景**：
  - 场景1：首次构建，没有历史 `appupdate.json` 文件。
    - 步骤：运行一键构建脚本。
    - 预期结果：生成的 `appupdate.json` 中 `ModifyContent` 为脚本中定义的多行默认内容。
  - 场景2：已有旧版本 `appupdate.json`。
    - 步骤：保留旧 `appupdate.json`，重新构建。
    - 预期结果：新文件中的 `ModifyContent` 继承旧值，或在未配置时使用默认内容。

- **验证方法**：
  - 方法1：直接打开生成的 `appupdate.json`，检查 `ModifyContent` 是否为预期的多行文本。
  - 方法2：在客户端/更新模块中展示 `ModifyContent`，确认换行和内容格式显示正常。

## 预防措施
- 措施1：在脚本内部通过注释明确 `ModifyContent` 的用途和推荐格式（多行、序号）。
- 措施2：建立版本发布前的检查清单，确认 `appupdate.json` 中的 `ModifyContent` 已按规范填写。
- 措施3：后续如需结构化更新说明（如按功能模块分类），可考虑新增字段，而不是随意修改 `ModifyContent` 类型。

## 相关链接/参考
- 相关文档：`imates-web/scripts/one-click-deploy.cjs` 内部实现。
- 参考资源：常见移动应用“更新日志/更新说明”格式（各大应用商店实践）。

## 可复用经验
- 经验1：版本更新说明字段应保持**简单类型（字符串）**，但可以通过多行和编号提升可读性。
- 经验2：生成类脚本（如构建/部署工具）应预置规范示例，降低使用和维护成本。
- 经验3：对外约定的数据结构（如 `appupdate.json`）尽量保持向后兼容，如需结构升级优先新增字段而不是改变字段类型。
