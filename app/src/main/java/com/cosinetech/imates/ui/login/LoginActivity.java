package com.cosinetech.imates.ui.login; // 声明包名，指定该类属于哪个包

// 导入所需的Android和项目相关类
import android.Manifest;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.text.Editable;
import android.text.TextWatcher;
import android.util.Log;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.StringRes;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.lifecycle.ViewModelProvider;
import androidx.lifecycle.ViewModelStoreOwner;

import com.cosinetech.imates.appenv.AppEnvConfig;
import com.cosinetech.imates.appenv.AppEnvSwitchDialog;
import com.cosinetech.imates.appenv.AppEnvSwitchHelper;
import com.cosinetech.imates.data.repository.LoginRepository;
import com.cosinetech.imates.R;
import com.cosinetech.imates.databinding.ActivityLoginBinding;
import com.cosinetech.imates.data.models.UserInfo;
import com.cosinetech.imates.data.models.UserInfoViewModel;
import com.cosinetech.imates.ui.activities.MyProfileActivity;
import com.cosinetech.imates.utils.WindowUtils;
import com.cosinetech.imates.coreapiservice.ApiUrl;
import com.xuexiang.xupdate.easy.EasyUpdate;

import java.io.File;

// 登录界面Activity，负责用户登录、权限申请、环境切换等功能
public class LoginActivity extends AppCompatActivity {
    // 1. 常量声明
    // 悬浮窗权限请求码
    private static final int REQUEST_CODE_DRAW_OVERLAY = 1001;
    // SharedPreferences配置名
    private final String PREFS_LOGIN_USER = "LOGIN_USER";
    // 用户名key
    private final String PREF_KEY_USERNAME = "USER_NAME";
    // 密码key
    private final String PREF_KEY_PASSWORD = "PASSWORD";

    // 2. View相关
    // 登录界面标语TextView
    private TextView tvMoto;
    // 登录按钮
    private Button btnLogin;
    // 加载进度条
    private ProgressBar progressBarLoading;
    // 视图绑定
    private ActivityLoginBinding binding;
    // 用户名、密码输入框
    private EditText etUsername;
    private EditText etPassword;

    // 3. 数据相关
    // 用户登录信息本地存储
    private SharedPreferences loginPrefs;
    // 标语完整文本
    private String motoText = null;
    // 打字机效果当前字符索引
    private int typewriterIndex = 0;
    // 版本号点击计数
    private int versionClickCount = 0;

    // 4. Handler/定时器相关
    // UI线程Handler
    private final Handler uiHandler = new Handler(Looper.getMainLooper());
    // 重置版本号点击计数的定时任务
    private final Runnable resetVersionClickCountRunnable = new Runnable() {
        @Override
        public void run() {
            versionClickCount = 0; // 将版本号点击计数重置为0
            uiHandler.postDelayed(this, 2000); // 2秒后再次执行该任务
        }
    };

    // 上次检查更新的时间戳
    private long lastCheckUpdateTick = 0;
    // 检查更新的Handler
    private final Handler checkUpdateHandler = new Handler(Looper.getMainLooper());
    // 检查更新定时任务 - 每分钟检查一次，但实际更新间隔为1小时
    private final Runnable checkUpdateRunnable = new Runnable() {
        @Override
        public void run() {
            long tick = System.currentTimeMillis(); // 获取当前时间戳
            if(tick - lastCheckUpdateTick >= 3600000) { // 3600000ms = 1小时，如果距离上次检查更新已超过1小时
                lastCheckUpdateTick = tick; // 更新上次检查时间戳
                EasyUpdate.create(com.cosinetech.imates.ui.login.LoginActivity.this, ApiUrl.URL_APP_UPDATE) // 创建更新检查
                        .isAutoMode(false) // 非自动模式，需要用户确认
                        .update(); // 执行更新检查
            }
            checkUpdateHandler.postDelayed(this, 60000); // 60秒后再次检查
        }
    };

    // 5. ViewModel相关
    // 用户信息ViewModel
    private UserInfoViewModel userInfoVM;
    // 登录ViewModel
    private LoginViewModel loginVM;

    // 6. 生命周期方法
    /**
     * Activity创建时的入口，依次完成环境设置、ViewModel初始化、视图绑定、后台任务启动等。
     */
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState); // 调用父类的onCreate方法
        Log.d("LoginActivity", "onCreate: called"); // 打印调试日志
        setupAppAndUI(); // 设置应用环境和UI
        initViewModels(); // 初始化ViewModel
        setupViewsAndData(); // 设置视图和数据
        startBackgroundTasksAndEffects(); // 启动后台任务和特效
    }

    /**
     * Activity恢复时，检查悬浮窗和录音权限，已登录则自动跳转主界面。
     */
    @Override
    protected void onResume() {
        super.onResume(); // 调用父类的onResume方法
        Log.d("LoginActivity", "onResume: called"); // 打印调试日志
        if (!Settings.canDrawOverlays(this)) { // 如果没有悬浮窗权限
            requestOverlayPermission(); // 请求悬浮窗权限
        }
        final int REQUEST_CODE_RECORD_AUDIO = 101; // 定义录音权限请求码
        requestPermission(Manifest.permission.RECORD_AUDIO, REQUEST_CODE_RECORD_AUDIO, // 请求录音权限
                "需要录音权限才能正常使用此功能", () -> { // 权限说明和授权后回调
                    Toast.makeText(this, "录音权限已授予", Toast.LENGTH_SHORT).show(); // 显示权限已授予提示
                });
        if(userInfoVM.token.getValue() != null && !userInfoVM.token.getValue().isEmpty()) { // 如果token不为空
            startMainActivityAndFinish(); // 启动主界面并关闭当前Activity
        }
    }

    /**
     * 窗口焦点变化时，自动隐藏系统UI。
     */
    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        Log.d("LoginActivity", "onWindowFocusChanged: hasFocus=" + hasFocus);
        Log.d("LoginActivity", "Window focus changed, current visibility: " + (getWindow().getDecorView().getSystemUiVisibility()));
        if (hasFocus) {
            WindowUtils.hideSystemUI(this);
            Log.d("LoginActivity", "Hiding system UI due to window focus change");
        }
    }

    /**
     * Activity销毁时，清理所有定时任务，防止内存泄漏。
     */
    @Override
    protected void onDestroy() {
        super.onDestroy(); // 调用父类的onDestroy方法
        Log.d("LoginActivity", "onDestroy: called"); // 打印调试日志
        checkUpdateHandler.removeCallbacksAndMessages(null); // 移除检查更新Handler的所有回调和消息
        uiHandler.removeCallbacksAndMessages(null); // 移除UI Handler的所有回调和消息
        Log.e("++++++++++++++++", "onDestroy"); // 打印错误日志
    }

    // 7. 初始化/设置相关私有方法
    /**
     * 设置应用环境和系统UI（如全屏、隐藏导航栏、检查App版本）。
     */
    private void setupAppAndUI() {
        Log.d("LoginActivity", "setupAppAndUI: called"); // 打印调试日志
        AppEnvConfig.checkAndUpdateVersion(this); // 检查并更新应用版本
        WindowUtils.hideSystemUI(this); // 隐藏系统UI
        WindowUtils.setFullScreenMode(this); // 设置全屏模式
    }

    /**
     * 初始化 ViewModel 实例。
     */
    private void initViewModels() {
        Log.d("LoginActivity", "initViewModels: called"); // 打印调试日志
        userInfoVM = new ViewModelProvider( // 创建UserInfoViewModel实例
                (ViewModelStoreOwner) getApplication(), // 使用Application作为ViewModelStoreOwner
                new ViewModelProvider.AndroidViewModelFactory(getApplication()) // 使用AndroidViewModelFactory创建工厂
        ).get(UserInfoViewModel.class); // 获取UserInfoViewModel实例
        loginVM = new ViewModelProvider(this).get(LoginViewModel.class); // 获取LoginViewModel实例
        // 设置UserInfoViewModel引用到LoginViewModel中
        loginVM.setUserInfoViewModel(userInfoVM);
    }

    /**
     * 绑定布局，初始化控件，设置事件监听，绑定ViewModel数据。
     */
    private void setupViewsAndData() {
        Log.d("LoginActivity", "setupViewsAndData: called"); // 打印调试日志
        binding = ActivityLoginBinding.inflate(getLayoutInflater()); // 使用数据绑定inflate布局
        setContentView(binding.getRoot()); // 设置Activity的内容视图
        loginPrefs = getSharedPreferences(PREFS_LOGIN_USER, Context.MODE_PRIVATE); // 获取SharedPreferences实例
        String userName = loginPrefs.getString(PREF_KEY_USERNAME, ""); // 从SharedPreferences中获取保存的用户名
        String passwd = loginPrefs.getString(PREF_KEY_PASSWORD, ""); // 从SharedPreferences中获取保存的密码
        etUsername = binding.username; // 获取用户名输入框
        etPassword = binding.password; // 获取密码输入框
        btnLogin = binding.login; // 获取登录按钮
        progressBarLoading = binding.loading; // 获取加载进度条
        etUsername.setText(userName); // 设置用户名输入框的文本
        etPassword.setText(passwd); // 设置密码输入框的文本
        // 登录按钮点击事件
        btnLogin.setOnClickListener(v -> {
            Log.d("LoginActivity", "loginButton clicked"); // 打印调试日志
            handleLogin(etUsername, etPassword, binding.usernameError, binding.passwordError); // 处理登录
        });
        binding.usernameError.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {}

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                if (binding.usernameError.getVisibility() == View.VISIBLE) {
                    binding.usernameError.setVisibility(View.INVISIBLE);
                }
            }

            public void afterTextChanged(Editable s) {}
        });
        binding.passwordError.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {}

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                if (binding.passwordError.getVisibility() == View.VISIBLE) {
                    binding.passwordError.setVisibility(View.INVISIBLE);
                }
            }

            public void afterTextChanged(Editable s) {}
        });
        // 监听登录状态
        loginVM.isLoading.observe(this, isLoading -> {
            Log.d("LoginActivity", "isLoading changed: " + isLoading); // 打印调试日志
            if (isLoading != null) { // 如果isLoading不为null
                progressBarLoading.setVisibility(isLoading ? View.VISIBLE : View.INVISIBLE); // 根据isLoading状态设置进度条可见性
                btnLogin.setEnabled(!isLoading); // 根据isLoading状态设置登录按钮是否可用
            }
        });
        // 监听登录结果
        loginVM.userInfo.observe(this, userInfo -> {
            if (userInfo != null) { // 如果userInfo不为null
                Log.d("LoginActivity", "userInfo changed: name=" + userInfo.getName() + ", avatar=" + userInfo.getAvatar()); // 打印调试日志
            } else {
                Log.d("LoginActivity", "userInfo changed: null"); // 打印调试日志
            }
            // 只有userInfo不为null且name不为空才跳转
            if (userInfo != null && userInfo.getName() != null && !userInfo.getName().isEmpty()) { // 如果用户信息有效
                handleLoginSuccess(etUsername.getText().toString(), etPassword.getText().toString()); // 处理登录成功
                Log.e("LoginActivity", String.valueOf(userInfo)); // 打印用户信息
            } else {
                Log.e("LoginActivity", "userInfo is null or invalid, not jumping!"); // 打印错误日志
            }
        });
        // 监听错误信息
        loginVM.errorMessage.observe(this, msg -> {
            Log.d("LoginActivity", "errorMessage changed: " + msg); // 打印调试日志
            if (msg != null && !msg.isEmpty()) { // 如果错误信息不为空
                Toast.makeText(this, msg, Toast.LENGTH_SHORT).show(); // 显示错误信息
            }
        });
        // 启动打字机效果
        motoText = getString(R.string.login_moto); // 获取标语文本
        // 启动定时检查更新
        lastCheckUpdateTick = System.currentTimeMillis(); // 记录当前时间作为上次检查更新时间
        checkUpdateHandler.postDelayed(checkUpdateRunnable, 60000); // 60秒后开始检查更新
        // 设置版本号和环境切换彩蛋
        TextView versionTextView = findViewById(R.id.version); // 获取版本号TextView
        versionTextView.setText(AppEnvConfig.getAppVersion(this)); // 设置版本号文本
        versionTextView.setOnClickListener(v -> handleVersionClick()); // 设置版本号点击事件
        // 启动点击计数重置定时器
        uiHandler.postDelayed(resetVersionClickCountRunnable, 2000); // 2秒后重置版本点击计数
    }

    // 事件/业务方法集中
    /**
     * 登录按钮点击逻辑，校验输入并调用ViewModel登录。
     */
    private void handleLogin(EditText etUsername, EditText etPassword, View usernameErrorView, View passwordErrorView) {
        String username = etUsername.getText().toString().trim(); // 获取用户名并去除首尾空格
        String password = etPassword.getText().toString().trim(); // 获取密码并去除首尾空格
        Log.d("LoginActivity", "handleLogin: username=" + username + ", password.length=" + password.length()); // 打印调试日志
        if (username.isEmpty()) { // 如果用户名为空
            usernameErrorView.setVisibility(View.VISIBLE); // 显示用户名错误提示
            return; // 直接返回
        }
        if (password.isEmpty()) { // 如果密码为空
            usernameErrorView.setVisibility(View.INVISIBLE); // 隐藏用户名错误提示
            passwordErrorView.setVisibility(View.VISIBLE); // 显示密码错误提示
            return; // 直接返回
        }
        usernameErrorView.setVisibility(View.INVISIBLE); // 隐藏用户名错误提示
        passwordErrorView.setVisibility(View.INVISIBLE); // 隐藏密码错误提示
        // 创建用户文件目录（恢复重构前的功能）
        File filesDir = getExternalFilesDir(null); // 获取外部文件目录
        File userFilesDir = new File(filesDir, username); // 创建以用户名命名的用户文件目录
        if (!userFilesDir.exists()) { // 如果用户文件目录不存在
            boolean created = userFilesDir.mkdirs();  // 创建子目录
            if (created) { // 如果创建成功
                Log.d("DirectoryCreation", "Subdirectory created successfully!"); // 打印调试日志
            } else {
                Log.d("DirectoryCreation", "Failed to create subdirectory."); // 打印调试日志
            }
        } else {
            Log.d("DirectoryCreation", "Subdirectory already exists."); // 打印调试日志
        }
        
        loginVM.login(username, password, userFilesDir); // 调用ViewModel的登录方法
    }

    /**
     * 登录成功后保存账号密码并跳转主界面。
     */
    private void handleLoginSuccess(String username, String password) {
        Log.d("LoginActivity", "handleLoginSuccess: username=" + username); // 打印调试日志
        SharedPreferences.Editor editor = loginPrefs.edit(); // 获取SharedPreferences编辑器
        editor.putString(PREF_KEY_USERNAME, username); // 保存用户名
        editor.putString(PREF_KEY_PASSWORD, password); // 保存密码
        editor.apply(); // 应用更改
        Toast.makeText(this, getText(R.string.tip_login_success), Toast.LENGTH_SHORT).show(); // 显示登录成功提示
        startMainActivityAndFinish(); // 启动主界面并关闭当前Activity
    }

    /**
     * 启动打字机效果、定时检查更新、环境切换彩蛋等后台任务。
     */
    private void startBackgroundTasksAndEffects() {
        Log.d("LoginActivity", "startBackgroundTasksAndEffects: called"); // 打印调试日志
        lastCheckUpdateTick = System.currentTimeMillis(); // 记录当前时间作为上次检查更新时间
        checkUpdateHandler.postDelayed(checkUpdateRunnable, 60000); // 60秒后开始检查更新
        TextView versionTextView = findViewById(R.id.version); // 获取版本号TextView
        versionTextView.setText(AppEnvConfig.getAppVersion(this)); // 设置版本号文本
        versionTextView.setOnClickListener(v -> handleVersionClick()); // 设置版本号点击事件
        uiHandler.postDelayed(resetVersionClickCountRunnable, 2000); // 2秒后重置版本点击计数
    }

    /**
     * 版本号点击彩蛋，连续点击5次弹出环境切换对话框。
     */
    private void handleVersionClick() {
        Log.d("LoginActivity", "handleVersionClick: versionClickCount=" + versionClickCount); // 打印调试日志
        versionClickCount++; // 版本点击计数加1
        if (versionClickCount >= 5) { // 如果点击次数达到5次
            versionClickCount = 0; // 重置点击计数
            AppEnvSwitchHelper.showEnvSwitchOption(this, new AppEnvSwitchDialog.AppEnvSwitchCallback() { // 显示环境切换选项
                @Override
                public void onSwitchSuccess(AppEnvConfig.AppEnvType newEnv) { // 环境切换成功回调
                    ((TextView)(findViewById(R.id.version))).setText(AppEnvConfig.getAppVersion(com.cosinetech.imates.ui.login.LoginActivity.this)); // 更新版本号显示
                }
                @Override
                public void onSwitchFailed() { // 环境切换失败回调
                    ((TextView)(findViewById(R.id.version))).setText(AppEnvConfig.getAppVersion(com.cosinetech.imates.ui.login.LoginActivity.this)); // 更新版本号显示
                }
            });
        }
        uiHandler.removeCallbacks(resetVersionClickCountRunnable); // 移除重置点击计数的回调
        uiHandler.postDelayed(resetVersionClickCountRunnable, 2000); // 2秒后重新添加重置点击计数的回调
    }

    /**
     * 跳转主界面并关闭当前Activity。
     */
    private void startMainActivityAndFinish() {
        Log.d("LoginActivity", "startMainActivityAndFinish: called"); // 打印调试日志
        Intent intent = new Intent(this, MyProfileActivity.class); // 创建跳转到个人资料页面的意图
        //intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TASK | Intent.FLAG_ACTIVITY_NEW_TASK); // 注释掉的代码，用于清除任务栈
        startActivity(intent); // 启动意图
        finish(); // 结束当前Activity
    }


    // 权限相关方法集中


    /**
     * 悬浮窗权限请求结果回调。
     */
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data); // 调用父类方法
        Log.d("LoginActivity", "onActivityResult: requestCode=" + requestCode + ", resultCode=" + resultCode); // 打印调试日志
        if (requestCode == REQUEST_CODE_DRAW_OVERLAY) { // 如果是悬浮窗权限请求
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) { // 如果系统版本大于等于M
                if (Settings.canDrawOverlays(this)) { // 如果已获得悬浮窗权限
                    // 权限已授予
                } else { // 如果未获得悬浮窗权限
                    // 权限未授予，继续请求
                    requestOverlayPermission(); // 继续请求悬浮窗权限
                }
            }
        }
    }

    /**
     * 请求悬浮窗权限。
     */
    private void requestOverlayPermission() {
        Log.d("LoginActivity", "requestOverlayPermission: called"); // 打印调试日志
        AlertDialog.Builder builder = new AlertDialog.Builder(this); // 创建对话框构建器
        builder.setTitle("权限提示"); // 设置对话框标题
        builder.setMessage("需要悬浮窗权限才能正常使用此功能。是否前往设置页面授权？"); // 设置对话框消息
        builder.setPositiveButton("前往设置", new DialogInterface.OnClickListener() { // 设置确认按钮
            @Override
            public void onClick(DialogInterface dialog, int which) { // 点击确认按钮的回调
                Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, // 创建跳转到悬浮窗权限设置页面的意图
                        Uri.parse("package:" + getPackageName())); // 设置包名参数
                startActivityForResult(intent, REQUEST_CODE_DRAW_OVERLAY); // 启动意图并等待结果
            }
        });
        builder.setNegativeButton("取消", (dialog, which) -> { // 设置取消按钮
            Toast.makeText(com.cosinetech.imates.ui.login.LoginActivity.this, "您拒绝了权限，功能无法使用", Toast.LENGTH_SHORT).show(); // 显示权限被拒绝提示
        });
        builder.show(); // 显示对话框
    }

    /**
     * 权限请求结果回调。
     */
    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults); // 调用父类方法
        Log.d("LoginActivity", "onRequestPermissionsResult: requestCode=" + requestCode); // 打印调试日志
        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) { // 如果权限被授予
            Toast.makeText(this, "权限已授予", Toast.LENGTH_SHORT).show(); // 显示权限已授予提示
        } else { // 如果权限被拒绝
            Toast.makeText(this, "权限被拒绝，功能无法使用", Toast.LENGTH_SHORT).show(); // 显示权限被拒绝提示
        }
    }

    /**
     * 动态权限请求通用方法。
     * @param permission 权限字符串
     * @param requestCode 请求码
     * @param rationale 权限说明
     * @param onGranted 授权后回调
     */
    private void requestPermission(String permission, int requestCode, String rationale, Runnable onGranted) {
        Log.d("LoginActivity", "requestPermission: permission=" + permission + ", requestCode=" + requestCode); // 打印调试日志
        if (ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED) { // 如果已获得权限
            onGranted.run(); // 执行授权后回调
        } else { // 如果未获得权限
            new AlertDialog.Builder(this) // 创建对话框构建器
                    .setTitle("权限请求") // 设置对话框标题
                    .setMessage(rationale) // 设置权限说明
                    .setPositiveButton("允许", (dialog, which) -> // 设置允许按钮
                            ActivityCompat.requestPermissions(this, new String[]{permission}, requestCode)) // 请求权限
                    .setNegativeButton("取消", (dialog, which) -> // 设置取消按钮
                            Toast.makeText(this, "您拒绝了权限，功能可能无法正常使用", Toast.LENGTH_SHORT).show()) // 显示权限被拒绝提示
                    .show(); // 显示对话框
        }
    }

    /**
     * 登录失败提示。
     */
    private void showLoginFailed(@StringRes Integer errorString) {
        Toast.makeText(getApplicationContext(), errorString, Toast.LENGTH_SHORT).show(); // 显示登录失败提示
    }
}