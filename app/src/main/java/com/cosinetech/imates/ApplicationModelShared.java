package com.cosinetech.imates;

import android.app.Application;

import androidx.annotation.NonNull;
import androidx.lifecycle.ViewModelStore;
import androidx.lifecycle.ViewModelStoreOwner;

import com.cosinetech.imates.activities.MainActivity;
import com.cosinetech.imates.service.FloatingWindowService;

public class ApplicationModelShared extends Application implements ViewModelStoreOwner {
    private final ViewModelStore viewModelStore = new ViewModelStore();
    private MainActivity mainActivity;
    private FloatingWindowService floatingWindowService;

    public void setMainActivity(MainActivity activity) {
        mainActivity = activity;
    }

    public MainActivity getMainActivity() {
        return mainActivity;
    }

    public void setFloatingWindowService(FloatingWindowService service) {
        floatingWindowService = service;
    }

    public FloatingWindowService getFloatingWindowService() {
        return floatingWindowService;
    }

    @NonNull
    @Override
    public ViewModelStore getViewModelStore() {
        return viewModelStore;
    }
}
