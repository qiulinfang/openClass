package com.cosinetech.imates.activities;

import android.os.Bundle;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.View;
import android.widget.Button;

import androidx.appcompat.app.AppCompatActivity;

import com.cosinetech.imates.ApplicationModelShared;
import com.cosinetech.imates.R;
import com.cosinetech.imates.audio.AudioPlayManager;
import com.cosinetech.imates.models.ChatAiParam;
import com.cosinetech.imates.mq.MessagingManager;
import com.cosinetech.imates.mq.TeacherMessage;
import com.cosinetech.imates.util.WindowUtils;
import com.cosinetech.imates.views.ChatAiView;


public class ChatAiActivity extends AppCompatActivity implements MessagingManager.MessageListener {
    private ChatAiView mChatView;
    public static final String KEY_CHAT_AI_PARAM = "CHAT_PARAM";
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        ChatAiParam param = getIntent().getParcelableExtra(KEY_CHAT_AI_PARAM);

        WindowUtils.hideSystemUI(this);
        WindowUtils.setFullScreenMode(this);

        View view = getLayoutInflater().inflate(R.layout.popup_window_chat, null);
        setContentView(view);

        mChatView = view.findViewById(R.id.chat_view);
        mChatView.setChatAiParam(param);

        Button btnExit = view.findViewById(R.id.btn_exit);
        btnExit.setOnClickListener(v->{
            finish();
        });

        mChatView.registerScreenShotForActivityResult(this);
        mChatView.registerPickImageForActivityResult(this);
        // Set listener to be notified when screenshot is captured
        mChatView.setOnPictureSelectedListener(mChatView::sendPictureToTeacher);

        MessagingManager.getInstance().addMessageListener(this);

        // 动态设置窗口宽度
        DisplayMetrics metrics = new DisplayMetrics();
        getWindowManager().getDefaultDisplay().getMetrics(metrics);
        int screenWidth = metrics.widthPixels;
        getWindow().setLayout((int) (screenWidth * 0.67), metrics.heightPixels);

        ApplicationModelShared.getInstance().getFloatingWindowService().hideRobot();
    }

    @Override
    public void onTeacherMessageReceived(TeacherMessage message) {
        mChatView.onReceivedTeacherMessage(message);
    }

    @Override
    protected void onResume() {
        super.onResume();
        Log.e("++++++++++++++++", "onResume");
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            WindowUtils.hideSystemUI(this);
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        MessagingManager.getInstance().removeMessageListener(this);
        AudioPlayManager.getInstance().stopPlay();
        ApplicationModelShared.getInstance().getFloatingWindowService().showRobot();
    }
}
