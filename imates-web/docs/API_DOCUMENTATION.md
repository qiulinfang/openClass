# imates-web API 接口文档

本文档汇总了 `imates-web` 项目中使用的所有主要 API 接口，按功能模块进行分类。

## 基础配置

- **正式环境域名**:
  - 学伴服务: `http://www.imates.com.cn:8222/blw-edu-service-alc`
  - 研伴服务: `https://www.imates.com.cn:9099`
  - IM 客户端: `https://www.imates.com.cn:8200`
  - 教师服务 API: `http://www.imates.com.cn:8201`
  - AI 聊天管理: `https://u389082-a353-35fba22b.westb.seetacloud.com:8443`
  - 高考 AI (LLM): `http://49.232.39.212:9011`
  - 手写识别: `http://49.232.39.212:9012`
  - 题目结构化: `http://49.232.39.212:8055`

---

## 1. AI 聊天接口 (`AiChatApi`)

处理与 AI 助手的对话交互。

| 接口名称 | 方法 | 路径 | 功能描述 |
| :--- | :--- | :--- | :--- |
| 发送聊天消息 | POST | (动态由 `dstUrl` 指定) | 发送消息至 AI，支持轮询机制和 SSE 打字机效果。 |
| 管理对话记忆 | POST | `/history_manage` | 删除部分消息或删除整个线程。 |
| 图片/截图问答 | POST | `/xb-release/ai/2.0/previewPictureQA` | 基于教材截图的 AI 问答。 |
| 数学 AI 聊天 | POST | `/xb-release/ai/2.0/chatMath` | 针对数学问题的 AI 对话。 |

---

## 2. 教师/互动接口 (`TeacherChatApi`)

处理学生与老师之间的互动。

| 接口名称 | 方法 | 路径 | 功能描述 |
| :--- | :--- | :--- | :--- |
| 获取聊天历史 | POST | `/api/question/historyList` | 分页获取与老师的对话历史消息。 |
| 上传图片 | POST | `/api/system/uploadImg` | 上传图片到教师端，返回相对路径。 |

---

## 3. 搜题与练习接口 (`QuestionSearchApi`)

处理题目搜索、练习列表管理及相似题推荐。

| 接口名称 | 方法 | 路径 | 功能描述 |
| :--- | :--- | :--- | :--- |
| 获取习题列表 | GET | `/xb-release/permission/exercises` | 根据科目获取习题集。 |
| 删除习题 | DELETE | `/xb-release/permission/deleteExercises/{id}/{subject}` | 删除指定的习题。 |
| 添加题目到列表 | POST | `/xb-release/permission/exercises` | 将特定题目加入习题集。 |
| 图片识别搜题 | POST | `/xb-release/permission/img(Math)` | 通过图片识别获取匹配题目。 |
| 文本搜题 | GET | `/xb-release/permission/textSearch(Math)/{text}` | 通过文本搜索获取匹配题目。 |
| 查找相似题目 | POST | `/xb-release/permission/topicAndAck` | 根据题目内容查找相似题。 |
| 知识点查题目 | POST | `/xb-release/biologyTopicKnowledge/knowledgeTopicAndAck` | 根据知识点 ID 查找相关题目。 |
| 批量题目查相似 | POST | `/xb-release/biologyTopicKnowledge/knowledgeTopicAndAck2` | 根据多个题目 ID 查找相似题。 |
| 查询知识点 ID | POST | `/knowledge` | 根据章节节点查询对应的知识点 ID 字符串。 |

---

## 4. 教材与资源下载接口 (`TextbookDownloadApi`)

管理教材版本、结构获取及资源包下载。

| 接口名称 | 方法 | 路径 | 功能描述 |
| :--- | :--- | :--- | :--- |
| 获取教材版本列表 | POST | `/api/app/teacher-textbook` | 获取用户可用的在线教材版本。 |
| 获取教材目录结构 | POST | `/api/app/teacher-textbook-section-tree` | 获取教材的章节目录树。 |
| 获取学习资源包 | POST | `/api/app/teacher-textbook-learning-package` | 获取章节下的资源包清单（含文件 URL）。 |
| 提交题包答案 | POST | `/api/app/topic-package-answer` | 提交教材内配套习题的答案。 |
| 题包分页列表 | POST | `/api/app/topic-package-page` | 获取公开或特定的题包列表。 |
| 下载资源文件 | GET | (动态 resource URL) | 支持流式下载并校验文件完整性。 |

---

## 5. 作业管理与高考助手 (`HomeworkApi`)

处理作业流程、高考题型识别及手写公式识别。

| 接口名称 | 方法 | 路径 | 功能描述 |
| :--- | :--- | :--- | :--- |
| 获取未完成作业 | POST | `/api/app/homework-undo-list` | 获取当前用户的待完成作业列表。 |
| 获取作业详情 | POST | `/api/app/homework-detail-list` | 根据作业 ID 获取题目详情。 |
| 提交作业答案 | POST | `/api/app/homework-submit-save` | 提交作业答题结果。 |
| 高考题型识别 | POST | `/v1/question/type` | 自动识别题目类型（单选/多选/填空等）。 |
| 选择题拆分 | POST | `/v1/question/choice/parse` | 将选择题内容拆分为题干和选项。 |
| 手写公式识别 | POST | `/api/recognize-handwritten-formula-image/json` | 将手写公式图片识别为 LaTeX 等格式。 |

---

## 6. 题目结构化服务 (`QuestionStructurerApi`)

用于对题目内容进行标准化的结构化处理。

| 接口名称 | 方法 | 路径 | 功能描述 |
| :--- | :--- | :--- | :--- |
| 单题结构化 | POST | `/structure_question` | 将普通文本题目结构化。 |
| 批量结构化 | POST | `/structure_question_batch` | 批量处理题目结构化。 |
| 健康检查 | GET | `/health` | 检查结构化服务运行状态。 |
| 服务信息 | GET | `/service_info` | 获取服务配置信息。 |

---

## 7. 其他基础服务

| 接口名称 | 方法 | 路径 | 功能描述 |
| :--- | :--- | :--- | :--- |
| 系统图片上传 | POST | `/api/images/upload` | 通用的图片上传接口（多用于 IM）。 |
| HTML 抓取 | GET | `/requests/fetch?url={url}` | 后端代理抓取网页内容。 |
| 应用更新 | GET | `/bj101/appupdate.json` | 检查前端 App 的更新配置。 |
