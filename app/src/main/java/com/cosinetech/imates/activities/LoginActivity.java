package com.cosinetech.imates.activities;

import androidx.appcompat.app.AlertDialog;
import androidx.lifecycle.ViewModelProvider;

import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;

import androidx.annotation.StringRes;
import androidx.appcompat.app.AppCompatActivity;
import androidx.lifecycle.ViewModelStoreOwner;

import android.os.Handler;
import android.provider.Settings;
import android.view.View;
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
    private SharedPreferences sharedPreferences;
    private final String CONFIG_NAME = "LOGIN_USER";
    private final String KEY_USER_NAME = "USER_NAME";
    private final String KEY_PASSWD = "PASSWORD";
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
        sharedPreferences = getSharedPreferences(CONFIG_NAME, Context.MODE_PRIVATE);
        // 隐藏系统导航栏
        WindowUtils.hideSystemUI(this);
        WindowUtils.setFullScreenMode(this);

        userInfoViewModel = new ViewModelProvider(
                (ViewModelStoreOwner) getApplication(),
                new ViewModelProvider.AndroidViewModelFactory(getApplication())
        ).get(UserInfoViewModel.class);

            com.cosinetech.imates.databinding.ActivityLoginBinding binding = ActivityLoginBinding.inflate(getLayoutInflater());
            setContentView(binding.getRoot());

            String userName = sharedPreferences.getString(KEY_USER_NAME, "");
            String passwd = sharedPreferences.getString(KEY_PASSWD, "");

            final EditText usernameEditText = binding.username;
            final EditText passwordEditText = binding.password;
            final Button loginButton = binding.login;
            loadingProgressBar = binding.loading;

            usernameEditText.setText(userName);
            passwordEditText.setText(passwd);

            loginButton.setOnClickListener(v -> {
                if (usernameEditText.getText().toString().trim().isEmpty()) {
                    binding.usernameError.setVisibility(View.VISIBLE);
                    return;
                }
                if (passwordEditText.getText().toString().trim().isEmpty()) {
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

        if(userInfoViewModel.token.getValue() != null && !userInfoViewModel.token.getValue().isEmpty()) {
            // 跳转到 MainActivity
            startMainActivityAndFinish();
        }
    }

    private void performLogin(String userName, String passwd) {
        SharedPreferences.Editor editor = sharedPreferences.edit();
        editor.putString(KEY_USER_NAME, userName);
        editor.putString(KEY_PASSWD, passwd);
        editor.apply();

        new Thread(() -> {
            try {
                LoginRepository loginRepository = new LoginRepository();
                userInfoViewModel.userId.postValue(userName);
                // Perform login
                String token = loginRepository.login(userName, passwd);
                userInfoViewModel.token.postValue(token);

                // Fetch user info
                UserInfo userInfo = loginRepository.getUserInfo(token);
                userInfoViewModel.userInfo.postValue(userInfo);

                // Navigate to MainActivity
                runOnUiThread(() -> {
                    Toast.makeText(LoginActivity.this, getText(R.string.tip_login_success), Toast.LENGTH_SHORT).show();
                    startMainActivityAndFinish();
                });
            } catch (Exception e) {
                runOnUiThread(() -> {
                    Toast.makeText(LoginActivity.this, e.getMessage().toString(), Toast.LENGTH_SHORT).show();
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

    private void startMainActivityAndFinish() {
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TASK | Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(intent);
        finish();
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
