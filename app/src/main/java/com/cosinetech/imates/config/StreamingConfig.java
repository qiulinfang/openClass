package com.cosinetech.imates.config;

import android.content.Context;
import android.content.SharedPreferences;

/**
 * 流式响应配置管理类
 */
public class StreamingConfig {
    private static final String PREF_NAME = "streaming_config";
    private static final String KEY_TYPEWRITER_SPEED = "typewriter_speed";
    private static final String KEY_STREAM_TIMEOUT = "stream_timeout";
    
    // 默认配置值
    private static final int DEFAULT_TYPEWRITER_SPEED = 30; // 毫秒
    private static final int DEFAULT_STREAM_TIMEOUT = 30000; // 30秒
    
    private SharedPreferences preferences;
    private static StreamingConfig instance;
    
    private StreamingConfig(Context context) {
        preferences = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
    }
    
    /**
     * 获取单例实例
     */
    public static synchronized StreamingConfig getInstance(Context context) {
        if (instance == null) {
            instance = new StreamingConfig(context.getApplicationContext());
        }
        return instance;
    }
    

    
    /**
     * 获取打字机效果速度（毫秒）
     */
    public int getTypewriterSpeed() {
        return preferences.getInt(KEY_TYPEWRITER_SPEED, DEFAULT_TYPEWRITER_SPEED);
    }
    
    /**
     * 设置打字机效果速度（毫秒）
     */
    public void setTypewriterSpeed(int speed) {
        preferences.edit().putInt(KEY_TYPEWRITER_SPEED, speed).apply();
    }
    
    /**
     * 获取流式响应超时时间（毫秒）
     */
    public int getStreamTimeout() {
        return preferences.getInt(KEY_STREAM_TIMEOUT, DEFAULT_STREAM_TIMEOUT);
    }
    
    /**
     * 设置流式响应超时时间（毫秒）
     */
    public void setStreamTimeout(int timeout) {
        preferences.edit().putInt(KEY_STREAM_TIMEOUT, timeout).apply();
    }
    
    /**
     * 重置为默认配置
     */
    public void resetToDefaults() {
        preferences.edit()
                .putInt(KEY_TYPEWRITER_SPEED, DEFAULT_TYPEWRITER_SPEED)
                .putInt(KEY_STREAM_TIMEOUT, DEFAULT_STREAM_TIMEOUT)
                .apply();
    }
    
    /**
     * 获取配置摘要（用于调试）
     */
    public String getConfigSummary() {
        return String.format(
            "StreamingConfig{typewriterSpeed=%dms, timeout=%dms}",
            getTypewriterSpeed(),
            getStreamTimeout()
        );
    }
}