package com.cosinetech.imates.ui.activities;

import android.graphics.Bitmap;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.WindowManager;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.TextView;

import androidx.activity.EdgeToEdge;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.bumptech.glide.Glide;
import com.cosinetech.imates.R;
import com.cosinetech.imates.utils.WindowUtils;
import com.github.chrisbanes.photoview.PhotoView;

public class MiniClassActivity extends AppCompatActivity {
    public static final String KEY_MINI_CLASS_URL = "class_url";
    public static final String KEY_MINI_CLASS_TITLE = "class_title";

    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setType(WindowManager.LayoutParams.TYPE_PHONE);

        WindowUtils.hideSystemUI(this);
        WindowUtils.setFullScreenMode(this);

        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);

        setContentView(R.layout.activity_mini_class);

        // 获取传递的图片路径
        String classUrl = getIntent().getStringExtra(KEY_MINI_CLASS_URL);
        String title = getIntent().getStringExtra(KEY_MINI_CLASS_TITLE);
        if(title == null || title.trim().isEmpty()) {
            title = "微课";
        }
        TextView titleView = findViewById(R.id.title);
        titleView.setText(title);

        webView = findViewById(R.id.web_view);
        // 启用 JavaScript
        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);

// 其他重要设置
        webSettings.setDomStorageEnabled(true); // 启用 DOM 存储
        webSettings.setAllowFileAccess(true); // 允许文件访问
        webSettings.setAllowContentAccess(true); // 允许内容访问
        webSettings.setDatabaseEnabled(true); // 启用数据库
        //webSettings.setCacheMode(true); // 启用应用缓存
        webSettings.setLoadWithOverviewMode(true);  // 页面自适应屏幕宽度
        webSettings.setUseWideViewPort(true);       // 允许meta viewport生效
        webSettings.setLayoutAlgorithm(WebSettings.LayoutAlgorithm.TEXT_AUTOSIZING); // 自动调整文字大小
        webSettings.setJavaScriptEnabled(true);
        webSettings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        webView.clearCache(true);

        // 禁止滚动条遮挡内容（可选）
        webView.setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY);

        // 居中显示
        webView.setInitialScale(1); // 不缩放

        // 处理混合内容（HTTP/HTTPS）
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            webSettings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        // 启用缩放控制
        webSettings.setBuiltInZoomControls(true);
        webSettings.setDisplayZoomControls(false);

        // 设置 WebViewClient
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                // 忽略SSL证书错误并继续加载页面
                handler.proceed();
            }
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                view.loadUrl(request.getUrl().toString());
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                Log.e("WebView", "加载错误: " + error.getDescription());
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                Log.d("WebView", "开始加载: " + url);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                Log.d("WebView", "加载完成: " + url);
            }
        });

// 设置 WebChromeClient 来显示进度等
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                super.onProgressChanged(view, newProgress);
                Log.d("WebView", "加载进度: " + newProgress + "%");
            }

            @Override
            public void onReceivedTitle(WebView view, String title) {
                super.onReceivedTitle(view, title);
                Log.d("WebView", "网页标题: " + title);
            }
        });
        // Load the local HTML file
        if(classUrl != null && !classUrl.trim().isEmpty()) {
            webView.clearHistory();
            webView.loadUrl(classUrl);
        }

        Button btnBack = findViewById(R.id.btn_back);
        btnBack.setOnClickListener(v->finish());
    }


    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            WindowUtils.hideSystemUI(this);
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        webView.loadUrl("about:blank");
        // 移除浮窗
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getWindow().setType(WindowManager.LayoutParams.TYPE_APPLICATION); // 恢复为普通窗口类型
        }
    }

    @Override
    public void onBackPressed() {
        super.onBackPressed();
        finish(); // 结束 Activity
    }
}