package com.cosinetech.imates.activities;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.LinearLayout;
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
import com.cosinetech.imates.service.FloatingRobotService;
import com.cosinetech.imates.util.VersionUtils;
import com.cosinetech.imates.util.WindowUtils;

import androidx.core.content.ContextCompat;
import androidx.fragment.app.Fragment;
import androidx.appcompat.app.AppCompatActivity;

import com.cosinetech.imates.databinding.ActivityMainBinding;
import com.cosinetech.imates.webservice.ApiUrl;
import com.google.android.material.tabs.TabLayout;

import com.google.android.material.tabs.TabLayoutMediator;
import com.xuexiang.xupdate.easy.EasyUpdate;

import android.widget.ImageView;

import androidx.viewpager2.widget.ViewPager2;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public class MainActivity extends AppCompatActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WindowUtils.hideSystemUI(this);
        WindowUtils.setFullScreenMode(this);

        ActivityMainBinding binding = ActivityMainBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

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
                Arrays.asList(new TabItemAttribute(getString(R.string.student_status_title), R.drawable.main_ic_my),
                        new TabItemAttribute(getString(R.string.subject_name_biology), R.drawable.main_ic_biology),
                        new TabItemAttribute(getString(R.string.subject_name_math), R.drawable.main_ic_math),
                        new TabItemAttribute(getString(R.string.subject_name_chinese), R.drawable.main_ic_chinese),
                        new TabItemAttribute(getString(R.string.subject_name_english), R.drawable.main_ic_english),
                        new TabItemAttribute(getString(R.string.subject_name_physics), R.drawable.main_ic_physics),
                        new TabItemAttribute(getString(R.string.subject_name_chemistry), R.drawable.main_ic_chemistry)));

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

        tabLayout.addOnTabSelectedListener(new TabLayout.OnTabSelectedListener() {
            @Override
            public void onTabSelected(TabLayout.Tab tab) {
                // 获取当前选中的 Tab 的自定义 View
                View tabView = tab.getCustomView();
                if (tabView == null)
                    return;

                // 调整选中 Tab 的高度
                ImageView icon = tabView.findViewById(R.id.tab_icon);
                LinearLayout.LayoutParams params = (LinearLayout.LayoutParams) icon.getLayoutParams();
                params.bottomMargin = 20; // 选中时距离底部的高度
                icon.setLayoutParams(params);

                // 改变文字颜色或其他样式
                TextView text = tabView.findViewById(R.id.tab_text);
                text.setTextColor(ContextCompat.getColor(MainActivity.this, R.color.black));
                text.setTextSize(24);
            }

            @Override
            public void onTabUnselected(TabLayout.Tab tab) {
                // 恢复未选中状态的高度
                View tabView = tab.getCustomView();
                if (tabView == null) return;

                // 调整选中 Tab 的高度
                ImageView icon = tabView.findViewById(R.id.tab_icon);
                LinearLayout.LayoutParams params = (LinearLayout.LayoutParams) icon.getLayoutParams();
                params.bottomMargin = 0; // 选中时距离底部的高度
                icon.setLayoutParams(params);

                // 改变文字颜色或其他样式
                TextView text = tabView.findViewById(R.id.tab_text);
                text.setTextColor(ContextCompat.getColor(MainActivity.this, R.color.gray3));
                text.setTextSize(16);
            }

            @Override
            public void onTabReselected(TabLayout.Tab tab) {
                // 可根据需要处理重复选中事件
            }
        });

        tabLayout.post(() -> {
            TabLayout.Tab firstTab = tabLayout.getTabAt(0); // 获取第一个 Tab
            if (firstTab != null) {
                firstTab.select(); // 选中第一个 Tab

                // 调整选中状态的高度
                View tabView = firstTab.getCustomView();
                if (tabView != null) {
                    ImageView icon = tabView.findViewById(R.id.tab_icon);
                    LinearLayout.LayoutParams params = (LinearLayout.LayoutParams) icon.getLayoutParams();
                    params.bottomMargin = 20; // 设置选中状态的高度
                    icon.setLayoutParams(params);

                    // 改变文字颜色
                    TextView text = tabView.findViewById(R.id.tab_text);
                    text.setTextColor(ContextCompat.getColor(MainActivity.this, R.color.black));
                    text.setTextSize(24);
                }
            }
        });

        stopFloatingWndowService();
        startFloatingWindowService();

        EasyUpdate.create(this, ApiUrl.URL_APP_UPDATE)
                .isAutoMode(false)
                .update();

        TextView versionText = findViewById(R.id.version);
        versionText.setText(VersionUtils.getVersionName(this) + "_" + VersionUtils.getVersionCode(this));

        Log.e("++++++++++++++++", "onCreate");    }

    @Override
    protected void onPause() {
        super.onPause();
        Log.e("++++++++++++++++", "onPause");
    }

    @Override
    protected void onResume() {
        super.onResume();
        Log.e("++++++++++++++++", "onResume");
        ApplicationModelShared app = (ApplicationModelShared) getApplication();
        if(app.getFloatingWindowService() != null) {
            app.getFloatingWindowService().showRobot();
        }
    }

    @Override
    protected void onStart() {
        super.onStart();
        Log.e("++++++++++++++++", "onStart");
    }

    @Override
    protected void onStop() {
        super.onStop();
        Log.e("++++++++++++++++", "onStop");
    }

    @Override
    protected  void onRestart() {
        super.onRestart();
        Log.e("++++++++++++++++", "onRestart");
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            WindowUtils.hideSystemUI(this);
        }
    }

    private void startFloatingWindowService() {
        Intent intent = new Intent(this, FloatingRobotService.class);
        startService(intent);
    }

    private void stopFloatingWndowService() {
        Intent intent = new Intent(this, FloatingRobotService.class);
        stopService(intent);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        stopFloatingWndowService();
        Log.e("++++++++++++++++", "onDestroy");
    }
}