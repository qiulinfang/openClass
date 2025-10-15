package com.cosinetech.imates.ui.webview;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;

import com.cosinetech.imates.R;
import com.cosinetech.imates.ui.activities.BaseActivity;
import com.cosinetech.imates.ui.webview.common.WebAppInterface;
import com.cosinetech.imates.ui.webview.common.WebViewConfig;
import com.cosinetech.imates.ui.webview.common.ImatesWebIntegration;
import com.cosinetech.imates.ui.webview.common.WebViewNavigationManager;
import com.cosinetech.imates.utils.AppUtils;
import com.cosinetech.imates.utils.WindowUtils;
import com.cosinetech.imates.BuildConfig;

/**
 * 主WebView Activity
 * 用于渲染整个imates-web项目构建后的页面
 * 提供完整的Vue应用容器
 */
public class MainWebViewActivity extends BaseActivity implements WebAppInterface.ExerciseSolveActivityBridge {

    private static final String TAG = "MainWebViewActivity";
    
    // WebView相关
    private WebView webView;
    private WebAppInterface webAppInterface;
    
    // Activity Result Launchers
    private ActivityResultLauncher<Intent> imagePickLauncher;
    private ActivityResultLauncher<Intent> imageCaptureLauncher;
    
    // 页面URL配置
    private String webAppUrl = "file:///android_asset/index.html"; // 默认加载本地文件
    
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
    protected int getLayoutResId() {
        return R.layout.activity_main_webview;
    }

    @Override
    protected int getCurrentNavItemId() {
        return R.id.nav_textbook_knowledge;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        Log.d(TAG, "MainWebViewActivity onCreate 开始");
        
        // 获取传入的URL参数
        String customUrl = getIntent().getStringExtra("web_app_url");
        if (customUrl != null && !customUrl.isEmpty()) {
            webAppUrl = customUrl;
        }
        
        Log.d(TAG, "加载URL: " + webAppUrl);
        
        // 初始化WebView
        initWebView();
        
        // 初始化Activity Result Launchers
        initActivityResultLaunchers();
        
        // 加载页面
        loadWebApp();
        
        Log.d(TAG, "MainWebViewActivity onCreate 完成");
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
        
        // 创建并设置WebAppInterface
        webAppInterface = new WebAppInterface(this);
        webAppInterface.setExerciseBridge(this);
        webAppInterface.setImageLaunchers(imagePickLauncher, imageCaptureLauncher);
        webAppInterface.setWebView(webView);
        webView.addJavascriptInterface(webAppInterface, "AndroidBridge");
        
        // 设置WebViewClient
        webView.setWebViewClient(new MainWebViewClient());
        
        Log.d(TAG, "WebView初始化完成");
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
            }
        );
        
        Log.d(TAG, "Activity Result Launchers初始化完成");
    }

    /**
     * 加载Web应用
     */
    private void loadWebApp() {
        Log.d(TAG, "开始加载Web应用: " + webAppUrl);
        
        // 如果是远程URL，使用集成工具类处理
        if (webAppUrl.startsWith("http://") || webAppUrl.startsWith("https://")) {
            webAppUrl = ImatesWebIntegration.getRemoteWebAppUrl(webAppUrl);
            Log.d(TAG, "处理后的远程URL: " + webAppUrl);
        } else {
            // 本地文件，使用默认URL
            webAppUrl = ImatesWebIntegration.getDefaultWebAppUrl(this);
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
        
        // 使用集成工具类初始化Web应用
        ImatesWebIntegration.initWebApp(webView, this);
        
        // 检查Web应用是否就绪
        ImatesWebIntegration.checkWebAppReady(webView, new ImatesWebIntegration.ReadyCallback() {
            @Override
            public void onReady(boolean isReady) {
                if (isReady) {
                    Log.d(TAG, "Web应用已就绪");
                    // Web应用就绪后可以执行其他初始化操作
                    onWebAppReady();
                } else {
                    Log.w(TAG, "Web应用未就绪，稍后重试");
                    // 可以设置重试机制
                    retryInitWebApp();
                }
            }
        });
    }

    /**
     * Web应用就绪后的处理
     */
    private void onWebAppReady() {
        try {
            // 设置Web应用配置
            org.json.JSONObject config = new org.json.JSONObject();
            config.put("theme", "light");
            config.put("language", "zh-CN");
            config.put("debug", BuildConfig.DEBUG);
            
            ImatesWebIntegration.setWebAppConfig(webView, config);
            
            Log.d(TAG, "Web应用配置设置完成");
            
        } catch (Exception e) {
            Log.e(TAG, "设置Web应用配置失败", e);
        }
    }

    /**
     * 重试初始化Web应用
     */
    private void retryInitWebApp() {
        webView.postDelayed(() -> {
            Log.d(TAG, "重试初始化Web应用");
            ImatesWebIntegration.checkWebAppReady(webView, new ImatesWebIntegration.ReadyCallback() {
                @Override
                public void onReady(boolean isReady) {
                    if (isReady) {
                        Log.d(TAG, "重试成功，Web应用已就绪");
                        onWebAppReady();
                    } else {
                        Log.w(TAG, "重试失败，Web应用仍未就绪");
                    }
                }
            });
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
        if (webView != null) {
            webView.destroy();
        }
    }

    @Override
    public void onBackPressed() {
        // 使用导航管理器处理返回操作
        if (!WebViewNavigationManager.handleBackPress(webView)) {
            super.onBackPressed();
        }
    }
}
