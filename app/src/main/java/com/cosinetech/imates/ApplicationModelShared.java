package com.cosinetech.imates;

import android.app.Application;
import android.graphics.Bitmap;
import android.util.Log;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.RelativeLayout;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.lifecycle.ViewModelStore;
import androidx.lifecycle.ViewModelStoreOwner;

import com.bumptech.glide.Glide;
import com.bumptech.glide.request.target.SimpleTarget;
import com.bumptech.glide.request.transition.Transition;
import com.cosinetech.imates.activities.MainActivity;
import com.cosinetech.imates.service.FloatingRobotService;
import com.cosinetech.imates.util.AssetsCopyUtils;
import com.cosinetech.imates.webservice.AiChatMessageRequest;

public class ApplicationModelShared extends Application implements ViewModelStoreOwner {
    private final ViewModelStore viewModelStore = new ViewModelStore();
    private MainActivity mainActivity;
    private FloatingRobotService floatingRobotService;

    public AiChatMessageRequest chatRequest;

    private static ApplicationModelShared appInstance = null;

    @Override
    public void onCreate() {
        super.onCreate();
        appInstance = this;
        // 拷贝文件到 Documents 目录
        AssetsCopyUtils.copyAssetsToDocuments(this);
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
