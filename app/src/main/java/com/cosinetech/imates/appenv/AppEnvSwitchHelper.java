package com.cosinetech.imates.appenv;

import android.content.Context;
import android.preference.Preference;
import android.preference.PreferenceScreen;
import android.widget.Toast;

public class AppEnvSwitchHelper {
    public static void showEnvSwitchOption(Context context, AppEnvSwitchDialog.AppEnvSwitchCallback callback) {
        AppEnvConfig.AppEnvType currentEnv = AppEnvConfig.getCurrentEnvType(context);
        if (currentEnv == AppEnvConfig.AppEnvType.RELEASE) {
            // 当前是正式环境，切换到测试环境需要密码
            AppEnvSwitchDialog.showSwitchToTestFlightDialog(context, new AppEnvSwitchDialog.AppEnvSwitchCallback() {
                @Override
                public void onSwitchSuccess(AppEnvConfig.AppEnvType newEnv) {
                    Toast.makeText(context, "已加入到测试通道", Toast.LENGTH_SHORT).show();
                    if(callback != null) {
                        callback.onSwitchSuccess(newEnv);
                    }
                }

                @Override
                public void onSwitchFailed() {
                    Toast.makeText(context, "密码错误，切换失败", Toast.LENGTH_SHORT).show();
                    if(callback != null) {
                        callback.onSwitchFailed();
                    }
                }
            });
        } else {
            // 当前是测试环境，切换回正式环境不需要密码
            AppEnvSwitchDialog.showSwitchToReleaseDialog(context, new AppEnvSwitchDialog.AppEnvSwitchCallback() {
                @Override
                public void onSwitchSuccess(AppEnvConfig.AppEnvType newEnv) {
                    Toast.makeText(context, "已离开测试通道", Toast.LENGTH_SHORT).show();
                    if(callback != null) {
                        callback.onSwitchSuccess(newEnv);
                    }
                }

                @Override
                public void onSwitchFailed() {
                    Toast.makeText(context, "已离开测试通道失败", Toast.LENGTH_SHORT).show();
                    if(callback != null) {
                        callback.onSwitchFailed();
                    }
                }
            });
        }
    }

    // 在设置界面添加触发按钮
    public static void setupEnvSwitchItem(Context context, PreferenceScreen screen) {
        Preference envPreference = new Preference(context);
        envPreference.setTitle("当前通道: " + AppEnvConfig.getCurrentEnvType(context).getDisplayName());
        envPreference.setSummary("点击加入/退出测试通道");
        envPreference.setOnPreferenceClickListener(preference -> {
            showEnvSwitchOption(context, null);
            return true;
        });
        screen.addPreference(envPreference);
    }
}
