package com.cosinetech.imates.ui.activities;

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
import com.cosinetech.imates.ui.data.models.Subject;
import com.cosinetech.imates.utils.WindowUtils;
import com.cosinetech.imates.coreapiservice.ApiUrl;
import com.google.android.material.bottomnavigation.BottomNavigationView;

public abstract class BaseActivity extends AppCompatActivity {
    private BottomNavigationView bottomNav;
    protected abstract @LayoutRes int getLayoutResId();

    protected abstract @IdRes int getCurrentNavItemId();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowUtils.hideSystemUI(this);
        WindowUtils.setFullScreenMode(this);
        setContentView(R.layout.activity_base);
        bottomNav = findViewById(R.id.bottom_navigation);
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
            if (itemId == R.id.nav_photo_search) {
                intent = new Intent(this, PhotoSearchActivity.class);
                intent.putExtra(PhotoSearchActivity.KEY_PARAM_SUBJECT, Subject.SUBJECT_MATH.name());
                startActivity(intent);
            } else if (itemId == R.id.nav_textbook_knowledge) {
                intent = new Intent(this, KnowledgeGraphActivity.class);
            } else if (itemId == R.id.nav_exercise_list) {
                intent = new Intent(this, ExerciseSolveActivity.class);
                intent.putExtra(ExerciseSolveActivity.KEY_CHATBOT_URL, ApiUrl.URL_CHAT_MATH);
                intent.putExtra(ExerciseSolveActivity.KEY_SUBJECT, Subject.SUBJECT_MATH.name());
                startActivity(intent);
            } else if (itemId == R.id.nav_my_profile) {
                intent = new Intent(this, MyProfileActivity.class);
            }

            if (intent != null) {
                intent.setFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                startActivity(intent);
            }
            return true;
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        WindowUtils.hideSystemUI(this);
        bottomNav.setSelectedItemId(getCurrentNavItemId());
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        WindowUtils.hideSystemUI(this);
    }
}