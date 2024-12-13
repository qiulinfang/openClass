package com.cosinetech.imates;

import android.annotation.SuppressLint;
import android.content.pm.ActivityInfo;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.TextView;

import com.airbnb.lottie.LottieAnimationView;
import com.cosinetech.imates.util.WindowUtils;

import androidx.fragment.app.Fragment;
import androidx.fragment.app.FragmentManager;
import androidx.fragment.app.FragmentTransaction;
import androidx.appcompat.app.AppCompatActivity;

import com.cosinetech.imates.databinding.ActivityMainBinding;
import com.google.android.material.tabs.TabLayout;

import com.google.android.material.tabs.TabLayoutMediator;
import android.widget.ImageView;
import androidx.viewpager2.widget.ViewPager2;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public class MainActivity extends AppCompatActivity {
    private float dX, dY;
    private float initialX, initialY;
    private static final int CLICK_THRESHOLD = 10; // 拖动的阈值

    @SuppressLint("ClickableViewAccessibility")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 设置全屏模式
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN);

        // 隐藏系统导航栏
        WindowUtils.hideSystemUI(this);
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE);

        ActivityMainBinding binding = ActivityMainBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        // 设置全屏并不遮挡导航栏
        View decorView = getWindow().getDecorView();
        decorView.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
        );

        LottieAnimationView lottieAnimationView = findViewById(R.id.lottieAnimationView);

        // 设置点击事件
        lottieAnimationView.setOnClickListener(view -> showFloatingFragment());

        // 设置拖动监听器
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

        ViewPager2 viewPager = findViewById(R.id.viewPager);


        // 创建 Fragment 列表
        List<Fragment> fragmentList = new ArrayList<>();
        fragmentList.add(FragmentStudentStatus.newInstance("", ""));
        fragmentList.add(FragmentSubjectBiology.newInstance("", ""));
        fragmentList.add(FragmentSubjectMath.newInstance("", ""));
        fragmentList.add(FragmentSubjectChinese.newInstance("", ""));
        fragmentList.add(FragmentSubjectEnglish.newInstance("", ""));
        fragmentList.add(FragmentSubjectPhysics.newInstance("", ""));
        fragmentList.add(FragmentSubjectChemistry.newInstance("", ""));

        List<TabItemAttribute> tabItems = new ArrayList<>(
                Arrays.asList(new TabItemAttribute(getString(R.string.student_status_title), R.drawable.ic_student_status),
                        new TabItemAttribute(getString(R.string.subject_name_biology), R.drawable.ic_subject_biology),
                        new TabItemAttribute(getString(R.string.subject_name_math), R.drawable.ic_subject_math),
                        new TabItemAttribute(getString(R.string.subject_name_chinese), R.drawable.ic_subject_chinese),
                        new TabItemAttribute(getString(R.string.subject_name_english), R.drawable.ic_subject_english),
                        new TabItemAttribute(getString(R.string.subject_name_physics), R.drawable.ic_subject_physics),
                        new TabItemAttribute(getString(R.string.subject_name_chemistry), R.drawable.ic_subject_chemistryl)));

        // 创建并设置适配器
        SubjectViewAdapter adapter = new SubjectViewAdapter(this, fragmentList);
        viewPager.setAdapter(adapter);

        // 将 TabLayout 与 ViewPager2 关联
        TabLayout tabLayout = findViewById(R.id.tabLayout);
        new TabLayoutMediator(tabLayout, viewPager, (tab, position) -> {
            View customView = LayoutInflater.from(this).inflate(R.layout.custom_tab, null);

            // 获取布局中的视图组件
            ImageView tabIcon = customView.findViewById(R.id.tab_icon);
            TextView tabTitle = customView.findViewById(R.id.tab_text);

            // 设置 tab 的标题和图标
            tabTitle.setText(tabItems.get(position).getTitle());  // 设置标签文本
            // 设置图标，根据 position 设置不同的图标
            tabIcon.setImageResource(tabItems.get(position).getIconResId());  // 根据 position 返回不同的图标

            // 设置自定义视图到 Tab
            tab.setCustomView(customView);
        }).attach();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            WindowUtils.hideSystemUI(this);
        }
    }

    private void showFloatingFragment() {
        FragmentManager fragmentManager = getSupportFragmentManager();
        FragmentTransaction transaction = fragmentManager.beginTransaction();
        transaction.setCustomAnimations(
                R.anim.fragment_enter, // enter animation
                R.anim.fragment_exit,  // exit animation
                R.anim.fragment_enter, // popEnter animation
                R.anim.fragment_exit   // popExit animation
        );

        // 创建悬浮 Fragment 实例
        FragmentChatAi floatingFragment = FragmentChatAi.newInstance(EnumApiUrl.URL_CHAT_GENERAL, true);
        transaction.replace(R.id.fragmentChatAiContainer, floatingFragment);
        transaction.addToBackStack(null);
        transaction.commit();
    }
}