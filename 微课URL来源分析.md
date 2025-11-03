# 微课URL来源分析

## 📋 分析摘要

基于微课功能技术文档（`# 微课功能技术文档.md`）的分析，微课URL的来源如下：

---

## 1. 当前实现方式（硬编码）

### 1.1 URL定义位置
**文件**: `app/src/main/java/com/cosinetech/imates/ui/activities/ExerciseSolveActivity.java`

**方法**:
```java
private String getMiniClassUrl() {
    return "https://www.imates.com.cn:9099/demo/demo1.html";
}
```

### 1.2 URL使用流程

```
用户点击微课按钮
    ↓
ExerciseSolveActivity.getMiniClassUrl()
    ↓
返回硬编码URL: "https://www.imates.com.cn:9099/demo/demo1.html"
    ↓
通过Intent传递到MiniClassActivity
    ↓
MiniClassActivity接收URL并加载到WebView
```

### 1.3 具体代码实现

**第1步：获取URL**
```java
findViewById(R.id.btn_mini_class).setOnClickListener(v -> {
    String url = getMiniClassUrl();
    if(url != null && !url.isEmpty()) {
        Intent intent = new Intent(this, MiniClassActivity.class);
        intent.putExtra(MiniClassActivity.KEY_MINI_CLASS_URL, url);
        startActivity(intent);
    }
});
```

**第2步：传递URL**
- Intent参数Key: `KEY_MINI_CLASS_URL = "class_url"`
- 通过`Intent.putExtra()`传递

**第3步：接收URL**
```java
String classUrl = getIntent().getStringExtra(KEY_MINI_CLASS_URL);
webView.loadUrl(classUrl);
```

---

## 2. 文档中建议的改进方案

### 2.1 三种获取URL的方式（文档第6.1节）

文档在使用示例（第6.1节）中提到了三种方式：

#### 方式1：硬编码URL（当前实现）
```java
private String getMiniClassUrl() {
    return "https://www.imates.com.cn:9099/demo/demo1.html";
}
```

#### 方式2：从题目数据中获取（推荐）
```java
private String getMiniClassUrl() {
    return currentExercise.getMiniClassUrl();
}
```

#### 方式3：从API获取
```java
private void loadMiniClassUrl(String exerciseId) {
    apiService.getExerciseDetail(exerciseId, new Callback<Exercise>() {
        @Override
        public void onSuccess(Exercise exercise) {
            String url = exercise.getMiniClassUrl();
            if (url != null && !url.isEmpty()) {
                openMiniClass(url);
            }
        }
    });
}
```

---

## 3. 未来API集成方案（建议）

### 3.1 API接口定义

**接口地址**: `GET /permission/miniClass?questionId={questionId}&subject={subject}`

**功能描述**: 根据题目ID和学科获取对应的微课URL

**请求参数**:
- `questionId` (必填): 题目ID
- `subject` (必填): 学科类型 (biology/math)

**请求头**:
```
Token: {用户token}
```

**响应数据**:
```json
{
  "success": true,
  "code": 200,
  "message": "获取成功",
  "data": {
    "miniClassUrl": "https://www.imates.com.cn:9099/demo/demo1.html",
    "title": "微课标题",
    "duration": 300,
    "coverImage": "https://www.imates.com.cn/images/cover.jpg"
  }
}
```

### 3.2 API实现步骤

**第1步**: 在`ApiUrl.java`中添加接口地址
```java
public static String URL_GET_MINI_CLASS;

private static void updateAllUrl() {
    // ... 其他接口
    URL_GET_MINI_CLASS = baseUrl + "/permission/miniClass";
}
```

**第2步**: 在`ApiGateWayService.java`中添加获取方法
```java
public interface MiniClassCallback {
    void onSuccess(String miniClassUrl);
    void onFailure(String msg, int code);
}

public static void getMiniClassUrl(String questionId, String subject, String token, MiniClassCallback callback) {
    // 实现API调用逻辑
}
```

---

## 4. Web端实现情况

### 4.1 当前Web端实现

在Web端（`imates-web`）中，微课URL的获取方式：

**位置**: `imates-web/src/components/QuestionList.vue:1050`

```typescript
const openMiniClass = async (question: ExerciseItem) => {
  // 尝试从题目对象中获取
  const questionWithUrl = question as ExerciseItem & { 
    miniClassUrl?: string
    microClassUrl?: string
  }
  const classUrl = questionWithUrl.miniClassUrl || questionWithUrl.microClassUrl || ''
  
  if (!classUrl || classUrl.trim() === '') {
    showMessage('该题目暂无微课', 'warning')
    return
  }
  
  emit('openMiniClass', question)
}
```

### 4.2 Web端存在的问题

1. **数据转换时未映射微课URL字段**
   - 在`questionStore.ts`的数据转换过程中，没有映射`miniClassUrl`或`microClassUrl`字段
   
2. **类型定义中缺少微课URL字段**
   - `ExerciseItem`接口中没有定义微课URL相关字段

3. **后端API返回数据中不包含微课URL**
   - 根据后端`Question.java`类的定义，API返回的题目数据中不包含微课URL字段

---

## 5. 总结

### 5.1 当前状态

| 平台 | URL来源 | 状态 |
|------|---------|------|
| **Android** | 硬编码在`ExerciseSolveActivity.getMiniClassUrl()` | ✅ 可用但不够灵活 |
| **Web** | 尝试从题目对象获取，但字段不存在 | ❌ 无法获取，显示"该题目暂无微课" |

### 5.2 关键问题

1. **Android端**: URL硬编码，所有题目使用同一个微课URL，无法根据题目动态加载
2. **Web端**: 题目对象中没有微课URL字段，导致无法显示微课
3. **后端API**: 题目列表接口不返回微课URL，需要单独API获取

### 5.3 解决方案建议

#### 方案1：在题目列表API中添加微课URL字段（推荐）
- **优点**: 一次请求获取所有数据，包括微课URL
- **缺点**: 需要后端修改API，增加返回数据量
- **实现**: 后端在`Question`类中添加`miniClassUrl`字段

#### 方案2：通过单独API获取微课URL
- **优点**: 不影响现有API，可以按需获取
- **缺点**: 需要额外请求，增加网络开销
- **实现**: 实现文档中建议的`/permission/miniClass`接口

#### 方案3：根据题目ID或知识点匹配微课URL
- **优点**: 可以通过规则自动匹配微课
- **缺点**: 需要维护匹配规则，灵活性较差
- **实现**: 在前端或后端实现URL匹配逻辑

---

## 6. 下一步行动

1. **确认后端是否有微课URL数据**
   - 检查数据库中是否有微课URL字段
   - 确认微课URL的存储方式

2. **选择实现方案**
   - 如果后端已有数据：选择方案1或方案2
   - 如果后端没有数据：需要先规划微课URL的数据结构

3. **实现API接口**
   - 如果需要单独API：实现`/permission/miniClass`接口
   - 如果修改现有接口：在`Question`类中添加`miniClassUrl`字段

4. **更新前端代码**
   - Android端：从硬编码改为从API获取
   - Web端：在数据转换时映射微课URL字段，更新类型定义

---

## 7. 相关文件位置

### Android端
- `app/src/main/java/com/cosinetech/imates/ui/activities/ExerciseSolveActivity.java` - 当前硬编码URL
- `app/src/main/java/com/cosinetech/imates/ui/activities/MiniClassActivity.java` - 微课播放Activity
- `app/src/main/java/com/cosinetech/imates/coreapiservice/Question.java` - 题目数据模型（无微课URL字段）

### Web端
- `imates-web/src/components/QuestionList.vue` - 微课按钮点击处理
- `imates-web/src/stores/questionStore.ts` - 题目数据转换（未映射微课URL）
- `imates-web/src/types/exercise.ts` - 题目类型定义（无微课URL字段）

### API服务
- `app/src/main/java/com/cosinetech/imates/coreapiservice/ApiUrl.java` - API地址配置
- `app/src/main/java/com/cosinetech/imates/coreapiservice/ApiGateWayService.java` - API调用服务

---

*文档生成时间: 基于微课功能技术文档分析*

