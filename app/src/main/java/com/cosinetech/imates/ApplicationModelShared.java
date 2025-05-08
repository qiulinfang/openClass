package com.cosinetech.imates;

import android.app.Activity;
import android.app.Application;
import android.os.Bundle;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.lifecycle.ViewModelStore;
import androidx.lifecycle.ViewModelStoreOwner;

import com.cosinetech.imates.activities.MainActivity;
import com.cosinetech.imates.screencasting.H264MpegTSStreamerManager;
import com.cosinetech.imates.screencasting.UdpForwarderManager;
import com.cosinetech.imates.service.FloatingRobotService;
import com.cosinetech.imates.util.AssetsCopyUtils;
import com.cosinetech.imates.webservice.AiChatMessageRequest;

public class ApplicationModelShared extends Application implements ViewModelStoreOwner {
    private final ViewModelStore viewModelStore = new ViewModelStore();
    private MainActivity mainActivity;
    private FloatingRobotService floatingRobotService;

    public AiChatMessageRequest chatRequest;

    private int activityCount = 0;
    private static ApplicationModelShared appInstance = null;

    @Override
    public void onCreate() {
        super.onCreate();
        appInstance = this;
        // 拷贝文件到 Documents 目录
        AssetsCopyUtils.copyAssetsToDocuments(this);
        UdpForwarderManager.getInstance().start();
        H264MpegTSStreamerManager.getInstance();
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
    }

    private void onAppExit() {
        // 这里处理应用退出逻辑
        Log.e("MyApp", "Application is exiting");
        UdpForwarderManager.getInstance().stop();
        H264MpegTSStreamerManager.getInstance().stop();
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

    @NonNull
    @Override
    public ViewModelStore getViewModelStore() {
        return viewModelStore;
    }
}
