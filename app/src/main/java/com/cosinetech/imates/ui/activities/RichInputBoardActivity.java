package com.cosinetech.imates.ui.activities;

import android.app.AlertDialog;
import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.JsPromptResult;
import android.webkit.JsResult;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.cosinetech.imates.R;
import com.cosinetech.imates.utils.WindowUtils;

public class RichInputBoardActivity extends AppCompatActivity {
    private WebView mathWebView;
    private boolean mathLiveReady = false;

    public static final String RICH_INPUT_RESULT_KEY = "RICH_INPUT_RESULT";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowUtils.hideSystemUI(this);
        WindowUtils.setFullScreenMode(this);
        setContentView(R.layout.activity_rich_input_board);

        initViews();
        setupWebView();
    }

    private void initViews() {
        mathWebView = findViewById(R.id.mathWebView);
    }

    private void setupWebView() {
        // 启用JavaScript
        mathWebView.getSettings().setJavaScriptEnabled(true);
        mathWebView.getSettings().setDomStorageEnabled(true);
        mathWebView.getSettings().setLoadWithOverviewMode(true);
        mathWebView.getSettings().setUseWideViewPort(true);
        mathWebView.getSettings().setBuiltInZoomControls(false);
        mathWebView.getSettings().setSupportZoom(false);

        // 允许访问本地文件
        mathWebView.getSettings().setAllowFileAccess(true);
        mathWebView.getSettings().setAllowFileAccessFromFileURLs(true);
        mathWebView.getSettings().setAllowUniversalAccessFromFileURLs(true);

        // 添加JavaScript接口
        mathWebView.addJavascriptInterface(new WebAppInterface(), "Android");

        // 设置WebView客户端
        mathWebView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onJsConfirm(WebView view, String url, String message, JsResult result) {
                showWebDialog(view, message, result);
                return true;
            }

            @Override
            public boolean onJsAlert(WebView view, String url, String message, JsResult result) {
                showWebDialog(view, message, result);
                return true;
            }

            @Override
            public boolean onJsPrompt(WebView view, String url, String message, String defaultMessage, JsPromptResult result) {
                showWebDialog(view, message, result);
                return true;
            }
        });

        mathWebView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                // 页面加载完成
            }

            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                super.onReceivedError(view, errorCode, description, failingUrl);
                Toast.makeText(RichInputBoardActivity.this, "加载错误: " + description, Toast.LENGTH_LONG).show();
            }
        });

        // 加载本地HTML文件
        mathWebView.loadUrl("file:///android_asset/mathlive/index.html");
    }

    private static void showWebDialog(WebView view, String message, JsResult result) {
        // 使用 AlertDialog 来显示 confirm 对话框
        new AlertDialog.Builder(view.getContext())
                .setTitle("确认")
                .setMessage(message)
                .setPositiveButton(android.R.string.ok, (dialog, which) -> {
                    result.confirm(); // 用户点击确定
                })
                .setNegativeButton(android.R.string.cancel, (dialog, which) -> {
                    result.cancel(); // 用户点击取消
                })
                .create()
                .show();
    }

    /**
     * JavaScript接口类
     * 提供网页端与Android端的通信桥梁
     */
    public class WebAppInterface {

        /**
         * MathLive准备就绪回调
         */
        @JavascriptInterface
        public void onMathLiveReady() {
            runOnUiThread(() -> {
                mathLiveReady = true;
                Toast.makeText(RichInputBoardActivity.this, "数学编辑器已就绪", Toast.LENGTH_SHORT).show();
            });
        }

        /**
         * LaTeX内容变化回调
         * @param latex 当前的LaTeX内容
         */
        @JavascriptInterface
        public void onLatexChanged(String latex) {
            // 可以在这里处理LaTeX变化事件
            // 例如：自动保存、实时预览等
//            runOnUiThread(() -> {
//                // 处理LaTeX变化，如果需要的话
//                // 目前暂时不做处理，所有功能都在网页端完成
//            });
        }

        /**
         * 错误处理回调
         * @param error 错误信息
         */
        @JavascriptInterface
        public void onError(String error) {
            runOnUiThread(() -> {
                Toast.makeText(RichInputBoardActivity.this, "错误: " + error, Toast.LENGTH_LONG).show();
            });
        }

        /**
         * 日志输出回调（用于调试）
         * @param message 日志信息
         */
        @JavascriptInterface
        public void log(String message) {
//            runOnUiThread(() -> {
//                // 可以用于调试，在发布版本中可以移除
//                // Toast.makeText(RichInputBoardActivity.this, "Log: " + message, Toast.LENGTH_SHORT).show();
//                android.util.Log.d("MathLive", message);
//            });
        }

        @JavascriptInterface
        public void onExportMarkdown(String markdown) {
            // 这里的 markdown 参数就是 Web 端导出的 Markdown 字符串
            // 你可以在这里处理，比如保存、显示、上传等
            Log.e("RichInputBoardActivity", markdown);
            runOnUiThread(() -> {
                Intent resultIntent = new Intent();
                resultIntent.putExtra(RICH_INPUT_RESULT_KEY, markdown);
                setResult(RESULT_OK, resultIntent);
                finish(); // 关闭当前 Activity
            });
        }

        @JavascriptInterface
        public void onExitEditor() {
            runOnUiThread(() -> {
                Intent resultIntent = new Intent();
                setResult(RESULT_CANCELED, resultIntent);
                finish(); // 关闭当前 Activity
            });
        }
    }

    /**
     * 处理返回键
     */
    @Override
    public void onBackPressed() {
        if (mathWebView.canGoBack()) {
            mathWebView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    /**
     * 活动暂停时的处理
     */
    @Override
    protected void onPause() {
        super.onPause();
        if (mathWebView != null) {
            mathWebView.onPause();
        }
    }

    /**
     * 活动恢复时的处理
     */
    @Override
    protected void onResume() {
        super.onResume();
        if (mathWebView != null) {
            mathWebView.onResume();
        }
    }

    /**
     * 活动销毁时的清理
     */
    @Override
    protected void onDestroy() {
        if (mathWebView != null) {
            mathWebView.loadDataWithBaseURL(null, "", "text/html", "utf-8", null);
            // 移除 JS 接口（防止内存泄漏）
            mathWebView.removeJavascriptInterface("Android");
            // 停止 WebView 所有加载任务
            mathWebView.stopLoading();
            // 清除 WebView 历史、缓存等
            mathWebView.clearCache(true);
            mathWebView.clearHistory();
            mathWebView.destroy();
            mathWebView = null;
        }
        super.onDestroy();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            WindowUtils.hideSystemUI(this);
        }
    }
}