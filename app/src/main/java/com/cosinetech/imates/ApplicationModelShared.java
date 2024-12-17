package com.cosinetech.imates;

import android.app.Application;

import androidx.annotation.NonNull;
import androidx.lifecycle.ViewModelStore;
import androidx.lifecycle.ViewModelStoreOwner;

import com.cosinetech.imates.activities.MainActivity;

public class ApplicationModelShared extends Application implements ViewModelStoreOwner {
    private final ViewModelStore viewModelStore = new ViewModelStore();
    private MainActivity mainActivity;

    public void setMainActivity(MainActivity activity) {
        mainActivity = activity;
    }

    public MainActivity getMainActivity() {
        return mainActivity;
    }

    @NonNull
    @Override
    public ViewModelStore getViewModelStore() {
        return viewModelStore;
    }
}
