package com.cosinetech.imates.ui.webview.common;

import android.content.Context;
import android.webkit.WebSettings;
import android.webkit.WebView;

/**
 * WebView配置工具类
 * 统一配置WebView的各种设置
 */
public class WebViewConfig {
    
    /**
     * 配置WebView
     * @param webView WebView实例
     * @param context 上下文
     */
    public static void configureWebView(WebView webView, Context context) {
        WebSettings settings = webView.getSettings();
        
        // 基础设置
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        // setAppCacheEnabled 和 setAppCachePath 已过时，移除
        
        // 缓存设置
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        
        // 媒体设置
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        
        // 渲染设置
        settings.setRenderPriority(WebSettings.RenderPriority.HIGH);
        settings.setLayoutAlgorithm(WebSettings.LayoutAlgorithm.TEXT_AUTOSIZING);
        
        // 缩放设置
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        
        // 混合内容设置
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        
        // 用户代理设置
        String userAgent = settings.getUserAgentString();
        settings.setUserAgentString(userAgent + " FindExerciseApp/1.0");
        
        // 硬件加速
        webView.setLayerType(WebView.LAYER_TYPE_HARDWARE, null);
    }
}
