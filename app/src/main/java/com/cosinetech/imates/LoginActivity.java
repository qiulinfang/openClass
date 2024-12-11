package com.cosinetech.imates;

import android.app.Activity;

import androidx.lifecycle.Observer;
import androidx.lifecycle.ViewModelProvider;

import android.app.Application;
import android.content.Intent;
import android.os.Bundle;

import androidx.annotation.Nullable;
import androidx.annotation.StringRes;
import androidx.appcompat.app.AppCompatActivity;
import androidx.lifecycle.ViewModelStoreOwner;

import android.os.Handler;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.KeyEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import com.cosinetech.imates.databinding.ActivityLoginBinding;
import com.cosinetech.imates.model.UserInfo;
import com.cosinetech.imates.model.UserViewModel;
import com.cosinetech.imates.util.WindowUtils;

public class LoginActivity extends AppCompatActivity {
    private UserViewModel userViewModel;
    private TextView textView;
    private String fullText = null;
    private int index = 0; // 当前显示的字符索引
    private final Handler handler = new Handler(); // 用于更新 UI
    private final Runnable typeWriterRunnable = new Runnable() {
        @Override
        public void run() {
            if (index <= fullText.length()) {
                textView.setText(fullText.substring(0, index)); // 更新显示的文字
                index++; // 更新索引
                // 每个字符显示的间隔时间，单位：毫秒
                long delay = 200;
                handler.postDelayed(this, delay); // 延迟后继续执行
            } else {
                long delay = 200;
                handler.postDelayed(this, delay); // 延迟后继续执行
                index = 0;
            }
        }
    };

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        userViewModel = new ViewModelProvider(
                (ViewModelStoreOwner) getApplication(),
                new ViewModelProvider.AndroidViewModelFactory(getApplication())
        ).get(UserViewModel.class);
        // 设置全屏模式
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN);

        // 隐藏系统导航栏
        WindowUtils.hideSystemUI(this);

        com.cosinetech.imates.databinding.ActivityLoginBinding binding = ActivityLoginBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        // 设置全屏并不遮挡导航栏
        View decorView = getWindow().getDecorView();
        decorView.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
        );

        final EditText usernameEditText = binding.username;
        final EditText passwordEditText = binding.password;
        final Button loginButton = binding.login;
        final ProgressBar loadingProgressBar = binding.loading;

        loginButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                loadingProgressBar.setVisibility(View.VISIBLE);
                performLogin(usernameEditText.getText().toString(), passwordEditText.getText().toString());
            }
        });

        fullText = getString(R.string.login_moto);
        textView = findViewById(R.id.moto); // 获取 TextView
        startTypingEffect(); // 启动打字机效果
    }

    private void performLogin(String userName, String passwd) {
        new Thread(() -> {
            try {
                LoginRepository loginRepository = new LoginRepository();
                // Perform login
                String token = loginRepository.login(userName, passwd);
                userViewModel.token.postValue(token);

                // Fetch user info
                UserInfo userInfo = loginRepository.getUserInfo(token);
                userViewModel.userInfo.postValue(userInfo);

                // Navigate to MainActivity
                runOnUiThread(() -> {
                    Toast.makeText(LoginActivity.this, "Login successful", Toast.LENGTH_SHORT).show();
                    Intent intent = new Intent(LoginActivity.this, MainActivity.class);
                    startActivity(intent);
                    finish(); // Close LoginActivity
                });
            } catch (Exception e) {
                e.printStackTrace();
                runOnUiThread(() -> Toast.makeText(LoginActivity.this, "Login failed", Toast.LENGTH_SHORT).show());
            }
        }).start();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            WindowUtils.hideSystemUI(this);
        }
    }
    private void startTypingEffect() {
        index = 0;
        handler.post(typeWriterRunnable); // 启动打字机效果
    }

//    private void updateUiWithUser(LoggedInUserView model) {
//        String welcome = getString(R.string.welcome) + model.getDisplayName();
//        // TODO : initiate successful logged in experience
//        Toast.makeText(getApplicationContext(), welcome, Toast.LENGTH_LONG).show();
//    }

    private void showLoginFailed(@StringRes Integer errorString) {
        Toast.makeText(getApplicationContext(), errorString, Toast.LENGTH_SHORT).show();
    }
}
