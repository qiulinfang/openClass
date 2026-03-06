package com.cosinetech.imates.ui.fab;

import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;
import android.util.DisplayMetrics;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.ImageView;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import com.bumptech.glide.Glide;
import com.cosinetech.imates.ApplicationModelShared;
import com.cosinetech.imates.R;
import com.cosinetech.imates.ui.webview.MainWebViewActivity;
import com.cosinetech.imates.ui.webview.common.WebAppInterface;
import com.cosinetech.imates.utils.ScreenUtils;

/**
 * 系统级悬浮FAB按钮服务
 * 提供草稿本和AI聊天功能的快速访问入口
 */
public class FloatingFabService extends Service {
    private static final String TAG = "FloatingFabService";
    private static final String CHANNEL_ID = "floating_fab_channel";
    private static final int NOTIFICATION_ID = 2;
    private static final String ACTION_OPEN_DRAFT = "openDraft";
    private static final String ACTION_TOGGLE_FAB = "toggleFab";

    private WindowManager windowManager;
    private View floatingFabView;
    private ImageView lottieAnimationView;
    
    private WindowManager.LayoutParams layoutParams;
    private int screenWidth;
    private int screenHeight;

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @SuppressLint("ClickableViewAccessibility")
    @Override
    public void onCreate() {
        super.onCreate();
        sendLogToWeb("INFO", TAG, "========== FloatingFabService onCreate 开始 ==========");

        // 创建通知通道（对于 Android 8.0 及以上）
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            sendLogToWeb("DEBUG", TAG, "步骤1: 创建通知通道（Android 8.0+）");
            CharSequence name = "AI学伴悬浮按钮";
            String description = "用于显示 AI学伴悬浮按钮服务的通知";
            int importance = NotificationManager.IMPORTANCE_LOW;
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, name, importance);
            channel.setDescription(description);
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            notificationManager.createNotificationChannel(channel);
            sendLogToWeb("INFO", TAG, "步骤1结果: 通知通道创建成功");
        } else {
            sendLogToWeb("DEBUG", TAG, "步骤1: 跳过通知通道创建（Android版本 < 8.0）");
        }

        // 创建并启动前台服务
        sendLogToWeb("DEBUG", TAG, "步骤2: 创建并启动前台服务");
        Notification notification = createNotification();
        startForeground(NOTIFICATION_ID, notification);
        sendLogToWeb("INFO", TAG, "步骤2结果: 前台服务已启动");

        // 获取屏幕尺寸
        sendLogToWeb("DEBUG", TAG, "步骤3: 获取屏幕尺寸");
        try {
            WindowManager wm = (WindowManager) getSystemService(WINDOW_SERVICE);
            if (wm != null) {
                DisplayMetrics dm = new DisplayMetrics();
                wm.getDefaultDisplay().getRealMetrics(dm);
                screenWidth = dm.widthPixels;
                screenHeight = dm.heightPixels;
            } else {
                screenWidth = ScreenUtils.getScreenWidth(this);
                screenHeight = ScreenUtils.getScreenHeight(this);
            }
        } catch (Exception e) {
            screenWidth = ScreenUtils.getScreenWidth(this);
            screenHeight = ScreenUtils.getScreenHeight(this);
        }
        sendLogToWeb("INFO", TAG, "步骤3结果: 屏幕尺寸=" + screenWidth + "x" + screenHeight);

        // 注册服务到Application
        sendLogToWeb("DEBUG", TAG, "步骤4: 注册服务到Application");
        ApplicationModelShared myapp = (ApplicationModelShared) getApplication();
        myapp.setFloatingFabService(this);
        sendLogToWeb("INFO", TAG, "步骤4结果: 服务已注册到Application");

        // 初始化悬浮窗口
        sendLogToWeb("DEBUG", TAG, "步骤5: 初始化悬浮窗口");
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        if (windowManager == null) {
            sendLogToWeb("ERROR", TAG, "步骤5结果: WindowManager获取失败");
            return;
        }
        sendLogToWeb("INFO", TAG, "步骤5结果: WindowManager获取成功");
        initFloatingFab();
        sendLogToWeb("INFO", TAG, "========== FloatingFabService onCreate 完成 ==========");
    }

    @SuppressLint("ClickableViewAccessibility")
    private void initFloatingFab() {
        sendLogToWeb("DEBUG", TAG, "initFloatingFab: 开始初始化悬浮按钮");
        
        // 创建窗口布局参数
        sendLogToWeb("DEBUG", TAG, "initFloatingFab 步骤1: 创建窗口布局参数");
        layoutParams = new WindowManager.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                        | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT);
        sendLogToWeb("INFO", TAG, "initFloatingFab 步骤1结果: 布局参数创建成功，类型=TYPE_APPLICATION_OVERLAY");

        // 加载布局
        sendLogToWeb("DEBUG", TAG, "initFloatingFab 步骤2: 加载布局文件");
        LayoutInflater inflater = (LayoutInflater) getSystemService(LAYOUT_INFLATER_SERVICE);
        if (inflater == null) {
            sendLogToWeb("ERROR", TAG, "initFloatingFab 步骤2结果: LayoutInflater获取失败");
            return;
        }
        floatingFabView = inflater.inflate(R.layout.floating_fab, null);
        if (floatingFabView == null) {
            sendLogToWeb("ERROR", TAG, "initFloatingFab 步骤2结果: 布局加载失败，floatingFabView为null");
            return;
        }
        sendLogToWeb("INFO", TAG, "initFloatingFab 步骤2结果: 布局加载成功");

        // 获取视图组件
        sendLogToWeb("DEBUG", TAG, "initFloatingFab 步骤3: 获取视图组件");
        lottieAnimationView = floatingFabView.findViewById(R.id.lottie_animation_view);
        
        if (lottieAnimationView == null) {
            sendLogToWeb("ERROR", TAG, "initFloatingFab 步骤3结果: lottieAnimationView获取失败");
            return;
        } else {
            sendLogToWeb("INFO", TAG, "initFloatingFab 步骤3结果: 所有视图组件获取成功");
            try {
                // 复刻 Web FAB：使用动图 ip.gif 作为按钮背景
                Glide.with(this)
                        .asGif()
                        .load(R.drawable.ip)
                        .into(lottieAnimationView);
            } catch (Exception e) {
                sendLogToWeb("WARN", TAG, "initFloatingFab: 加载 ip.gif 失败 - " + e.getMessage());
            }
        }

        // 初始位置：右下角
        sendLogToWeb("DEBUG", TAG, "initFloatingFab 步骤4: 设置初始位置（右下角）");
        // 使用 TOP|START + 正坐标体系，跨 ROM 更稳定（避免 BOTTOM|END 下负坐标导致拖拽看起来不动）
        layoutParams.gravity = Gravity.TOP | Gravity.START;
        int margin = ScreenUtils.dpToPx(this, 18);
        // 先给一个初始值，等 addView 后 width/height 可用再校准
        layoutParams.x = Math.max(0, screenWidth - margin);
        layoutParams.y = Math.max(0, screenHeight - margin);
        sendLogToWeb("INFO", TAG, "initFloatingFab 步骤4结果: 位置设置完成，gravity=TOP|START");

        // 添加窗口
        sendLogToWeb("DEBUG", TAG, "initFloatingFab 步骤5: 添加窗口到WindowManager");
        try {
            windowManager.addView(floatingFabView, layoutParams);
            sendLogToWeb("INFO", TAG, "initFloatingFab 步骤5结果: 窗口添加成功，悬浮按钮应该已经显示");
        } catch (Exception e) {
            sendLogToWeb("ERROR", TAG, "initFloatingFab 步骤5结果: 窗口添加失败 - " + e.getMessage());
            Log.e(TAG, "添加悬浮窗口失败", e);
            return;
        }

        // addView 后再根据真实尺寸把悬浮按钮放到右下角
        try {
            floatingFabView.post(() -> {
                try {
                    int viewWidth = floatingFabView.getWidth();
                    int viewHeight = floatingFabView.getHeight();
                    int safeMargin = ScreenUtils.dpToPx(this, 18);
                    layoutParams.x = Math.max(0, screenWidth - viewWidth - safeMargin);
                    layoutParams.y = Math.max(0, screenHeight - viewHeight - safeMargin);
                    windowManager.updateViewLayout(floatingFabView, layoutParams);
                } catch (Exception ignore) {
                }
            });
        } catch (Exception ignore) {
        }

        // 设置主按钮触摸事件（拖拽和点击）
        lottieAnimationView.setOnTouchListener(new View.OnTouchListener() {
            private int initialX;
            private int initialY;
            private float initialTouchX;
            private float initialTouchY;
            private boolean hasMoved = false;

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                switch (event.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        // 记录初始位置
                        initialX = layoutParams.x;
                        initialY = layoutParams.y;
                        // 记录触摸点位置
                        initialTouchX = event.getRawX();
                        initialTouchY = event.getRawY();
                        // 重置移动标记
                        hasMoved = false;
                        // 缩小一点表示按下
                        v.animate().scaleX(0.9f).scaleY(0.9f).setDuration(100).start();
                        return true;

                    case MotionEvent.ACTION_MOVE:
                        // 计算移动的偏移量
                        int offsetX = (int) (event.getRawX() - initialTouchX);
                        int offsetY = (int) (event.getRawY() - initialTouchY);
                        
                        // 如果移动距离超过阈值，认为是拖拽
                        if (Math.abs(offsetX) > 10 || Math.abs(offsetY) > 10) {
                            hasMoved = true;
                        }
                        
                        // 更新悬浮窗的位置（考虑边界限制）
                        int newX = initialX + offsetX;
                        int newY = initialY + offsetY;
                        
                        // 获取视图宽度和高度
                        int viewWidth = floatingFabView.getWidth();
                        int viewHeight = floatingFabView.getHeight();
                        
                        // 限制在屏幕范围内
                        layoutParams.x = Math.max(0, Math.min(newX, screenWidth - viewWidth));
                        layoutParams.y = Math.max(0, Math.min(newY, screenHeight - viewHeight));
                        windowManager.updateViewLayout(floatingFabView, layoutParams);
                        return true;

                    case MotionEvent.ACTION_UP:
                        // 恢复原始大小
                        v.animate().scaleX(1.0f).scaleY(1.0f).setDuration(100).start();
                        // 判断是否为点击事件
                        float deltaX = event.getRawX() - initialTouchX;
                        float deltaY = event.getRawY() - initialTouchY;
                        if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10 && !hasMoved) {
                            // 单击主按钮：复刻 Web FAB 行为（toggle 聊天面板）
                            handleMenuItemClick(ACTION_TOGGLE_FAB);
                        }
                        return true;

                    case MotionEvent.ACTION_CANCEL:
                        // 恢复原始大小
                        v.animate().scaleX(1.0f).scaleY(1.0f).setDuration(100).start();
                        return true;
                }
                return false;
            }
        });
        sendLogToWeb("INFO", TAG, "initFloatingFab: 初始化完成");
    }

    /**
     * 处理菜单项点击
     */
    private void handleMenuItemClick(String action) {
        final String clickTraceId = "fab-click-" + System.currentTimeMillis();
        Log.d(TAG, "handleMenuItemClick: clickTraceId=" + clickTraceId + ", action=" + action + ", thread=" + Thread.currentThread().getName());

        // 优先直接向当前 WebView 派发事件，避免通过 startActivity 重启/清栈导致 Web 端跳转 login
        try {
            ApplicationModelShared app = (ApplicationModelShared) getApplication();
            boolean isForeground = app != null && app.isAppInForeground();
            Log.d(TAG, "handleMenuItemClick: clickTraceId=" + clickTraceId + ", isForeground=" + isForeground);
            if (isForeground) {
                WebAppInterface webAppInterface = app.getWebAppInterface();
                if (webAppInterface != null) {
                    Log.d(TAG, "handleMenuItemClick: clickTraceId=" + clickTraceId + ", dispatchFloatingFabActionEventToWeb to WebView, action=" + action);
                    webAppInterface.dispatchFloatingFabActionEventToWeb(action);
                    return;
                } else {
                    Log.w(TAG, "handleMenuItemClick: clickTraceId=" + clickTraceId + ", webAppInterface is null");
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "handleMenuItemClick: clickTraceId=" + clickTraceId + ", dispatchFloatingFabActionEventToWeb failed, fallback to startActivity", e);
        }

        // fallback：应用在后台/或 WebView 不可用时，只唤起应用到前台（不派发 toggleFab，避免改变面板状态）
        Log.d(TAG, "handleMenuItemClick: clickTraceId=" + clickTraceId + ", fallback to startActivity, action=" + action);
        Intent intent = new Intent(this, MainWebViewActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        startActivity(intent);
    }

    /**
     * 隐藏悬浮按钮
     */
    public void hideFab() {
        if (Looper.myLooper() != Looper.getMainLooper()) {
            Log.d(TAG, "hideFab: switching to main thread");
            new Handler(Looper.getMainLooper()).post(this::hideFab);
            return;
        }

        Log.d(TAG, "hideFab: start, thread=" + Thread.currentThread().getName());
        sendLogToWeb("DEBUG", TAG, "hideFab: 隐藏悬浮按钮");
        if (floatingFabView != null) {
            floatingFabView.setVisibility(View.GONE);
            Log.d(TAG, "hideFab: setVisibility(GONE) completed, view=" + floatingFabView);
            sendLogToWeb("INFO", TAG, "hideFab: 悬浮按钮已隐藏");
        } else {
            Log.w(TAG, "hideFab: floatingFabView is null");
            sendLogToWeb("WARN", TAG, "hideFab: floatingFabView为null，无法隐藏");
        }
    }

    /**
     * 显示悬浮按钮
     */
    public void showFab() {
        if (Looper.myLooper() != Looper.getMainLooper()) {
            Log.d(TAG, "showFab: switching to main thread");
            new Handler(Looper.getMainLooper()).post(this::showFab);
            return;
        }

        Log.d(TAG, "showFab: start, thread=" + Thread.currentThread().getName());
        sendLogToWeb("DEBUG", TAG, "showFab: 显示悬浮按钮");
        if (floatingFabView != null) {
            floatingFabView.setVisibility(View.VISIBLE);
            Log.d(TAG, "showFab: setVisibility(VISIBLE) completed, view=" + floatingFabView);
            sendLogToWeb("INFO", TAG, "showFab: 悬浮按钮已显示");
        } else {
            Log.w(TAG, "showFab: floatingFabView is null");
            sendLogToWeb("WARN", TAG, "showFab: floatingFabView为null，无法显示");
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        sendLogToWeb("INFO", TAG, "onStartCommand: 服务被重新启动，保持前台服务运行");
        // 继续保持服务在前台
        startForeground(NOTIFICATION_ID, createNotification());
        sendLogToWeb("INFO", TAG, "onStartCommand: 前台服务已重新启动");
        return START_STICKY;  // 保持服务运行
    }

    private Notification createNotification() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("AI学伴悬浮按钮")
                .setContentText("AI学伴, 伴你进步")
                .setSmallIcon(R.drawable.ic_notification_icon)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        sendLogToWeb("INFO", TAG, "========== FloatingFabService onDestroy 开始 ==========");
        
        if (floatingFabView != null) {
            sendLogToWeb("DEBUG", TAG, "onDestroy: 移除悬浮窗口");
            try {
                windowManager.removeView(floatingFabView);
                sendLogToWeb("INFO", TAG, "onDestroy: 悬浮窗口已移除");
            } catch (Exception e) {
                sendLogToWeb("ERROR", TAG, "onDestroy: 移除悬浮窗口失败 - " + e.getMessage());
            }
            floatingFabView = null;
        } else {
            sendLogToWeb("WARN", TAG, "onDestroy: floatingFabView为null，无需移除");
        }
        sendLogToWeb("INFO", TAG, "========== FloatingFabService onDestroy 完成 ==========");
    }
    
    /**
     * 发送日志到Web前端
     * 第1步：在Android Logcat中打印日志
     * 第2步：获取ApplicationModelShared实例
     * 第3步：获取WebAppInterface引用
     * 第4步：调用WebAppInterface的sendLogToWeb方法发送到Web
     * 第5步：如果获取失败，则只在Android Logcat中打印
     */
    private void sendLogToWeb(String level, String tag, String message) {
        // 第1步：在Android Logcat中打印
        switch (level.toUpperCase()) {
            case "DEBUG":
                Log.d(tag, message);
                break;
            case "INFO":
                Log.i(tag, message);
                break;
            case "WARN":
                Log.w(tag, message);
                break;
            case "ERROR":
                Log.e(tag, message);
                break;
            default:
                Log.i(tag, message);
                break;
        }
        
        // 第2步：尝试发送到Web前端
        try {
            ApplicationModelShared app = (ApplicationModelShared) getApplication();
            if (app != null) {
                // 第3步：获取WebAppInterface引用
                WebAppInterface webAppInterface = app.getWebAppInterface();
                if (webAppInterface != null) {
                    // 第4步：调用WebAppInterface的sendLogToWeb方法
                    webAppInterface.sendLogToWeb(level, tag, message);
                } else {
                    Log.w(TAG, "WebAppInterface未初始化，无法发送日志到Web");
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "发送日志到Web失败: " + e.getMessage());
        }
    }
}

