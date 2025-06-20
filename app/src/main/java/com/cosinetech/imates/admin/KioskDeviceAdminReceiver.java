package com.cosinetech.imates.admin;

import android.app.admin.DeviceAdminReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class KioskDeviceAdminReceiver extends DeviceAdminReceiver {
    private static final String TAG = "KioskDeviceAdmin";

    @Override
    public void onEnabled(Context context, Intent intent) {
        super.onEnabled(context, intent);
        Log.d(TAG, "Device Admin enabled");

        // 启用设备管理员后初始化Kiosk模式
        KioskManager.getInstance().onDeviceAdminEnabled(context);
    }

    @Override
    public void onDisabled(Context context, Intent intent) {
        super.onDisabled(context, intent);
        Log.d(TAG, "Device Admin disabled");

        KioskManager.getInstance().onDeviceAdminDisabled(context);
    }

    @Override
    public void onLockTaskModeEntering(Context context, Intent intent, String pkg) {
        super.onLockTaskModeEntering(context, intent, pkg);
        Log.d(TAG, "Lock Task Mode entering: " + pkg);
    }

    @Override
    public void onLockTaskModeExiting(Context context, Intent intent) {
        super.onLockTaskModeExiting(context, intent);
        Log.d(TAG, "Lock Task Mode exiting");
    }
}
