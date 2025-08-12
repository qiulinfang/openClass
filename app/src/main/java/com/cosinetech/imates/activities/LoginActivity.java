package com.cosinetech.imates.activities;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AlertDialog;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.lifecycle.ViewModelProvider;

import android.Manifest;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;

import androidx.annotation.StringRes;
import androidx.appcompat.app.AppCompatActivity;
import androidx.lifecycle.ViewModelStoreOwner;

import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import com.cosinetech.imates.AppEnvConfig;
import com.cosinetech.imates.AppEnvSwitchDialog;
import com.cosinetech.imates.AppEnvSwitchHelper;
import com.cosinetech.imates.LoginRepository;
import com.cosinetech.imates.R;
import com.cosinetech.imates.databinding.ActivityLoginBinding;
import com.cosinetech.imates.models.UserInfo;
import com.cosinetech.imates.models.UserInfoViewModel;
import com.cosinetech.imates.util.WindowUtils;
import com.cosinetech.imates.coreapiservice.ApiUrl;
import com.xuexiang.xupdate.easy.EasyUpdate;

import java.io.File;

public class LoginActivity extends AppCompatActivity {
    private static final int REQUEST_CODE_DRAW_OVERLAY = 1001;
    private UserInfoViewModel userInfoViewModel;
    private TextView textView;
    private Button loginButton;
    private String fullText = null;
    private ProgressBar loadingProgressBar;
    private SharedPreferences sharedPreferences;
    private final String CONFIG_NAME = "LOGIN_USER";
    private final String KEY_USER_NAME = "USER_NAME";
    private final String KEY_PASSWD = "PASSWORD";
    private int index = 0; // 当前显示的字符索引
    private int clickCount = 0; // 记录点击次数
    private final Handler handler = new Handler(Looper.getMainLooper()); // 用于更新 UI
    private final Runnable resetClickCountRunnable = new Runnable() {
        @Override
        public void run() {
            clickCount = 0; // 重置点击次数
            handler.postDelayed(this, 2000);
        }
    };
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

    private long mCheckUpdateTick = 0;
    private final Handler mCheckUpdateHandler = new Handler(Looper.getMainLooper());
    private final Runnable mCheckUpdateRunnable = new Runnable() {
        @Override
        public void run() {
            long tick = System.currentTimeMillis();
            if(tick - mCheckUpdateTick >= 3600000) {
                mCheckUpdateTick = tick;
                EasyUpdate.create(LoginActivity.this, ApiUrl.URL_APP_UPDATE)
                        .isAutoMode(false)
                        .update();
            }
            mCheckUpdateHandler.postDelayed(this, 60000); // 每秒执行一次
        }
    };

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        AppEnvConfig.checkAndUpdateVersion(this);
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
        loginButton = binding.login;
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

        mCheckUpdateTick = System.currentTimeMillis();
        mCheckUpdateHandler.postDelayed(mCheckUpdateRunnable, 60000);

        ((TextView)(findViewById(R.id.version))).setText(AppEnvConfig.getAppVersion(this));
        findViewById(R.id.version).setOnClickListener(v -> {
            clickCount++;
            // 如果点击次数达到
            if(clickCount >= 5) {
                clickCount = 0;
                AppEnvSwitchHelper.showEnvSwitchOption(this, new AppEnvSwitchDialog.AppEnvSwitchCallback() {
                    @Override
                    public void onSwitchSuccess(AppEnvConfig.AppEnvType newEnv) {
                        ((TextView)(findViewById(R.id.version))).setText(AppEnvConfig.getAppVersion(LoginActivity.this));
                    }

                    @Override
                    public void onSwitchFailed() {
                        ((TextView)(findViewById(R.id.version))).setText(AppEnvConfig.getAppVersion(LoginActivity.this));
                    }
                });

            }
        });

        handler.postDelayed(resetClickCountRunnable, 2000);
    }

    @Override
    protected void onResume() {
        super.onResume();
        // 检查权限
        if (!Settings.canDrawOverlays(this)) {
            // 如果没有权限，请求权限
            requestOverlayPermission();
        } else {
            // 有权限
        }

        final int REQUEST_CODE_RECORD_AUDIO = 101;
        requestPermission(Manifest.permission.RECORD_AUDIO, REQUEST_CODE_RECORD_AUDIO,
                "需要录音权限才能正常使用此功能", () -> {
                    // 录音权限被授予后执行的操作
                    Toast.makeText(this, "录音权限已授予", Toast.LENGTH_SHORT).show();
        });


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
        loginButton.setEnabled(false);

        File filesDir = getExternalFilesDir(null);
        File userFilesDir = new File(filesDir, userName);
        if (!userFilesDir.exists()) {
            boolean created = userFilesDir.mkdirs();  // 创建子目录
            if (created) {
                Log.d("DirectoryCreation", "Subdirectory created successfully!");
            } else {
                Log.d("DirectoryCreation", "Failed to create subdirectory.");
            }
        } else {
            Log.d("DirectoryCreation", "Subdirectory already exists.");
        }


        new Thread(() -> {
            try {
                LoginRepository loginRepository = new LoginRepository();
                userInfoViewModel.userId.postValue(userName);

                userInfoViewModel.password.postValue(passwd);
                // Perform login
                String token = loginRepository.login(userName, passwd);
                userInfoViewModel.token.postValue(token);

                // Fetch user info
                UserInfo userInfo = loginRepository.getUserInfo(token);
                userInfoViewModel.userInfo.postValue(userInfo);

                userInfoViewModel.userPath.postValue(userFilesDir);

                // Navigate to MainActivity
                runOnUiThread(() -> {
                    Toast.makeText(LoginActivity.this, getText(R.string.tip_login_success), Toast.LENGTH_SHORT).show();
                    startMainActivityAndFinish();
                });
            } catch (Exception e) {
                runOnUiThread(() -> {
                    Toast.makeText(LoginActivity.this, e.getMessage().toString(), Toast.LENGTH_SHORT).show();
                    loadingProgressBar.setVisibility(View.INVISIBLE);
                    loginButton.setEnabled(true);
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
        Intent intent = new Intent(this, MyProfileActivity.class);
        //intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TASK | Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(intent);
        finish();
    }
    private void startTypingEffect() {
        index = 0;
        handler.post(typeWriterRunnable); // 启动打字机效果
    }

    private void showLoginFailed(@StringRes Integer errorString) {
        Toast.makeText(getApplicationContext(), errorString, Toast.LENGTH_SHORT).show();
    }

    private void requestOverlayPermission() {
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
        builder.setNegativeButton("取消", (dialog, which) -> {
            // 用户取消，提示用户
            Toast.makeText(LoginActivity.this, "您拒绝了权限，功能无法使用", Toast.LENGTH_SHORT).show();
        });

        // 显示对话框
        builder.show();
    }

    private void requestPermission(String permission, int requestCode, String rationale, Runnable onGranted) {
        if (ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED) {
            // 权限已授权，直接执行回调
            onGranted.run();
        } else {
            // 显示权限申请对话框
            new AlertDialog.Builder(this)
                    .setTitle("权限请求")
                    .setMessage(rationale)
                    .setPositiveButton("允许", (dialog, which) ->
                            ActivityCompat.requestPermissions(this, new String[]{permission}, requestCode))
                    .setNegativeButton("取消", (dialog, which) ->
                            Toast.makeText(this, "您拒绝了权限，功能可能无法正常使用", Toast.LENGTH_SHORT).show())
                    .show();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        mCheckUpdateHandler.removeCallbacksAndMessages(null); // 彻底清除
        handler.removeCallbacksAndMessages(null);
        Log.e("++++++++++++++++", "onDestroy");
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            Toast.makeText(this, "权限已授予", Toast.LENGTH_SHORT).show();
        } else {
            Toast.makeText(this, "权限被拒绝，功能无法使用", Toast.LENGTH_SHORT).show();
        }
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
                    requestOverlayPermission();
                }
            }
        }
    }
}
