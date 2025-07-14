package com.cosinetech.imates.activities;

import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.MotionEvent;
import android.view.View;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.appcompat.content.res.AppCompatResources;
import androidx.cardview.widget.CardView;
import androidx.lifecycle.ViewModelProvider;
import androidx.lifecycle.ViewModelStoreOwner;

import com.cosinetech.imates.AppEnvConfig;
import com.cosinetech.imates.ApplicationModelShared;
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

import com.cosinetech.imates.R;
import com.cosinetech.imates.webservice.ApiUrl;
import com.lzf.easyfloat.EasyFloat;
import com.lzf.easyfloat.anim.DefaultAnimator;
import com.lzf.easyfloat.enums.ShowPattern;
import com.lzf.easyfloat.enums.SidePattern;
import com.lzf.easyfloat.interfaces.OnFloatCallbacks;
import com.xuexiang.xupdate.easy.EasyUpdate;

import org.jetbrains.annotations.NotNull;
import org.loka.screensharekit.EncodeBuilder;
import org.loka.screensharekit.ScreenShareKit;

import java.util.UUID;

import gun0912.tedimagepicker.builder.TedImagePicker;

public class MyProfileActivity extends BaseActivity {
    private final static String FLOAT_ACTION_TAG = "MAIN_FLOAT_ACTION";
    private long mCheckUpdateTick = 0;
    FFmpegPipeStreamer h264ToTsStreamer = null;
    private final Handler mMainHandler = new Handler(Looper.getMainLooper());
    private final Runnable mCheckUpdateRunnable = new Runnable() {
        @Override
        public void run() {
            long tick = System.currentTimeMillis();
            if(tick - mCheckUpdateTick >= 3600000) {
                mCheckUpdateTick = tick;
                EasyUpdate.create(MyProfileActivity.this, ApiUrl.URL_APP_UPDATE)
                        .isAutoMode(false)
                        .update();
            }
            mMainHandler.postDelayed(this, 60000); // 每秒执行一次
        }
    };

    @Override
    protected int getLayoutResId() {
        return R.layout.activity_my_profile;
    }

    @Override
    protected int getCurrentNavItemId() {
        return R.id.nav_my_profile;
    }
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // 初始化视图
        ImageView ivAvatar = findViewById(R.id.ivAvatar);
        TextView tvUserId = findViewById(R.id.tvUserId);
        TextView tvGrade = findViewById(R.id.tvGrade);
        CardView cardJoinClass = findViewById(R.id.cardJoinClass);
        CardView cardTeacherAnswer = findViewById(R.id.cardTeacherAnswer);
        CardView cardHomework = findViewById(R.id.cardHomework);
        CardView cardFeedback = findViewById(R.id.cardFeedback);
        CardView cardLogout = findViewById(R.id.cardLogout);

        // 设置用户信息
        tvUserId.setText("用户789594350");
        tvGrade.setText("高三(1)班");

        // 头像点击事件
        ivAvatar.setOnClickListener(v -> {
            // 预留更换头像功能
            //Toast.makeText(ProfileActivity.this, "更换头像功能", Toast.LENGTH_SHORT).show();
        });

        // 功能卡片点击事件
        cardJoinClass.setOnClickListener(v -> Toast.makeText(this, "进入实时互动课堂", Toast.LENGTH_SHORT).show());

        cardTeacherAnswer.setOnClickListener(v -> Toast.makeText(this, "查看教师解答记录", Toast.LENGTH_SHORT).show());

        cardHomework.setOnClickListener(v -> Toast.makeText(this, "拍摄并上传作业", Toast.LENGTH_SHORT).show());

        cardFeedback.setOnClickListener(v -> Toast.makeText(this, "反馈与建议", Toast.LENGTH_SHORT).show());

        // 退出账号按钮点击事件
        cardLogout.setOnClickListener(v -> Toast.makeText(this, "退出账号", Toast.LENGTH_SHORT).show());

        miscellaneousInitialization();
    }

    private void miscellaneousInitialization() {
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
                                    Intent intent = new Intent(MyProfileActivity.this, MainActivity.class);
                                    intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP |
                                            Intent.FLAG_ACTIVITY_NEW_TASK |
                                            Intent.FLAG_ACTIVITY_SINGLE_TOP);
                                    startActivity(intent);
                                });
                                Button submitButton = view.findViewById(R.id.submit_homework);
                                submitButton.setOnClickListener(v3 -> takePictureToTeacher());

                                Button switchButton = view.findViewById(R.id.switch_button);
                                if(AppUtils.getUserId().equals("guest000")) {
                                    if(ApplicationModelShared.getInstance().fakeClassMode) {
                                        switchButton.setCompoundDrawablesWithIntrinsicBounds(null, AppCompatResources.getDrawable(getApplicationContext(), R.drawable.app_switch_on), null, null);
                                    } else {
                                        switchButton.setCompoundDrawablesWithIntrinsicBounds(null, AppCompatResources.getDrawable(getApplicationContext(), R.drawable.app_switch_off), null, null);
                                    }
                                    switchButton.setOnClickListener(v3 -> {
                                        if(ApplicationModelShared.getInstance().fakeClassMode) {
                                            ApplicationModelShared.getInstance().fakeClassMode = false;
                                            switchButton.setCompoundDrawablesWithIntrinsicBounds(null, AppCompatResources.getDrawable(getApplicationContext(), R.drawable.app_switch_off), null, null);
                                        } else {
                                            ApplicationModelShared.getInstance().fakeClassMode = true;
                                            switchButton.setCompoundDrawablesWithIntrinsicBounds(null, AppCompatResources.getDrawable(getApplicationContext(), R.drawable.app_switch_on), null, null);
                                        }
                                    });
                                } else {
                                    if (ScreenCastingManager.isHavingClass()) {
                                        switchButton.setCompoundDrawablesWithIntrinsicBounds(null, AppCompatResources.getDrawable(getApplicationContext(), R.drawable.app_switch_on), null, null);
                                    } else {
                                        switchButton.setCompoundDrawablesWithIntrinsicBounds(null, AppCompatResources.getDrawable(getApplicationContext(), R.drawable.app_switch_off), null, null);
                                    }

                                    switchButton.setOnClickListener(v2 -> {
                                        switchButton.setEnabled(false);
                                        if (ScreenCastingManager.isHavingClass()) {
                                            new AlertDialog.Builder(getApplicationContext())
                                                    .setTitle("提示")
                                                    .setMessage("退出课堂后将不能和老师互动, 确认退出吗?")
                                                    .setPositiveButton("确认", (dialog, which) -> {
                                                        ScreenCastingManager.setClassMode(false);
                                                        switchButton.setCompoundDrawablesWithIntrinsicBounds(null, AppCompatResources.getDrawable(getApplicationContext(), R.drawable.app_switch_off), null, null);
                                                        ScreenShareKit.INSTANCE.stop();
                                                        switchButton.postDelayed(() -> switchButton.setEnabled(true), 2000);
                                                    })
                                                    .setNegativeButton("取消", (dialog, which) -> {
                                                    })
                                                    .create()
                                                    .show();
                                        } else {
                                            ScreenShareKit.INSTANCE.init(MyProfileActivity.this)
                                                    .config(1920, 1080, H264MpegTSStreamerManager.ENCODE_FRAME_RATE, 8000000, EncodeBuilder.SCREEN_DATA_TYPE.H264, false, 44100, 2)
                                                    .onH264((buffer, isKeyFrame, width, height, ts) -> {
                                                        try {
                                                            // 编码后的数据
                                                            byte[] bytes = new byte[buffer.remaining()];
                                                            buffer.get(bytes);

                                                            h264ToTsStreamer.onH264DataReceived(bytes, ts);
                                                            if (isKeyFrame) {
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
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        WindowUtils.hideSystemUI(this);
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