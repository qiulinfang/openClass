package com.cosinetech.imates.ui.webview.findexercise;

import android.graphics.Bitmap;
import android.util.Log;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.annotation.NonNull;

/**
 * 习题查找WebView的WebViewClient
 * 处理页面加载事件
 */
public class FindExerciseWebViewClient extends WebViewClient {
    
    private static final String TAG = "FindExerciseWebViewClient";
    
    private final FindExerciseWebViewActivity activity;
    
    public FindExerciseWebViewClient(FindExerciseWebViewActivity activity) {
        this.activity = activity;
    }
    
    @Override
    public void onPageStarted(WebView view, String url, Bitmap favicon) {
        super.onPageStarted(view, url, favicon);
        Log.i(TAG, "页面开始加载: " + url);
    }
    
    @Override
    public void onPageFinished(WebView view, String url) {
        super.onPageFinished(view, url);
        Log.i(TAG, "页面加载完成: " + url);
        
        // 页面加载完成后，可以执行一些初始化操作
        // 例如：注入配置参数、设置事件监听器等
        
        // 检查页面内容
        view.evaluateJavascript("document.body.innerHTML", result -> {
            Log.i(TAG, "页面内容: " + result);
        });
        
        // 检查Vue应用是否已挂载
        view.evaluateJavascript("typeof window.Vue !== 'undefined'", result -> {
            Log.i(TAG, "Vue是否可用: " + result);
        });
    }
    
    @Override
    public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
        super.onReceivedError(view, request, error);
        Log.e(TAG, "页面加载错误: " + error.getDescription());
        Log.e(TAG, "错误代码: " + error.getErrorCode());
        Log.e(TAG, "请求URL: " + request.getUrl());
        
        // 可以在这里显示错误页面或重试逻辑
    }
    
    @Override
    public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
        super.onReceivedHttpError(view, request, errorResponse);
        Log.e(TAG, "HTTP错误: " + errorResponse.getStatusCode());
        Log.e(TAG, "错误原因: " + errorResponse.getReasonPhrase());
        Log.e(TAG, "请求URL: " + request.getUrl());
    }
    
    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        String url = request.getUrl().toString();
        Log.i(TAG, "URL拦截: " + url);
        
        // 对于外部链接，可以选择在外部浏览器中打开
        if (url.startsWith("http://") || url.startsWith("https://")) {
            // 这里可以添加外部链接处理逻辑
            return false; // 在WebView中打开
        }
        
        return super.shouldOverrideUrlLoading(view, request);
    }
}
