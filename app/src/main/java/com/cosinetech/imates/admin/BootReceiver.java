package com.cosinetech.imates.admin;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

public class BootReceiver extends BroadcastReceiver {
    private static final String TAG = "BootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        Log.d(TAG, "Received action: " + action);

        if (Intent.ACTION_BOOT_COMPLETED.equals(action) ||
                Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {

            KioskManager kioskManager = KioskManager.getInstance();
            kioskManager.initialize(context);

            // 启动监控服务
            Intent serviceIntent = new Intent(context, AppMonitorService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            }

            // 如果之前启用了Kiosk模式，自动启动桌面
            if (kioskManager.isKioskModeEnabled() && kioskManager.isDeviceOwner()) {
                Intent launcherIntent = new Intent(context, KioskLauncherActivity.class);
                launcherIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(launcherIntent);
            }
        }
    }
}
