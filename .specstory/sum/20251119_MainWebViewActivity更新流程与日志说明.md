# MainWebViewActivity 更新流程与日志说明

## 1. 相关问题

- 问题：MainWebViewActivity 这个更新的流程如何打日志？
- 目标：描述 MainWebViewActivity 中更新检查的完整流程，并记录本次为调试而增加的日志点位。

## 2. MainWebViewActivity 中的更新检查流程

### 2.1 定时更新检查的启动

- 在 `onCreate` 中调用：
  ```java
  // 第4步：初始化应用更新检查机制
  initUpdateCheck();
  ```
- `initUpdateCheck()` 的实现：
  ```java
  /**
   * 初始化应用更新检查机制
   * 启动后10秒执行首次更新检查，然后每60秒检查一次。
   * 每次检查都会发送HTTP请求，如果服务器返回的版本号比当前版本新，则执行更新。
   */
  private void initUpdateCheck() {
      Log.d(TAG, "[Update] 初始化更新检查机制，将在 10 秒后执行首次更新检查");
      // 启动后10秒执行首次更新检查
      mCheckUpdateHandler.postDelayed(mCheckUpdateRunnable, 10000);
  }
  ```

> 启动后约 10 秒执行第一次检查，此后由 `mCheckUpdateRunnable` 负责周期性检查。

### 2.2 定时任务 Runnable 的逻辑

- 成员定义：
  ```java
  // 更新检查的 Handler，用于定时执行更新检查
  private final Handler mCheckUpdateHandler = new Handler(Looper.getMainLooper());

  /**
   * 更新检查的 Runnable，每 60 秒执行一次检查
   * 每次检查都会发送HTTP请求，如果服务器返回的版本号比当前版本新，则执行更新
   */
  private final Runnable mCheckUpdateRunnable = new Runnable() {
      @Override
      public void run() {
          Log.d(TAG, "[Update] 定时检查触发，开始执行 mCheckUpdateRunnable.run()");
          String updateUrl = ApiUrl.URL_APP_UPDATE;
          Log.d(TAG, "[Update] 当前使用的更新检查 URL = " + updateUrl);

          // 每次检查都发送HTTP请求，判断是否需要更新
          checkUpdateWithHttpRequest(updateUrl);

          // 每 60 秒执行一次检查
          mCheckUpdateHandler.postDelayed(this, 60000);
      }
  };
  ```

- 行为说明：
  - 每次执行 `run()`：
    - 记录日志说明定时检查触发。
    - 取当前环境对应的 `ApiUrl.URL_APP_UPDATE` 作为更新配置地址。
    - 调用 `checkUpdateWithHttpRequest(updateUrl)` 执行实际的网络请求与更新逻辑。
    - 自己再次 `postDelayed` 自身，形成每 60 秒一次的周期任务。

### 2.3 HTTP 请求与 JSON 解析流程

- `checkUpdateWithHttpRequest(String updateUrl)` 的核心逻辑：

  ```java
  /**
   * 手动发送HTTP请求检查更新并打印响应信息
   * EasyUpdate内部会自动比较版本号，如果需要更新则执行更新
   *
   * @param updateUrl 更新检查的URL
   */
  private void checkUpdateWithHttpRequest(String updateUrl) {
      Log.d(TAG, "[Update] 开始请求更新配置，updateUrl = " + updateUrl);
      // 创建OkHttp客户端
      OkHttpClient client = new OkHttpClient.Builder()
              .connectTimeout(10, TimeUnit.SECONDS)
              .readTimeout(10, TimeUnit.SECONDS)
              .writeTimeout(10, TimeUnit.SECONDS)
              .build();

      // 创建请求
      Request request = new Request.Builder()
              .url(updateUrl)
              .get()
              .build();

      // 发送异步请求
      client.newCall(request).enqueue(new Callback() {
          @Override
          public void onFailure(Call call, IOException e) {
              // HTTP请求失败，静默处理
              Log.e(TAG, "[Update] 更新配置 HTTP 请求失败", e);
          }

          @Override
          public void onResponse(Call call, Response response) throws IOException {
              try {
                  // 获取响应信息
                  int statusCode = response.code();
                  String statusMessage = response.message();

                  // 读取响应体（注意：只能读取一次）
                  String responseBody = "";
                  if (response.body() != null) {
                      responseBody = response.body().string();
                  }
                  Log.d(TAG, "[Update] 收到更新配置响应，statusCode = " + statusCode
                          + ", statusMessage = " + statusMessage
                          + ", bodyLength = " + (responseBody != null ? responseBody.length() : 0));

                  // 解析响应JSON，提取版本号
                  if (statusCode == 200 && responseBody != null && !responseBody.isEmpty()) {
                      try {
                          org.json.JSONObject jsonObj = new org.json.JSONObject(responseBody);
                          String serverVersion = jsonObj.optString("VersionName", "");
                          Log.d(TAG, "[Update] 解析到服务器版本号 VersionName = " + serverVersion);
                          if (!serverVersion.isEmpty()) {
                              // 发送版本号到Web端
                              dispatchAppVersionEvent(serverVersion);
                              Log.d(TAG, "[Update] 已将服务器版本号发送给 Web 端: " + serverVersion);
                              Log.d(TAG, "服务器版本: " + serverVersion);

                              // 直接调用EasyUpdate.update()，内部会自动比较版本号并决定是否更新
                              runOnUiThread(() -> {
                                  Log.d(TAG, "[Update] 即将调用 EasyUpdate 进行更新检查和可能的弹窗");
                                  EasyUpdate.create(MainWebViewActivity.this, updateUrl)
                                          .isAutoMode(false)
                                          .update();
                              });
                          } else {
                              Log.w(TAG, "[Update] 更新配置 JSON 中缺少 VersionName 或为空，不执行更新");
                          }
                      } catch (org.json.JSONException e) {
                          Log.e(TAG, "[Update] 解析更新响应JSON失败", e);
                      }
                  } else {
                      Log.w(TAG, "[Update] 更新配置响应异常，statusCode = " + statusCode + ", 不进行更新处理");
                  }
              } catch (Exception e) {
                  Log.e(TAG, "[Update] 处理更新响应失败", e);
              } finally {
                  if (response.body() != null) {
                      response.body().close();
                  }
              }
          }
      });
  }
  ```

- 流程总结：
  1. 打印“开始请求更新配置”的日志，确认 URL。  
  2. 发起网络请求，失败时打印错误日志。  
  3. 成功时记录状态码、返回长度等信息。  
  4. 如果 HTTP 200 且 body 非空：
     - 解析 JSON，打印服务器版本号 `VersionName`。
     - 把版本号发送给 Web 端，并打印相应日志。
     - 在 UI 线程调用 EasyUpdate 进行更新检查，并记录即将调用的日志。
  5. 若 JSON 中缺少版本号或响应码异常，则分别打印 warning。

## 3. 日志点位总表

为便于排查“为什么没弹更新对话框”等问题，MainWebViewActivity 中新增的日志点如下：

1. **初始化阶段**
   - 方法：`initUpdateCheck()`
   - 日志：
     - `[Update] 初始化更新检查机制，将在 10 秒后执行首次更新检查`

2. **定时任务执行**
   - Runnable：`mCheckUpdateRunnable`
   - 日志：
     - `[Update] 定时检查触发，开始执行 mCheckUpdateRunnable.run()`
     - `[Update] 当前使用的更新检查 URL = ...`

3. **网络请求与响应**
   - 方法：`checkUpdateWithHttpRequest(String updateUrl)`
   - 日志：
     - 请求开始：
       - `[Update] 开始请求更新配置，updateUrl = ...`
     - 请求失败：
       - `[Update] 更新配置 HTTP 请求失败`（`Log.e`，附异常栈）
     - 收到响应：
       - `[Update] 收到更新配置响应，statusCode = ..., statusMessage = ..., bodyLength = ...`
     - 解析版本号：
       - `[Update] 解析到服务器版本号 VersionName = ...`
     - 通知 Web 端：
       - `[Update] 已将服务器版本号发送给 Web 端: ...`
     - 即将调用 EasyUpdate：
       - `[Update] 即将调用 EasyUpdate 进行更新检查和可能的弹窗`
     - JSON 无版本号：
       - `[Update] 更新配置 JSON 中缺少 VersionName 或为空，不执行更新`
     - 响应码异常：
       - `[Update] 更新配置响应异常，statusCode = ..., 不进行更新处理`
     - JSON 解析异常 / 处理异常：
       - `[Update] 解析更新响应JSON失败`
       - `[Update] 处理更新响应失败`

## 4. 使用日志排查问题的建议

- 在 Logcat 中按 `TAG=MainWebViewActivity` 和关键字 `[Update]` 过滤查看：
  1. **先看是否触发了初始化和定时任务**：
     - 有无“初始化更新检查机制”和“定时检查触发”的日志。  
  2. **确认请求是否发出并收到响应**：
     - 有无“开始请求更新配置”和“收到更新配置响应”的日志。
  3. **检查服务器版本号是否解析正确**：
     - 确认 `VersionName` 是否非空，且与预期一致。
  4. **确认是否进入 EasyUpdate 调用**：
     - 有无“即将调用 EasyUpdate 进行更新检查和可能的弹窗”的日志。

> 如果日志显示已经进入 EasyUpdate 调用但仍然不弹窗，问题很可能在：服务器 `VersionCode` 配置不大于本地 `versionCode`、`UpdateStatus` 设置、或 EasyUpdate/XUpdate 自身的版本策略上，此时可结合历史文档 `20250108_Android应用更新检查不弹出更新框问题.md` 做进一步分析。
