package com.cosinetech.imates.ui.activities;

import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;

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

        WebView webView = findViewById(R.id.web_view);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true); // 启用 DOM storage
        webView.getSettings().setSupportZoom(true);
        webView.getSettings().setBuiltInZoomControls(true);
        webView.getSettings().setDisplayZoomControls(false);
        // 设置WebViewClient以防止外部浏览器打开链接
        webView.setWebViewClient(new WebViewClient());
        // Load the local HTML file
        if(classUrl != null && !classUrl.trim().isEmpty()) {
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