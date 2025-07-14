package com.cosinetech.imates.activities;

import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.cardview.widget.CardView;

import com.cosinetech.imates.util.WindowUtils;

import com.cosinetech.imates.R;

public class MyProfileActivity extends BaseActivity {
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
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        WindowUtils.hideSystemUI(this);
    }
}