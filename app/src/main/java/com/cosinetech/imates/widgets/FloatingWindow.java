package com.cosinetech.imates.widgets;

import android.annotation.SuppressLint;
import android.content.Context;
import android.graphics.PixelFormat;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;

import androidx.fragment.app.FragmentActivity;
import androidx.fragment.app.FragmentManager;
import androidx.fragment.app.FragmentTransaction;

import com.airbnb.lottie.LottieAnimationView;
import com.cosinetech.imates.R;
import com.cosinetech.imates.fragments.FragmentChatAi;
import com.cosinetech.imates.webservice.ApiUrl;

public class FloatingWindow extends FrameLayout {
    private float dX, dY;
    private float initialX, initialY;
    private static final int CLICK_THRESHOLD = 10; // 拖动的阈值
    private WindowManager windowManager;
    private View floatView;
    private WindowManager.LayoutParams params;
    private Context context;
    private float touchX, touchY, viewX, viewY;

    @SuppressLint("ClickableViewAccessibility")
    public FloatingWindow(Context context) {
        super(context);
        this.context = context;
        windowManager = (WindowManager) context.getSystemService(Context.WINDOW_SERVICE);

        // 加载浮窗布局
        floatView = LayoutInflater.from(context).inflate(R.layout.floating_chat_window, null);

        // 设置浮窗的 LayoutParams
        params = new WindowManager.LayoutParams();
        params.width = 1920; // 浮窗宽度
        params.height = 1080; // 浮窗高度
        params.type = WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY; // 悬浮窗类型
        params.flags = WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL | WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH; // 触摸事件穿透
        params.format = PixelFormat.TRANSLUCENT;
        params.gravity = Gravity.TOP | Gravity.START;
        params.x = 0; // 初始位置 X
        params.y = 0; // 初始位置 Y

        // 添加浮窗到 WindowManager
        windowManager.addView(floatView, params);

        LottieAnimationView lottieAnimationView = floatView.findViewById(R.id.lottie_animation_view);

        // 让浮窗中加载 Fragment
        if (context instanceof FragmentActivity) {
            FragmentManager fragmentManager = ((FragmentActivity) context).getSupportFragmentManager();
            // 设置点击事件
            lottieAnimationView.setOnClickListener(view -> showFloatingFragment(fragmentManager));
                    lottieAnimationView.setOnTouchListener(new View.OnTouchListener() {
            @SuppressLint("ClickableViewAccessibility")
            @Override
            public boolean onTouch(View view, MotionEvent motionEvent) {
                switch (motionEvent.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        // 记录触摸的初始位置
                        initialX = motionEvent.getRawX();
                        initialY = motionEvent.getRawY();
                        dX = view.getX() - motionEvent.getRawX();
                        dY = view.getY() - motionEvent.getRawY();
                        return true;

                    case MotionEvent.ACTION_MOVE:
                        // 如果触摸点移动的距离超过阈值，认为是拖动
                        if (Math.abs(motionEvent.getRawX() - initialX) > CLICK_THRESHOLD ||
                                Math.abs(motionEvent.getRawY() - initialY) > CLICK_THRESHOLD) {
                            // 更新位置
                            view.animate()
                                    .x(motionEvent.getRawX() + dX)
                                    .y(motionEvent.getRawY() + dY)
                                    .setDuration(0)
                                    .start();
                        }
                        return true;

                    case MotionEvent.ACTION_UP:
                        // 在这里可以判断是否是点击（可以放置额外的条件判断）
                        if (Math.abs(motionEvent.getRawX() - initialX) <= CLICK_THRESHOLD &&
                                Math.abs(motionEvent.getRawY() - initialY) <= CLICK_THRESHOLD) {
                            // 如果触摸的移动距离小于阈值，认为是点击
                            lottieAnimationView.performClick();
                        }
                        return true;

                    default:
                        return false;
                }
            }
        });
        }

        // 设置拖动功能
        //setDragListener();
    }

    public <T extends View> T findView(int id) {
        View view = floatView.findViewById(id);
        if (view != null) {
            return (T) view;
        }
        return super.findViewById(id);
    }

    private void showFloatingFragment(FragmentManager fragmentManager) {
        //FragmentManager fragmentManager = getSupportFragmentManager();
        FragmentTransaction transaction = fragmentManager.beginTransaction();
        transaction.setCustomAnimations(
                R.anim.fragment_enter, // enter animation
                R.anim.fragment_exit,  // exit animation
                R.anim.fragment_enter, // popEnter animation
                R.anim.fragment_exit   // popExit animation
        );

        // 创建悬浮 Fragment 实例
//        if(fragmentChatAi != null){
//            fragmentChatAi.getParentFragmentManager().popBackStack();
//            fragmentChatAi = null;
//        } else {
        try {
            FragmentChatAi fragmentChatAi = FragmentChatAi.newInstance(ApiUrl.URL_CHAT_GENERAL, true);
            transaction.replace(R.id.float_chat_container, fragmentChatAi);
            transaction.addToBackStack(null);
            transaction.commit();
        }catch (Exception e) {
            e.printStackTrace();
        }
        //}
    }

//    private void setDragListener() {
//        floatView.setOnTouchListener(new View.OnTouchListener() {
//            @Override
//            public boolean onTouch(View v, MotionEvent event) {
//                switch (event.getAction()) {
//                    case MotionEvent.ACTION_DOWN:
//                        // 记录初始位置
//                        touchX = event.getRawX();
//                        touchY = event.getRawY();
//                        viewX = params.x;
//                        viewY = params.y;
//                        return false;
//
//                    case MotionEvent.ACTION_MOVE:
//                        // 计算并更新浮窗位置
//                        float deltaX = event.getRawX() - touchX;
//                        float deltaY = event.getRawY() - touchY;
//
//                        params.x = (int) (viewX + deltaX);
//                        params.y = (int) (viewY + deltaY);
//
//                        windowManager.updateViewLayout(floatView, params);
//                        return false;
//
//                    default:
//                        return false;
//                }
//            }
//        });
//    }

    public void remove() {
        if (windowManager != null && floatView != null) {
            windowManager.removeView(floatView);
            floatView = null;
        }
    }
}
