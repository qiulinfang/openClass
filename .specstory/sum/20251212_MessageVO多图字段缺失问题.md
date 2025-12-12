问题序号：MessageVO多图字段缺失问题

## 问题元信息
- **问题分类**：`[后端]`
- **严重程度**：`[中]`
- **影响范围**：`[图片问答多图上传、AI问答接口]`
- **发现日期**：`2025-12-12`
- **解决状态**：`[待解决]`

## 问题现象
前端向 `/permission/previewPictureQA` 发送包含 `imageList` 的多图请求时，后端收到的 `MessageVO` 只含单个 `question`（base64），日志中 `imageList` 始终为空，多图数据无法被写入 AI 请求，导致只能处理单图。

## 复现步骤
1. 前端构造含 `imageList`（多张 base64）的请求并调用 `/permission/previewPictureQA`。
2. 后端 `MessageVO` 反序列化时缺少 `imageList` 字段，导致对应数据被忽略。
3. `PreviewPictureQAImpl` 仅对 `question` 调用 `imgBase64`，最终构造的 `ChatReq` 只携带单一 `url`。

## 用户体验
- 无法一次提交多张图片，需要多次上传。
- 前端看到已传多图，但回答结果只基于第一张，体验错位。
- 日志中 `imageList` 为空，排查困难。

## 相关文件/模块
- **涉及文件**：
  - `d:\Project\学伴-后端\imates-service\service\service-alc\src\main\java\com\blw\edu\service\alc\enums\MessageVO.java`：缺少 `imageList` 字段。
  - `d:\Project\学伴-后端\imates-service\service\service-alc\src\main\java\com\blw\edu\service\alc\service\impl\AlcPermissionServiceImpl.java`：`PreviewPictureQAImpl` 只调用 `req.getInputs().setUrl(...)`。
- **涉及模块**：
  - `权限服务-图片问答接口`：负责解析前端入参。
  - `AI请求封装模块`：构造 `ChatReq` 并发往大模型。

## 技术原因 (❌)
1. `MessageVO` VO 未定义 `List<String> imageList` 或对应对象，Jackson 反序列化自动丢弃该节点。
2. `PreviewPictureQAImpl` 仅从 `question` 读取单张 base64，未遍历多图集合。
3. `ChatReq.Inputs` 虽支持 `List<String> image_url`，但未被赋值。

```java
// ❌ 缺少 imageList 字段
public class MessageVO {
    private String question;
    private String url;
    // ...
}
```

## 正确实现方案 (✅)
1. 给 `MessageVO` 新增 `List<ImageItem> imageList`（或 `List<String>`），与前端字段对齐。
2. 在 `PreviewPictureQAImpl` 中循环 `imageList`，逐个调用 `imgBase64` 生成 URL。
3. 使用 `req.getInputs().setImage_url(urlList)` 将多张图片传给 AI，同时保留单图兼容。

```java
// ✅ VO 定义多图字段
public class MessageVO {
    private List<String> imageList;
    // getter/setter
}

// ✅ 服务侧构造 image_url
List<String> urls = vo.getImageList().stream()
    .map(OptionImgUtil::imgBase64)
    .map(res -> res.split(",")[0])
    .collect(Collectors.toList());
req.getInputs().setImage_url(urls);
```

## 关键代码/公式
- `MessageVO` 新增字段示例
```java
@Data
public class MessageVO {
    private List<String> imageList; // base64 dataURL 集合
}
```
- `PreviewPictureQAImpl` 多图处理示例
```java
List<String> urls = new ArrayList<>();
for (String base64 : vo.getImageList()) {
    String result = imgBase64(base64);
    urls.add(result.split(",")[0]);
}
req.getInputs().setImage_url(urls);
```

## 测试验证
- **测试场景**：
  - 场景1：前端上传单张图片，确保兼容旧逻辑。
  - 场景2：上传多张图片，检查 AI 请求 `image_url` 包含全部 URL。
- **验证方法**：
  - 方法1：抓取后端日志，确认 `MessageVO.imageList` 与 `ChatReq.inputs.image_url`。
  - 方法2：调用 AI 接口验证生成结果能引用所有图片。

## 预防措施
- 在 VO 中为新增字段编写单元测试，校验 JSON 反序列化。
- API 变更同步更新前后端契约文档。
- 对关键入参增加日志与参数校验，及时发现缺失字段。

## 相关链接/参考
- `d:\Project\学伴-后端\imates-service\service\service-alc\src\main\java\com\blw\edu\service\alc\api\ai\pojo\req\ChatReq.java`

## 可复用经验
- 多端协同时，VO 字段需与前端契约同步维护。
- 保留单图兼容路径可降低上线风险。
- 在日志中打印入参与关键字段有助于快速定位序列化问题。
