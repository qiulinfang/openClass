package com.cosinetech.imates.ui.webview;

import android.content.Context;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Rect;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.net.http.SslError;
import android.webkit.SslErrorHandler;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.view.ViewTreeObserver;
import android.view.WindowManager;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
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
import com.cosinetech.imates.BuildConfig;
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
 * 主 Web 视图 Activity
 */
public class MainWebViewActivity extends AppCompatActivity
        implements WebAppInterface.ExerciseSolveActivityBridge, WebAppInterface.WebAppReadyCallback {

    // 日志标签
    private static final String TAG = "MainWebViewActivity";
    private static final String SCHOOL_ID = "jinshanyuanyang"; //可以是 jingkaierzhong / jinshanyuanyang

    private static final boolean IS_INTERNAL_TEST = false;

    // WebView
    private WebView webView;

    // Web 桥接接口
    private WebAppInterface webAppInterface;

    // 加载指示器
    private View loadingProgressBar;

    // Activity 启动器
    private ActivityResultLauncher<Intent> imagePickLauncher;
    private ActivityResultLauncher<Intent> imageCaptureLauncher;
    private ActivityResultLauncher<String> cameraPermissionLauncher;
    private ActivityResultLauncher<String> audioPermissionLauncher;
    private ActivityResultLauncher<Intent> mediaProjectionLauncher;

    // 相机相关
    private PreviewView cameraPreviewView;
    private ImageCapture imageCapture;
    private ProcessCameraProvider cameraProvider;

    // 相机状态
    private final java.util.concurrent.Executor cameraExecutor = java.util.concurrent.Executors
            .newSingleThreadExecutor();
    private boolean isCameraActive = false;
    private boolean pendingCameraStart = false;

    // 页面 URL
    private String webAppUrl = "https://www.imates.com.cn/openClass/";

    // 键盘检测
    private int previousKeyboardHeight = 0;
    private boolean isKeyboardVisible = false;

    // 更新检查
    private final Handler mCheckUpdateHandler = new Handler(Looper.getMainLooper());
    private volatile boolean mForceUpdateRequired = false;

    // 每 10 秒检查一次更新
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
        return BuildConfig.UPDATE_URL;
    }

    // 启动 Activity
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

        // 初始化全屏和布局
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE);
        WindowUtils.setFullScreenMode(this);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            getWindow().setLayout(WindowManager.LayoutParams.MATCH_PARENT,
                    WindowManager.LayoutParams.MATCH_PARENT);
        }

        setContentView(R.layout.activity_main_webview);
        WindowUtils.hideSystemUI(this);

        loadingProgressBar = findViewById(R.id.loading_progress);
        if (loadingProgressBar != null) {
            loadingProgressBar.setVisibility(View.VISIBLE);
        }

        Log.d(TAG, "MainWebViewActivity onCreate 开始");

        // 获取 URL 参数
        String customUrl = getIntent().getStringExtra("web_app_url");
        if (customUrl != null && !customUrl.isEmpty()) {
            webAppUrl = customUrl;
        }

        Log.d(TAG, "加载 URL: " + webAppUrl);

        // 初始化组件
        initActivityResultLaunchers();
        initWebView();
        loadWebApp();
        initUpdateCheck();

        Log.d(TAG, "MainWebViewActivity onCreate 完成");
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
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

    // 初始化更新检查
    private void initUpdateCheck() {
        mCheckUpdateHandler.postDelayed(mCheckUpdateRunnable, 0);
    }

    // 发送 HTTP 请求检查更新
    private void checkUpdateWithHttpRequest(String updateUrl) {
        OkHttpClient client = new OkHttpClient.Builder()
                .connectTimeout(10, TimeUnit.SECONDS)
                .readTimeout(10, TimeUnit.SECONDS)
                .writeTimeout(10, TimeUnit.SECONDS)
                .build();
        
        Request request = new Request.Builder()
                .url(updateUrl)
                .get()
                .build();
        
        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                try {
                    int statusCode = response.code();
                    String responseBody = "";
                    if (response.body() != null) {
                        responseBody = response.body().string();
                    }
                    
                    if (statusCode == 200 && responseBody != null && !responseBody.isEmpty()) {
                        try {
                            org.json.JSONObject jsonObj = new org.json.JSONObject(responseBody);
                            String serverVersion = jsonObj.optString("VersionName", "");
                            int updateStatus = jsonObj.optInt("UpdateStatus", 0);
                            mForceUpdateRequired = updateStatus == 2;
                            if (!serverVersion.isEmpty()) {
                                Log.d(TAG, "服务器版本: " + serverVersion);

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

    // 初始化 WebView
    private void initWebView() {
        webView = findViewById(R.id.main_webview);

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.KITKAT) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        WebViewConfig.configureWebView(webView, this);

        webView.setBackgroundColor(Color.TRANSPARENT);
        webView.setLayerType(WebView.LAYER_TYPE_HARDWARE, null);

        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);

        cameraPreviewView = findViewById(R.id.camera_previewer);
        if (cameraPreviewView != null) {
            cameraPreviewView.setImplementationMode(PreviewView.ImplementationMode.COMPATIBLE);
        }

        webAppInterface = new WebAppInterface(this);
        webAppInterface.setExerciseBridge(this);
        webAppInterface.setWebAppReadyCallback(this);
        webAppInterface.setImageLaunchers(imagePickLauncher, imageCaptureLauncher);
        webAppInterface.setCameraPermissionLauncher(cameraPermissionLauncher);
        webAppInterface.setAudioPermissionLauncher(audioPermissionLauncher);
        webAppInterface.setWebView(webView);
        webView.addJavascriptInterface(webAppInterface, "AndroidBridge");

        ApplicationModelShared app = (ApplicationModelShared) getApplication();
        app.setWebAppInterface(webAppInterface);

        webView.setWebViewClient(new MainWebViewClient());
        setupKeyboardListener();
    }

    // 设置键盘监听器
    private void setupKeyboardListener() {
        View rootView = findViewById(android.R.id.content);
        if (rootView == null) return;

        rootView.getViewTreeObserver().addOnGlobalLayoutListener(new ViewTreeObserver.OnGlobalLayoutListener() {
            @Override
            public void onGlobalLayout() {
                Rect rect = new Rect();
                rootView.getWindowVisibleDisplayFrame(rect);
                int screenHeight = rootView.getRootView().getHeight();
                int keyboardHeight = screenHeight - rect.bottom;
                int threshold = (int) (screenHeight * 0.15);

                if (keyboardHeight > threshold) {
                    if (!isKeyboardVisible || previousKeyboardHeight != keyboardHeight) {
                        isKeyboardVisible = true;
                        previousKeyboardHeight = keyboardHeight;
                        dispatchKeyboardShowEvent(keyboardHeight);
                    }
                } else {
                    if (isKeyboardVisible) {
                        isKeyboardVisible = false;
                        previousKeyboardHeight = 0;
                        dispatchKeyboardHideEvent();
                    }
                }
            }
        });
    }

    // 触发键盘显示事件到 Web
    private void dispatchKeyboardShowEvent(int keyboardHeight) {
        runOnUiThread(() -> {
            try {
                org.json.JSONObject detailObj = new org.json.JSONObject();
                detailObj.put("height", keyboardHeight);
                detailObj.put("duration", 300);
                String detailJson = detailObj.toString();

                String jsCode = "javascript:(function() {" +
                        "  try {" +
                        "    var detailStr = '" + detailJson.replace("'", "\\'") + "';" +
                        "    var detail = JSON.parse(detailStr);" +
                        "    var event = new CustomEvent('keyboard-show', { detail: detail });" +
                        "    window.dispatchEvent(event);" +
                        "  } catch(e) {}" +
                        "})()";

                webView.evaluateJavascript(jsCode, null);
            } catch (Exception e) {
                Log.e(TAG, "触发 keyboard-show 事件失败", e);
            }
        });
    }

    // 触发键盘隐藏事件到 Web
    private void dispatchKeyboardHideEvent() {
        runOnUiThread(() -> {
            try {
                org.json.JSONObject detailObj = new org.json.JSONObject();
                detailObj.put("duration", 300);
                String detailJson = detailObj.toString();

                String jsCode = "javascript:(function() {" +
                        "  try {" +
                        "    var detailStr = '" + detailJson.replace("'", "\\'") + "';" +
                        "    var detail = JSON.parse(detailStr);" +
                        "    var event = new CustomEvent('keyboard-hide', { detail: detail });" +
                        "    window.dispatchEvent(event);" +
                        "  } catch(e) {}" +
                        "})()";

                webView.evaluateJavascript(jsCode, null);
            } catch (Exception e) {
                Log.e(TAG, "触发 keyboard-hide 事件失败", e);
            }
        });
    }

    // 初始化 Activity Result Launchers
    private void initActivityResultLaunchers() {
        imagePickLauncher = registerForActivityResult(
                new ActivityResultContracts.StartActivityForResult(),
                result -> {
                    if (result.getResultCode() == RESULT_OK && result.getData() != null) {
                        android.net.Uri imageUri = result.getData().getData();
                        String resultJson = webAppInterface.handleImagePickResult(imageUri);
                        dispatchImagePickResultToWebView(resultJson);
                    }
                });

        imageCaptureLauncher = registerForActivityResult(
                new ActivityResultContracts.StartActivityForResult(),
                result -> {
                    boolean success = result.getResultCode() == RESULT_OK;
                    String resultJson = webAppInterface.handleImageCaptureResult(success);
                    dispatchImageCaptureResultToWebView(resultJson);
                });

        cameraPermissionLauncher = registerForActivityResult(
                new ActivityResultContracts.RequestPermission(),
                granted -> {
                    if (webAppInterface != null) {
                        webAppInterface.onCameraPermissionResult(granted);
                    }
                    if (granted && pendingCameraStart) {
                        startCameraPreview();
                        pendingCameraStart = false;
                    }
                });

        audioPermissionLauncher = registerForActivityResult(
                new ActivityResultContracts.RequestPermission(),
                granted -> {
                    if (webAppInterface != null) {
                        webAppInterface.onAudioPermissionResult(granted);
                    }
                });

        mediaProjectionLauncher = registerForActivityResult(
                new ActivityResultContracts.StartActivityForResult(),
                result -> {
                    if (result.getResultCode() == RESULT_OK && result.getData() != null) {
                        MediaProjectionManager mediaProjectionManager = 
                            (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
                        MediaProjection mediaProjection = mediaProjectionManager
                            .getMediaProjection(result.getResultCode(), result.getData());
                        if (webAppInterface != null) {
                            webAppInterface.setMediaProjection(mediaProjection);
                        }
                    }
                });
    }

    // 触发图片选择结果到 Web
    private void dispatchImagePickResultToWebView(String resultJson) {
        runOnUiThread(() -> {
            try {
                org.json.JSONObject jsonObj = new org.json.JSONObject(resultJson);
                boolean success = jsonObj.optBoolean("success", false);
                org.json.JSONObject dataObj = jsonObj.optJSONObject("data");

                org.json.JSONObject detailObj = new org.json.JSONObject();
                detailObj.put("success", success);

                if (dataObj != null) {
                    java.util.Iterator<String> keys = dataObj.keys();
                    while (keys.hasNext()) {
                        String key = keys.next();
                        detailObj.put(key, dataObj.get(key));
                    }
                }

                String detailJson = detailObj.toString();
                String jsCode = "javascript:(function() {" +
                        "  try {" +
                        "    var detailStr = '" + detailJson.replace("'", "\\'") + "';" +
                        "    var detail = JSON.parse(detailStr);" +
                        "    var event = new CustomEvent('nativeImagePickResult', { detail: detail });" +
                        "    window.dispatchEvent(event);" +
                        "  } catch(e) {}" +
                        "})()";

                webView.evaluateJavascript(jsCode, null);
            } catch (Exception e) {
                Log.e(TAG, "触发 nativeImagePickResult 失败", e);
            }
        });
    }

    // 触发拍照结果到 Web
    private void dispatchImageCaptureResultToWebView(String resultJson) {
        runOnUiThread(() -> {
            try {
                org.json.JSONObject jsonObj = new org.json.JSONObject(resultJson);
                boolean success = jsonObj.optBoolean("success", false);
                org.json.JSONObject dataObj = jsonObj.optJSONObject("data");

                org.json.JSONObject detailObj = new org.json.JSONObject();
                detailObj.put("success", success);

                if (dataObj != null) {
                    java.util.Iterator<String> keys = dataObj.keys();
                    while (keys.hasNext()) {
                        String key = keys.next();
                        detailObj.put(key, dataObj.get(key));
                    }
                }

                String detailJson = detailObj.toString();
                String jsCode = "javascript:(function() {" +
                        "  try {" +
                        "    var detailStr = '" + detailJson.replace("'", "\\'") + "';" +
                        "    var detail = JSON.parse(detailStr);" +
                        "    var event = new CustomEvent('nativeImageCaptureResult', { detail: detail });" +
                        "    window.dispatchEvent(event);" +
                        "  } catch(e) {}" +
                        "})()";

                webView.evaluateJavascript(jsCode, null);
            } catch (Exception e) {
                Log.e(TAG, "触发 nativeImageCaptureResult 失败", e);
            }
        });
    }

    // 加载 Web 应用
    private void loadWebApp() {
        Log.d(TAG, "开始加载Web应用: " + webAppUrl);

        if (webAppUrl == null || webAppUrl.isEmpty()) {
            webAppUrl = "https://www.imates.com.cn/openClass/";
        }

        if (webAppUrl.startsWith("http://") || webAppUrl.startsWith("https://")) {
            Log.d(TAG, "加载远程URL: " + webAppUrl);
        } else if (webAppUrl.startsWith("file:///")) {
            Log.d(TAG, "加载本地文件URL: " + webAppUrl);
        } else {
            webAppUrl = "https://www.imates.com.cn/openClass/";
        }

        webView.loadUrl(webAppUrl);
    }

    // 自定义 WebViewClient
    private class MainWebViewClient extends WebViewClient {

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            if (url.startsWith("http://") || url.startsWith("https://")) {
                return false;
            }

            if (url.startsWith("tel:") || url.startsWith("mailto:")) {
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, android.net.Uri.parse(url));
                    startActivity(intent);
                    return true;
                } catch (Exception e) {
                    Log.e(TAG, "处理协议链接失败: " + url, e);
                }
            }

            return false;
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);
            
            if (loadingProgressBar != null) {
                loadingProgressBar.setVisibility(View.GONE);
            }
            
            initWebApp();
        }

        @Override
        public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
            super.onReceivedError(view, errorCode, description, failingUrl);
            showErrorPage(errorCode, description);
        }

        @Override
        public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
            if (BuildConfig.DEBUG) {
                handler.proceed();
            } else {
                handler.cancel();
            }
        }
    }

    // 初始化 Web 应用
    private void initWebApp() {
        Log.d(TAG, "等待 Web 应用主动通知就绪状态");
    }

    // Web 应用就绪回调
    @Override
    public void onWebAppReady() {
        Log.d(TAG, "Web应用就绪，执行后续初始化");
        initMessagingManagerOnStartup();
    }

    // 触发版本号事件到 Web
    private void dispatchAppVersionEvent(String versionName) {
        runOnUiThread(() -> {
            try {
                org.json.JSONObject detailObj = new org.json.JSONObject();
                detailObj.put("versionName", versionName);
                String detailJson = detailObj.toString();

                String jsCode = "javascript:(function() {" +
                        "  try {" +
                        "    var detailStr = '" + detailJson.replace("'", "\\'") + "';" +
                        "    var detail = JSON.parse(detailStr);" +
                        "    var event = new CustomEvent('app-version', { detail: detail });" +
                        "    window.dispatchEvent(event);" +
                        "  } catch(e) {}" +
                        "})()";

                webView.evaluateJavascript(jsCode, null);
            } catch (Exception e) {
                Log.e(TAG, "触发 app-version 失败", e);
            }
        });
    }

    // 启动时初始化 MessagingManager
    private void initMessagingManagerOnStartup() {
        try {
            String userId = AppUtils.getUserId();
            if (userId == null || userId.isEmpty()) return;

            if (webAppInterface != null) {
                webAppInterface.initTeacherMessageListener();
            }
        } catch (Exception e) {
            Log.e(TAG, "initMessagingManagerOnStartup 失败", e);
        }
    }

    // 显示错误页面
    private void showErrorPage(int errorCode, String description) {
        String errorHtml = String.format(
                "<html><body style='text-align:center;padding:50px;font-family:Arial;'>" +
                        "<h2>页面加载失败</h2>" +
                        "<p>错误代码: %d</p>" +
                        "<p>错误描述: %s</p>" +
                        "<button onclick='window.location.reload()' style='padding:10px 20px;font-size:16px;'>重新加载</button>"
                        + "</body></html>",
                errorCode, description);

        webView.loadDataWithBaseURL(null, errorHtml, "text/html", "UTF-8", null);
    }

    // ========== WebAppInterface.ExerciseSolveActivityBridge 实现 ==========

    // 设置老师消息回调
    @Override
    public void setTeacherMessageCallback(String callbackName) {
    }


    // 生命周期管理
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
        stopCameraPreview();
        mCheckUpdateHandler.removeCallbacksAndMessages(null);
        if (webView != null) {
            webView.destroy();
        }
    }

    // 相机预览
    public void startCameraPreview() {
        if (isCameraActive) {
            stopCameraPreview();
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                startCameraPreviewInternal();
            }, 100);
            return;
        }

        startCameraPreviewInternal();
    }

    private void startCameraPreviewInternal() {
        if (ContextCompat.checkSelfPermission(this,
                android.Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            pendingCameraStart = true;
            cameraPermissionLauncher.launch(android.Manifest.permission.CAMERA);
            return;
        }

        runOnUiThread(() -> {
            if (cameraPreviewView != null) {
                cameraPreviewView.setVisibility(View.VISIBLE);
            }
        });

        ListenableFuture<ProcessCameraProvider> cameraProviderFuture = ProcessCameraProvider.getInstance(this);

        cameraProviderFuture.addListener(() -> {
            try {
                cameraProvider = cameraProviderFuture.get();
                if (cameraPreviewView == null) return;
                if (cameraProvider != null) {
                    cameraProvider.unbindAll();
                }
                bindPreview(cameraProvider);
                isCameraActive = true;
            } catch (java.util.concurrent.ExecutionException | InterruptedException e) {
                Log.e(TAG, "启动相机失败", e);
                runOnUiThread(() -> {
                    if (cameraPreviewView != null) {
                        cameraPreviewView.setVisibility(View.GONE);
                    }
                });
            }
        }, ContextCompat.getMainExecutor(this));
    }

    public void stopCameraPreview() {
        if (!isCameraActive) return;

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
    }

    private void bindPreview(@NonNull ProcessCameraProvider cameraProvider) {
        if (cameraPreviewView == null) return;

        Preview preview = new Preview.Builder().build();
        CameraSelector cameraSelector = new CameraSelector.Builder()
                .requireLensFacing(CameraSelector.LENS_FACING_BACK)
                .build();

        imageCapture = new ImageCapture.Builder().build();
        preview.setSurfaceProvider(cameraPreviewView.getSurfaceProvider());
        cameraProvider.bindToLifecycle(this, cameraSelector, preview, imageCapture);
    }

    public void capturePhoto(String callbackId) {
        if (imageCapture == null) {
            String js = String.format(
                    "javascript:(function() {" +
                            "  try {" +
                            "    if (window.onNativeCameraCaptureFailed) {" +
                            "      window.onNativeCameraCaptureFailed('%s', '相机未初始化');" +
                            "    }" +
                            "  } catch(e) {}" +
                            "})();",
                    callbackId.replace("'", "\\'"));
            webView.evaluateJavascript(js, null);
            return;
        }

        try {
            java.io.File photoFile = java.io.File.createTempFile("photo_", ".jpg", getCacheDir());
            ImageCapture.OutputFileOptions outputOptions = new ImageCapture.OutputFileOptions.Builder(photoFile).build();

            imageCapture.takePicture(outputOptions, cameraExecutor,
                    new ImageCapture.OnImageSavedCallback() {
                        @Override
                        public void onImageSaved(@NonNull ImageCapture.OutputFileResults results) {
                            String base64 = encodeImageToBase64(photoFile);
                            runOnUiThread(() -> {
                                String js = String.format(
                                        "javascript:(function() {" +
                                                "  try {" +
                                                "    if (window.onNativeCameraCaptureSuccess) {" +
                                                "      window.onNativeCameraCaptureSuccess('%s', '%s');" +
                                                "    }" +
                                                "  } catch(e) {}" +
                                                "})();",
                                        callbackId.replace("'", "\\'"),
                                        base64.replace("'", "\\'"));
                                webView.evaluateJavascript(js, null);
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
                                                "  } catch(e) {}" +
                                                "})();",
                                        callbackId.replace("'", "\\'"),
                                        errorMsg.replace("'", "\\'"));
                                webView.evaluateJavascript(js, null);
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
                            "  } catch(e) {}" +
                            "})();",
                    callbackId.replace("'", "\\'"),
                    errorMsg.replace("'", "\\'"));
            webView.evaluateJavascript(js, null);
        }
    }

    // 图片转 Base64
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

    // 处理返回键
    @Override
    public void onBackPressed() {
        if (mForceUpdateRequired) return;
        
        if (webView != null) {
            String currentUrl = webView.getUrl();
            String currentHash = "";
            if (currentUrl != null && currentUrl.contains("#")) {
                currentHash = currentUrl.substring(currentUrl.indexOf("#"));
            }

            if (currentHash.startsWith("#/app")) {
                if (!webView.canGoBack()) {
                    finish();
                    return;
                }
                webView.goBack();
            } else {
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

    // 窗口焦点变化
    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        WindowUtils.hideSystemUI(this);
    }
}
