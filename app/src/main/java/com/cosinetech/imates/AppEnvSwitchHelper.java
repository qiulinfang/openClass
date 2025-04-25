package com.cosinetech.imates;

import android.content.Context;
import android.preference.Preference;
import android.preference.PreferenceScreen;
import android.widget.Toast;

public class AppEnvSwitchHelper {
    public static void showEnvSwitchOption(Context context) {
        AppEnvConfig.AppEnvType currentEnv = AppEnvConfig.getCurrentEnvType(context);

        if (currentEnv == AppEnvConfig.AppEnvType.RELEASE) {
            // 当前是正式环境，切换到测试环境需要密码
            AppEnvSwitchDialog.showSwitchToTestFlightDialog(context, new AppEnvSwitchDialog.AppEnvSwitchCallback() {
                @Override
                public void onSwitchSuccess(AppEnvConfig.AppEnvType newEnv) {
                    Toast.makeText(context, "已切换到测试环境", Toast.LENGTH_SHORT).show();
                }

                @Override
                public void onSwitchFailed() {
                    Toast.makeText(context, "密码错误，切换失败", Toast.LENGTH_SHORT).show();
                }
            });
        } else {
            // 当前是测试环境，切换回正式环境不需要密码
            AppEnvSwitchDialog.showSwitchToReleaseDialog(context, new AppEnvSwitchDialog.AppEnvSwitchCallback() {
                @Override
                public void onSwitchSuccess(AppEnvConfig.AppEnvType newEnv) {
                    Toast.makeText(context, "已切换回正式环境", Toast.LENGTH_SHORT).show();
                }

                @Override
                public void onSwitchFailed() {

                }
            });
        }
    }

    // 在设置界面添加触发按钮
    public static void setupEnvSwitchItem(Context context, PreferenceScreen screen) {
        Preference envPreference = new Preference(context);
        envPreference.setTitle("当前环境: " + AppEnvConfig.getCurrentEnvType(context).getDisplayName());
        envPreference.setSummary("点击切换应用环境");
        envPreference.setOnPreferenceClickListener(preference -> {
            showEnvSwitchOption(context);
            return true;
        });
        screen.addPreference(envPreference);
    }
}
