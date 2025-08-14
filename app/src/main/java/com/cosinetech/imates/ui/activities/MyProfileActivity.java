package com.cosinetech.imates.ui.activities;

import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.content.res.AppCompatResources;
import androidx.cardview.widget.CardView;
import androidx.lifecycle.ViewModelProvider;
import androidx.lifecycle.ViewModelStoreOwner;

import com.cosinetech.imates.appenv.AppEnvConfig;
import com.cosinetech.imates.ApplicationModelShared;
import com.cosinetech.imates.ui.feedback.FeedbackActivity;
import com.cosinetech.imates.data.models.ChatAiParam;
import com.cosinetech.imates.data.models.UserInfo;
import com.cosinetech.imates.data.models.UserInfoViewModel;
import com.cosinetech.imates.screencasting.FFmpegPipeStreamer;
import com.cosinetech.imates.screencasting.H264IFrameCache;
import com.cosinetech.imates.screencasting.H264MpegTSStreamerManager;
import com.cosinetech.imates.screencasting.ScreenCastingManager;
import com.cosinetech.imates.screencasting.UdpForwarderManager;
import com.cosinetech.imates.ui.robot.FloatingRobotService;
import com.cosinetech.imates.utils.AppUtils;
import com.cosinetech.imates.utils.SimpleImageCompressor;
import com.cosinetech.imates.utils.WindowUtils;

import com.cosinetech.imates.R;
import com.cosinetech.imates.coreapiservice.ApiUrl;
import com.lzf.easyfloat.EasyFloat;
import com.xuexiang.xupdate.easy.EasyUpdate;

import org.loka.screensharekit.EncodeBuilder;
import org.loka.screensharekit.ScreenShareKit;

import java.util.UUID;

import gun0912.tedimagepicker.builder.TedImagePicker;

public class MyProfileActivity extends BaseActivity {
    private UserInfoViewModel userInfoViewModel;
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
        ViewModelStoreOwner owner = (ViewModelStoreOwner) this.getApplication();
        userInfoViewModel = new ViewModelProvider(
                owner,
                new ViewModelProvider.AndroidViewModelFactory(getApplication())
        ).get(UserInfoViewModel.class);
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
        tvUserId.setText(userInfoViewModel.userInfo.getValue().getName());
        tvGrade.setText("高三(1)班");

        // 头像点击事件
        ivAvatar.setOnClickListener(v -> {
            // 预留更换头像功能
            //Toast.makeText(ProfileActivity.this, "更换头像功能", Toast.LENGTH_SHORT).show();
        });

        // 功能卡片点击事件
        cardJoinClass.setOnClickListener(v -> {
            joinClassroom(v);
            v.setEnabled(false);
            v.postDelayed(() -> v.setEnabled(true), 1000);
        });

        cardTeacherAnswer.setOnClickListener(v -> chatWithTeacher());

        cardHomework.setOnClickListener(v -> takePictureToTeacher());

        cardFeedback.setOnClickListener(v -> feedback());

        cardLogout.setOnClickListener(v -> logout());

        miscellaneousInitialization();
    }
    private void miscellaneousInitialization() {
        stopFloatingWindowService();
        startFloatingWindowService();
        TextView versionText = findViewById(R.id.version);
        versionText.setText(AppEnvConfig.getAppVersion(this));
        EasyUpdate.create(this, ApiUrl.URL_APP_UPDATE)
                .isAutoMode(false)
                .update();
        mCheckUpdateTick = System.currentTimeMillis();
        mMainHandler.postDelayed(mCheckUpdateRunnable, 60000);
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
    }

    private void startFloatingWindowService() {
        Intent intent = new Intent(this, FloatingRobotService.class);
        startService(intent);
    }

    private void stopFloatingWindowService() {
        Intent intent = new Intent(this, FloatingRobotService.class);
        stopService(intent);
    }

    private void chatWithTeacher() {
        ((ApplicationModelShared)getApplication()).getFloatingWindowService().popupChatBot(ApiUrl.URL_CHAT_GENERAL, true);
    }
    private void showJoinClassroom(boolean b) {
        CardView cardJoinClass = findViewById(R.id.cardJoinClass);
        TextView tvJoinClass = findViewById(R.id.tvJoinClass);
        if(b) {
            cardJoinClass.setCardBackgroundColor(AppCompatResources.getColorStateList(this, me.minetsh.imaging.R.color.image_color_blue));
            tvJoinClass.setText("退出课堂");
        } else {
            cardJoinClass.setCardBackgroundColor(AppCompatResources.getColorStateList(this, R.color.white));
            tvJoinClass.setText("加入课堂");
        }
    }

    private void joinClassroom(View v) {
        if(AppUtils.getUserId().equals("guest000")) {
            ApplicationModelShared.getInstance().fakeClassMode = !ApplicationModelShared.getInstance().fakeClassMode;
            showJoinClassroom(ApplicationModelShared.getInstance().fakeClassMode);
        } else {
            if (ScreenCastingManager.isHavingClass()) {
                new AlertDialog.Builder(this)
                        .setTitle("提示")
                        .setMessage("退出课堂后将不能和老师互动, 确认退出吗?")
                        .setPositiveButton("确认", (dialog, which) -> {
                            ScreenCastingManager.setClassMode(false);
                            ScreenShareKit.INSTANCE.stop();
                            showJoinClassroom(false);
                        })
                        .setNegativeButton("取消", (dialog, which) -> {
                            showJoinClassroom(true);
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
                            showJoinClassroom(true);
                            h264ToTsStreamer.start();
                        }).start();
            }
        }
    }

    private void feedback() {
        Intent intent = new Intent(this, FeedbackActivity.class);
        startActivity(intent);
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
                            param.showTeacherSessionOnly = true;

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

    private void logout() {
        ViewModelStoreOwner owner = (ViewModelStoreOwner) this.getApplication();
        UserInfoViewModel userInfoViewModel = new ViewModelProvider(
                owner,
                new ViewModelProvider.AndroidViewModelFactory(this.getApplication())
        ).get(UserInfoViewModel.class);
        userInfoViewModel.token.postValue("");
        userInfoViewModel.userId.postValue("");
        userInfoViewModel.userInfo.postValue(new UserInfo());
        ScreenCastingManager.setClassMode(false);
        Intent intent = new Intent(this, LoginActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(intent);
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
        stopFloatingWindowService();
        mMainHandler.removeCallbacksAndMessages(null); // 彻底清除
        Log.e("++++++++++++++++", "onDestroy");
    }
}