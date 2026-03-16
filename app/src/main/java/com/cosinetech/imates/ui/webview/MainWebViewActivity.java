package com.cosinetech.imates.ui.webview;

import android.content.Context;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Rect;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.view.ViewTreeObserver;
import android.view.WindowManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.ImageCapture;
import androidx.camera.core.ImageCaptureException;
import androidx.camera.core.Preview;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.view.PreviewView;
import androidx.core.content.ContextCompat;

import com.google.common.util.concurrent.ListenableFuture;

import com.cosinetech.imates.ApplicationModelShared;
import com.cosinetech.imates.R;
import com.cosinetech.imates.screenshot.MediaProjectionForegroundService;
import com.cosinetech.imates.ui.webview.common.WebAppInterface;
import com.cosinetech.imates.ui.webview.common.WebViewConfig;
import com.cosinetech.imates.utils.AppUtils;
import com.cosinetech.imates.utils.WindowUtils;
import com.xuexiang.xupdate.easy.EasyUpdate;
import android.os.Build;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

/**
 *
 * @author Cosinetech
 * @since 1.0.0
 */
public class MainWebViewActivity extends AppCompatActivity
        implements WebAppInterface.ExerciseSolveActivityBridge, WebAppInterface.WebAppReadyCallback {

    /** 日志标签 */
    private static final String TAG = "MainWebViewActivity";
    private static final String SCHOOL_ID = "jinshanyuanyang"; //可以是 jingkaierzhong / jinshanyuanyang

    private static final boolean IS_INTERNAL_TEST = false;

    // ========== WebView 相关 ==========

    /** WebView 实例，用于加载和显示 Web 应用 */
    private WebView webView;

    /** Web 应用接口，提供 JavaScript 与 Android 原生功能的桥接 */
    private WebAppInterface webAppInterface;

    // ========== Activity Result Launchers ==========

    /** 图片选择器启动器，用于从相册选择图片 */
    private ActivityResultLauncher<Intent> imagePickLauncher;

    /** 相机拍照启动器，用于启动系统相机进行拍照 */
    private ActivityResultLauncher<Intent> imageCaptureLauncher;

    /** 相机权限请求启动器，用于请求相机权限 */
    private ActivityResultLauncher<String> cameraPermissionLauncher;

    /** 录音权限请求启动器，用于请求录音权限 */
    private ActivityResultLauncher<String> audioPermissionLauncher;

    /** MediaProjection 权限请求启动器，用于请求屏幕录制权限 */
    private ActivityResultLauncher<Intent> mediaProjectionLauncher;

    // ========== 相机相关 ==========

    /** 相机预览视图，用于显示相机实时预览画面 */
    private PreviewView cameraPreviewView;

    /** 图片捕获器，用于拍照功能 */
    private ImageCapture imageCapture;

    /** 相机提供者，用于管理相机生命周期 */
    private ProcessCameraProvider cameraProvider;

    /** 相机执行器，用于在后台线程执行相机操作 */
    private final java.util.concurrent.Executor cameraExecutor = java.util.concurrent.Executors
            .newSingleThreadExecutor();

    /** 相机是否已激活的标志 */
    private boolean isCameraActive = false;

    /** 是否有待启动的相机请求（权限授予后启动） */
    private boolean pendingCameraStart = false;

    // ========== 页面 URL 配置 ==========

    /** Web 应用 URL，默认为本地 assets 中的 index.html */
    private String webAppUrl = "file:///android_asset/webapp/index.html";

    // ========== 悬浮 FAB 按钮相关 ==========

    /** 悬浮 FAB 按钮的 action 参数，用于触发特定的 Web 端操作 */
    private String floatingFabAction = null;

    // ========== 键盘检测相关 ==========

    /** 上一次检测到的键盘高度（像素） */
    private int previousKeyboardHeight = 0;

    /** 键盘是否可见的标志 */
    private boolean isKeyboardVisible = false;

    // ========== 更新检查相关 ==========

    /** 更新检查的 Handler，用于定时执行更新检查 */
    private final Handler mCheckUpdateHandler = new Handler(Looper.getMainLooper());

    private volatile boolean mForceUpdateRequired = false;

    /**
     * 更新检查的 Runnable，每 10 秒执行一次检查
     * 每次检查都会发送HTTP请求，如果服务器返回的版本号比当前版本新，则执行更新
     */
    private final Runnable mCheckUpdateRunnable = new Runnable() {
        @Override
        public void run() {
            String updateUrl = getUpdateUrl();

            // 每次检查都发送HTTP请求，判断是否需要更新
            checkUpdateWithHttpRequest(updateUrl);

            // 每10秒执行一次检查
            mCheckUpdateHandler.postDelayed(this, 10 * 1000);
        }
    };

    private String getUpdateUrl() {
        if (IS_INTERNAL_TEST) {
            return "https://www.imates.com.cn/appupdate_test.json";
        }

        if ("jingkaierzhong".equals(SCHOOL_ID)) {
            return "https://www.imates.com.cn/jinkai/appupdate.json";
        } else if ("jinshanyuanyang".equals(SCHOOL_ID)) {
            return "https://www.imates.com.cn/bj101/appupdate-primary.json";
        } else {
            return "https://www.imates.com.cn/bj101/appupdate-primary.json";
        }
    }

    /**
     * 启动 MainWebViewActivity 的静态方法
     * <p>
     * 提供便捷的方式启动主 WebView Activity，支持自定义 URL 参数。
     * </p>
     *
     * @param context 上下文对象，用于启动 Activity
     * @param url     可选的自定义 URL，如果为 null 或空字符串，则使用默认的本地 assets URL
     */
    public static void startActivity(Context context, String url) {
        Intent intent = new Intent(context, MainWebViewActivity.class);
        if (url != null) {
            intent.putExtra("web_app_url", url);
        }
        context.startActivity(intent);
    }

    /**
     * Activity 创建时的初始化方法
     * <p>
     * 执行顺序：
     * <ol>
     *   <li>强制横屏显示</li>
     *   <li>设置全屏模式（必须在 setContentView 之前调用）</li>
     *   <li>确保窗口占据整个屏幕（Android 7.0+，防止悬浮窗模式）</li>
     *   <li>设置布局文件</li>
     *   <li>隐藏系统 UI（必须在 setContentView 之后调用才能生效）</li>
     *   <li>初始化 Activity Result Launchers</li>
     *   <li>初始化 WebView</li>
     *   <li>加载 Web 应用</li>
     *   <li>初始化更新检查</li>
     * </ol>
     * </p>
     *
     * @param savedInstanceState 保存的实例状态
     */
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 第1步：强制横屏
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE);

        // 第2步：设置全屏模式（必须在 setContentView 之前调用）
        WindowUtils.setFullScreenMode(this);

        // 第3步：确保窗口占据整个屏幕（防止悬浮窗模式）
        // 在 Android 7.0+ 系统上，确保窗口以全屏模式启动
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            getWindow().setLayout(WindowManager.LayoutParams.MATCH_PARENT,
                    WindowManager.LayoutParams.MATCH_PARENT);
        }

        // 第4步：设置布局
        setContentView(R.layout.activity_main_webview);

        // 第5步：隐藏系统 UI（必须在 setContentView 之后调用才能生效）
        WindowUtils.hideSystemUI(this);

        Log.d(TAG, "MainWebViewActivity onCreate 开始");

        // 获取传入的自定义 URL 参数（如果存在）
        String customUrl = getIntent().getStringExtra("web_app_url");
        if (customUrl != null && !customUrl.isEmpty()) {
            webAppUrl = customUrl;
        }

        // 获取悬浮 FAB 按钮的 action 参数（如果存在）
        floatingFabAction = getIntent().getStringExtra("floating_fab_action");
        if (floatingFabAction != null) {
            Log.d(TAG, "收到悬浮 FAB 按钮 action: " + floatingFabAction);
        }

        Log.d(TAG, "加载 URL: " + webAppUrl);

        // 第1步：先初始化 Activity Result Launchers（必须在 initWebView 之前）
        initActivityResultLaunchers();

        // 第2步：初始化 WebView（需要使用已初始化的 launchers）
        initWebView();

        // 第3步：加载 Web 应用页面
        loadWebApp();

        // 第4步：初始化应用更新检查机制
        initUpdateCheck();

        Log.d(TAG, "MainWebViewActivity onCreate 完成");
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);

        try {
            String action = intent != null ? intent.getStringExtra("floating_fab_action") : null;
            if (action != null && !action.isEmpty()) {
                Log.d(TAG, "onNewIntent 收到悬浮 FAB action: " + action);
                floatingFabAction = action;

                // 如果 WebAppInterface 已就绪，直接派发到 Web；否则等 onWebAppReady 再触发
                ApplicationModelShared app = (ApplicationModelShared) getApplication();
                WebAppInterface w = app != null ? app.getWebAppInterface() : null;
                if (w != null) {
                    w.dispatchFloatingFabActionEventToWeb(action);
                    floatingFabAction = null;
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "onNewIntent handle floating_fab_action failed", e);
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        
        // 处理 MediaProjection 权限请求结果
        if (requestCode == 1001) {
            Log.d(TAG, "MediaProjection 权限请求结果: " + resultCode);
            if (resultCode == RESULT_OK && data != null) {
                try {
                    Intent svc = new Intent(this, MediaProjectionForegroundService.class);
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                        startForegroundService(svc);
                    } else {
                        startService(svc);
                    }
                } catch (Exception e) {
                    Log.e(TAG, "启动 MediaProjection 前台服务失败", e);
                }

                final Intent resultData = data;
                final Handler handler = new Handler(Looper.getMainLooper());
                final int[] retries = new int[] { 0 };

                Runnable tryGetProjection = new Runnable() {
                    @Override
                    public void run() {
                        try {
                            MediaProjectionManager mediaProjectionManager =
                                    (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
                            if (mediaProjectionManager == null) {
                                Log.e(TAG, "MediaProjectionManager 不可用");
                                return;
                            }

                            MediaProjection mediaProjection = mediaProjectionManager.getMediaProjection(resultCode, resultData);
                            if (webAppInterface != null) {
                                webAppInterface.setMediaProjection(mediaProjection);
                                webAppInterface.executeJavaScript(
                                        "try{if(window.onMediaProjectionPermissionResult){window.onMediaProjectionPermissionResult(true);}}catch(e){}"
                                );
                            }
                            Log.d(TAG, "MediaProjection 权限已授权");
                        } catch (SecurityException se) {
                            retries[0]++;
                            if (retries[0] <= 3) {
                                Log.w(TAG, "getMediaProjection 触发 SecurityException，重试次数=" + retries[0], se);
                                handler.postDelayed(this, 500);
                            } else {
                                Log.e(TAG, "getMediaProjection 重试失败", se);
                            }
                        } catch (Exception e) {
                            Log.e(TAG, "getMediaProjection 失败", e);
                        }
                    }
                };

                handler.postDelayed(tryGetProjection, 300);
            } else {
                Log.w(TAG, "MediaProjection 权限被拒绝");
                try {
                    if (webAppInterface != null) {
                        webAppInterface.executeJavaScript(
                                "try{if(window.onMediaProjectionPermissionResult){window.onMediaProjectionPermissionResult(false);}}catch(e){}"
                        );
                    }
                } catch (Exception e) {
                    Log.w(TAG, "回传 MediaProjection 授权结果到 Web 失败", e);
                }
            }
        }
    }

    /**
     * 初始化应用更新检查机制
     * <p>
     * 启动后10秒执行首次更新检查，然后每60秒检查一次。
     * 每次检查都会发送HTTP请求，如果服务器返回的版本号比当前版本新，则执行更新。
     * </p>
     */
    private void initUpdateCheck() {
        // 启动后10秒执行首次更新检查
        mCheckUpdateHandler.postDelayed(mCheckUpdateRunnable, 0);
    }

    /**
     * 手动发送HTTP请求检查更新并打印响应信息
     * EasyUpdate内部会自动比较版本号，如果需要更新则执行更新
     * 
     * @param updateUrl 更新检查的URL
     */
    private void checkUpdateWithHttpRequest(String updateUrl) {
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
                    
                    // 解析响应JSON，提取版本号
                    if (statusCode == 200 && responseBody != null && !responseBody.isEmpty()) {
                        try {
                            org.json.JSONObject jsonObj = new org.json.JSONObject(responseBody);
                            String serverVersion = jsonObj.optString("VersionName", "");
                            int updateStatus = jsonObj.optInt("UpdateStatus", 0);
                            mForceUpdateRequired = updateStatus == 2;
                            if (!serverVersion.isEmpty()) {
                                Log.d(TAG, "服务器版本: " + serverVersion);

                                // 直接调用 EasyUpdate.update()，内部会自动比较版本号并决定是否更新
                                runOnUiThread(() -> {
                                    EasyUpdate.create(MainWebViewActivity.this, updateUrl)
                                            .isAutoMode(false)
                                            .update();
                                });
                            }
                        } catch (org.json.JSONException e) {
                            Log.e(TAG, "解析更新响应JSON失败", e);
                        }
                    }
                } catch (Exception e) {
                    Log.e(TAG, "处理更新响应失败", e);
                } finally {
                    if (response.body() != null) {
                        response.body().close();
                    }
                }
            }
        });
    }

    /**
     * 初始化 WebView 及相关组件
     * <p>
     * 执行以下操作：
     * <ul>
     *   <li>启用 WebView 调试（Android 4.4+）</li>
     *   <li>使用统一的 WebView 配置（WebViewConfig）</li>
     *   <li>设置透明背景和硬件加速</li>
     *   <li>禁用长按菜单和触觉反馈</li>
     *   <li>隐藏滚动条</li>
     *   <li>初始化相机预览视图</li>
     *   <li>创建并配置 WebAppInterface</li>
     *   <li>注册 WebAppInterface 到 Application</li>
     *   <li>设置 WebViewClient</li>
     *   <li>设置键盘监听器</li>
     * </ul>
     * </p>
     */
    private void initWebView() {
        webView = findViewById(R.id.main_webview);

        // 启用 WebView 调试（Android 4.4+ 支持）
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.KITKAT) {
            WebView.setWebContentsDebuggingEnabled(true);
            Log.d(TAG, "WebView 调试已启用");
        }

        // 使用统一的 WebView 配置
        WebViewConfig.configureWebView(webView, this);

        // 配置 WebView 为透明背景，让底层相机预览可见
        webView.setBackgroundColor(Color.TRANSPARENT);
        // 启用硬件加速，提升渲染性能
        webView.setLayerType(WebView.LAYER_TYPE_HARDWARE, null);

        // 滚动条设置（全屏应用不需要显示滚动条）
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);

        // 初始化相机预览视图
        cameraPreviewView = findViewById(R.id.camera_previewer);
        if (cameraPreviewView == null) {
            Log.e(TAG, "⚠️ 警告：无法找到相机预览视图 camera_previewer");
        } else {
            Log.d(TAG, "✅ 相机预览视图初始化成功");
            // 设置 PreviewView 为 COMPATIBLE 模式（使用 TextureView），确保预览可以显示在 WebView 下方
            cameraPreviewView.setImplementationMode(PreviewView.ImplementationMode.COMPATIBLE);
            Log.d(TAG, "✅ PreviewView 已设置为 COMPATIBLE 模式");
        }

        // 创建并配置 WebAppInterface（JavaScript 与 Android 原生功能的桥接）
        webAppInterface = new WebAppInterface(this);
        webAppInterface.setExerciseBridge(this);
        webAppInterface.setWebAppReadyCallback(this);
        webAppInterface.setImageLaunchers(imagePickLauncher, imageCaptureLauncher);
        webAppInterface.setCameraPermissionLauncher(cameraPermissionLauncher);
        webAppInterface.setAudioPermissionLauncher(audioPermissionLauncher);
        webAppInterface.setWebView(webView);
        // 将 WebAppInterface 注册为 JavaScript 接口，Web 端可通过 window.AndroidBridge 调用
        webView.addJavascriptInterface(webAppInterface, "AndroidBridge");

        // 注册 WebAppInterface 到 Application，供其他 Service 使用
        ApplicationModelShared app = (ApplicationModelShared) getApplication();
        app.setWebAppInterface(webAppInterface);

        // 设置自定义 WebViewClient，处理页面加载和 URL 跳转
        webView.setWebViewClient(new MainWebViewClient());

        // 设置键盘监听器，监听键盘弹出/隐藏事件
        setupKeyboardListener();

        Log.d(TAG, "WebView初始化完成");
    }

    /**
     * 设置键盘监听器
     * <p>
     * 通过 ViewTreeObserver 监听窗口大小变化来检测键盘的弹出和隐藏。
     * 当键盘高度超过屏幕高度的 15% 时，认为键盘已显示。
     * 检测到键盘状态变化时，会通过 CustomEvent 通知 Web 端。
     * </p>
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
     * 触发键盘显示事件到 Web 端
     * <p>
     * 通过 JavaScript 代码在 Web 端触发 'keyboard-show' CustomEvent，
     * 事件详情包含键盘高度和动画持续时间。
     * </p>
     *
     * @param keyboardHeight 键盘高度（像素）
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
                String jsCode = "javascript:(function() {" +
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
     * 触发键盘隐藏事件到 Web 端
     * <p>
     * 通过 JavaScript 代码在 Web 端触发 'keyboard-hide' CustomEvent，
     * 事件详情包含动画持续时间。
     * </p>
     */
    private void dispatchKeyboardHideEvent() {
        runOnUiThread(() -> {
            try {
                // 构造事件详情
                org.json.JSONObject detailObj = new org.json.JSONObject();
                detailObj.put("duration", 300); // 动画持续时间（毫秒）

                String detailJson = detailObj.toString();

                // 构造JavaScript代码触发keyboard-hide事件
                String jsCode = "javascript:(function() {" +
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
     * 初始化 Activity Result Launchers
     * <p>
     * 注册以下启动器：
     * <ul>
     *   <li>图片选择器启动器：从相册选择图片</li>
     *   <li>相机拍照启动器：启动系统相机进行拍照</li>
     *   <li>相机权限请求启动器：请求相机权限，权限授予后自动启动相机预览</li>
     *   <li>录音权限请求启动器：请求录音权限</li>
     * </ul>
     * </p>
     * <p>
     * 注意：此方法必须在 initWebView() 之前调用，因为 WebAppInterface 需要使用这些启动器。
     * </p>
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
                });

        // 相机拍照
        imageCaptureLauncher = registerForActivityResult(
                new ActivityResultContracts.StartActivityForResult(),
                result -> {
                    boolean success = result.getResultCode() == RESULT_OK;
                    String resultJson = webAppInterface.handleImageCaptureResult(success);
                    Log.d(TAG, "拍照结果: " + resultJson);

                    // 触发WebView事件，通知前端拍照完成
                    dispatchImageCaptureResultToWebView(resultJson);
                });

        // 相机权限请求
        cameraPermissionLauncher = registerForActivityResult(
                new ActivityResultContracts.RequestPermission(),
                granted -> {
                    Log.d(TAG, "相机权限请求结果: " + granted);
                    // 通知WebAppInterface权限请求结果
                    if (webAppInterface != null) {
                        webAppInterface.onCameraPermissionResult(granted);
                    }
                    // 如果权限授予，且相机预览已请求启动，则启动相机
                    if (granted && pendingCameraStart) {
                        startCameraPreview();
                        pendingCameraStart = false;
                    }
                });

        // 录音权限请求
        audioPermissionLauncher = registerForActivityResult(
                new ActivityResultContracts.RequestPermission(),
                granted -> {
                    Log.d(TAG, "录音权限请求结果: " + granted);
                    // 通知WebAppInterface权限请求结果
                    if (webAppInterface != null) {
                        webAppInterface.onAudioPermissionResult(granted);
                    }
                });

        // MediaProjection 权限请求
        mediaProjectionLauncher = registerForActivityResult(
                new ActivityResultContracts.StartActivityForResult(),
                result -> {
                    Log.d(TAG, "MediaProjection 权限请求结果: " + result.getResultCode());
                    if (result.getResultCode() == RESULT_OK && result.getData() != null) {
                        // 获取 MediaProjectionManager
                        MediaProjectionManager mediaProjectionManager = 
                            (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
                        
                        // 获取 MediaProjection
                        MediaProjection mediaProjection = mediaProjectionManager
                            .getMediaProjection(result.getResultCode(), result.getData());
                        
                        // 设置到 WebAppInterface
                        if (webAppInterface != null) {
                            webAppInterface.setMediaProjection(mediaProjection);
                        }
                        
                        Log.d(TAG, "MediaProjection 权限已授权");
                    } else {
                        Log.w(TAG, "MediaProjection 权限被拒绝");
                    }
                });

        Log.d(TAG, "Activity Result Launchers初始化完成");
    }

    /**
     * 触发 WebView 事件 - 图片选择完成
     * <p>
     * 将图片选择的结果通过 CustomEvent 'nativeImagePickResult' 通知 Web 端。
     * 事件详情包含选择是否成功以及图片的相关信息（URI、路径等）。
     * </p>
     *
     * @param resultJson 图片选择结果的 JSON 字符串
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
                String jsCode = "javascript:(function() {" +
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
     * 触发 WebView 事件 - 拍照完成
     * <p>
     * 将拍照的结果通过 CustomEvent 'nativeImageCaptureResult' 通知 Web 端。
     * 事件详情包含拍照是否成功以及图片的相关信息（URI、路径等）。
     * </p>
     *
     * @param resultJson 拍照结果的 JSON 字符串
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
                String jsCode = "javascript:(function() {" +
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
     * 加载 Web 应用
     * <p>
     * 根据 webAppUrl 加载 Web 应用：
     * <ul>
     *   <li>如果是远程 URL（http:// 或 https://），直接加载</li>
     *   <li>如果是本地文件，使用默认的本地 assets URL</li>
     * </ul>
     * </p>
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
     * 自定义 WebViewClient
     * <p>
     * 处理 WebView 的页面加载、URL 跳转、错误处理等事件。
     * </p>
     */
    private class MainWebViewClient extends WebViewClient {

        /**
         * 处理 URL 加载请求
         * <p>
         * 决定是否在当前 WebView 中加载 URL，还是使用外部应用处理。
         * </p>
         *
         * @param view WebView 实例
         * @param url  要加载的 URL
         * @return true 表示已处理，false 表示在当前 WebView 中加载
         */
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            Log.d(TAG, "页面跳转: " + url);

            // 处理外部链接（http/https）：在当前 WebView 中加载
            if (url.startsWith("http://") || url.startsWith("https://")) {
                Log.d(TAG, "外部链接，在当前 WebView 中加载: " + url);
                return false; // 在当前 WebView 中加载
            }

            // 处理其他协议（tel/mailto）：使用外部应用处理
            if (url.startsWith("tel:") || url.startsWith("mailto:")) {
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, android.net.Uri.parse(url));
                    startActivity(intent);
                    return true; // 已由外部应用处理
                } catch (Exception e) {
                    Log.e(TAG, "处理协议链接失败: " + url, e);
                }
            }

            return false; // 在当前 WebView 中加载
        }

        /**
         * 页面加载完成回调
         * <p>
         * 当 WebView 完成页面加载后调用，此时可以安全地执行 JavaScript 代码。
         * </p>
         *
         * @param view WebView 实例
         * @param url  加载完成的页面 URL
         */
        @Override
        public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);
            Log.d(TAG, "页面加载完成: " + url);

            // 页面加载完成后，执行 Web 应用初始化
            initWebApp();
        }

        /**
         * 页面加载错误回调
         * <p>
         * 当 WebView 加载页面出错时调用，显示错误页面给用户。
         * </p>
         *
         * @param view        WebView 实例
         * @param errorCode   错误代码
         * @param description 错误描述
         * @param failingUrl  失败的 URL
         */
        @Override
        public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
            super.onReceivedError(view, errorCode, description, failingUrl);
            Log.e(TAG, "页面加载错误: " + errorCode + ", " + description + ", " + failingUrl);

            // 显示错误页面
            showErrorPage(errorCode, description);
        }
    }

    /**
     * 初始化 Web 应用
     * <p>
     * 页面加载完成后执行。不再主动检查 Web 应用是否就绪，
     * 而是等待 Web 端通过 notifyWebAppReady() 主动通知就绪状态。
     * </p>
     */
    private void initWebApp() {
        Log.d(TAG, "开始初始化 Web 应用");
        // 不再主动检查 Web 应用是否就绪，等待 Web 端主动通知
        Log.d(TAG, "等待 Web 应用主动通知就绪状态");
    }

    /**
     * Web 应用就绪回调实现
     * <p>
     * 由 Web 端通过 notifyWebAppReady() 主动调用，表示 Vue 应用已完全初始化。
     * 此时可以安全地执行以下操作：
     * <ul>
     *   <li>初始化 MessagingManager（消息管理器）</li>
     *   <li>启动悬浮 FAB 按钮服务</li>
     *   <li>启动浮动机器人服务</li>
     *   <li>触发悬浮 FAB 按钮的 action 事件（如果有）</li>
     * </ul>
     * </p>
     */
    @Override
    public void onWebAppReady() {
        Log.d(TAG, "Web应用就绪，执行后续初始化");

        // 自动初始化MessagingManager（类似FloatingRobotService的做法）
        // 这样Vue在应用启动时就可以使用，不需要等到用户进入聊天页面
        initMessagingManagerOnStartup();

        // 启动系统级悬浮FAB按钮服务（在Web应用就绪后启动，确保功能完全准备好）
        startFloatingFabServiceWhenReady();

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
     * 在 Web 应用就绪后启动悬浮 FAB 按钮服务
     * <p>
     * 确保 Web 应用和 Vue 完全初始化后再启动服务，
     * 避免用户点击悬浮按钮时功能未准备好。
     * </p>
     */
    private void startFloatingFabServiceWhenReady() {
        ApplicationModelShared app = (ApplicationModelShared) getApplication();
        app.startFloatingFabService();
        Log.d(TAG, "已尝试启动悬浮FAB按钮服务（Web应用就绪后）");
    }


    /**
     * 触发悬浮 FAB 按钮 action 事件到 WebView
     * <p>
     * 通过 JavaScript 代码在 Web 端触发 'floating-fab-action' CustomEvent，
     * 事件详情包含 action 参数，用于触发特定的 Web 端操作。
     * </p>
     *
     * @param action 要触发的 action 名称
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
                String jsCode = "javascript:(function() {" +
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
     * 触发应用版本号事件到 WebView
     * <p>
     * 通过 JavaScript 代码在 Web 端触发 'app-version' CustomEvent，
     * 事件详情包含版本号信息。
     * </p>
     *
     * @param versionName 版本号名称（如 "1.0.18"）
     */
    private void dispatchAppVersionEvent(String versionName) {
        runOnUiThread(() -> {
            try {
                // 构造事件详情
                org.json.JSONObject detailObj = new org.json.JSONObject();
                detailObj.put("versionName", versionName);

                String detailJson = detailObj.toString();
                Log.d(TAG, "准备触发 app-version 事件，versionName: " + versionName
                        + ", detailJson: " + detailJson);

                // 构造JavaScript代码触发app-version事件
                String jsCode = "javascript:(function() {" +
                        "  try {" +
                        "    var detailStr = '" + detailJson.replace("'", "\\'") + "';" +
                        "    var detail = JSON.parse(detailStr);" +
                        "    var event = new CustomEvent('app-version', { detail: detail });" +
                        "    window.dispatchEvent(event);" +
                        "    console.log('📡 [Android] 触发 app-version 事件', detail);" +
                        "  } catch(e) {" +
                        "    console.error('📡 [Android] 触发事件失败:', e);" +
                        "  }" +
                        "})()";

                webView.evaluateJavascript(jsCode, null);
                Log.d(TAG, "已触发 app-version 事件");
            } catch (Exception e) {
                Log.e(TAG, "触发WebView事件失败", e);
                e.printStackTrace();
            }
        });
    }

    /**
     * 在应用启动时初始化 MessagingManager
     * <p>
     * 在 Web 应用就绪后立即初始化消息管理器，这样 Vue 端可以立即使用消息功能，
     * 不需要等待用户进入聊天页面。如果用户未登录，则跳过初始化。
     * </p>
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
     * 显示错误页面
     * <p>
     * 当 WebView 加载页面出错时，显示一个友好的错误页面，
     * 包含错误代码、错误描述和一个重新加载按钮。
     * </p>
     *
     * @param errorCode   错误代码
     * @param description 错误描述
     */
    private void showErrorPage(int errorCode, String description) {
        String errorHtml = String.format(
                "<html><body style='text-align:center;padding:50px;font-family:Arial;'>" +
                        "<h2>页面加载失败</h2>" +
                        "<p>错误代码: %d</p>" +
                        "<p>错误描述: %s</p>" +
                        "<button onclick='window.location.reload()' style='padding:10px 20px;font-size:16px;'>重新加载</button>"
                        +
                        "</body></html>",
                errorCode, description);

        webView.loadDataWithBaseURL(null, errorHtml, "text/html", "UTF-8", null);
    }

    // ========== WebAppInterface.ExerciseSolveActivityBridge 实现 ==========

    /**
     * 设置老师消息回调
     * <p>
     * 由 WebAppInterface 调用，用于设置接收老师消息的回调函数名称。
     * </p>
     *
     * @param callbackName JavaScript 回调函数名称
     */
    @Override
    public void setTeacherMessageCallback(String callbackName) {
        Log.d(TAG, "设置老师消息回调: " + callbackName);
        // 设置老师消息回调
    }


    // ========== 生命周期管理 ==========

    /**
     * Activity 恢复时的回调
     * <p>
     * 当 Activity 从后台恢复时调用，执行以下操作：
     * <ul>
     *   <li>隐藏系统 UI（保持全屏状态）</li>
     *   <li>恢复 WebView 状态</li>
     * </ul>
     * </p>
     */
    @Override
    protected void onResume() {
        super.onResume();
        WindowUtils.hideSystemUI(this);
        if (webView != null) {
            webView.onResume();
        }
    }

    /**
     * Activity 暂停时的回调
     * <p>
     * 当 Activity 进入后台时调用，暂停 WebView 以节省资源。
     * </p>
     */
    @Override
    protected void onPause() {
        super.onPause();
        if (webView != null) {
            webView.onPause();
        }
    }

    /**
     * Activity 销毁时的回调
     * <p>
     * 当 Activity 被销毁时调用，执行以下清理操作：
     * <ul>
     *   <li>停止相机预览并释放相机资源</li>
     *   <li>清理更新检查定时器</li>
     *   <li>销毁 WebView 实例</li>
     * </ul>
     * </p>
     */
    @Override
    protected void onDestroy() {
        super.onDestroy();
        // 停止相机预览
        stopCameraPreview();
        // 清理更新检查定时器
        mCheckUpdateHandler.removeCallbacksAndMessages(null);
        if (webView != null) {
            webView.destroy();
        }
        Log.d(TAG, "MainWebViewActivity onDestroy 完成");
    }

    // ========== 相机预览相关方法 ==========

    /**
     * 启动相机预览（通过 JS 桥接调用）
     * <p>
     * 如果相机已激活，先完全停止并释放资源，然后重新启动。
     * 这样可以避免尝试绑定新的 use case 时出现冲突。
     * </p>
     * <p>
     * 如果相机权限未授予，会先请求权限，权限授予后自动启动相机预览。
     * </p>
     */
    public void startCameraPreview() {
        // 如果相机已激活，先完全停止并释放资源，然后再重新启动
        // 这样可以避免尝试绑定新的 use case 时出现冲突
        if (isCameraActive) {
            Log.d(TAG, "相机预览已启动，先停止并释放资源，然后重新启动");
            stopCameraPreview();
            // 使用 Handler 延迟启动，确保资源完全释放
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                startCameraPreviewInternal();
            }, 100);
            return;
        }

        startCameraPreviewInternal();
    }

    /**
     * 内部方法：实际启动相机预览的逻辑
     * <p>
     * 执行以下操作：
     * <ol>
     *   <li>检查相机权限，如果未授予则请求权限</li>
     *   <li>显示 PreviewView</li>
     *   <li>获取 ProcessCameraProvider</li>
     *   <li>绑定相机预览到 PreviewView</li>
     * </ol>
     * </p>
     */
    private void startCameraPreviewInternal() {

        // 检查权限
        if (ContextCompat.checkSelfPermission(this,
                android.Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            Log.d(TAG, "相机权限未授予，请求权限");
            pendingCameraStart = true;
            cameraPermissionLauncher.launch(android.Manifest.permission.CAMERA);
            return;
        }

        // 显示 PreviewView
        runOnUiThread(() -> {
            if (cameraPreviewView != null) {
                cameraPreviewView.setVisibility(View.VISIBLE);
                Log.d(TAG, "✅ PreviewView 已设置为可见");
            } else {
                Log.e(TAG, "❌ PreviewView 为 null，无法显示相机预览");
            }
        });

        // 启动相机
        ListenableFuture<ProcessCameraProvider> cameraProviderFuture = ProcessCameraProvider.getInstance(this);

        cameraProviderFuture.addListener(() -> {
            try {
                cameraProvider = cameraProviderFuture.get();
                if (cameraPreviewView == null) {
                    Log.e(TAG, "❌ 无法绑定相机预览：PreviewView 为 null");
                    return;
                }
                // 在绑定之前，再次确保没有残留的绑定
                if (cameraProvider != null) {
                    cameraProvider.unbindAll();
                }
                bindPreview(cameraProvider);
                isCameraActive = true;
                Log.d(TAG, "✅ 相机预览启动成功，PreviewView 可见性: " +
                        (cameraPreviewView.getVisibility() == View.VISIBLE ? "VISIBLE" : "GONE"));
            } catch (java.util.concurrent.ExecutionException | InterruptedException e) {
                Log.e(TAG, "❌ 启动相机失败", e);
                runOnUiThread(() -> {
                    if (cameraPreviewView != null) {
                        cameraPreviewView.setVisibility(View.GONE);
                    }
                });
            }
        }, ContextCompat.getMainExecutor(this));
    }

    /**
     * 停止相机预览
     * <p>
     * 执行以下操作：
     * <ul>
     *   <li>隐藏 PreviewView</li>
     *   <li>解绑所有相机用例</li>
     *   <li>释放相机资源</li>
     *   <li>重置相机状态标志</li>
     * </ul>
     * </p>
     */
    public void stopCameraPreview() {
        if (!isCameraActive) {
            return;
        }

        runOnUiThread(() -> {
            if (cameraPreviewView != null) {
                cameraPreviewView.setVisibility(View.GONE);
            }
        });

        if (cameraProvider != null) {
            cameraProvider.unbindAll();
            cameraProvider = null;
        }
        imageCapture = null;
        isCameraActive = false;
        Log.d(TAG, "相机预览已停止");
    }

    /**
     * 绑定相机预览到 PreviewView
     * <p>
     * 创建 Preview 和 ImageCapture use case，并绑定到相机提供者。
     * 使用后置摄像头（LENS_FACING_BACK）。
     * </p>
     *
     * @param cameraProvider 相机提供者实例
     */
    private void bindPreview(@NonNull ProcessCameraProvider cameraProvider) {
        if (cameraPreviewView == null) {
            Log.e(TAG, "❌ bindPreview: PreviewView 为 null");
            return;
        }

        Log.d(TAG, "开始绑定相机预览，PreviewView ID: " + cameraPreviewView.getId());

        Preview preview = new Preview.Builder().build();
        CameraSelector cameraSelector = new CameraSelector.Builder()
                .requireLensFacing(CameraSelector.LENS_FACING_BACK)
                .build();

        imageCapture = new ImageCapture.Builder().build();
        preview.setSurfaceProvider(cameraPreviewView.getSurfaceProvider());

        cameraProvider.bindToLifecycle(this, cameraSelector, preview, imageCapture);

        Log.d(TAG, "✅ 相机预览已绑定到 PreviewView");
    }

    /**
     * 拍照（通过 JS 桥接调用）
     * <p>
     * 使用已初始化的 ImageCapture 进行拍照，并将结果以 Base64 编码的字符串形式
     * 通过 JavaScript 回调返回给 Web 端。
     * </p>
     * <p>
     * 如果相机未初始化，会通过 JavaScript 回调通知 Web 端拍照失败。
     * </p>
     *
     * @param callbackId 回调 ID，用于匹配 Web 端的回调函数
     */
    public void capturePhoto(String callbackId) {
        if (imageCapture == null) {
            // 回调 Web 端：拍照失败
            String js = String.format(
                    "javascript:(function() {" +
                            "  try {" +
                            "    if (window.onNativeCameraCaptureFailed) {" +
                            "      window.onNativeCameraCaptureFailed('%s', '相机未初始化');" +
                            "    }" +
                            "  } catch(e) {" +
                            "    console.error('拍照回调失败:', e);" +
                            "  }" +
                            "})();",
                    callbackId.replace("'", "\\'"));
            webView.evaluateJavascript(js, null);
            return;
        }

        try {
            java.io.File photoFile = java.io.File.createTempFile("photo_", ".jpg", getCacheDir());
            ImageCapture.OutputFileOptions outputOptions = new ImageCapture.OutputFileOptions.Builder(photoFile)
                    .build();

            imageCapture.takePicture(outputOptions, cameraExecutor,
                    new ImageCapture.OnImageSavedCallback() {
                        @Override
                        public void onImageSaved(@NonNull ImageCapture.OutputFileResults results) {
                            // 将图片转换为 Base64
                            String base64 = encodeImageToBase64(photoFile);
                            runOnUiThread(() -> {
                                // 回调 Web 端：拍照成功
                                String js = String.format(
                                        "javascript:(function() {" +
                                                "  try {" +
                                                "    if (window.onNativeCameraCaptureSuccess) {" +
                                                "      window.onNativeCameraCaptureSuccess('%s', '%s');" +
                                                "    }" +
                                                "  } catch(e) {" +
                                                "    console.error('拍照回调失败:', e);" +
                                                "  }" +
                                                "})();",
                                        callbackId.replace("'", "\\'"),
                                        base64.replace("'", "\\'"));
                                webView.evaluateJavascript(js, null);
                                Log.d(TAG, "拍照成功，已回调Web端");
                            });
                        }

                        @Override
                        public void onError(@NonNull ImageCaptureException exception) {
                            runOnUiThread(() -> {
                                String errorMsg = exception.getMessage() != null ? exception.getMessage() : "拍照失败";
                                String js = String.format(
                                        "javascript:(function() {" +
                                                "  try {" +
                                                "    if (window.onNativeCameraCaptureFailed) {" +
                                                "      window.onNativeCameraCaptureFailed('%s', '%s');" +
                                                "    }" +
                                                "  } catch(e) {" +
                                                "    console.error('拍照回调失败:', e);" +
                                                "  }" +
                                                "})();",
                                        callbackId.replace("'", "\\'"),
                                        errorMsg.replace("'", "\\'"));
                                webView.evaluateJavascript(js, null);
                                Log.e(TAG, "拍照失败", exception);
                            });
                        }
                    });
        } catch (Exception e) {
            String errorMsg = e.getMessage() != null ? e.getMessage() : "拍照异常";
            String js = String.format(
                    "javascript:(function() {" +
                            "  try {" +
                            "    if (window.onNativeCameraCaptureFailed) {" +
                            "      window.onNativeCameraCaptureFailed('%s', '%s');" +
                            "    }" +
                            "  } catch(e) {" +
                            "    console.error('拍照回调失败:', e);" +
                            "  }" +
                            "})();",
                    callbackId.replace("'", "\\'"),
                    errorMsg.replace("'", "\\'"));
            webView.evaluateJavascript(js, null);
            Log.e(TAG, "拍照异常", e);
        }
    }

    /**
     * 将图片文件编码为 Base64 字符串
     * <p>
     * 读取图片文件的所有字节，然后使用 Base64 编码（NO_WRAP 模式）转换为字符串。
     * </p>
     *
     * @param imageFile 要编码的图片文件
     * @return Base64 编码的字符串，如果编码失败则返回空字符串
     */
    private String encodeImageToBase64(java.io.File imageFile) {
        try {
            java.io.FileInputStream inputStream = new java.io.FileInputStream(imageFile);
            byte[] bytes = new byte[(int) imageFile.length()];
            inputStream.read(bytes);
            inputStream.close();
            return android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP);
        } catch (Exception e) {
            Log.e(TAG, "图片编码失败", e);
            return "";
        }
    }

    /**
     * 处理返回键按下事件
     * <p>
     * 实现智能返回逻辑：
     * <ul>
     *   <li>如果当前路由是主页面（/app 或 /app/xxx）：
     *     <ul>
     *       <li>如果 WebView 没有历史记录可返回，则退出应用</li>
     *       <li>如果有历史记录，则返回上一页</li>
     *     </ul>
     *   </li>
     *   <li>如果当前路由不是主页面（如登录页）：
     *     <ul>
     *       <li>如果 WebView 有历史记录，则返回上一页</li>
     *       <li>如果没有历史记录，则执行默认的返回行为</li>
     *     </ul>
     *   </li>
     * </ul>
     * </p>
     * <p>
     * 注意：Vue Router 使用 Hash 模式，路由信息在 URL 的 hash 部分。
     * </p>
     */
    @Override
    public void onBackPressed() {
        if (mForceUpdateRequired) {
            return;
        }
        if (webView != null) {
            // 第1步：获取当前 URL 的 hash 部分（Vue Router 使用 Hash 模式）
            String currentUrl = webView.getUrl();
            String currentHash = "";
            if (currentUrl != null && currentUrl.contains("#")) {
                currentHash = currentUrl.substring(currentUrl.indexOf("#"));
            }

            // 第2步：如果当前路由是 /app 或 /app/xxx（主页面）
            if (currentHash.startsWith("#/app")) {
                // 第3步：如果 WebView 不能返回，说明没有历史记录，直接退出应用
                if (!webView.canGoBack()) {
                    finish();
                    return;
                }
                // 第4步：如果 WebView 可以返回，说明有子路由可以返回，正常返回
                webView.goBack();
            } else {
                // 第5步：如果当前路由不是主页面（比如登录页），正常处理返回
                if (webView.canGoBack()) {
                    webView.goBack();
                } else {
                    super.onBackPressed();
                }
            }
        } else {
            super.onBackPressed();
        }
    }

    /**
     * 窗口焦点变化回调
     * <p>
     * 当窗口获得或失去焦点时调用，确保窗口获得焦点时隐藏系统 UI，
     * 保持全屏状态。
     * </p>
     *
     * @param hasFocus true 表示窗口获得焦点，false 表示窗口失去焦点
     */
    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        WindowUtils.hideSystemUI(this);
    }
}
