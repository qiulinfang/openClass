package com.cosinetech.imates.activities;

import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.cosinetech.imates.AppEnvConfig;
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
import com.cosinetech.imates.models.ChatAiParam;
import com.cosinetech.imates.models.UserInfoViewModel;
import com.cosinetech.imates.screencasting.FFmpegPipeStreamer;
import com.cosinetech.imates.screencasting.H264IFrameCache;
import com.cosinetech.imates.screencasting.H264MpegTSStreamerManager;
import com.cosinetech.imates.screencasting.ScreenCastingManager;
import com.cosinetech.imates.screencasting.UdpForwarderManager;
import com.cosinetech.imates.service.FloatingRobotService;
import com.cosinetech.imates.util.AppUtils;
import com.cosinetech.imates.util.SimpleImageCompressor;
import com.cosinetech.imates.util.WindowUtils;

import androidx.annotation.Nullable;
import androidx.appcompat.content.res.AppCompatResources;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.Fragment;
import androidx.appcompat.app.AppCompatActivity;

import com.cosinetech.imates.databinding.ActivityMainBinding;
import com.cosinetech.imates.webservice.ApiUrl;
import com.google.android.material.tabs.TabLayout;

import com.google.android.material.tabs.TabLayoutMediator;
import com.lzf.easyfloat.EasyFloat;
import com.lzf.easyfloat.anim.DefaultAnimator;
import com.lzf.easyfloat.enums.ShowPattern;
import com.lzf.easyfloat.enums.SidePattern;
import com.lzf.easyfloat.interfaces.OnFloatCallbacks;
import com.xuexiang.xupdate.easy.EasyUpdate;

import android.widget.ImageView;
import android.widget.Toast;

import androidx.lifecycle.ViewModelProvider;
import androidx.lifecycle.ViewModelStoreOwner;
import androidx.viewpager2.widget.ViewPager2;

import org.jetbrains.annotations.NotNull;
import org.loka.screensharekit.EncodeBuilder;
import org.loka.screensharekit.ScreenShareKit;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

import gun0912.tedimagepicker.builder.TedImagePicker;

public class MainActivity extends AppCompatActivity {
    private final static String FLOAT_ACTION_TAG = "MAIN_FLOAT_ACTION";
    private long mCheckUpdateTick = 0;
    private final Handler mMainHandler = new Handler(Looper.getMainLooper());
    private final Runnable mCheckUpdateRunnable = new Runnable() {
        @Override
        public void run() {
            long tick = System.currentTimeMillis();
            if(tick - mCheckUpdateTick >= 3600000) {
                mCheckUpdateTick = tick;
                EasyUpdate.create(MainActivity.this, ApiUrl.URL_APP_UPDATE)
                        .isAutoMode(false)
                        .update();
            }
            mMainHandler.postDelayed(this, 60000); // 每秒执行一次
        }
    };

    private FFmpegPipeStreamer h264ToTsStreamer = null;

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

        TextView versionText = findViewById(R.id.version);
        versionText.setText(AppEnvConfig.getAppVersion(this));

        EasyUpdate.create(this, ApiUrl.URL_APP_UPDATE)
                .isAutoMode(false)
                .update();
        mCheckUpdateTick = System.currentTimeMillis();
        mMainHandler.postDelayed(mCheckUpdateRunnable, 60000);

        ViewModelStoreOwner owner = (ViewModelStoreOwner) this.getApplication();
        UserInfoViewModel userInfoViewModel = new ViewModelProvider(
                owner,
                new ViewModelProvider.AndroidViewModelFactory(getApplication())
        ).get(UserInfoViewModel.class);
        h264ToTsStreamer = H264MpegTSStreamerManager.getInstance();
        ScreenCastingManager.startLoop(this,
                userInfoViewModel.userId.getValue(),
                userInfoViewModel.userInfo.getValue().getName(),
                UdpForwarderManager.getInstance());
        h264ToTsStreamer = H264MpegTSStreamerManager.getInstance();

        Log.e("++++++++++++++++", "onCreate");
    }

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
        if (app.getFloatingWindowService() != null) {
            app.getFloatingWindowService().showRobot();
        }

        mMainHandler.postDelayed(() -> {
            EasyFloat.with(this)
                    .setLayout(R.layout.float_action)
                    .setDragEnable(true)
                    .setShowPattern(ShowPattern.FOREGROUND)
                    .setSidePattern(SidePattern.DEFAULT)
                    .setMatchParent(false, false)
                    .setAnimator(new DefaultAnimator())
                    .setTag(FLOAT_ACTION_TAG)
                    .registerCallbacks(new OnFloatCallbacks() {
                        @Override
                        public void createdResult(boolean isCreated, @Nullable String msg, @Nullable View view) {
                            if (isCreated && view != null) {
                                Button homeButton = view.findViewById(R.id.back_main);
                                homeButton.setOnClickListener(v->{
                                    Intent intent = new Intent(MainActivity.this, MainActivity.class);
                                    intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP |
                                            Intent.FLAG_ACTIVITY_NEW_TASK |
                                            Intent.FLAG_ACTIVITY_SINGLE_TOP);
                                    startActivity(intent);
                                });
                                Button submitButton = view.findViewById(R.id.submit_homework);
                                submitButton.setOnClickListener(v3 -> takePictureToTeacher());

                                Button switchButton = view.findViewById(R.id.switch_button);
                                if(ScreenCastingManager.isHavingClass()) {
                                    switchButton.setCompoundDrawablesWithIntrinsicBounds(null, AppCompatResources.getDrawable(getApplicationContext(), R.drawable.app_switch_on), null, null);
                                } else {
                                    switchButton.setCompoundDrawablesWithIntrinsicBounds(null, AppCompatResources.getDrawable(getApplicationContext(), R.drawable.app_switch_off), null, null);
                                }

                                switchButton.setOnClickListener(v2 -> {
                                    switchButton.setEnabled(false);
                                    if(ScreenCastingManager.isHavingClass()) {
                                        new AlertDialog.Builder(MainActivity.this)
                                                .setTitle("提示")
                                                .setMessage("退出课堂后将不能和老师互动, 确认退出吗?")
                                                .setPositiveButton("确认", (dialog, which) -> {
                                                    ScreenCastingManager.setClassMode(false);
                                                    switchButton.setCompoundDrawablesWithIntrinsicBounds(null, AppCompatResources.getDrawable(getApplicationContext(), R.drawable.app_switch_off), null, null);
                                                    ScreenShareKit.INSTANCE.stop();
                                                    switchButton.postDelayed(() -> switchButton.setEnabled(true), 2000);
                                                    submitButton.post(() -> submitButton.setVisibility(View.INVISIBLE));
                                                })
                                                .setNegativeButton("取消", (dialog, which) -> {
                                                })
                                                .create()
                                                .show();
                                    } else {
                                        ScreenShareKit.INSTANCE.init(MainActivity.this)
                                                .config(1920, 1080, H264MpegTSStreamerManager.ENCODE_FRAME_RATE, 8000000, EncodeBuilder.SCREEN_DATA_TYPE.H264, false, 44100, 2)
                                                .onH264((buffer, isKeyFrame, width, height, ts) -> {
                                                    try {
                                                        // 编码后的数据
                                                        byte[] bytes = new byte[buffer.remaining()];
                                                        buffer.get(bytes);

                                                        h264ToTsStreamer.onH264DataReceived(bytes, ts);
                                                        if(isKeyFrame) {
                                                            H264IFrameCache.getInstance().onH264Frame(bytes);
                                                        }
                                                    } catch (Exception e) {
                                                        Log.e("ScreenShareKit", "H264 callback error:" + e.getMessage());
                                                    }
                                                })
                                                .onError(errorInfo -> Log.e("ScreenShareKitERROR", errorInfo.getMessage()))
                                                .onStart(() -> {
                                                    ScreenCastingManager.setClassMode(true);
                                                    h264ToTsStreamer.start();
                                                    switchButton.post(() -> switchButton.setCompoundDrawablesWithIntrinsicBounds(null, AppCompatResources.getDrawable(getApplicationContext(), R.drawable.app_switch_on), null, null));
                                                    submitButton.post(() -> submitButton.setVisibility(View.VISIBLE));
                                                }).start();
                                    }

                                    switchButton.postDelayed(() -> switchButton.setEnabled(true), 2000);
                                });
                            }
                        }

                        @Override
                        public void show(@NotNull View view) {
                        }

                        @Override
                        public void hide(@NotNull View view) {
                        }

                        @Override
                        public void dismiss() {
                        }

                        @Override
                        public void touchEvent(@NotNull View view, @NotNull MotionEvent event) { }

                        @Override
                        public void drag(@NotNull View view, @NotNull MotionEvent event) { }

                        @Override
                        public void dragEnd(@NotNull View view) { }
                    })
                    .show();
        }, 3000);

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

    @SuppressLint("CheckResult")
    private void takePictureToTeacher() {
        TedImagePicker.with(this)
                .startMultiImage(uriList -> {
                    String paths = "";
                    for(Uri uri : uriList) {
                        if(uri != null) {
                            // 复制图片到外部存储
                            String filePath = AppUtils.getUserFilePath().getAbsolutePath() + "/" + UUID.randomUUID().toString() + ".png";
                            boolean success = AppUtils.copyImageToExternalFilesDir(getApplicationContext(), uri, filePath);
                            if (success) {
                                SimpleImageCompressor.compressInPlace(filePath, 40);
                                paths += filePath + ",";
                            } else {
                                Log.e("PhotoPicker", "Failed to copy image.");
                                Toast.makeText(getApplicationContext(), "照片读取失败", Toast.LENGTH_SHORT).show();
                            }
                        } else {
                            Toast.makeText(getApplicationContext(), "没有选择相片", Toast.LENGTH_SHORT).show();
                        }
                    }

                    String finalPaths = paths;
                    if(!finalPaths.isEmpty()) {
                        runOnUiThread(() -> {
                            ChatAiParam param = new ChatAiParam();
                            //param.sessionId = tag;
                            param.chatBotUrl = ApiUrl.URL_CHAT_GENERAL;
                            param.showHeader = true;
                            param.streamDisplay = true;
                            param.showHistory = true;
                            param.initialSendEnable = true;

                            Intent intent = new Intent(this, ChatAiActivity.class);
                            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK); // 启动新任务栈
                            intent.putExtra(ChatAiActivity.KEY_CHAT_AI_PARAM, param);
                            intent.putExtra(ChatAiActivity.KEY_SUBMIT_PICTURE_PATH, finalPaths);
                            startActivity(intent);

                            ApplicationModelShared.getInstance().getFloatingWindowService().hideRobot();
                        });
                    }
                });
    }


    @Override
    protected void onDestroy() {
        super.onDestroy();
        EasyFloat.dismiss(FLOAT_ACTION_TAG);
        stopFloatingWndowService();
        mMainHandler.removeCallbacksAndMessages(null); // 彻底清除
        Log.e("++++++++++++++++", "onDestroy");
    }
}