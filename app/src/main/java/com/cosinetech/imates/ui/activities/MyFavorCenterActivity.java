package com.cosinetech.imates.ui.activities;

import android.os.Bundle;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.PopupWindow;

import androidx.appcompat.app.AppCompatActivity;
import androidx.cardview.widget.CardView;

import com.cosinetech.imates.R;
import com.cosinetech.imates.data.models.Subject;
import com.cosinetech.imates.utils.WindowUtils;

public class MyFavorCenterActivity extends AppCompatActivity {
    public  static String KEY_SUBJECT_NAME = "SUBJECT_NAME";
    private String subjectName;
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowUtils.hideSystemUI(this);
        WindowUtils.setFullScreenMode(this);
        setContentView(R.layout.popup_window_my_favor);

        subjectName = getIntent().getStringExtra(KEY_SUBJECT_NAME);
        if(subjectName == null || subjectName.isEmpty()) {
            subjectName = Subject.SUBJECT_BIOLOGY.name();
        }

        View decorView = getWindow().getDecorView();

        // 关闭按钮点击事件
        Button closeButton = findViewById(R.id.close);
        closeButton.setOnClickListener(v -> finish());

        CardView btnShowNotes = findViewById(R.id.my_note);
        btnShowNotes.setOnClickListener(v->{
            showMyFavorNotes(decorView);
        });

        CardView btnShowMind = findViewById(R.id.my_mind);
        btnShowMind.setOnClickListener(v->{
            showMyFavorMind(decorView);
        });

    }

    public void showMyFavorNotes(View view) {
        // 加载布局
        View popupView = LayoutInflater.from(this).inflate(R.layout.popup_window_my_notes, null);

        // 初始化 PopupWindow
        PopupWindow popupWindow = new PopupWindow(popupView,
                ViewGroup.LayoutParams.MATCH_PARENT, // 宽度
                ViewGroup.LayoutParams.MATCH_PARENT); // 高度

        // 设置点击外部区域关闭
        popupWindow.setOutsideTouchable(true);
        popupWindow.setFocusable(true);

        // 设置图片
        ImageView imageView = popupView.findViewById(R.id.img_view);
        if(subjectName.equals(Subject.SUBJECT_BIOLOGY.name())) {
            imageView.setImageResource(R.drawable.notes_biology);
        } else if(subjectName.equals(Subject.SUBJECT_MATH.name())) {
            imageView.setImageResource(R.drawable.notes_math);
        }

        // 关闭按钮点击事件
        Button closeButton = popupView.findViewById(R.id.close);
        closeButton.setOnClickListener(v -> popupWindow.dismiss());

        // 显示 PopupWindow
        popupWindow.showAtLocation(view, Gravity.CENTER, 0, 0);
    }

    public void showMyFavorMind(View view) {
// 加载布局
        View popupView = LayoutInflater.from(this).inflate(R.layout.popup_window_my_mind, null);

        // 初始化 PopupWindow
        PopupWindow popupWindow = new PopupWindow(popupView,
                ViewGroup.LayoutParams.MATCH_PARENT, // 宽度
                ViewGroup.LayoutParams.MATCH_PARENT); // 高度

        // 设置背景
        //popupWindow.setBackgroundDrawable(new ColorDrawable(android.R.color.white));

        // 设置点击外部区域关闭
        popupWindow.setOutsideTouchable(true);
        popupWindow.setFocusable(true);

        // 设置图片
        ImageView imageView = popupView.findViewById(R.id.img_view);
        if(subjectName.equals(Subject.SUBJECT_BIOLOGY.name())) {
            imageView.setImageResource(R.drawable.notes_biology);
        } else if(subjectName.equals(Subject.SUBJECT_MATH.name())) {
            imageView.setImageResource(R.drawable.notes_math);
        }

        // 关闭按钮点击事件
        Button closeButton = popupView.findViewById(R.id.close);
        closeButton.setOnClickListener(v -> popupWindow.dismiss());

        // 显示 PopupWindow
        popupWindow.showAtLocation(view, Gravity.CENTER, 0, 0);
    }


    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            WindowUtils.hideSystemUI(this);
        }
    }
}