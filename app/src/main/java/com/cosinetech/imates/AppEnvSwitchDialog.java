package com.cosinetech.imates;

import android.content.Context;
import android.text.InputType;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.appcompat.app.AlertDialog;

public class AppEnvSwitchDialog {
    public interface AppEnvSwitchCallback {
        void onSwitchSuccess(AppEnvConfig.AppEnvType newEnv);
        void onSwitchFailed();
    }

    public static void showSwitchToTestFlightDialog(Context context, AppEnvSwitchCallback callback) {
        LinearLayout layout = new LinearLayout(context);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(50, 30, 50, 10);

        TextView hint = new TextView(context);
        hint.setText("加入测试通道,获取更及时的测试版更新及新功能");
        layout.addView(hint);

        EditText passwordInput = new EditText(context);
        passwordInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        passwordInput.setHint("输入密码");
        layout.addView(passwordInput);

        new AlertDialog.Builder(context)
                .setTitle("加入测试通道验证")
                .setView(layout)
                .setPositiveButton("确认", (dialog, which) -> {
                    String password = passwordInput.getText().toString();
                    if (AppEnvConfig.trySwitchEnv(context, AppEnvConfig.AppEnvType.INTERNAL_TEST, password)) {
                        callback.onSwitchSuccess(AppEnvConfig.AppEnvType.INTERNAL_TEST);
                    } else {
                        callback.onSwitchFailed();
                    }
                })
                .setNegativeButton("取消", null)
                .show();
    }

    public static void showSwitchToReleaseDialog(Context context, AppEnvSwitchCallback callback) {
        new AlertDialog.Builder(context)
                .setTitle("离开测试通道")
                .setMessage("确定要离开测试通道吗？")
                .setPositiveButton("确定", (dialog, which) -> {
                    AppEnvConfig.trySwitchEnv(context, AppEnvConfig.AppEnvType.RELEASE, "");
                    callback.onSwitchSuccess(AppEnvConfig.AppEnvType.RELEASE);
                })
                .setNegativeButton("取消", null)
                .show();
    }
}
