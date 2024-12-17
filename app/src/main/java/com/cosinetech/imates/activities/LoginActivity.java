package com.cosinetech.imates.activities;

import androidx.appcompat.app.AlertDialog;
import androidx.lifecycle.ViewModelProvider;

import android.content.DialogInterface;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;

import androidx.annotation.StringRes;
import androidx.appcompat.app.AppCompatActivity;
import androidx.lifecycle.ViewModelStoreOwner;

import android.os.Handler;
import android.provider.Settings;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import com.cosinetech.imates.LoginRepository;
import com.cosinetech.imates.R;
import com.cosinetech.imates.databinding.ActivityLoginBinding;
import com.cosinetech.imates.models.UserInfo;
import com.cosinetech.imates.models.UserInfoViewModel;
import com.cosinetech.imates.util.WindowUtils;

public class LoginActivity extends AppCompatActivity {
    private static final int REQUEST_CODE_DRAW_OVERLAY = 1001;
    private UserInfoViewModel userInfoViewModel;
    private TextView textView;
    private String fullText = null;
    private ProgressBar loadingProgressBar;
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
        userInfoViewModel = new ViewModelProvider(
                (ViewModelStoreOwner) getApplication(),
                new ViewModelProvider.AndroidViewModelFactory(getApplication())
        ).get(UserInfoViewModel.class);
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
        loadingProgressBar = binding.loading;

        loginButton.setOnClickListener(v -> {
            if(usernameEditText.getText().toString().trim().isEmpty()) {
                binding.usernameError.setVisibility(View.VISIBLE);
                return;
            }
            if(passwordEditText.getText().toString().trim().isEmpty()) {
                binding.usernameError.setVisibility(View.INVISIBLE);
                binding.passwordError.setVisibility(View.VISIBLE);
                return;
            }
            binding.usernameError.setVisibility(View.INVISIBLE);
            binding.passwordError.setVisibility(View.INVISIBLE);
            performLogin(usernameEditText.getText().toString(), passwordEditText.getText().toString());
            loadingProgressBar.setVisibility(View.VISIBLE);
        });

        fullText = getString(R.string.login_moto);
        textView = findViewById(R.id.moto_text); // 获取 TextView
        startTypingEffect(); // 启动打字机效果
    }



    @Override
    protected void onResume() {
        super.onResume();
        // 检查权限
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(this)) {
                // 如果没有权限，请求权限
                showPermissionDialog();
            } else {
                // 有权限
            }
        }
    }

    private void performLogin(String userName, String passwd) {
        new Thread(() -> {
            try {
                LoginRepository loginRepository = new LoginRepository();
                // Perform login
                String token = loginRepository.login(userName, passwd);
                userInfoViewModel.token.postValue(token);

                // Fetch user info
                UserInfo userInfo = loginRepository.getUserInfo(token);
                userInfoViewModel.userInfo.postValue(userInfo);

                // Navigate to MainActivity
                runOnUiThread(() -> {
                    Toast.makeText(LoginActivity.this, getText(R.string.tip_login_success), Toast.LENGTH_SHORT).show();
                    Intent intent = new Intent(LoginActivity.this, MainActivity.class);
                    startActivity(intent);
                    finish(); // Close LoginActivity
                });
            } catch (Exception e) {
                runOnUiThread(() -> {
                    Toast.makeText(LoginActivity.this, getText(R.string.tip_login_fail), Toast.LENGTH_SHORT).show();
                    loadingProgressBar.setVisibility(View.INVISIBLE);
                });
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

    private void showPermissionDialog() {
        // 创建 AlertDialog
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("权限提示");
        builder.setMessage("需要悬浮窗权限才能正常使用此功能。是否前往设置页面授权？");

        // 设置“前往设置”按钮
        builder.setPositiveButton("前往设置", new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                // 跳转到系统设置页面
                Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:" + getPackageName()));
                startActivityForResult(intent, REQUEST_CODE_DRAW_OVERLAY);
            }
        });

        // 设置“取消”按钮
        builder.setNegativeButton("取消", new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                // 用户取消，提示用户
                Toast.makeText(LoginActivity.this, "您拒绝了权限，功能无法使用", Toast.LENGTH_SHORT).show();
            }
        });

        // 显示对话框
        builder.show();
    }

    private void requestOverlayPermission() {
        Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:" + getPackageName()));
        startActivityForResult(intent, REQUEST_CODE_DRAW_OVERLAY);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_CODE_DRAW_OVERLAY) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (Settings.canDrawOverlays(this)) {
                    // 权限已授予
                } else {
                    // 权限未授予
                    Toast.makeText(this, "需要悬浮窗权限", Toast.LENGTH_SHORT).show();
                    showPermissionDialog();
                }
            }
        }
    }
}
