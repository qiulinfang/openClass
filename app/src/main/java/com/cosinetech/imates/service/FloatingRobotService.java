package com.cosinetech.imates.service;

import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.util.Log;
import android.view.Gravity;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.app.Service;
import android.content.Intent;
import android.graphics.PixelFormat;
import android.os.IBinder;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.widget.Button;
import android.widget.PopupWindow;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import com.airbnb.lottie.LottieAnimationView;
import com.cosinetech.imates.ApplicationModelShared;
import com.cosinetech.imates.R;
import com.cosinetech.imates.models.Subject;
import com.cosinetech.imates.util.ScreenUtils;
import com.cosinetech.imates.util.WindowUtils;
import com.cosinetech.imates.views.ChatAiView;
import com.cosinetech.imates.webservice.ApiUrl;

public class FloatingRobotService extends Service {
    private static final String CHANNEL_ID = "floating_window_channel";
    private static final int NOTIFICATION_ID = 1;

    private WindowManager windowManager;
    private WindowManager.LayoutParams layoutParams;
    private View floatingRobotView;
    //private View popupChatView;

    private LottieAnimationView lottieAnimationView;

    public FloatingRobotService() {
    }


    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @SuppressLint("ClickableViewAccessibility")
    @Override
    public void onCreate() {
        super.onCreate();

        // 创建通知通道（对于 Android 8.0 及以上）
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            CharSequence name = "AI学伴通知";
            String description = "用于显示 AI学伴悬浮窗服务的通知";
            int importance = NotificationManager.IMPORTANCE_DEFAULT;
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, name, importance);
            channel.setDescription(description);
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            notificationManager.createNotificationChannel(channel);
        }

        // 创建并启动前台服务
        Notification notification = createNotification();

        startForeground(NOTIFICATION_ID, notification);

        // Log to verify
        Log.d("FloatingRobotService", "Service started as foreground.");

        // 获取 FragmentManagerProvider
        ApplicationModelShared myapp = (ApplicationModelShared)(getApplication());
        myapp.setFloatingWindowService(this);

        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        layoutParams = new WindowManager.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
                PixelFormat.TRANSLUCENT);

        LayoutInflater inflater = (LayoutInflater) getSystemService(LAYOUT_INFLATER_SERVICE);
        floatingRobotView = inflater.inflate(R.layout.floating_robot, null);
        final int screenWidth = ScreenUtils.getScreenWidth(this);
        final int screenHeight = ScreenUtils.getScreenHeight(this);
        // 初始位置
        layoutParams.x = 0; //ScreenUtils.getScreenWidth(this) - floatingRobotView.getWidth();
        layoutParams.y = 0; //ScreenUtils.getScreenHeight(this) - floatingRobotView.getHeight();
        layoutParams.gravity = Gravity.TOP | Gravity.START;
        windowManager.addView(floatingRobotView, layoutParams);

        lottieAnimationView = floatingRobotView.findViewById(R.id.lottie_animation_view);
        lottieAnimationView.setOnTouchListener(new View.OnTouchListener() {
            private int initialX;
            private int initialY;
            private float initialTouchX;
            private float initialTouchY;

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                switch (event.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        // 记录按下时的坐标
                        initialX = layoutParams.x;
                        initialY = layoutParams.y;

                        initialTouchX = event.getRawX();
                        initialTouchY = event.getRawY();
                        //Log.d("?????????", "onTouch-1: " + initialX  + "," + initialY + "," + initialTouchX + ", " + initialTouchY);
                        return true;

                    case MotionEvent.ACTION_MOVE:
                        // 计算移动的偏移量
                        int offsetX = (int) (event.getRawX() - initialTouchX);
                        int offsetY = (int) (event.getRawY() - initialTouchY);
                        // 更新悬浮窗的位置

                        layoutParams.x = Math.min(initialX + offsetX, screenWidth);
                        layoutParams.y = Math.min(initialY + offsetY, screenHeight);
                        windowManager.updateViewLayout(floatingRobotView, layoutParams);
//                        Log.d("?????????", "onTouch0: " + offsetX  + "," + offsetY);
//                        Log.d("?????????", "onTouch1: " + layoutParams.x  + "," + layoutParams.y);
                        return true;

                    case MotionEvent.ACTION_UP:
                        // 判断是否为点击事件
                        float deltaX = event.getRawX() - initialTouchX;
                        float deltaY = event.getRawY() - initialTouchY;
                        if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
                            // 如果移动距离小于阈值，认为是点击事件
                            popupChatBot(ApiUrl.URL_CHAT_GENERAL, Subject.SUBJECT_ALL.name());
                        }
                        return true;
                }
                return true;
            }
        });

         //// 使悬浮窗可拖动
//        floatingRobotView.setOnTouchListener(new View.OnTouchListener() {
//            private int initialX;
//            private int initialY;
//            private float initialTouchX;
//            private float initialTouchY;
//
//            @Override
//            public boolean onTouch(View v, MotionEvent event) {
//                switch (event.getAction()) {
//                    case MotionEvent.ACTION_DOWN:
//                        initialX = layoutParams.x;
//                        initialY = layoutParams.y;
//                        initialTouchX = event.getRawX();
//                        initialTouchY = event.getRawY();
//                        return true;
//                    case MotionEvent.ACTION_MOVE:
//                        layoutParams.x = initialX + (int) (event.getRawX() - initialTouchX);
//                        layoutParams.y = initialY + (int) (event.getRawY() - initialTouchY);
//                        windowManager.updateViewLayout(floatingRobotView, layoutParams);
//                        Log.d("?????????", "onTouch1: " + layoutParams.x  + "," + layoutParams.y);
//                        return true;
//                }
//                return true;
//            }
//        });
    }

    public void hideMe() {
        if(floatingRobotView != null) {
            floatingRobotView.setVisibility(View.GONE);
        }
    }

    public void showMe() {
        if(floatingRobotView != null) {
            floatingRobotView.setVisibility(View.VISIBLE);
        }
    }
    public void popupChatBot1(String url, String tag) {
        int screenWidth = ScreenUtils.getScreenWidth(this);
        int screenHeight = ScreenUtils.getScreenHeight(this);

        // 配置 LayoutParams
        WindowManager.LayoutParams layoutPopup = new WindowManager.LayoutParams(
                screenWidth / 2 + screenWidth / 4,
                screenHeight,
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY, // 确保权限
                WindowManager.LayoutParams.FLAG_ALT_FOCUSABLE_IM, // 根据需要调整 FLAG
                PixelFormat.TRANSLUCENT
        );

        layoutParams.flags &= ~WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE;
        layoutParams.flags |= WindowManager.LayoutParams.FLAG_ALT_FOCUSABLE_IM;

        layoutPopup.gravity = Gravity.TOP | Gravity.START; // 显示位置
        layoutPopup.x = screenWidth / 2;
        layoutPopup.y = 0;

        // 初始化并加载布局
        final View popupChatView = LayoutInflater.from(this).inflate(R.layout.popup_window_chat, null);
        windowManager.addView(popupChatView, layoutPopup);

        // 添加交互事件
        popupChatView.setOnTouchListener(new View.OnTouchListener() {
            private int initialX;
            private int initialY;
            private float initialTouchX;
            private float initialTouchY;

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                switch (event.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        initialX = layoutPopup.x;
                        initialY = layoutPopup.y;
                        initialTouchX = event.getRawX();
                        initialTouchY = event.getRawY();
                        return true;

                    case MotionEvent.ACTION_MOVE:
                        layoutPopup.x = initialX + (int) (event.getRawX() - initialTouchX);
                        layoutPopup.y = initialY + (int) (event.getRawY() - initialTouchY);
                        windowManager.updateViewLayout(popupChatView, layoutPopup);
                        return true;
                }
                return false;
            }
        });

        Button btnExit = popupChatView.findViewById(R.id.btn_exit);
        btnExit.setOnClickListener(v-> {
            windowManager.removeView(popupChatView);
        });
    }

    public void popupChatBot(String url, String tag) {
        // 加载 PopupWindow 的布局
        View popupView = LayoutInflater.from(this).inflate(R.layout.popup_window_chat, null);

        popupView.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION // 隐藏导航栏
                        | View.SYSTEM_UI_FLAG_FULLSCREEN); // 隐藏状态栏

        int screenWidth = ScreenUtils.getScreenWidth(this);
        int screenHeight = ScreenUtils.getScreenHeight(this);

        // 初始化 PopupWindow
        PopupWindow popupWindow = new PopupWindow(
                popupView,
                screenWidth / 2,
                screenHeight,
                true
        );

        // 设置 PopupWindow 的背景
        popupWindow.setBackgroundDrawable(ContextCompat.getDrawable(this, android.R.color.transparent));

        // 显示 PopupWindow
        popupWindow.showAtLocation(floatingRobotView, Gravity.START, 0, 0);

        popupWindow.setOutsideTouchable(false);

        popupWindow.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);


        Button btnExit = popupView.findViewById(R.id.btn_exit);
        btnExit.setOnClickListener(v-> {
            popupWindow.dismiss();
        });

        ChatAiView  chatView = popupView.findViewById(R.id.chat_view);
        ChatAiView.ChatAiParam param = new ChatAiView.ChatAiParam();
        param.tag = tag;
        param.chatBotUrl = url;
        param.showHeader = true;
        param.streamDisplay = true;
        param.showHistory = true;
        param.initialSendEnable = true;
        param.listener = null;
        chatView.setChatAiParam(param);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // 继续保持服务在前台
        startForeground(NOTIFICATION_ID, createNotification());
        return START_STICKY;  // 保持服务运行
    }

    private Notification createNotification() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("AI学伴")
                .setContentText("AI学伴, 伴你进步")
                .setSmallIcon(R.mipmap.ic_launcher)
                .build();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (floatingRobotView != null) {
            windowManager.removeView(floatingRobotView);
            floatingRobotView = null;
        }
    }
}
