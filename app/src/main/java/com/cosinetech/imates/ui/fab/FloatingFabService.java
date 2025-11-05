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
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.view.animation.Animation;
import android.view.animation.AnimationUtils;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.Nullable;
import androidx.annotation.RequiresApi;
import androidx.core.app.NotificationCompat;

import com.airbnb.lottie.LottieAnimationView;
import com.cosinetech.imates.ApplicationModelShared;
import com.cosinetech.imates.R;
import com.cosinetech.imates.ui.webview.MainWebViewActivity;
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
    private static final String ACTION_OPEN_AI_CHAT = "openAIChat";

    private WindowManager windowManager;
    private View floatingFabView;
    private LottieAnimationView lottieAnimationView;
    private LinearLayout menuContainer;
    private View menuItemDraft;
    private View menuItemAIChat;
    
    private WindowManager.LayoutParams layoutParams;
    private boolean isMenuExpanded = false;
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
        Log.d(TAG, "FloatingFabService onCreate");

        // 创建通知通道（对于 Android 8.0 及以上）
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            CharSequence name = "AI学伴悬浮按钮";
            String description = "用于显示 AI学伴悬浮按钮服务的通知";
            int importance = NotificationManager.IMPORTANCE_LOW;
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, name, importance);
            channel.setDescription(description);
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            notificationManager.createNotificationChannel(channel);
        }

        // 创建并启动前台服务
        Notification notification = createNotification();
        startForeground(NOTIFICATION_ID, notification);

        // 获取屏幕尺寸
        screenWidth = ScreenUtils.getScreenWidth(this);
        screenHeight = ScreenUtils.getScreenHeight(this);

        // 注册服务到Application
        ApplicationModelShared myapp = (ApplicationModelShared) getApplication();
        myapp.setFloatingFabService(this);

        // 初始化悬浮窗口
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        initFloatingFab();
    }

    @SuppressLint("ClickableViewAccessibility")
    private void initFloatingFab() {
        // 创建窗口布局参数
        layoutParams = new WindowManager.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
                PixelFormat.TRANSLUCENT);

        // 加载布局
        LayoutInflater inflater = (LayoutInflater) getSystemService(LAYOUT_INFLATER_SERVICE);
        floatingFabView = inflater.inflate(R.layout.floating_fab, null);

        // 获取视图组件
        lottieAnimationView = floatingFabView.findViewById(R.id.lottie_animation_view);
        menuContainer = floatingFabView.findViewById(R.id.menu_container);
        menuItemDraft = floatingFabView.findViewById(R.id.menu_item_draft);
        menuItemAIChat = floatingFabView.findViewById(R.id.menu_item_ai_chat);

        // 初始位置：右下角
        layoutParams.gravity = Gravity.BOTTOM | Gravity.END;
        layoutParams.x = 0;
        layoutParams.y = 0;

        // 添加窗口
        windowManager.addView(floatingFabView, layoutParams);

        // 设置菜单项点击事件
        menuItemDraft.setOnClickListener(v -> {
            handleMenuItemClick(ACTION_OPEN_DRAFT);
        });

        menuItemAIChat.setOnClickListener(v -> {
            handleMenuItemClick(ACTION_OPEN_AI_CHAT);
        });

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
                        // 记录按下时的坐标
                        initialX = layoutParams.x;
                        initialY = layoutParams.y;
                        initialTouchX = event.getRawX();
                        initialTouchY = event.getRawY();
                        hasMoved = false;
                        return true;

                    case MotionEvent.ACTION_MOVE:
                        // 计算移动的偏移量
                        int offsetX = (int) (event.getRawX() - initialTouchX);
                        int offsetY = (int) (event.getRawY() - initialTouchY);
                        
                        // 如果移动距离超过阈值，认为是拖拽
                        if (Math.abs(offsetX) > 10 || Math.abs(offsetY) > 10) {
                            hasMoved = true;
                            // 收起菜单（如果已展开）
                            if (isMenuExpanded) {
                                collapseMenu();
                            }
                        }
                        
                        // 更新悬浮窗的位置（考虑边界限制）
                        int newX = initialX - offsetX;
                        int newY = initialY - offsetY;
                        
                        // 获取视图宽度和高度
                        int viewWidth = floatingFabView.getWidth();
                        int viewHeight = floatingFabView.getHeight();
                        
                        // 限制在屏幕范围内
                        layoutParams.x = Math.max(-screenWidth + viewWidth, Math.min(newX, 0));
                        layoutParams.y = Math.max(-screenHeight + viewHeight, Math.min(newY, 0));
                        windowManager.updateViewLayout(floatingFabView, layoutParams);
                        return true;

                    case MotionEvent.ACTION_UP:
                        // 判断是否为点击事件
                        float deltaX = event.getRawX() - initialTouchX;
                        float deltaY = event.getRawY() - initialTouchY;
                        if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10 && !hasMoved) {
                            // 如果移动距离小于阈值，认为是点击事件
                            toggleMenu();
                        }
                        return true;
                }
                return false;
            }
        });

        // 初始状态：菜单收起
        collapseMenu();
    }

    /**
     * 切换菜单展开/收起状态
     */
    private void toggleMenu() {
        if (isMenuExpanded) {
            collapseMenu();
        } else {
            expandMenu();
        }
    }

    /**
     * 展开菜单
     */
    private void expandMenu() {
        if (isMenuExpanded) {
            return;
        }
        isMenuExpanded = true;
        
        // 显示菜单项
        menuContainer.setVisibility(View.VISIBLE);
        
        // 加载展开动画
        Animation expandAnimation = AnimationUtils.loadAnimation(this, R.anim.fab_menu_expand);
        menuContainer.startAnimation(expandAnimation);
        
        Log.d(TAG, "菜单已展开");
    }

    /**
     * 收起菜单
     */
    private void collapseMenu() {
        if (!isMenuExpanded) {
            return;
        }
        isMenuExpanded = false;
        
        // 加载收起动画
        Animation collapseAnimation = AnimationUtils.loadAnimation(this, R.anim.fab_menu_collapse);
        collapseAnimation.setAnimationListener(new Animation.AnimationListener() {
            @Override
            public void onAnimationStart(Animation animation) {
            }

            @Override
            public void onAnimationEnd(Animation animation) {
                // 动画结束后隐藏菜单
                menuContainer.setVisibility(View.GONE);
            }

            @Override
            public void onAnimationRepeat(Animation animation) {
            }
        });
        menuContainer.startAnimation(collapseAnimation);
        
        Log.d(TAG, "菜单已收起");
    }

    /**
     * 处理菜单项点击
     */
    private void handleMenuItemClick(String action) {
        Log.d(TAG, "菜单项点击: " + action);
        
        // 收起菜单
        collapseMenu();
        
        // 启动MainWebViewActivity并传递action参数
        Intent intent = new Intent(this, MainWebViewActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra("floating_fab_action", action);
        startActivity(intent);
    }

    /**
     * 隐藏悬浮按钮
     */
    public void hideFab() {
        if (floatingFabView != null) {
            floatingFabView.setVisibility(View.GONE);
        }
    }

    /**
     * 显示悬浮按钮
     */
    public void showFab() {
        if (floatingFabView != null) {
            floatingFabView.setVisibility(View.VISIBLE);
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
                .setContentTitle("AI学伴悬浮按钮")
                .setContentText("AI学伴, 伴你进步")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "FloatingFabService onDestroy");
        
        if (floatingFabView != null) {
            windowManager.removeView(floatingFabView);
            floatingFabView = null;
        }
    }
}

