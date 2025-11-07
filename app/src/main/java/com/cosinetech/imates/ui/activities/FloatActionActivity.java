package com.cosinetech.imates.ui.activities;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.widget.Toast;

import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;

import com.cosinetech.imates.ApplicationModelShared;
import com.cosinetech.imates.coreapiservice.ApiUrl;
import com.cosinetech.imates.data.models.ChatAiParam;
import com.cosinetech.imates.utils.AppUtils;
import com.cosinetech.imates.utils.SimpleImageCompressor;
import com.github.drjacky.imagepicker.ImagePicker;
import com.github.drjacky.imagepicker.constant.ImageProvider;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

public class FloatActionActivity extends AppCompatActivity {

    private static final String TAG = "FloatActionActivity";

    // 任务类型
    public static final String EXTRA_TASK_TYPE = "task_type";

    public static final String TASK_SCREEN_SHARE = "screen_share";
    public static final String TASK_TAKE_PICTURE = "take_picture";

    private boolean initialized = false;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Log.d(TAG, "onCreate()");
    }

    @Override
    protected void onNewIntent(@NonNull Intent intent) {
        super.onNewIntent(intent);
        Log.d(TAG, "onNewIntent()");
        handleIntent(intent);
    }

    @Override
    protected void onResume() {
        super.onResume();
        Log.d(TAG, "onResume()");
        if (!initialized) {
            initialized = true;
            handleIntent(getIntent());
        } else {
            moveTaskToBack(true);
        }
    }

    private void handleIntent(Intent intent) {
        if (intent == null) return;

        String type = intent.getStringExtra(EXTRA_TASK_TYPE);
        Log.d(TAG, "handleIntent: task=" + type);

        if (Objects.equals(type, TASK_SCREEN_SHARE)) {
            runScreenShare();
        } else if (Objects.equals(type, TASK_TAKE_PICTURE)) {
            runImagePicker();
        }  else {
            Log.w(TAG, "未知任务类型");
            moveTaskToBack(true);
        }
    }

    // 示例任务 1：屏幕共享
    private void runScreenShare() {
    }

    private void runImagePicker() {
        takePictureToTeacher();
    }
    private final ActivityResultLauncher<Intent> launcher =
            registerForActivityResult(new ActivityResultContracts.StartActivityForResult(),(ActivityResult result)->{
                if(result.getResultCode()==RESULT_OK){
                    if(result.getData() != null) {
                        ArrayList<Uri> uriList = result.getData().getParcelableArrayListExtra(ImagePicker.MULTIPLE_FILES_PATH);
                        if(uriList == null) {
                            uriList = new ArrayList<>();
                            Uri uri = result.getData().getData();
                            uriList.add(uri);
                        }
                        processPostSelectImage(uriList);
                        moveTaskToBack(true);
                    }
                }else if(result.getResultCode()== ImagePicker.RESULT_ERROR){
                    Log.e("IMGPICKER", ImagePicker.Companion.getError(result.getData()));// to show an error
                }});
    @SuppressLint("CheckResult")
    private void takePictureToTeacher() {
        ImagePicker.Companion.with(this)
                .provider(ImageProvider.BOTH) //Or bothCameraGallery()
                .setOutputFormat(Bitmap.CompressFormat.JPEG)
                .setMultipleAllowed(true)
                .createIntentFromDialog(it -> {
                    launcher.launch(it);
                    return null;
                });
    }

    private void processPostSelectImage(List<Uri> uriList) {
        if(uriList == null) {
            return;
        }
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
            ChatAiParam param = new ChatAiParam();
            param.chatBotUrl = ApiUrl.URL_CHAT_GENERAL;
            param.showHeader = true;
            param.streamDisplay = true;
            param.showHistory = true;
            param.initialSendEnable = true;
            //param.showTeacherSessionOnly = true;

            Intent intent = new Intent(this, ChatAiActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK); // 启动新任务栈
            intent.putExtra(ChatAiActivity.KEY_CHAT_AI_PARAM, param);
            intent.putExtra(ChatAiActivity.KEY_SUBMIT_PICTURE_PATH, finalPaths);
            startActivity(intent);

            ApplicationModelShared.getInstance().getFloatingWindowService().hideRobot();
        }
    }


    @Override
    protected void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "onDestroy()");
    }
}