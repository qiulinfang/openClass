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
import androidx.fragment.app.FragmentManager;
import androidx.fragment.app.FragmentTransaction;

import com.airbnb.lottie.LottieAnimationView;
import com.cosinetech.imates.ApplicationModelShared;
import com.cosinetech.imates.fragments.FragmentChatAi;
import com.cosinetech.imates.R;
import com.cosinetech.imates.models.Subject;
import com.cosinetech.imates.util.ScreenUtils;
import com.cosinetech.imates.webservice.ApiUrl;

public class FloatingWindowService extends Service {
    public interface FragmentManagerProvider {
        FragmentManager getFragmentManagerForFloatingWindow(View floatingView);
    }
    private static final String CHANNEL_ID = "floating_window_channel";
    private static final int NOTIFICATION_ID = 1;

    private FragmentManagerProvider fragmentManagerProvider;
    private WindowManager windowManager;
    private WindowManager.LayoutParams layoutParams;
    private View floatingRobotView;
    private View popupChatView;

    public FloatingWindowService() {
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
            CharSequence name = "Floating Window Service";
            String description = "Floating window service notification";
            int importance = NotificationManager.IMPORTANCE_DEFAULT;
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, name, importance);
            channel.setDescription(description);
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            notificationManager.createNotificationChannel(channel);
        }

        // 创建并启动前台服务
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Floating Window")
                .setContentText("Floating Window Service is running")
                .setSmallIcon(R.mipmap.ic_launcher)
                .build();

        startForeground(NOTIFICATION_ID, notification);

        // Log to verify
        Log.d("FloatingWindowService", "Service started as foreground.");

        // 获取 FragmentManagerProvider
        ApplicationModelShared myapp = (ApplicationModelShared)(getApplication());
        fragmentManagerProvider = myapp.getMainActivity();
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
        // 初始位置
        layoutParams.x = ScreenUtils.getScreenWidth(this) - floatingRobotView.getWidth() - 10;
        layoutParams.y = ScreenUtils.getScreenHeight(this) - floatingRobotView.getHeight() - 10;
//        layoutParams.gravity = Gravity.BOTTOM | Gravity.END;
        windowManager.addView(floatingRobotView, layoutParams);

        LottieAnimationView lottieAnimationView = floatingRobotView.findViewById(R.id.lottie_animation_view);
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
                        return true;

                    case MotionEvent.ACTION_MOVE:
                        // 计算移动的偏移量
                        int offsetX = (int) (event.getRawX() - initialTouchX);
                        int offsetY = (int) (event.getRawY() - initialTouchY);

                        // 更新悬浮窗的位置
                        layoutParams.x = initialX + offsetX;
                        layoutParams.y = initialY + offsetY;
                        windowManager.updateViewLayout(floatingRobotView, layoutParams);
                        Log.d("?????????", "onTouch: " + layoutParams.x  + "," + layoutParams.y);
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

        // 使悬浮窗可拖动
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
//                        return true;
//                }
//                return true;
//            }
//        });
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
        popupChatView = LayoutInflater.from(this).inflate(R.layout.popup_window_chat, null);
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
            popupChatView = null;
        });

        // 加载 Fragment
        FragmentManager fragmentManager = fragmentManagerProvider.getFragmentManagerForFloatingWindow(popupChatView);
        FragmentTransaction transaction = fragmentManager.beginTransaction();
        transaction.setCustomAnimations(
                R.anim.fragment_enter, // enter animation
                R.anim.fragment_exit,  // exit animation
                R.anim.fragment_enter, // popEnter animation
                R.anim.fragment_exit   // popExit animation
        );

        FragmentChatAi fragmentChatAi;
        try {
            fragmentChatAi = FragmentChatAi.newInstance(url,
                    tag,
                    true,
                    true,
                    true,
                    true,
                    null);
            transaction.replace(R.id.popup_container, fragmentChatAi);
            transaction.addToBackStack(null);
            transaction.commitAllowingStateLoss();
        }catch (Exception e) {
            e.printStackTrace();
        }
    }

    public void popupChatBot(String url, String tag) {
        // 加载 PopupWindow 的布局
        View popupView = LayoutInflater.from(this).inflate(R.layout.popup_window_chat, null);

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

        // 加载 Fragment
        FragmentManager fragmentManager = fragmentManagerProvider.getFragmentManagerForFloatingWindow(popupView);
        FragmentTransaction transaction = fragmentManager.beginTransaction();
        transaction.setCustomAnimations(
                R.anim.fragment_enter, // enter animation
                R.anim.fragment_exit,  // exit animation
                R.anim.fragment_enter, // popEnter animation
                R.anim.fragment_exit   // popExit animation
        );

        FragmentChatAi fragmentChatAi;
        try {
            fragmentChatAi = FragmentChatAi.newInstance(url,
                    tag,
                    true,
                    true,
                    true,
                    true,
                    null);
            transaction.replace(R.id.popup_container, fragmentChatAi);
            transaction.addToBackStack(null);
            transaction.commitAllowingStateLoss();
        }catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // 继续保持服务在前台
        startForeground(NOTIFICATION_ID, createNotification());
        return START_STICKY;  // 保持服务运行
    }

    private Notification createNotification() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Floating Window")
                .setContentText("Floating Window Service is running")
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

        if(popupChatView != null) {
            windowManager.removeView(popupChatView);
            popupChatView = null;
        }
    }
}
