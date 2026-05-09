package com.cosinetech.imates.screencasting;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import com.cosinetech.imates.R;

/**
 * 课堂连接维护服务
 * 目的：确保 App 在后台时，心跳包发送线程和通信逻辑不会被系统挂起或杀掉。
 */
public class ClassroomService extends Service {
    private static final String TAG = "ClassroomService";
    private static final String CHANNEL_ID = "classroom_connection_channel";
    private static final int NOTIFICATION_ID = 10087;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.i(TAG, "ClassroomService onCreate");
        ensureChannel();
        startForegroundCompat();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.i(TAG, "ClassroomService onStartCommand");
        if (intent != null) {
            String userId = intent.getStringExtra("userId");
            String studentName = intent.getStringExtra("studentName");
            Log.i(TAG, "启动参数: userId=" + userId + ", studentName=" + studentName);
        }
        // START_STICKY 表示服务被杀后尝试自动重启
        return START_STICKY;
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "课堂连接维护",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("保持课堂连接稳定性，防止后台掉线");
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.createNotificationChannel(channel);
            }
        }
    }

    private void startForegroundCompat() {
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification_icon)
                .setContentTitle("研伴课堂")
                .setContentText("课堂连接维护中，确保互动稳定性")
                .setOngoing(true)
                .build();

        // 适配 Android 14+ 的特殊用途前台服务类型（如果需要）
        // 目前先使用基础方式，因为 manifest 中已经声明了 FOREGROUND_SERVICE_SPECIAL_USE
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // 注意：这里需要确保 manifest 中声明了对应的 type
            startForeground(NOTIFICATION_ID, notification);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    @Override
    public void onDestroy() {
        Log.i(TAG, "ClassroomService onDestroy");
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
