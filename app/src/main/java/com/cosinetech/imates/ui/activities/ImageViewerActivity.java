package com.cosinetech.imates.ui.activities;

import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.widget.Button;

import androidx.appcompat.app.AppCompatActivity;
import com.bumptech.glide.Glide;
import com.cosinetech.imates.R;
import com.cosinetech.imates.utils.WindowUtils;
import com.github.chrisbanes.photoview.PhotoView;

public class ImageViewerActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setType(WindowManager.LayoutParams.TYPE_PHONE);

        WindowUtils.hideSystemUI(this);
        WindowUtils.setFullScreenMode(this);

        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);

        setContentView(R.layout.activity_image_viewer);

        // 获取传递的图片路径
        String imagePath = getIntent().getStringExtra("image_path");

        // 初始化 PhotoView
        PhotoView photoView = findViewById(R.id.photo_view);

        // 使用 Glide 加载图片
        Glide.with(this)
                .load(imagePath) // 图片路径
                .into(photoView);

        Button btnBack = findViewById(R.id.btn_back);
        btnBack.setOnClickListener(v->finish());
    }


    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            WindowUtils.hideSystemUI(this);
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();

        // 移除浮窗
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getWindow().setType(WindowManager.LayoutParams.TYPE_APPLICATION); // 恢复为普通窗口类型
        }
    }

    @Override
    public void onBackPressed() {
        super.onBackPressed();
        finish(); // 结束 Activity
    }
}