package com.cosinetech.imates;

import android.app.Activity;
import android.app.Application;
import android.content.Context;
import android.content.Intent;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.lifecycle.ViewModelProvider;
import androidx.lifecycle.ViewModelStore;
import androidx.lifecycle.ViewModelStoreOwner;

import com.bumptech.glide.Glide;
import com.cosinetech.imates.deviceadmin.AppMonitorService;
import com.cosinetech.imates.deviceadmin.KioskManager;
import com.cosinetech.imates.data.models.UserInfo;
import com.cosinetech.imates.data.models.UserInfoViewModel;
import com.cosinetech.imates.screencasting.H264IFrameCache;
import com.cosinetech.imates.screencasting.H264MpegTSStreamerManager;
import com.cosinetech.imates.screencasting.ScreenCastingManager;
import com.cosinetech.imates.screencasting.UdpForwarderManager;
import com.cosinetech.imates.ui.robot.FloatingRobotService;
import com.cosinetech.imates.ui.fab.FloatingFabService;
import com.cosinetech.imates.ui.webview.common.WebAppInterface;
import com.cosinetech.imates.utils.AssetsCopyUtils;
import com.cosinetech.imates.coreapiservice.AiChatMessageRequest;
import com.cosinetech.imates.appenv.AppEnvConfig;
import android.webkit.WebView;

public class ApplicationModelShared extends Application implements ViewModelStoreOwner {
    private final ViewModelStore viewModelStore = new ViewModelStore();
    private FloatingRobotService floatingRobotService;
    private FloatingFabService floatingFabService;
    private WebAppInterface webAppInterface;

    public AiChatMessageRequest chatRequest;

    private int activityCount = 0;
    public boolean fakeClassMode = false;
    WifiManager.MulticastLock multicastLock = null;
    private static ApplicationModelShared appInstance = null;

    @Override
    public void onCreate() {
        super.onCreate();
        appInstance = this;
        
        // 初始化应用环境配置（必须在其他初始化之前）
        AppEnvConfig.checkAndUpdateVersion(this);
        
        // 启用 WebView 调试 - 在应用启动时全局启用
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            WebView.setWebContentsDebuggingEnabled(true);
        }
        
        Glide.get(this);
        // 拷贝文件到 Documents 目录
        AssetsCopyUtils.copyAssetsToDocuments(this);
        UdpForwarderManager.getInstance().start();
        H264MpegTSStreamerManager.getInstance();
        H264IFrameCache.getInstance();
        WifiManager wifi = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        multicastLock = wifi.createMulticastLock("media-play");
        multicastLock.setReferenceCounted(true);
        multicastLock.acquire();

        registerActivityLifecycleCallbacks(new ActivityLifecycleCallbacks() {
            @Override
            public void onActivityCreated(@NonNull Activity activity, @Nullable Bundle savedInstanceState) {
                activityCount++;
            }

            @Override
            public void onActivityDestroyed(Activity activity) {
                activityCount--;
                if (activityCount == 0) {
                    // 所有Activity都销毁了，可能是应用退出
                    onAppExit();
                }
            }

            // 其他生命周期方法需要空实现
            @Override public void onActivityStarted(Activity activity) {}
            @Override public void onActivityResumed(Activity activity) {}
            @Override public void onActivityPaused(Activity activity) {}
            @Override public void onActivityStopped(Activity activity) {}
            @Override public void onActivitySaveInstanceState(Activity activity, Bundle outState) {}

        });
// 初始化Kiosk管理器
        KioskManager.getInstance().initialize(this);

        // 启动监控服务
        startAppMonitorService();
        
        // 注意：悬浮FAB按钮服务在MainWebViewActivity的onWebAppReady()中启动
        // 确保Web应用和Vue完全初始化后再启动，避免点击功能时功能未准备好
    }

    private void startAppMonitorService() {
        Intent serviceIntent = new Intent(this, AppMonitorService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        }
    }

    /**
     * 启动系统级悬浮FAB按钮服务
     * 在Web应用就绪后启动，确保功能完全准备好
     */
    public void startFloatingFabService() {
        // 检查悬浮窗权限（Android 6.0+ 需要用户手动授予）
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            Log.w("ApplicationModelShared", "悬浮窗权限未授予，无法启动FloatingFabService");
            // 不启动服务，避免无意义的尝试
            return;
        }

        // 检查服务是否已启动
        if (floatingFabService != null) {
            Log.d("ApplicationModelShared", "FloatingFabService 已启动，跳过重复启动");
            return;
        }

        Intent serviceIntent = new Intent(this, FloatingFabService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
        }
        Log.d("ApplicationModelShared", "FloatingFabService 已启动");
    }

    private void onAppExit() {
        // 这里处理应用退出逻辑
        Log.e("MyApp", "Application is exiting");
        UserInfoViewModel userInfoViewModel = new ViewModelProvider(
                this,
                new ViewModelProvider.AndroidViewModelFactory(this)
        ).get(UserInfoViewModel.class);
        userInfoViewModel.token.postValue("");
        userInfoViewModel.userId.postValue("");
        userInfoViewModel.userInfo.postValue(new UserInfo());
        ScreenCastingManager.setClassMode(false);
        ScreenCastingManager.stopLoop();
        UdpForwarderManager.getInstance().stop();
        H264MpegTSStreamerManager.getInstance().stop();
        multicastLock.release();
        fakeClassMode = false;
        
        // 停止系统级悬浮FAB按钮服务
        stopFloatingFabService();
    }

    /**
     * 停止系统级悬浮FAB按钮服务
     */
    private void stopFloatingFabService() {
        Intent serviceIntent = new Intent(this, FloatingFabService.class);
        stopService(serviceIntent);
        Log.d("ApplicationModelShared", "FloatingFabService 已停止");
    }

    public static ApplicationModelShared getInstance() {
            return appInstance;
    }

    public void setFloatingWindowService(FloatingRobotService service) {
        floatingRobotService = service;
    }

    public FloatingRobotService getFloatingWindowService() {
        return floatingRobotService;
    }

    public void setFloatingFabService(FloatingFabService service) {
        floatingFabService = service;
    }

    public FloatingFabService getFloatingFabService() {
        return floatingFabService;
    }

    public void setWebAppInterface(WebAppInterface webAppInterface) {
        this.webAppInterface = webAppInterface;
    }

    public WebAppInterface getWebAppInterface() {
        return webAppInterface;
    }

    @NonNull
    @Override
    public ViewModelStore getViewModelStore() {
        return viewModelStore;
    }
}
