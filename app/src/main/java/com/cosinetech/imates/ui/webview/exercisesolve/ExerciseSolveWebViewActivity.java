package com.cosinetech.imates.ui.webview.exercisesolve;

import static com.cosinetech.imates.network.UnsafeOkHttpClient.TAG;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.lifecycle.ViewModelProvider;
import androidx.lifecycle.ViewModelStoreOwner;

import com.cherry.lib.doc.BuildConfig;
import com.cosinetech.imates.R;
// HTTP接口已移至Vue前端实现，相关导入已删除
import com.cosinetech.imates.ui.activities.BaseActivity;
import com.cosinetech.imates.ui.activities.ExerciseSolveActivity;
import com.cosinetech.imates.data.models.Subject;
import com.cosinetech.imates.data.models.UserInfoViewModel;
import com.cosinetech.imates.coreapiservice.Question;
import com.cosinetech.imates.utils.WindowUtils;
import com.cosinetech.imates.utils.AppUtils;
import com.cosinetech.imates.ui.viewmodels.ExerciseViewModel;
import com.cosinetech.imates.data.models.ChatMessage;
import com.cosinetech.imates.config.StreamingConfig;
import com.cosinetech.imates.ApplicationModelShared;
import com.cosinetech.imates.ui.webview.common.WebAppInterface;
import com.cosinetech.imates.ui.webview.common.KeyboardAwareWebView;
import org.json.JSONObject;

import com.google.gson.Gson;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

/**
 * ExerciseSolve功能的WebView实现
 * 使用MVVM架构模式
 */
public class ExerciseSolveWebViewActivity extends BaseActivity implements WebAppInterface.ExerciseSolveActivityBridge {

    private static final Logger log = LoggerFactory.getLogger(ExerciseSolveWebViewActivity.class);

    /**
     * 安全启动ExerciseSolveWebViewActivity的静态方法
     */
    public static void startActivity(Context context, String chatBotUrl, Subject subject, boolean showLastQuestion) {
        Intent intent = new Intent(context, ExerciseSolveWebViewActivity.class);
        intent.putExtra(ExerciseSolveActivity.KEY_CHATBOT_URL, chatBotUrl != null ? chatBotUrl : "");
        intent.putExtra(ExerciseSolveActivity.KEY_SUBJECT,
                subject != null ? subject.name() : Subject.SUBJECT_MATH.name());
        intent.putExtra(ExerciseSolveActivity.KEY_SHOW_LAST_QUESTION, showLastQuestion);
        context.startActivity(intent);
    }

    private KeyboardAwareWebView webView;
    private WebAppInterface webAppInterface;
    private UserInfoViewModel userInfoViewModel;
    private ExerciseViewModel exerciseViewModel;
    private String chatBotUrl;
    private Subject subject;
    private Gson gson = new Gson();
    private StreamingConfig streamingConfig;
    
    // 键盘状态检测
    private boolean isKeyboardVisible = false;

    // Activity Result Launchers
    private ActivityResultLauncher<Intent> imagePickLauncher;
    private ActivityResultLauncher<Intent> imageCaptureLauncher;

    // HTTP接口已移至Vue前端实现，ChatResponse类已删除

    @Override
    protected int getLayoutResId() {
        return R.layout.activity_webview;
    }

    @Override
    protected int getCurrentNavItemId() {
        return R.id.nav_textbook_knowledge;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // 立即输出调试信息
        Log.e("ExerciseSolveWebView", "🚨🚨🚨 ExerciseSolveWebViewActivity onCreate 被调用 🚨🚨🚨");
        Log.w("ExerciseSolveWebView", "🚨🚨🚨 ExerciseSolveWebViewActivity onCreate 被调用 🚨🚨🚨");
        Log.i("ExerciseSolveWebView", "🚨🚨🚨 ExerciseSolveWebViewActivity onCreate 被调用 🚨🚨🚨");
        
        // 获取传入参数并进行空值检查
        chatBotUrl = getIntent().getStringExtra(ExerciseSolveActivity.KEY_CHATBOT_URL);
        String subjectString = getIntent().getStringExtra(ExerciseSolveActivity.KEY_SUBJECT);

        // 检查subject参数是否为空
        if (subjectString == null || subjectString.isEmpty()) {
            // 设置默认科目或显示错误
            subject = Subject.SUBJECT_MATH; // 默认数学科目
            android.util.Log.w("ExerciseSolveWebView", "Subject parameter is null, using default: MATH");
        } else {
            try {
                subject = Subject.valueOf(subjectString);
            } catch (IllegalArgumentException e) {
                // 如果传入的科目名称无效，使用默认科目
                subject = Subject.SUBJECT_MATH;
                android.util.Log.w("ExerciseSolveWebView",
                        "Invalid subject: " + subjectString + ", using default: MATH");
            }
        }

        // 初始化ViewModel
        ViewModelStoreOwner owner = (ViewModelStoreOwner) getApplication();
        userInfoViewModel = new ViewModelProvider(
                owner,
                new ViewModelProvider.AndroidViewModelFactory(getApplication())).get(UserInfoViewModel.class);

        exerciseViewModel = new ViewModelProvider(this).get(ExerciseViewModel.class);

        // 初始化流式响应配置
        streamingConfig = StreamingConfig.getInstance(this);
        Log.d("ExerciseSolveWebView", "流式响应配置: " + streamingConfig.getConfigSummary());

        initActivityResultLaunchers();
        initWebView();
        setupObservers();
        
        // 输出WebView调试信息
        logWebViewDebugInfo();
        
        // 键盘检测初始化 - 只使用WindowInsets方法
        Log.i("ExerciseSolveWebView", "=== 开始初始化键盘检测系统 (WindowInsets) ===");
        initInsetsListener();
        Log.i("ExerciseSolveWebView", "=== 键盘检测系统初始化完成 ===");
    }

    /**
     * 初始化 Activity Result Launchers
     */
    private void initActivityResultLaunchers() {
        // 图片选择 Launcher
        imagePickLauncher = registerForActivityResult(
                new ActivityResultContracts.StartActivityForResult(),
                this::handleImagePickResult);

        // 拍照 Launcher
        imageCaptureLauncher = registerForActivityResult(
                new ActivityResultContracts.StartActivityForResult(),
                this::handleImageCaptureResult);
    }

    /**
     * 处理图片选择结果
     */
    private void handleImagePickResult(ActivityResult result) {
        Log.d("WebViewActivity", "handleImagePickResult: resultCode=" + result.getResultCode());

        if (result.getResultCode() == RESULT_OK) {
            Intent data = result.getData();
            if (data != null && data.getData() != null) {
                Uri imageUri = data.getData();
                Log.d("WebViewActivity", "从相册选择了图片: " + imageUri.toString());
                // 将图片URI传递给WebAppInterface进行处理
                webAppInterface.handleImagePickResult(imageUri);

                // 通知前端图片选择成功
                runOnUiThread(() -> {
                    String jsCode = String.format("window.onImagePickResult && window.onImagePickResult(true, '%s');",
                            imageUri.toString());
                    webView.evaluateJavascript(jsCode, null);
                });
            } else {
                Log.w("WebViewActivity", "从相册返回了成功结果，但没有图片数据");
                // 通知前端图片选择失败
                runOnUiThread(() -> {
                    String jsCode = "window.onImagePickResult && window.onImagePickResult(false, '');";
                    webView.evaluateJavascript(jsCode, null);
                });
            }
        } else {
            // 操作被取消或失败
            Log.w("WebViewActivity", "图片选择被取消或失败");
            runOnUiThread(() -> {
                String jsCode = "window.onImagePickResult && window.onImagePickResult(false, '');";
                webView.evaluateJavascript(jsCode, null);
            });
        }
    }

    /**
     * 处理拍照结果
     */
    private void handleImageCaptureResult(ActivityResult result) {
        Log.d("WebViewActivity", "handleImageCaptureResult: resultCode=" + result.getResultCode());

        if (result.getResultCode() == RESULT_OK) {
            Log.d("WebViewActivity", "拍照成功");
            // 通知WebAppInterface拍照成功并获取图片信息
            String imageResult = webAppInterface.handleImageCaptureResult(true);

            // 解析图片信息
            try {
                JSONObject response = new JSONObject(imageResult);
                if (response.getBoolean("success")) {
                    String dataStr = response.getString("data");
                    JSONObject imageInfo = new JSONObject(dataStr);

                    String filePath = imageInfo.getString("filePath");
                    int width = imageInfo.getInt("width");
                    int height = imageInfo.getInt("height");
                    long fileSize = imageInfo.getLong("fileSize");

                    // 通知前端拍照成功，传递完整的图片信息
                    runOnUiThread(() -> {
                        String jsCode = String.format(
                                "window.onImageCaptureResult && window.onImageCaptureResult(true, '%s', %d, %d, %d);",
                                filePath, width, height, fileSize);
                        webView.evaluateJavascript(jsCode, null);
                    });
                } else {
                    // 处理失败
                    runOnUiThread(() -> {
                        String jsCode = "window.onImageCaptureResult && window.onImageCaptureResult(false);";
                        webView.evaluateJavascript(jsCode, null);
                    });
                }
            } catch (Exception e) {
                Log.e("WebViewActivity", "解析拍照结果失败", e);
                runOnUiThread(() -> {
                    String jsCode = "window.onImageCaptureResult && window.onImageCaptureResult(false);";
                    webView.evaluateJavascript(jsCode, null);
                });
            }
        } else {
            // 操作被取消或失败
            Log.w("WebViewActivity", "拍照被取消或失败");
            webAppInterface.handleImageCaptureResult(false);
            // 通知前端拍照失败
            runOnUiThread(() -> {
                String jsCode = "window.onImageCaptureResult && window.onImageCaptureResult(false);";
                webView.evaluateJavascript(jsCode, null);
            });
        }
    }

    private void initWebView() {
        webView = findViewById(R.id.webview);

        // 启用 WebView 调试（重要：这样就能在 Chrome DevTools 中看到 console.log）
        // 强制启用调试，确保在Chrome DevTools中可见
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.KITKAT) {
            WebView.setWebContentsDebuggingEnabled(true); // 强制启用调试
            Log.d("WebViewDebug", "WebView调试已启用，Chrome DevTools应该可以连接");
        }

        // WebView配置
        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setDatabaseEnabled(true);
        webSettings.setAllowFileAccess(true);
        webSettings.setAllowContentAccess(true);
        webSettings.setAllowFileAccessFromFileURLs(true);
        webSettings.setAllowUniversalAccessFromFileURLs(true);
        
        // 增强调试支持
        webSettings.setCacheMode(WebSettings.LOAD_DEFAULT);
        webSettings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        
        // 启用远程调试
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.KITKAT) {
            webSettings.setLayoutAlgorithm(WebSettings.LayoutAlgorithm.TEXT_AUTOSIZING);
        }
        
        Log.d("WebViewDebug", "WebView设置完成，支持远程调试");

        // 创建并设置WebAppInterface
        webAppInterface = new WebAppInterface(this);
        webAppInterface.setExerciseBridge(this);
        webAppInterface.setImageLaunchers(imagePickLauncher, imageCaptureLauncher);
        webAppInterface.setWebView(webView); // 设置WebView实例用于执行JavaScript
        webView.addJavascriptInterface(webAppInterface, "AndroidBridge");

        // 设置WebViewClient
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                Log.d("WebViewDebug", "页面加载完成: " + url);
                // 页面加载完成后，传递初始化数据
                initializeWebApp();
                
                // 输出调试信息到控制台
                webView.evaluateJavascript("console.log('🔧 WebView调试信息: 页面已加载完成');", null);
                webView.evaluateJavascript("console.log('🔧 当前URL: " + url + "');", null);
                webView.evaluateJavascript("console.log('🔧 User Agent: ' + navigator.userAgent);", null);
            }
            
            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                super.onReceivedError(view, errorCode, description, failingUrl);
                Log.e("WebViewDebug", "WebView错误: " + errorCode + " - " + description + " - " + failingUrl);
            }
        });

        // 加载本地Web应用
        webView.loadUrl("file:///android_asset/exerciseSolve/index.html");
    }

    private void setupObservers() {
        // 初始化ExerciseViewModel - 使用AppUtils.getUserToken()
        String token = AppUtils.getUserToken();
        if (token != null && !token.isEmpty()) {
            // 使用字符串科目名初始化
            String subjectName = getSubjectNameFromEnum(subject);
            if (subjectName != null) {
                exerciseViewModel.initialize(subjectName);
            }
        } else {
            android.util.Log.w("ExerciseSolveWebView",
                    "User token is null or empty, cannot initialize ExerciseViewModel");
        }

        // 观察题目列表变化
        exerciseViewModel.getExerciseList().observe(this, questions -> {
            if (questions != null) {
                android.util.Log.d("ExerciseSolveWebView",
                        String.format("题目列表更新，数量: %d", questions.size()));

                // 通知Web端题目列表更新
                String questionsJson = gson.toJson(questions);
                String jsCode = String.format("window.onExerciseListUpdated && window.onExerciseListUpdated(%s);",
                        questionsJson);
                webView.evaluateJavascript(jsCode, null);
            }
        });

        // 观察错误消息
        exerciseViewModel.getErrorMessage().observe(this, errorMsg -> {
            if (errorMsg != null && !errorMsg.isEmpty()) {
                android.util.Log.w("ExerciseSolveWebView", "错误消息: " + errorMsg);
                webAppInterface.showToast(errorMsg);
            }
        });

        // 观察加载状态
        exerciseViewModel.getIsLoading().observe(this, isLoading -> {
            android.util.Log.d("ExerciseSolveWebView", "加载状态: " + isLoading);

            // 通知Web端加载状态变化
            String jsCode = String.format("window.onLoadingStateChanged && window.onLoadingStateChanged(%b);",
                    isLoading);
            webView.evaluateJavascript(jsCode, null);
        });

        // 观察科目变化
        exerciseViewModel.getCurrentSubject().observe(this, currentSubject -> {
            if (currentSubject != null) {
                String subjectName = getSubjectNameFromEnum(currentSubject);
                android.util.Log.d("ExerciseSolveWebView", "当前科目: " + subjectName);

                // 通知Web端科目变化
                String jsCode = String.format("window.onSubjectChanged && window.onSubjectChanged('%s');", subjectName);
                webView.evaluateJavascript(jsCode, null);
            }
        });
    }

    /**
     * 将Subject枚举转换为字符串科目名
     */
    private String getSubjectNameFromEnum(Subject subject) {
        if (subject == null)
            return null;

        switch (subject) {
            case SUBJECT_MATH:
                return "数学";
            case SUBJECT_BIOLOGY:
                return "生物";
            case SUBJECT_PHYSICS:
                return "物理";
            case SUBJECT_CHEMISTRY:
                return "化学";
            case SUBJECT_ENGLISH:
                return "英语";
            case SUBJECT_CHINESE:
                return "语文";
            default:
                return null;
        }
    }

    private void initializeWebApp() {
        // 构建初始化数据，包含流式响应配置
        String initData = String.format(
                "{ \"chatBotUrl\": \"%s\", \"subject\": \"%s\", \"showLastQuestion\": %b, \"streamingConfig\": { \"typewriterSpeed\": %d, \"timeout\": %d } }",
                chatBotUrl != null ? chatBotUrl : "",
                subject.name(),
                getIntent().getBooleanExtra(ExerciseSolveActivity.KEY_SHOW_LAST_QUESTION, false),
                streamingConfig.getTypewriterSpeed(),
                streamingConfig.getStreamTimeout());

        // 调用Web端的初始化方法
        String jsCode = String.format("window.initializeApp && window.initializeApp(%s);", initData);
        webView.evaluateJavascript(jsCode, null);

        // 设置全局回调函数
        setupGlobalCallbacks();
    }

    /**
     * 设置全局JavaScript回调函数
     */
    private void setupGlobalCallbacks() {
        // 题目置顶功能已改为纯前端实现，移除相关回调

        // 拍照搜题结果回调
        runOnUiThread(() -> {
            String jsCode = "window.onPhotoSearchResult = function(success, questionData) { " +
                    "if (success && questionData) { " +
                    "  console.log('拍照搜题成功:', questionData); " +
                    "  if (window.onQuestionAdded) { " +
                    "    window.onQuestionAdded(questionData); " +
                    "  } " +
                    "} else { " +
                    "  console.log('拍照搜题失败'); " +
                    "} " +
                    "};";
            webView.evaluateJavascript(jsCode, null);
        });
    }

    // ========== WebAppInterface.ExerciseSolveActivityBridge 实现 ==========
    // HTTP接口已移至Vue前端实现，仅保留原生功能接口

    @Override
    public void startPhotoSearch(String subjectName) {
        try {
            // 启动拍照搜题Activity
            Intent intent = new Intent(this, com.cosinetech.imates.ui.activities.PhotoSearchActivity.class);
            intent.putExtra(com.cosinetech.imates.ui.activities.PhotoSearchActivity.KEY_PARAM_SUBJECT, subject.name());
            startActivity(intent);
        } catch (Exception e) {
            e.printStackTrace();
            webAppInterface.showToast("启动拍照搜题失败: " + e.getMessage());
        }
    }

    // HTTP接口已移至Vue前端实现，相关辅助方法已删除

    // HTTP接口已移至Vue前端实现，getUserInfo等方法已删除

    @Override
    public void setTeacherMessageCallback(String callbackName) {
        // 设置老师消息回调函数名
        // 这里可以存储回调函数名，在收到老师消息时调用
        Log.d(TAG, "设置老师消息回调: " + callbackName);
    }

    @Override
    public void onTeacherMessageReceived(String messageData) {
        // 当收到老师消息时的回调处理
        try {
            Log.d(TAG, "收到老师消息: " + messageData);

            // 通知WebAppInterface处理老师消息
            if (webAppInterface != null) {
                // 解析消息数据并转换为ChatMessage对象
                // 这里需要根据实际的消息格式进行解析
                // 暂时直接传递给WebAppInterface
                runOnUiThread(() -> {
                    String jsCode = String.format(
                            "window.onTeacherMessageReceived && window.onTeacherMessageReceived(%s);", messageData);
                    webView.evaluateJavascript(jsCode, null);
                });
            }
        } catch (Exception e) {
            Log.e(TAG, "处理老师消息失败", e);
        }
    }

    @Override
    public void onBackPressed() {
        android.util.Log.d("ExerciseSolveWebView", "onBackPressed called");
        
        // 检查是否有键盘显示，如果有则先隐藏键盘
        if (webView != null) {
            // 触发键盘隐藏事件
            webView.evaluateJavascript("javascript:" +
                "console.log('⌨️ [Activity返回键] 检测到返回键按下');" +
                "if (typeof window !== 'undefined' && window.dispatchEvent) {" +
                "  const event = new CustomEvent('keyboard-hide', { detail: { duration: 300 } });" +
                "  window.dispatchEvent(event);" +
                "  console.log('⌨️ [Activity返回键] 已触发全局键盘隐藏事件');" +
                "}", null);
        }
        
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        // 隐藏悬浮窗
        ApplicationModelShared app = (ApplicationModelShared) getApplication();
        if(app.getFloatingWindowService() != null) {
            app.getFloatingWindowService().hideRobot();
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        // 显示悬浮窗
        ApplicationModelShared app = (ApplicationModelShared) getApplication();
        if(app.getFloatingWindowService() != null) {
            app.getFloatingWindowService().showRobot();
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            WindowUtils.hideSystemUI(this);
        }
    }

    @Override
    public boolean onKeyDown(int keyCode, android.view.KeyEvent event) {
        android.util.Log.d("ExerciseSolveWebView", "Activity onKeyDown: keyCode=" + keyCode + ", action=" + event.getAction());
        
        // 监听返回键
        if (keyCode == android.view.KeyEvent.KEYCODE_BACK) {
            android.util.Log.d("ExerciseSolveWebView", "Activity检测到返回键按下");
            
            // 触发键盘隐藏事件
            if (webView != null) {
                webView.evaluateJavascript("javascript:" +
                    "console.log('⌨️ [Activity onKeyDown] 检测到返回键按下');" +
                    "if (typeof window !== 'undefined' && window.dispatchEvent) {" +
                    "  const event = new CustomEvent('keyboard-hide', { detail: { duration: 300 } });" +
                    "  window.dispatchEvent(event);" +
                    "  console.log('⌨️ [Activity onKeyDown] 已触发全局键盘隐藏事件');" +
                    "}", null);
            }
        }
        
        return super.onKeyDown(keyCode, event);
    }


    /**
     * 通知键盘显示
     */
    private void notifyKeyboardShow(int keyboardHeight) {
        if (webView != null) {
            webView.evaluateJavascript("javascript:" +
                "console.log('⌨️ [Android键盘检测] 键盘显示: " + keyboardHeight + "px');" +
                "if (typeof window !== 'undefined' && window.dispatchEvent) {" +
                "  const event = new CustomEvent('keyboard-show', { detail: { height: " + keyboardHeight + ", duration: 300 } });" +
                "  window.dispatchEvent(event);" +
                "  console.log('⌨️ [Android键盘检测] 已触发键盘显示事件');" +
                "}", null);
        }
    }

    /**
     * 通知键盘隐藏
     */
    private void notifyKeyboardHide() {
        if (webView != null) {
            webView.evaluateJavascript("javascript:" +
                "console.log('⌨️ [Android键盘检测] 键盘隐藏');" +
                "if (typeof window !== 'undefined' && window.dispatchEvent) {" +
                "  const event = new CustomEvent('keyboard-hide', { detail: { duration: 300 } });" +
                "  window.dispatchEvent(event);" +
                "  console.log('⌨️ [Android键盘检测] 已触发键盘隐藏事件');" +
                "}", null);
        }
    }

    /**
     * 输出WebView调试信息
     */
    private void logWebViewDebugInfo() {
        if (webView != null) {
            Log.d("WebViewDebug", "=== WebView调试信息 ===");
            Log.d("WebViewDebug", "WebView版本: " + webView.getSettings().getUserAgentString());
            Log.d("WebViewDebug", "JavaScript已启用: " + webView.getSettings().getJavaScriptEnabled());
            Log.d("WebViewDebug", "DOM存储已启用: " + webView.getSettings().getDomStorageEnabled());
            Log.d("WebViewDebug", "数据库已启用: " + webView.getSettings().getDatabaseEnabled());
            Log.d("WebViewDebug", "当前URL: " + webView.getUrl());
            Log.d("WebViewDebug", "========================");
        }
    }

    /**
     * 初始化Insets监听器 - 最可靠的键盘检测方法
     */
    private void initInsetsListener() {
        Log.i("ExerciseSolveWebView", "🔍 [Insets监听] 开始初始化Insets监听器");
        
        // 监听窗口insets变化
        getWindow().getDecorView().setOnApplyWindowInsetsListener((v, insets) -> {
            int imeType = android.view.WindowInsets.Type.ime();
            boolean imeVisible = false;
            
            // 检测键盘是否可见 - 兼容API 24
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
                // API 30+ 使用 isVisible
                imeVisible = insets.isVisible(imeType);
            } else {
                // API 24-29 通过检查底部insets来判断键盘是否可见
                int bottomInsets = 0;
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                    // API 29 使用 getSystemWindowInsets
                    bottomInsets = insets.getSystemWindowInsets().bottom;
                } else {
                    // API 24-28 使用 getSystemWindowInsets (兼容方法)
                    bottomInsets = insets.getSystemWindowInsets().bottom;
                }
                // 如果底部insets大于状态栏高度，认为键盘可见
                imeVisible = bottomInsets > 100; // 100px阈值
            }
            
            Log.i("ExerciseSolveWebView", "🔍 [Insets监听] imeVisible=" + imeVisible + 
                  ", imeType=" + imeType);
            
            if (imeVisible && !isKeyboardVisible) {
                Log.i("ExerciseSolveWebView", "🔍 [Insets监听] 检测到键盘显示");
                isKeyboardVisible = true;
                // 获取键盘高度 - 兼容API 24
                int keyboardHeight = 0;
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
                    // API 30+ 使用 getInsets
                    keyboardHeight = insets.getInsets(imeType).bottom;
                } else {
                    // API 24-29 使用 getSystemWindowInsets
                    keyboardHeight = insets.getSystemWindowInsets().bottom;
                }
                notifyKeyboardShow(keyboardHeight);
            } else if (!imeVisible && isKeyboardVisible) {
                Log.i("ExerciseSolveWebView", "🔍 [Insets监听] 检测到键盘隐藏");
                isKeyboardVisible = false;
                notifyKeyboardHide();
            }
            
            return v.onApplyWindowInsets(insets);
        });
        
        Log.i("ExerciseSolveWebView", "🔍 [Insets监听] Insets监听器设置完成");
    }
}