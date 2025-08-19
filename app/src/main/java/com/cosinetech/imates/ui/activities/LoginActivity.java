package com.cosinetech.imates.ui.activities;

import androidx.annotation.NonNull;
import androidx.lifecycle.ViewModelProvider;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;

import androidx.appcompat.app.AppCompatActivity;
import androidx.lifecycle.ViewModelStoreOwner;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import com.cosinetech.imates.appenv.AppEnvConfig;
import com.cosinetech.imates.appenv.AppEnvSwitchDialog;
import com.cosinetech.imates.appenv.AppEnvSwitchHelper;
import com.cosinetech.imates.data.repository.LoginRepository;
import com.cosinetech.imates.R;
import com.cosinetech.imates.databinding.ActivityLoginBinding;
import com.cosinetech.imates.data.models.UserInfo;
import com.cosinetech.imates.data.models.UserInfoViewModel;
import com.cosinetech.imates.utils.PermissionHelper;
import com.cosinetech.imates.utils.WindowUtils;
import com.cosinetech.imates.coreapiservice.ApiUrl;
import com.xuexiang.xupdate.easy.EasyUpdate;

import java.io.File;

public class LoginActivity extends AppCompatActivity {
    private UserInfoViewModel userInfoViewModel;
    private Button loginButton;
    private ProgressBar loadingProgressBar;
    private SharedPreferences sharedPreferences;
    private final String CONFIG_NAME = "LOGIN_USER";
    private final String KEY_USER_NAME = "USER_NAME";
    private final String KEY_PASSWD = "PASSWORD";
    private int clickCount = 0; // 记录点击次数
    private boolean hasRequestedPermissions = false;
    PermissionHelper permissionHelper;
    private final Handler handler = new Handler(Looper.getMainLooper()); // 用于更新 UI
    private final Runnable resetClickCountRunnable = new Runnable() {
        @Override
        public void run() {
            clickCount = 0; // 重置点击次数
            handler.postDelayed(this, 2000);
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

        permissionHelper = new PermissionHelper(this, new PermissionHelper.Callback() {
            @Override
            public void onAllPermissionsGranted() {
                Toast.makeText(LoginActivity.this, "所有权限已授权", Toast.LENGTH_SHORT).show();
                // 这里执行应用正常逻辑
            }

            @Override
            public void onPermissionDenied(String permission) {
                Toast.makeText(LoginActivity.this, "应用无法正常使用, 权限被拒绝 " + permission, Toast.LENGTH_SHORT).show();
            }
        });

        // 第一次启动请求权限
        permissionHelper.requestAllPermissionsWithPreDialog();
    }

    @Override
    public void onStart() {
        super.onStart();
        if (!hasRequestedPermissions) {
            hasRequestedPermissions = true;
            permissionHelper.requestAllPermissionsWithPreDialog();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
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
        Intent intent = new Intent(this, KnowledgeGraphActivity.class);
        startActivity(intent);
        finish();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        mCheckUpdateHandler.removeCallbacksAndMessages(null); // 彻底清除
        handler.removeCallbacksAndMessages(null);
        Log.e("++++++++++++++++", "onDestroy");
    }

    @Override
    public void onRequestPermissionsResult(int requestCode,
                                           @NonNull String[] permissions,
                                           @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        permissionHelper.onRequestPermissionsResult(requestCode, permissions, grantResults);
    }

}
