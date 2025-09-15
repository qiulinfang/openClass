package com.cosinetech.imates.ui.webview;

import android.content.Context;
import android.util.AttributeSet;
import android.view.KeyEvent;
import android.webkit.WebView;

public class KeyboardAwareWebView extends WebView {

    public KeyboardAwareWebView(Context context) {
        super(context);
    }

    public KeyboardAwareWebView(Context context, AttributeSet attrs) {
        super(context, attrs);
    }

    public KeyboardAwareWebView(Context context, AttributeSet attrs, int defStyleAttr) {
        super(context, attrs, defStyleAttr);
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        android.util.Log.d("KeyboardAwareWebView", "onKeyDown called: keyCode=" + keyCode + ", action=" + event.getAction());
        return super.onKeyDown(keyCode, event);
    }

    @Override
    public boolean onKeyUp(int keyCode, KeyEvent event) {
        android.util.Log.d("KeyboardAwareWebView", "onKeyUp called: keyCode=" + keyCode + ", action=" + event.getAction());
        return super.onKeyUp(keyCode, event);
    }

    @Override
    public boolean onKeyPreIme(int keyCode, KeyEvent event) {
        // 添加日志来确认方法是否被调用
        android.util.Log.d("KeyboardAwareWebView", "onKeyPreIme called: keyCode=" + keyCode + ", action=" + event.getAction());
        
        // 监听返回键 (KEYCODE_BACK) 的弹起 (ACTION_UP) 事件
        if (keyCode == KeyEvent.KEYCODE_BACK && event.getAction() == KeyEvent.ACTION_UP) {
            android.util.Log.d("KeyboardAwareWebView", "检测到返回键按下，准备触发键盘隐藏事件");
            
            // 这是捕获键盘关闭按钮点击的关键点
            // 触发全局键盘隐藏事件，与keyboard.ts保持一致
            this.evaluateJavascript("javascript:" +
                "console.log('⌨️ [Android键盘] 检测到返回键按下');" +
                "if (typeof window !== 'undefined' && window.dispatchEvent) {" +
                "  const event = new CustomEvent('keyboard-hide', { detail: { duration: 300 } });" +
                "  window.dispatchEvent(event);" +
                "  console.log('⌨️ [Android键盘] 已触发全局键盘隐藏事件');" +
                "} else {" +
                "  console.error('⌨️ [Android键盘] 无法触发事件，window或dispatchEvent不可用');" +
                "}", null);
        }
        return super.onKeyPreIme(keyCode, event);
    }
}