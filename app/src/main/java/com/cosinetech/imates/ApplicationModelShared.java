package com.cosinetech.imates;

import android.app.Activity;
import android.app.Application;
import android.content.Context;
import android.content.Intent;
import android.net.wifi.WifiManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.util.Log;
import android.content.pm.PackageManager;

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

    // Web 侧可能在 Service 启动/注册前就调用 setFloatingFabVisible，这里做一次兜底缓存
    private volatile Boolean pendingFloatingFabVisible = null;

    public AiChatMessageRequest chatRequest;

    private int activityCount = 0;
    private int resumedCount = 0;
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
            @Override
            public void onActivityResumed(Activity activity) {
                resumedCount++;
            }

            @Override
            public void onActivityPaused(Activity activity) {
                resumedCount = Math.max(0, resumedCount - 1);
                // 当应用进入后台时，强制显示悬浮按钮，保证用户能从后台点击悬浮唤起应用
                if (resumedCount == 0) {
                    forceShowFloatingFabInBackground();
                }
            }
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

    public boolean isAppInForeground() {
        return resumedCount > 0;
    }

    private void forceShowFloatingFabInBackground() {
        try {
            // 进入后台时以“显示”为最终状态（即使 Web 侧同步了 hide）
            pendingFloatingFabVisible = true;

            if (floatingFabService != null) {
                floatingFabService.showFab();
                return;
            }

            // Service 还没启动时，尝试启动（会在 setFloatingFabService 时应用 pending 状态）
            startFloatingFabService();
        } catch (Exception e) {
            Log.w("ApplicationModelShared", "forceShowFloatingFabInBackground failed", e);
        }
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
        Log.d("ApplicationModelShared", "startFloatingFabService called, hasInstance=" + (floatingFabService != null));
        // 检查悬浮窗权限（Android 6.0+ 需要用户手动授予）
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            Log.w("ApplicationModelShared", "悬浮窗权限未授予，无法启动FloatingFabService, canDrawOverlays=false");
            // 引导用户前往系统设置开启悬浮窗权限
            try {
                Uri packageUri = Uri.parse("package:" + getPackageName());

                // 方案1：直达当前应用的“在其他应用上层显示”页面（部分 ROM 可能会退化为列表页）
                Intent overlayIntent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, packageUri);
                overlayIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                overlayIntent.putExtra("packageName", getPackageName());

                PackageManager pm = getPackageManager();
                if (pm != null && overlayIntent.resolveActivity(pm) != null) {
                    startActivity(overlayIntent);
                    Log.d("ApplicationModelShared", "已尝试跳转到悬浮窗权限设置页（直达应用）");
                } else {
                    throw new IllegalStateException("ACTION_MANAGE_OVERLAY_PERMISSION not resolvable");
                }
            } catch (Exception e) {
                Log.w("ApplicationModelShared", "跳转悬浮窗权限设置页失败，fallback到应用详情页", e);
                // 方案2：fallback 到本应用详情页（至少能让用户快速进入权限管理）
                try {
                    Intent appDetailIntent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                    appDetailIntent.setData(Uri.parse("package:" + getPackageName()));
                    appDetailIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(appDetailIntent);
                    Log.d("ApplicationModelShared", "已跳转到应用详情设置页（fallback）");
                } catch (Exception e2) {
                    Log.w("ApplicationModelShared", "跳转应用详情设置页失败", e2);
                }
            }
            // 不启动服务，避免无意义的尝试
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Log.d("ApplicationModelShared", "startFloatingFabService: canDrawOverlays=true");
        }

        // 检查服务是否已启动
        if (floatingFabService != null) {
            Log.d("ApplicationModelShared", "FloatingFabService 已启动，跳过重复启动");
            return;
        }

        Intent serviceIntent = new Intent(this, FloatingFabService.class);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent);
            } else {
                startService(serviceIntent);
            }
            Log.d("ApplicationModelShared", "FloatingFabService startService invoked");
        } catch (Exception e) {
            Log.e("ApplicationModelShared", "FloatingFabService startService failed", e);
        }
    }

    private void onAppExit() {
        try {
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
        } catch (Exception e) {
            Log.e("MyApp", "Error during app exit: " + e.getMessage());
        }
        finally {
            android.os.Process.killProcess(android.os.Process.myPid());
            System.exit(0);
        }
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

        // 应用 Web 侧提前同步过来的显示/隐藏状态，避免时序导致悬浮按钮一直不出现
        try {
            if (floatingFabService != null && pendingFloatingFabVisible != null) {
                if (pendingFloatingFabVisible) {
                    floatingFabService.showFab();
                } else {
                    floatingFabService.hideFab();
                }
            }
        } catch (Exception e) {
            Log.w("ApplicationModelShared", "apply pendingFloatingFabVisible failed: " + e.getMessage());
        }
    }

    public void setPendingFloatingFabVisible(@Nullable Boolean visible) {
        pendingFloatingFabVisible = visible;
    }

    @Nullable
    public Boolean getPendingFloatingFabVisible() {
        return pendingFloatingFabVisible;
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
