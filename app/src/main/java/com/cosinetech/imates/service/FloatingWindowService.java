package com.cosinetech.imates.service;

import android.annotation.SuppressLint;
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

    private FragmentManagerProvider fragmentManagerProvider;
    private WindowManager windowManager;
    private WindowManager.LayoutParams layoutParams;
    private View floatingView;

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

        // 获取 FragmentManagerProvider
        ApplicationModelShared myapp = (ApplicationModelShared)(getApplication());
        fragmentManagerProvider = myapp.getMainActivity();
        myapp.setFloatingWindowService(this);

        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        layoutParams = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
                PixelFormat.TRANSLUCENT);

        LayoutInflater inflater = (LayoutInflater) getSystemService(LAYOUT_INFLATER_SERVICE);
        floatingView = inflater.inflate(R.layout.floating_robot, null);
        // 初始位置
        layoutParams.x = ScreenUtils.getScreenWidth(this) - floatingView.getWidth() - 10;
        layoutParams.y = ScreenUtils.getScreenHeight(this) - floatingView.getHeight() - 10;
//        layoutParams.gravity = Gravity.BOTTOM | Gravity.END;
        windowManager.addView(floatingView, layoutParams);

        LottieAnimationView lottieAnimationView = floatingView.findViewById(R.id.lottie_animation_view);
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
                        windowManager.updateViewLayout(floatingView, layoutParams);
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
        floatingView.setOnTouchListener(new View.OnTouchListener() {
            private int initialX;
            private int initialY;
            private float initialTouchX;
            private float initialTouchY;

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                switch (event.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        initialX = layoutParams.x;
                        initialY = layoutParams.y;
                        initialTouchX = event.getRawX();
                        initialTouchY = event.getRawY();
                        return true;
                    case MotionEvent.ACTION_MOVE:
                        layoutParams.x = initialX + (int) (event.getRawX() - initialTouchX);
                        layoutParams.y = initialY + (int) (event.getRawY() - initialTouchY);
                        windowManager.updateViewLayout(floatingView, layoutParams);
                        return true;
                }
                return true;
            }
        });
    }

    public FragmentChatAi popupChatBot(String url, String tag) {
        // 加载 PopupWindow 的布局
        View popupView = LayoutInflater.from(this).inflate(R.layout.popup_window_chat, null);

        // 初始化 PopupWindow
        PopupWindow popupWindow = new PopupWindow(
                popupView,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                true
        );

        // 设置 PopupWindow 的背景
        popupWindow.setBackgroundDrawable(ContextCompat.getDrawable(this, android.R.color.transparent));

        // 显示 PopupWindow
        popupWindow.showAtLocation(floatingView, Gravity.START, 0, 0);

        popupWindow.setOutsideTouchable(false);

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
            return null;
        }
        return fragmentChatAi;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (floatingView != null) windowManager.removeView(floatingView);
    }
}
