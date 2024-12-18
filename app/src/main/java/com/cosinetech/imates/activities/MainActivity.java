package com.cosinetech.imates.activities;

import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.TextView;

import com.cosinetech.imates.ApplicationModelShared;
import com.cosinetech.imates.R;
import com.cosinetech.imates.adapters.AdapterSubjectViewPager;
import com.cosinetech.imates.TabItemAttribute;
import com.cosinetech.imates.fragments.FragmentMyStatus;
import com.cosinetech.imates.fragments.FragmentSubjectBiology;
import com.cosinetech.imates.fragments.FragmentSubjectChemistry;
import com.cosinetech.imates.fragments.FragmentSubjectChinese;
import com.cosinetech.imates.fragments.FragmentSubjectEnglish;
import com.cosinetech.imates.fragments.FragmentSubjectMath;
import com.cosinetech.imates.fragments.FragmentSubjectPhysics;
import com.cosinetech.imates.service.FloatingWindowService;
import com.cosinetech.imates.util.WindowUtils;

import androidx.fragment.app.Fragment;
import androidx.appcompat.app.AppCompatActivity;

import com.cosinetech.imates.databinding.ActivityMainBinding;
import com.google.android.material.tabs.TabLayout;

import com.google.android.material.tabs.TabLayoutMediator;
import android.widget.ImageView;

import androidx.fragment.app.FragmentManager;
import androidx.viewpager2.widget.ViewPager2;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public class MainActivity extends AppCompatActivity implements FloatingWindowService.FragmentManagerProvider {
    private View floatingView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        ApplicationModelShared  myapp = (ApplicationModelShared)(getApplication());
        myapp.setMainActivity(this);
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

        ViewPager2 viewPager = findViewById(R.id.view_pager);
        // 禁止滑动翻页
        viewPager.setUserInputEnabled(false);


        // 创建 Fragment 列表
        List<Fragment> fragmentList = new ArrayList<>();
        fragmentList.add(FragmentMyStatus.newInstance("", ""));
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
        AdapterSubjectViewPager adapter = new AdapterSubjectViewPager(this, fragmentList);
        viewPager.setAdapter(adapter);

        // 将 TabLayout 与 ViewPager2 关联
        TabLayout tabLayout = findViewById(R.id.tab_layout);
        new TabLayoutMediator(tabLayout, viewPager, (tab, position) -> {
            View customView = LayoutInflater.from(this).inflate(R.layout.tab_layout_subjects, null);

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

        startFloatingWindowService();
    }


    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            WindowUtils.hideSystemUI(this);
        }
    }

    private void startFloatingWindowService() {
        Intent intent = new Intent(this, FloatingWindowService.class);
        startService(intent);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
    }

    @Override
    public <T extends View> T findViewById(int id) {
        View view;
        if(floatingView != null) {
            view = floatingView.findViewById(id);
            if (view != null) {
                return (T) view;
            }
        }
        return super.findViewById(id);
    }

    @Override
    public FragmentManager getFragmentManagerForFloatingWindow(View view) {
        floatingView = view;
        return getSupportFragmentManager();
    }
}