package com.cosinetech.imates.deviceadmin;

import android.app.ActivityManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;
import androidx.core.app.NotificationCompat;

import com.cosinetech.imates.R;

import java.util.List;
import java.util.SortedMap;
import java.util.TreeMap;

public class AppMonitorService extends Service {
    private static final String TAG = "AppMonitorService";
    private static final String CHANNEL_ID = "kiosk_monitor_channel";
    private static final int NOTIFICATION_ID = 1001;
    private static final long CHECK_INTERVAL = 1000; // 1秒检查一次

    private Handler handler;
    private Runnable monitorRunnable;
    private ActivityManager activityManager;
    private UsageStatsManager usageStatsManager;
    private KioskManager kioskManager;

    @Override
    public void onCreate() {
        super.onCreate();

        activityManager = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
        usageStatsManager = (UsageStatsManager) getSystemService(Context.USAGE_STATS_SERVICE);
        kioskManager = KioskManager.getInstance();
        handler = new Handler(Looper.getMainLooper());

        createNotificationChannel();
        startForeground(NOTIFICATION_ID, createNotification());

        startMonitoring();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Kiosk Monitor Service",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("监控应用使用情况");

            NotificationManager manager = getSystemService(NotificationManager.class);
            manager.createNotificationChannel(channel);
        }
    }

    private Notification createNotification() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("学生平板控制")
                .setContentText("正在监控应用使用情况")
                .setSmallIcon(R.drawable.ic_warning)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .build();
    }

    private void startMonitoring() {
        monitorRunnable = new Runnable() {
            @Override
            public void run() {
                checkCurrentApp();
                handler.postDelayed(this, CHECK_INTERVAL);
            }
        };

        handler.post(monitorRunnable);
        Log.d(TAG, "App monitoring started");
    }

    private void checkCurrentApp() {
        String currentApp = getCurrentForegroundApp();

        if (currentApp != null && !kioskManager.isAppAllowed(currentApp)) {
            Log.w(TAG, "Unauthorized app detected: " + currentApp);
            handleUnauthorizedApp(currentApp);
        }
    }

    private String getCurrentForegroundApp() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            // 使用UsageStatsManager (Android 5.0+)
            long time = System.currentTimeMillis();
            SortedMap<Long, UsageStats> usageStats = new TreeMap<>();

            List<UsageStats> stats = usageStatsManager.queryUsageStats(
                    UsageStatsManager.INTERVAL_DAILY,
                    time - 1000 * 60, // 最近1分钟
                    time
            );

            if (stats != null) {
                for (UsageStats usageStat : stats) {
                    usageStats.put(usageStat.getLastTimeUsed(), usageStat);
                }

                if (!usageStats.isEmpty()) {
                    return usageStats.get(usageStats.lastKey()).getPackageName();
                }
            }
        } else {
            // 使用ActivityManager (Android 5.0以下)
            List<ActivityManager.RunningTaskInfo> tasks =
                    activityManager.getRunningTasks(1);

            if (!tasks.isEmpty()) {
                return tasks.get(0).topActivity.getPackageName();
            }
        }

        return null;
    }

    private void handleUnauthorizedApp(String packageName) {
        try {
            // 方法1: 启动允许的应用
            launchAllowedApp();

            // 方法2: 显示警告对话框
            showWarningDialog(packageName);

            // 方法3: 记录违规行为
            logViolation(packageName);

        } catch (Exception e) {
            Log.e(TAG, "Error handling unauthorized app", e);
        }
    }

    private void launchAllowedApp() {
        // 启动默认的学习应用或桌面
        Intent intent = getPackageManager().getLaunchIntentForPackage("com.cosinetech.imates");
        if (intent == null) {
            // 如果没有找到学习应用，启动自定义桌面
            intent = new Intent(this, KioskLauncherActivity.class);
        }

        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        startActivity(intent);
    }

    private void showWarningDialog(String packageName) {
        Intent dialogIntent = new Intent(this, WarningDialogActivity.class);
        dialogIntent.putExtra("unauthorized_app", packageName);
        dialogIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivity(dialogIntent);
    }

    private void logViolation(String packageName) {
        // 记录违规使用日志，可以发送到服务器
        Log.w(TAG, "Violation logged: " + packageName + " at " + System.currentTimeMillis());

        // TODO: 发送到远程服务器进行记录和分析
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY; // 服务被杀死后自动重启
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (handler != null && monitorRunnable != null) {
            handler.removeCallbacks(monitorRunnable);
        }
        Log.d(TAG, "App monitoring stopped");
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
