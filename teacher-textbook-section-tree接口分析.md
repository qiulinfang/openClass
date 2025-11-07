# teacher-textbook-section-tree 接口分析

## 1. 接口基本信息

### 1.1 接口路径
- **完整路径**: `/blw-edu-yb/api/app/teacher-textbook-section-tree`
- **Base URL**: `https://www.imates.com.cn:9099`
- **完整URL**: `https://www.imates.com.cn:9099/blw-edu-yb/api/app/teacher-textbook-section-tree`

### 1.2 请求方法
- **方法**: `POST`
- **Content-Type**: `application/json`

### 1.3 认证方式
- 需要在请求头中添加 `sa-token` 字段
- Token值来自登录接口返回的token

## 2. 请求参数

### 2.1 请求体结构
```json
{
  "id": "309599971637723136"  // 教材的textbookId（注意：不是教材版本ID）
}
```

### 2.2 参数说明
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | string | 是 | 教材的textbookId，从教材版本列表接口获取 |

### 2.3 请求示例

**Android端实现**:
```198:212:app/src/main/java/com/cosinetech/imates/textbookservice/LearnResourceManager.java
    public void getTextbookStructure(String textbookId, TextbookStructureCallback callback) {
        if (!isLoggedIn()) {
            callback.onError("Not logged in");
            return;
        }
        
        TextbookStructureRequest request = new TextbookStructureRequest(textbookId);
        String json = gson.toJson(request);
        
        RequestBody body = RequestBody.create(json, MediaType.get("application/json"));
        Request httpRequest = new Request.Builder()
                .url(BASE_URL + "/blw-edu-yb/api/app/teacher-textbook-section-tree")
                .post(body)
                .addHeader("sa-token", currentToken)
                .build();
```

**Web端实现**:
```1483:1503:imates-web/src/services/api-service.ts
  public async getTextbookStructure(id: string): Promise<ChapterNode[]> {
    try {
      const endpoint = API_ENDPOINTS.LEARNING_RESOURCE.TEXTBOOK.STRUCTURE
      
      const request: TextbookStructureRequest = { id : id }
      const response = await httpClient.post<{
        code: number
        success: boolean
        message: string
        data: ChapterNode[]
      }>(endpoint, request)
      
      if (response.success && response.data && response.data.data && response.data.data.length > 0 && response.data.data[0]?.children && response.data.data[0].children.length > 0) {
        return response.data.data[0].children
      }
      
      return []
    } catch (error) {
      throw error
    }
  }
```

## 3. 响应数据结构

### 3.1 响应格式
```json
{
  "code": 200,
  "success": true,
  "message": "成功",
  "data": [
    {
      "id": "309599971637723136",
      "name": "人教版",
      "parentId": null,
      "label": "人教版",
      "level": null,
      "isRoot": true,
      "children": [
        {
          "id": "1628285388617848832",
          "name": "第一章 集合与常用逻辑用语",
          "parentId": "309599971637723136",
          "label": "第一章 集合与常用逻辑用语",
          "level": 0,
          "isRoot": true,
          "children": [
            {
              "id": "1628285388617848833",
              "name": "1.1 集合的概念",
              "parentId": "1628285388617848832",
              "label": "1.1 集合的概念",
              "level": 1,
              "isRoot": false
            }
          ]
        }
      ]
    }
  ]
}
```

### 3.2 数据结构说明

#### ChapterNode 节点结构
| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | string | 章节唯一标识 |
| name | string | 章节名称 |
| parentId | string \| null | 父章节ID，根节点为null |
| label | string | 章节标签（通常与name相同） |
| level | number \| null | 章节层级：null=教材根节点，0=章，1=节 |
| isRoot | boolean | 是否为根节点 |
| children | ChapterNode[] | 子章节列表（可选） |

### 3.3 层级关系
- **level = null**: 教材根节点（如"人教版"）
- **level = 0**: 章（如"第一章 集合与常用逻辑用语"）
- **level = 1**: 节（如"1.1 集合的概念"）

### 3.4 树结构说明
- 返回的是教材的章节树结构
- 通过 `parentId` 标识父子关系
- 树结构是嵌套的，通过 `children` 数组表示子节点

## 4. 代码实现分析

### 4.1 Android端实现

#### 4.1.1 请求类定义
```java
public class TextbookStructureRequest {
    public String id;
    
    public TextbookStructureRequest(String id) {
        this.id = id;
    }
}
```

#### 4.1.2 响应数据类定义
```java
public class ChapterNode {
    public String id;
    public String name;
    public String parentId;
    public String label;
    public Integer level;
    public String knowledgeList;
    public boolean isRoot;
    public List<ChapterNode> children;
}
```

#### 4.1.3 回调接口
```192:196:app/src/main/java/com/cosinetech/imates/textbookservice/LearnResourceManager.java
    public interface TextbookStructureCallback {
        void onSuccess(List<ChapterNode> structure);
        void onError(String error);
        void onUnauthorized();
    }
```

#### 4.1.4 完整调用流程
```198:243:app/src/main/java/com/cosinetech/imates/textbookservice/LearnResourceManager.java
    public void getTextbookStructure(String textbookId, TextbookStructureCallback callback) {
        if (!isLoggedIn()) {
            callback.onError("Not logged in");
            return;
        }
        
        TextbookStructureRequest request = new TextbookStructureRequest(textbookId);
        String json = gson.toJson(request);
        
        RequestBody body = RequestBody.create(json, MediaType.get("application/json"));
        Request httpRequest = new Request.Builder()
                .url(BASE_URL + "/blw-edu-yb/api/app/teacher-textbook-section-tree")
                .post(body)
                .addHeader("sa-token", currentToken)
                .build();

        UnsafeOkHttpClient.getUnsafeOkHttpClient().newCall(httpRequest).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                mainHandler.post(() -> callback.onError("Network error: " + e.getMessage()));
            }
            
            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {
                if (response.code() == 401) {
                    currentToken = "";
                    mainHandler.post(callback::onUnauthorized);
                    return;
                }
                
                try {
                    String responseBody = response.body().string();
                    ApiResponse<List<ChapterNode>> apiResponse = gson.fromJson(responseBody,
                            new TypeToken<ApiResponse<List<ChapterNode>>>(){}.getType());
                    
                    if (apiResponse.success && apiResponse.data != null) {
                        mainHandler.post(() -> callback.onSuccess(apiResponse.data));
                    } else {
                        mainHandler.post(() -> callback.onError(apiResponse.message));
                    }
                } catch (Exception e) {
                    mainHandler.post(() -> callback.onError("Parse error: " + e.getMessage()));
                }
            }
        });
    }
```

**特点**:
- 使用异步回调机制
- 处理401未授权情况，清空token
- 在主线程中执行回调
- 完整的错误处理机制

### 4.2 Web端实现

#### 4.2.1 TypeScript类型定义
```43:66:imates-web/src/types/textbook.ts
export interface TextbookStructureRequest {
  id: string // 教材版本ID
}

/**
 * 学习资源请求
 */
export interface LearningResourcesRequest {
  id: string // 教材版本ID
}

/**
 * 章节节点
 */
export interface ChapterNode {
  id: string // 章节唯一标识
  name: string // 章节名称
  parentId?: string | null // 父章节ID
  label: string // 章节标签
  level: number | null // 章节层级
  isRoot: boolean // 是否为根节点
  updateTime: string // 更新时间
  children?: ChapterNode[] // 子章节列表
}
```

#### 4.2.2 API端点配置
```94:94:imates-web/src/services/api-endpoints.ts
      STRUCTURE: '/blw-edu-yb/api/app/teacher-textbook-section-tree', // 获取教材结构
```

#### 4.2.3 实际使用场景（KnowledgeGraphView）
```2221:2264:imates-web/src/views/KnowledgeGraphView.vue
const loadChapterStructure = async (textbookId: string) => {
  try {
    // 先尝试从缓存加载章节结构
    const cacheKey = `${CACHE_KEYS.CHAPTER_STRUCTURE}${textbookId}`
    
    const cachedChapterData = getCachedData(cacheKey)
    
    if (cachedChapterData) {
      // 直接使用后台返回的顺序，不进行排序
      chapterStructure.value = cachedChapterData
      
      // 提取章节名称列表（所有level=0的章节），并转换为中文数字
      chapters.value = cachedChapterData.map((chapter: { name: string }) => convertToChineseNumber(chapter.name))
      
      // 初始化所有章节的状态
      initializeChapterStates(textbookId, cachedChapterData, getSubChapters)
      return
    }

    // 缓存中没有数据，从API获取
    const chapterData = await apiService.getTextbookStructure(textbookId)
    
    if (chapterData && chapterData.length > 0) {
      // 直接使用后台返回的顺序，不进行排序
      chapterStructure.value = chapterData
      
      // 缓存章节结构数据
      setCachedData(cacheKey, chapterData)
      
      // 提取章节名称列表（所有level=0的章节），并转换为中文数字
      chapters.value = chapterData.map(chapter => convertToChineseNumber(chapter.name))
      
      // 初始化所有章节的状态
      initializeChapterStates(textbookId, chapterData, getSubChapters)
    } else {
      chapterStructure.value = []
      chapters.value = []
    }
  } catch (error) {
    console.error('[流程] ❌ 加载章节结构出错:', error)
    chapterStructure.value = []
    chapters.value = []
  }
}
```

**特点**:
- 使用async/await异步处理
- 实现了缓存机制，优先从缓存加载
- 返回的数据会提取第一层children（Web端特殊处理）
- 支持章节状态初始化

### 4.3 数据处理的差异

**Android端**:
- 直接返回完整的 `data` 数组
- 包含教材根节点和所有子节点

**Web端**:
- 特殊处理：返回 `data[0].children`（第一层子节点）
- 这样可以直接获取到章级别的数据，跳过教材根节点

## 5. 使用场景

### 5.1 知识图谱视图
- **文件**: `imates-web/src/views/KnowledgeGraphView.vue`
- **用途**: 加载教材章节结构，用于知识图谱展示
- **特点**: 支持缓存，提升加载速度

### 5.2 教材管理
- **文件**: `app/src/main/java/com/cosinetech/imates/textbookservice/LearnResourceManager.java`
- **用途**: 获取教材的章节树结构
- **特点**: 用于教材资源管理功能

## 6. 错误处理

### 6.1 常见错误情况
1. **401 Unauthorized**: Token失效或未登录
   - Android端：清空token，调用 `onUnauthorized()`
   - Web端：抛出异常

2. **网络错误**: 网络连接失败
   - Android端：调用 `onError("Network error: ...")`
   - Web端：抛出异常

3. **解析错误**: JSON解析失败
   - Android端：调用 `onError("Parse error: ...")`
   - Web端：抛出异常

4. **数据为空**: 返回空数组或null
   - Android端：返回空列表
   - Web端：返回空数组 `[]`

## 7. 注意事项

### 7.1 参数说明
- ⚠️ **重要**: 请求参数中的 `id` 是 `textbookId`，不是教材版本的 `id`
- 教材版本的 `id` 格式类似：`"2f91a127e2fb4b5a9289d97974a790fd"`
- 教材的 `textbookId` 格式类似：`"309599971637723136"`

### 7.2 数据层级
- 返回的数据是嵌套的树结构
- 根节点通常是教材名称（如"人教版"）
- 第一层children是章（level=0）
- 第二层children是节（level=1）

### 7.3 Web端特殊处理
- Web端在 `getTextbookStructure` 方法中会提取 `data[0].children`
- 这样可以直接获取章级别的数据，跳过教材根节点
- 如果数据为空或格式不正确，返回空数组

### 7.4 缓存策略
- Web端实现了缓存机制
- 缓存key格式：`knowledge_graph_chapter_structure_{textbookId}`
- 优先从缓存加载，提升性能

## 8. 相关接口

### 8.1 前置接口
- **获取教材版本列表**: `/blw-edu-yb/api/app/teacher-textbook`
  - 用于获取教材列表，获取 `textbookId`

### 8.2 后续接口
- **获取学习资源包**: `/blw-edu-yb/api/app/teacher-textbook-learning-package`
  - 用于获取章节对应的学习资源文件
  - 注意：该接口使用的是教材版本的 `id`，不是 `textbookId`

## 9. 总结

`teacher-textbook-section-tree` 接口用于获取教材的章节树结构，返回嵌套的章节数据。该接口在Android端和Web端都有实现，主要用于知识图谱展示和教材资源管理功能。

**关键点**:
1. 请求参数使用 `textbookId`（不是教材版本ID）
2. 返回嵌套的树结构数据
3. Web端会特殊处理，提取第一层children
4. 支持缓存机制（Web端）
5. 完整的错误处理和认证机制

