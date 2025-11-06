package com.cosinetech.imates.ui.webview;

import android.content.Context;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.graphics.Rect;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.view.ViewTreeObserver;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;

import com.cosinetech.imates.ApplicationModelShared;
import com.cosinetech.imates.R;
import com.cosinetech.imates.ui.robot.FloatingRobotService;
import com.cosinetech.imates.ui.webview.common.WebAppInterface;
import com.cosinetech.imates.ui.webview.common.WebViewConfig;
import com.cosinetech.imates.utils.AppUtils;
import com.cosinetech.imates.utils.WindowUtils;
import com.cosinetech.imates.coreapiservice.ApiUrl;
import com.xuexiang.xupdate.easy.EasyUpdate;
import android.os.Build;

/**
 * 主WebView Activity
 * 用于渲染整个imates-web项目构建后的页面
 * 提供完整的Vue应用容器
 */
public class MainWebViewActivity extends AppCompatActivity implements WebAppInterface.ExerciseSolveActivityBridge {

    private static final String TAG = "MainWebViewActivity";
    
    // WebView相关
    private WebView webView;
    private WebAppInterface webAppInterface;
    
    // Activity Result Launchers
    private ActivityResultLauncher<Intent> imagePickLauncher;
    private ActivityResultLauncher<Intent> imageCaptureLauncher;
    private ActivityResultLauncher<String> cameraPermissionLauncher;
    private ActivityResultLauncher<String> audioPermissionLauncher;
    
    // 页面URL配置
    private String webAppUrl = "file:///android_asset/webapp/index.html"; // 默认加载Vue.js整体应用
    
    // 悬浮FAB按钮action参数
    private String floatingFabAction = null;
    
    // 键盘检测相关
    private int previousKeyboardHeight = 0;
    private boolean isKeyboardVisible = false;
    
    // 更新检查相关
    private long mCheckUpdateTick = 0;
    private final Handler mCheckUpdateHandler = new Handler(Looper.getMainLooper());
    private final Runnable mCheckUpdateRunnable = new Runnable() {
        @Override
        public void run() {
            long tick = System.currentTimeMillis();
            if(tick - mCheckUpdateTick >= 3600000) {
                mCheckUpdateTick = tick;
                EasyUpdate.create(MainWebViewActivity.this, ApiUrl.URL_APP_UPDATE)
                        .isAutoMode(false)
                        .update();
            }
            mCheckUpdateHandler.postDelayed(this, 60000); // 每60秒执行一次检查
        }
    };
    
    /**
     * 启动MainWebViewActivity的静态方法
     * @param context 上下文
     * @param url 可选的自定义URL，如果为null则使用默认URL
     */
    public static void startActivity(Context context, String url) {
        Intent intent = new Intent(context, MainWebViewActivity.class);
        if (url != null) {
            intent.putExtra("web_app_url", url);
        }
        context.startActivity(intent);
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // 第1步：强制横屏
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE);
        
        // 第2步：设置全屏模式（必须在setContentView之前调用）
        WindowUtils.setFullScreenMode(this);
        
        // 第3步：确保窗口占据整个屏幕（防止悬浮窗模式）
        // 在Android 7.0+系统上，确保窗口以全屏模式启动
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            getWindow().setLayout(WindowManager.LayoutParams.MATCH_PARENT, 
                                 WindowManager.LayoutParams.MATCH_PARENT);
        }
        
        // 第4步：设置布局
        setContentView(R.layout.activity_main_webview);
        
        // 第5步：隐藏系统UI（必须在setContentView之后调用才能生效）
        WindowUtils.hideSystemUI(this);
        
        Log.d(TAG, "MainWebViewActivity onCreate 开始");
        
        // 获取传入的URL参数
        String customUrl = getIntent().getStringExtra("web_app_url");
        if (customUrl != null && !customUrl.isEmpty()) {
            webAppUrl = customUrl;
        }
        
        // 获取悬浮FAB按钮的action参数
        floatingFabAction = getIntent().getStringExtra("floating_fab_action");
        if (floatingFabAction != null) {
            Log.d(TAG, "收到悬浮FAB按钮action: " + floatingFabAction);
        }
        
        Log.d(TAG, "加载URL: " + webAppUrl);
        
        // 第1步：先初始化Activity Result Launchers（必须在initWebView之前）
        initActivityResultLaunchers();
        
        // 第2步：初始化WebView（需要使用已初始化的launchers）
        initWebView();
        
        // 第3步：加载页面
        loadWebApp();
        
        // 第4步：初始化更新检查
        initUpdateCheck();
        
        Log.d(TAG, "MainWebViewActivity onCreate 完成");
    }
    
    /**
     * 初始化更新检查
     */
    private void initUpdateCheck() {
        mCheckUpdateTick = System.currentTimeMillis();
        mCheckUpdateHandler.postDelayed(mCheckUpdateRunnable, 60000); // 60秒后首次检查
        Log.d(TAG, "更新检查已初始化");
    }

    /**
     * 初始化WebView
     */
    private void initWebView() {
        webView = findViewById(R.id.main_webview);
        
        // 启用WebView调试
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.KITKAT) {
            WebView.setWebContentsDebuggingEnabled(true);
            Log.d(TAG, "WebView调试已启用");
        }
        
        // 使用统一的WebView配置
        WebViewConfig.configureWebView(webView, this);
        
        // 禁用长按弹出右键菜单
        webView.setLongClickable(false);
        webView.setOnLongClickListener(v -> true);
        webView.setHapticFeedbackEnabled(false);
        
        // 隐藏滚动条
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);
        
        // 创建并设置WebAppInterface
        webAppInterface = new WebAppInterface(this);
        webAppInterface.setExerciseBridge(this);
        webAppInterface.setImageLaunchers(imagePickLauncher, imageCaptureLauncher);
        webAppInterface.setCameraPermissionLauncher(cameraPermissionLauncher);
        webAppInterface.setAudioPermissionLauncher(audioPermissionLauncher);
        webAppInterface.setWebView(webView);
        webView.addJavascriptInterface(webAppInterface, "AndroidBridge");
        
        // 注册WebAppInterface到Application，供其他Service使用
        ApplicationModelShared app = (ApplicationModelShared) getApplication();
        app.setWebAppInterface(webAppInterface);
        
        // 设置WebViewClient
        webView.setWebViewClient(new MainWebViewClient());
        
        // 监听键盘弹出/隐藏
        setupKeyboardListener();
        
        Log.d(TAG, "WebView初始化完成");
    }
    
    /**
     * 设置键盘监听器
     * 通过ViewTreeObserver监听窗口大小变化来检测键盘弹出/隐藏
     */
    private void setupKeyboardListener() {
        View rootView = findViewById(android.R.id.content);
        if (rootView == null) {
            Log.w(TAG, "无法找到rootView，跳过键盘监听设置");
            return;
        }
        
        rootView.getViewTreeObserver().addOnGlobalLayoutListener(new ViewTreeObserver.OnGlobalLayoutListener() {
            @Override
            public void onGlobalLayout() {
                // 获取当前屏幕可见区域
                Rect rect = new Rect();
                rootView.getWindowVisibleDisplayFrame(rect);
                
                // 获取屏幕高度
                int screenHeight = rootView.getRootView().getHeight();
                
                // 计算键盘高度（屏幕高度 - 可见区域底部）
                int keyboardHeight = screenHeight - rect.bottom;
                
                // 键盘显示阈值：如果键盘高度超过屏幕高度的15%，认为键盘已显示
                int threshold = (int) (screenHeight * 0.15);
                
                if (keyboardHeight > threshold) {
                    // 键盘已显示
                    if (!isKeyboardVisible || previousKeyboardHeight != keyboardHeight) {
                        isKeyboardVisible = true;
                        previousKeyboardHeight = keyboardHeight;
                        dispatchKeyboardShowEvent(keyboardHeight);
                    }
                } else {
                    // 键盘已隐藏
                    if (isKeyboardVisible) {
                        isKeyboardVisible = false;
                        previousKeyboardHeight = 0;
                        dispatchKeyboardHideEvent();
                    }
                }
            }
        });
        
        Log.d(TAG, "键盘监听器设置完成");
    }
    
    /**
     * 触发键盘显示事件
     */
    private void dispatchKeyboardShowEvent(int keyboardHeight) {
        runOnUiThread(() -> {
            try {
                // 构造事件详情
                org.json.JSONObject detailObj = new org.json.JSONObject();
                detailObj.put("height", keyboardHeight);
                detailObj.put("duration", 300); // 动画持续时间（毫秒）
                
                String detailJson = detailObj.toString();
                
                // 构造JavaScript代码触发keyboard-show事件
                String jsCode = 
                    "javascript:(function() {" +
                    "  try {" +
                    "    var detailStr = '" + detailJson.replace("'", "\\'") + "';" +
                    "    var detail = JSON.parse(detailStr);" +
                    "    var event = new CustomEvent('keyboard-show', { detail: detail });" +
                    "    window.dispatchEvent(event);" +
                    "    console.log('⌨️ [Android键盘] 已触发键盘显示事件', detail);" +
                    "  } catch(e) {" +
                    "    console.error('⌨️ [Android键盘] 触发事件失败:', e);" +
                    "  }" +
                    "})()";
                
                webView.evaluateJavascript(jsCode, null);
                Log.d(TAG, "已触发keyboard-show事件，键盘高度: " + keyboardHeight);
            } catch (Exception e) {
                Log.e(TAG, "触发keyboard-show事件失败", e);
                e.printStackTrace();
            }
        });
    }
    
    /**
     * 触发键盘隐藏事件
     */
    private void dispatchKeyboardHideEvent() {
        runOnUiThread(() -> {
            try {
                // 构造事件详情
                org.json.JSONObject detailObj = new org.json.JSONObject();
                detailObj.put("duration", 300); // 动画持续时间（毫秒）
                
                String detailJson = detailObj.toString();
                
                // 构造JavaScript代码触发keyboard-hide事件
                String jsCode = 
                    "javascript:(function() {" +
                    "  try {" +
                    "    var detailStr = '" + detailJson.replace("'", "\\'") + "';" +
                    "    var detail = JSON.parse(detailStr);" +
                    "    var event = new CustomEvent('keyboard-hide', { detail: detail });" +
                    "    window.dispatchEvent(event);" +
                    "    console.log('⌨️ [Android键盘] 已触发键盘隐藏事件', detail);" +
                    "  } catch(e) {" +
                    "    console.error('⌨️ [Android键盘] 触发事件失败:', e);" +
                    "  }" +
                    "})()";
                
                webView.evaluateJavascript(jsCode, null);
                Log.d(TAG, "已触发keyboard-hide事件");
            } catch (Exception e) {
                Log.e(TAG, "触发keyboard-hide事件失败", e);
                e.printStackTrace();
            }
        });
    }

    /**
     * 初始化Activity Result Launchers
     */
    private void initActivityResultLaunchers() {
        // 图片选择器
        imagePickLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> {
                if (result.getResultCode() == RESULT_OK && result.getData() != null) {
                    android.net.Uri imageUri = result.getData().getData();
                    String resultJson = webAppInterface.handleImagePickResult(imageUri);
                    Log.d(TAG, "图片选择结果: " + resultJson);
                    
                    // 触发WebView事件，通知前端图片选择完成
                    dispatchImagePickResultToWebView(resultJson);
                }
            }
        );
        
        // 相机拍照
        imageCaptureLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> {
                boolean success = result.getResultCode() == RESULT_OK;
                String resultJson = webAppInterface.handleImageCaptureResult(success);
                Log.d(TAG, "拍照结果: " + resultJson);
                
                // 触发WebView事件，通知前端拍照完成
                dispatchImageCaptureResultToWebView(resultJson);
            }
        );
        
        // 相机权限请求
        cameraPermissionLauncher = registerForActivityResult(
            new ActivityResultContracts.RequestPermission(),
            granted -> {
                Log.d(TAG, "相机权限请求结果: " + granted);
                // 通知WebAppInterface权限请求结果
                if (webAppInterface != null) {
                    webAppInterface.onCameraPermissionResult(granted);
                }
            }
        );
        
        // 录音权限请求
        audioPermissionLauncher = registerForActivityResult(
            new ActivityResultContracts.RequestPermission(),
            granted -> {
                Log.d(TAG, "录音权限请求结果: " + granted);
                // 通知WebAppInterface权限请求结果
                if (webAppInterface != null) {
                    webAppInterface.onAudioPermissionResult(granted);
                }
            }
        );
        
        Log.d(TAG, "Activity Result Launchers初始化完成");
    }
    
    /**
     * 触发WebView事件 - 图片选择完成
     */
    private void dispatchImagePickResultToWebView(String resultJson) {
        runOnUiThread(() -> {
            try {
                // 解析JSON结果
                org.json.JSONObject jsonObj = new org.json.JSONObject(resultJson);
                boolean success = jsonObj.optBoolean("success", false);
                
                // 获取data字段（JSON对象）
                org.json.JSONObject dataObj = jsonObj.optJSONObject("data");
                
                // 构造完整的detail对象
                org.json.JSONObject detailObj = new org.json.JSONObject();
                detailObj.put("success", success);
                
                if (dataObj != null) {
                    // 将data对象的所有字段复制到detail对象
                    java.util.Iterator<String> keys = dataObj.keys();
                    while (keys.hasNext()) {
                        String key = keys.next();
                        detailObj.put(key, dataObj.get(key));
                    }
                }
                
                // 转换为JSON字符串（自动转义）
                String detailJson = detailObj.toString();
                
                // 构造JavaScript代码
                // 使用单引号包裹JSON字符串，避免双引号冲突
                String jsCode = 
                    "javascript:(function() {" +
                    "  try {" +
                    "    var detailStr = '" + detailJson.replace("'", "\\'") + "';" +
                    "    var detail = JSON.parse(detailStr);" +
                    "    var event = new CustomEvent('nativeImagePickResult', { detail: detail });" +
                    "    window.dispatchEvent(event);" +
                    "    console.log('📡 [Android] 触发 nativeImagePickResult 事件', detail);" +
                    "  } catch(e) {" +
                    "    console.error('📡 [Android] 触发事件失败:', e);" +
                    "  }" +
                    "})()";
                
                webView.evaluateJavascript(jsCode, null);
                Log.d(TAG, "已触发 nativeImagePickResult 事件");
            } catch (Exception e) {
                Log.e(TAG, "触发WebView事件失败", e);
                e.printStackTrace();
            }
        });
    }
    
    /**
     * 触发WebView事件 - 拍照完成
     */
    private void dispatchImageCaptureResultToWebView(String resultJson) {
        runOnUiThread(() -> {
            try {
                // 解析JSON结果
                org.json.JSONObject jsonObj = new org.json.JSONObject(resultJson);
                boolean success = jsonObj.optBoolean("success", false);
                
                // 获取data字段（JSON对象）
                org.json.JSONObject dataObj = jsonObj.optJSONObject("data");
                
                // 构造完整的detail对象
                org.json.JSONObject detailObj = new org.json.JSONObject();
                detailObj.put("success", success);
                
                if (dataObj != null) {
                    // 将data对象的所有字段复制到detail对象
                    java.util.Iterator<String> keys = dataObj.keys();
                    while (keys.hasNext()) {
                        String key = keys.next();
                        detailObj.put(key, dataObj.get(key));
                    }
                }
                
                // 转换为JSON字符串（自动转义）
                String detailJson = detailObj.toString();
                
                // 构造JavaScript代码
                // 使用单引号包裹JSON字符串，避免双引号冲突
                String jsCode = 
                    "javascript:(function() {" +
                    "  try {" +
                    "    var detailStr = '" + detailJson.replace("'", "\\'") + "';" +
                    "    var detail = JSON.parse(detailStr);" +
                    "    var event = new CustomEvent('nativeImageCaptureResult', { detail: detail });" +
                    "    window.dispatchEvent(event);" +
                    "    console.log('📡 [Android] 触发 nativeImageCaptureResult 事件', detail);" +
                    "  } catch(e) {" +
                    "    console.error('📡 [Android] 触发事件失败:', e);" +
                    "  }" +
                    "})()";
                
                webView.evaluateJavascript(jsCode, null);
                Log.d(TAG, "已触发 nativeImageCaptureResult 事件");
            } catch (Exception e) {
                Log.e(TAG, "触发WebView事件失败", e);
                e.printStackTrace();
            }
        });
    }

    /**
     * 加载Web应用
     */
    private void loadWebApp() {
        Log.d(TAG, "开始加载Web应用: " + webAppUrl);
        
        // 如果是远程URL，直接加载
        if (webAppUrl.startsWith("http://") || webAppUrl.startsWith("https://")) {
            Log.d(TAG, "加载远程URL: " + webAppUrl);
        } else {
            // 本地文件，使用webapp路径
            webAppUrl = "file:///android_asset/webapp/index.html";
            Log.d(TAG, "使用默认本地URL: " + webAppUrl);
        }
        
        webView.loadUrl(webAppUrl);
    }

    /**
     * 自定义WebViewClient
     */
    private class MainWebViewClient extends WebViewClient {
        
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            Log.d(TAG, "页面跳转: " + url);
            
            // 处理外部链接
            if (url.startsWith("http://") || url.startsWith("https://")) {
                // 可以在这里处理外部链接，比如在外部浏览器中打开
                Log.d(TAG, "外部链接，在当前WebView中加载: " + url);
                return false; // 在当前WebView中加载
            }
            
            // 处理其他协议
            if (url.startsWith("tel:") || url.startsWith("mailto:")) {
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, android.net.Uri.parse(url));
                    startActivity(intent);
                    return true;
                } catch (Exception e) {
                    Log.e(TAG, "处理协议链接失败: " + url, e);
                }
            }
            
            return false; // 在当前WebView中加载
        }
        
        @Override
        public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);
            Log.d(TAG, "页面加载完成: " + url);
            
            // 页面加载完成后，可以执行一些初始化JavaScript
            initWebApp();
        }
        
        @Override
        public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
            super.onReceivedError(view, errorCode, description, failingUrl);
            Log.e(TAG, "页面加载错误: " + errorCode + ", " + description + ", " + failingUrl);
            
            // 显示错误页面或提示
            showErrorPage(errorCode, description);
        }
    }

    /**
     * 初始化Web应用
     * 页面加载完成后执行
     */
    private void initWebApp() {
        Log.d(TAG, "开始初始化Web应用");
        
        // 设置Web应用配置
        try {
            org.json.JSONObject config = new org.json.JSONObject();
            config.put("theme", "light");
            config.put("language", "zh-CN");
            config.put("debug", false); // 可以根据需要调整
            
            // 通过JavaScript设置配置
            String jsCode = String.format(
                "if (window.AndroidBridge && window.AndroidBridge.setConfig) {" +
                "  window.AndroidBridge.setConfig(%s);" +
                "}", config.toString()
            );
            
            webView.evaluateJavascript(jsCode, null);
            
            Log.d(TAG, "Web应用配置设置完成");
            
        } catch (Exception e) {
            Log.e(TAG, "设置Web应用配置失败", e);
        }
        
        // 检查Web应用是否就绪
        checkWebAppReady();
    }

    /**
     * 检查Web应用是否就绪
     */
    private void checkWebAppReady() {
        String jsCode = 
            "if (typeof window !== 'undefined' && window.Vue && window.Vue.version) {" +
            "  'ready';" +
            "} else {" +
            "  'not_ready';" +
            "}";
        
        webView.evaluateJavascript(jsCode, result -> {
            if ("ready".equals(result)) {
                Log.d(TAG, "Web应用已就绪");
                onWebAppReady();
            } else {
                Log.w(TAG, "Web应用未就绪，稍后重试");
                retryInitWebApp();
            }
        });
    }

    /**
     * Web应用就绪后的处理
     */
    private void onWebAppReady() {
        Log.d(TAG, "Web应用就绪，执行后续初始化");
        
        // 自动初始化MessagingManager（类似FloatingRobotService的做法）
        // 这样Vue在应用启动时就可以使用，不需要等到用户进入聊天页面
        initMessagingManagerOnStartup();
        
        // 启动系统级悬浮FAB按钮服务（在Web应用就绪后启动，确保功能完全准备好）
        startFloatingFabServiceWhenReady();
        
        // 启动浮动机器人服务（在Web应用就绪后启动，确保功能完全准备好）
        startFloatingRobotServiceWhenReady();
        
        // 如果有悬浮FAB按钮的action参数，触发CustomEvent
        if (floatingFabAction != null && !floatingFabAction.isEmpty()) {
            // 延迟触发，确保Vue完全初始化
            webView.postDelayed(() -> {
                dispatchFloatingFabActionEvent(floatingFabAction);
                // 清除action，避免重复触发
                floatingFabAction = null;
            }, 500);
        }
    }
    
    /**
     * 在Web应用就绪后启动悬浮FAB按钮服务
     * 确保Web应用和Vue完全初始化后再启动，避免点击功能时功能未准备好
     */
    private void startFloatingFabServiceWhenReady() {
        ApplicationModelShared app = (ApplicationModelShared) getApplication();
        app.startFloatingFabService();
        Log.d(TAG, "已尝试启动悬浮FAB按钮服务（Web应用就绪后）");
    }
    
    /**
     * 在Web应用就绪后启动浮动机器人服务
     * 确保Web应用和Vue完全初始化后再启动，避免点击功能时功能未准备好
     */
    private void startFloatingRobotServiceWhenReady() {
        try {
            Intent intent = new Intent(this, FloatingRobotService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(intent);
            } else {
                startService(intent);
            }
            Log.d(TAG, "已尝试启动浮动机器人服务（Web应用就绪后）");
        } catch (Exception e) {
            Log.e(TAG, "启动浮动机器人服务失败", e);
        }
    }
    
    /**
     * 触发悬浮FAB按钮action事件到WebView
     */
    private void dispatchFloatingFabActionEvent(String action) {
        runOnUiThread(() -> {
            try {
                // 构造事件详情
                org.json.JSONObject detailObj = new org.json.JSONObject();
                detailObj.put("action", action);
                
                String detailJson = detailObj.toString();
                Log.d(TAG, "准备触发 floating-fab-action 事件，detail: " + detailJson);
                
                // 使用单引号包裹JSON字符串，避免双引号冲突
                String jsCode = 
                    "javascript:(function() {" +
                    "  try {" +
                    "    var detailStr = '" + detailJson.replace("'", "\\'") + "';" +
                    "    var detail = JSON.parse(detailStr);" +
                    "    var event = new CustomEvent('floating-fab-action', { detail: detail });" +
                    "    window.dispatchEvent(event);" +
                    "    console.log('📡 [Android] 触发 floating-fab-action 事件', detail);" +
                    "  } catch(e) {" +
                    "    console.error('📡 [Android] 触发事件失败:', e);" +
                    "  }" +
                    "})()";
                
                webView.evaluateJavascript(jsCode, null);
                Log.d(TAG, "已触发 floating-fab-action 事件");
            } catch (Exception e) {
                Log.e(TAG, "触发WebView事件失败", e);
                e.printStackTrace();
            }
        });
    }
    
    /**
     * 在应用启动时初始化MessagingManager
     * 这样Vue端可以立即使用，不需要等待用户进入聊天页面
     */
    private void initMessagingManagerOnStartup() {
        try {
            String userId = AppUtils.getUserId();
            if (userId == null || userId.isEmpty()) {
                Log.w(TAG, "initMessagingManagerOnStartup: 用户未登录，跳过初始化");
                return;
            }
            
            Log.d(TAG, "initMessagingManagerOnStartup: 开始预初始化MessagingManager, userId=" + userId);
            
            // 通过WebAppInterface初始化（这样可以自动设置消息监听器）
            if (webAppInterface != null) {
                String result = webAppInterface.initTeacherMessageListener();
                Log.d(TAG, "initMessagingManagerOnStartup: 初始化结果=" + result);
            } else {
                Log.w(TAG, "initMessagingManagerOnStartup: webAppInterface未初始化，跳过");
            }
        } catch (Exception e) {
            Log.e(TAG, "initMessagingManagerOnStartup: 初始化失败", e);
        }
    }

    /**
     * 重试初始化Web应用
     */
    private void retryInitWebApp() {
        webView.postDelayed(() -> {
            Log.d(TAG, "重试初始化Web应用");
            checkWebAppReady();
        }, 1000); // 1秒后重试
    }

    /**
     * 显示错误页面
     */
    private void showErrorPage(int errorCode, String description) {
        String errorHtml = String.format(
            "<html><body style='text-align:center;padding:50px;font-family:Arial;'>" +
            "<h2>页面加载失败</h2>" +
            "<p>错误代码: %d</p>" +
            "<p>错误描述: %s</p>" +
            "<button onclick='window.location.reload()' style='padding:10px 20px;font-size:16px;'>重新加载</button>" +
            "</body></html>",
            errorCode, description
        );
        
        webView.loadDataWithBaseURL(null, errorHtml, "text/html", "UTF-8", null);
    }

    // ========== WebAppInterface.ExerciseSolveActivityBridge 实现 ==========

    @Override
    public void startPhotoSearch(String subject) {
        Log.d(TAG, "启动拍照搜题: " + subject);
        // 这里可以实现拍照搜题功能
        Toast.makeText(this, "拍照搜题功能: " + subject, Toast.LENGTH_SHORT).show();
    }

    @Override
    public void setTeacherMessageCallback(String callbackName) {
        Log.d(TAG, "设置老师消息回调: " + callbackName);
        // 设置老师消息回调
    }

    @Override
    public void onTeacherMessageReceived(String messageData) {
        Log.d(TAG, "收到老师消息: " + messageData);
        // 处理老师消息
    }

    // ========== 生命周期管理 ==========

    @Override
    protected void onResume() {
        super.onResume();
        WindowUtils.hideSystemUI(this);
        if (webView != null) {
            webView.onResume();
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (webView != null) {
            webView.onPause();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        // 清理更新检查定时器
        mCheckUpdateHandler.removeCallbacksAndMessages(null);
        if (webView != null) {
            webView.destroy();
        }
        Log.d(TAG, "MainWebViewActivity onDestroy 完成");
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        WindowUtils.hideSystemUI(this);
    }
}
