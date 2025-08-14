package com.cosinetech.imates.deviceadmin;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;
import com.cosinetech.imates.R;

public class WarningDialogActivity extends Activity {
    private static final String TAG = "WarningDialog";
    private static final int AUTO_DISMISS_DELAY = 5000; // 5秒后自动关闭

    private TextView warningMessage;
    private TextView countdownText;
    private Button okButton;
    private Button returnButton;

    private String unauthorizedApp;
    private Handler handler;
    private int countdown = 5;
    private Runnable countdownRunnable;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_warning_dialog);

        // 设置为系统级窗口，确保显示在最前面
        setupSystemWindow();

        // 获取违规应用信息
        unauthorizedApp = getIntent().getStringExtra("unauthorized_app");

        initializeViews();
        setupCountdown();
    }

    private void setupSystemWindow() {
        // 设置窗口标志，确保对话框显示在最前面
        getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                        WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD |
                        WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
                        WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                        WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD |
                        WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
                        WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        );

        // 设置为全屏显示
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
                        View.SYSTEM_UI_FLAG_FULLSCREEN |
                        View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        );
    }

    private void initializeViews() {
        warningMessage = findViewById(R.id.warning_message);
        countdownText = findViewById(R.id.countdown_text);
        okButton = findViewById(R.id.ok_button);
        returnButton = findViewById(R.id.return_button);

        // 设置警告消息
        String appName = getAppName(unauthorizedApp);
        String message = String.format(
                "检测到您尝试使用未授权的应用：\n\n%s\n\n请返回学习应用继续学习。",
                appName
        );
        warningMessage.setText(message);

        // 设置按钮点击事件
        okButton.setOnClickListener(v -> returnToAllowedApp());
        returnButton.setOnClickListener(v -> returnToAllowedApp());
    }

    private String getAppName(String packageName) {
        try {
            return getPackageManager()
                    .getApplicationLabel(getPackageManager().getApplicationInfo(packageName, 0))
                    .toString();
        } catch (Exception e) {
            return packageName; // 如果获取不到应用名，返回包名
        }
    }

    private void setupCountdown() {
        handler = new Handler();
        countdownRunnable = new Runnable() {
            @Override
            public void run() {
                if (countdown > 0) {
                    countdownText.setText(String.format("将在 %d 秒后自动返回学习应用", countdown));
                    countdown--;
                    handler.postDelayed(this, 1000);
                } else {
                    // 倒计时结束，自动返回
                    returnToAllowedApp();
                }
            }
        };

        handler.post(countdownRunnable);
    }

    private void returnToAllowedApp() {
        // 停止倒计时
        if (handler != null && countdownRunnable != null) {
            handler.removeCallbacks(countdownRunnable);
        }

        // 启动允许的应用或返回桌面
        launchAllowedApp();

        // 关闭警告对话框
        finish();
    }

    private void launchAllowedApp() {
        KioskManager kioskManager = KioskManager.getInstance();

        // 尝试启动第一个允许的学习应用
        String[] preferredApps = {
                "com.education.math",
                "com.education.english",
                "com.education.science"
        };

        for (String packageName : preferredApps) {
            if (kioskManager.isAppAllowed(packageName)) {
                Intent intent = getPackageManager().getLaunchIntentForPackage(packageName);
                if (intent != null) {
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK |
                            Intent.FLAG_ACTIVITY_CLEAR_TOP |
                            Intent.FLAG_ACTIVITY_SINGLE_TOP);
                    startActivity(intent);
                    return;
                }
            }
        }

        // 如果没有找到学习应用，启动自定义桌面
        Intent intent = new Intent(this, KioskLauncherActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        startActivity(intent);
    }

    @Override
    public void onBackPressed() {
        // 禁用返回键，强制用户点击按钮
        // 不调用 super.onBackPressed()
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (handler != null && countdownRunnable != null) {
            handler.removeCallbacks(countdownRunnable);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            // 确保对话框始终保持焦点
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
                            View.SYSTEM_UI_FLAG_FULLSCREEN |
                            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            );
        }
    }
}
