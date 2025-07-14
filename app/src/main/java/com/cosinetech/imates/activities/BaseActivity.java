package com.cosinetech.imates.activities;

import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.FrameLayout;

import androidx.annotation.IdRes;
import androidx.annotation.LayoutRes;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.cosinetech.imates.R;
import com.cosinetech.imates.models.Subject;
import com.cosinetech.imates.util.WindowUtils;
import com.google.android.material.bottomnavigation.BottomNavigationView;

public abstract class BaseActivity extends AppCompatActivity {

    protected abstract @LayoutRes int getLayoutResId();

    protected abstract @IdRes int getCurrentNavItemId();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowUtils.hideSystemUI(this);
        WindowUtils.setFullScreenMode(this);
        setContentView(R.layout.activity_base);
        BottomNavigationView bottomNav = findViewById(R.id.bottom_navigation);
        ViewCompat.setOnApplyWindowInsetsListener(bottomNav, (v, insets) -> {
            // 获取原始的 Insets，但只保留左右，不保留底部
            Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            v.setPadding(systemBars.left, 0, systemBars.right, 0); // 底部 padding 为 0
            return WindowInsetsCompat.CONSUMED;
        });
        bottomNav.setSelectedItemId(getCurrentNavItemId());

        // 将子类的布局加载到 container 中
        FrameLayout container = findViewById(R.id.container);
        LayoutInflater inflater = (LayoutInflater) getSystemService(LAYOUT_INFLATER_SERVICE);
        View childLayout = inflater.inflate(getLayoutResId(), null);
        container.addView(childLayout);

        bottomNav.setOnItemSelectedListener(item -> {
            int itemId = item.getItemId();
            if (itemId == getCurrentNavItemId()) return true;

            Intent intent = null;
            if (itemId == R.id.nav_camera) {
                intent = new Intent(this, PhotoSearchActivity.class);
                intent.putExtra(PhotoSearchActivity.KEY_PARAM_SUBJECT, Subject.SUBJECT_MATH.name());
                startActivity(intent);
            } else if (itemId == R.id.nav_knowledge) {
                intent = new Intent(this, PhotoSearchActivity.class);
            } else if (itemId == R.id.nav_list) {
                intent = new Intent(this, QuestionSolveActivity.class);
            } else if (itemId == R.id.nav_profile) {
                intent = new Intent(this, MyProfileActivity.class);
            }

            if (intent != null) {
                startActivity(intent);
                overridePendingTransition(0, 0);
                finish(); // 避免堆栈积累
            }
            return true;
        });
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        WindowUtils.hideSystemUI(this);
    }
}