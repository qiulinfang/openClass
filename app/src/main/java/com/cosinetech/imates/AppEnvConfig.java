package com.cosinetech.imates;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;

import com.cosinetech.imates.coreapiservice.ApiUrl;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

public class AppEnvConfig {
    // 环境类型枚举
    public enum AppEnvType {
        RELEASE(""),
        INTERNAL_TEST("Joined Testflight");

        private final String displayName;

        AppEnvType(String displayName) {
            this.displayName = displayName;
        }

        public String getDisplayName() {
            return displayName;
        }
    }

    // 密码相关配置
    private static final String TEST_ENV_PASSWORD = "148259"; // 测试环境切换密码
    private static final String PASSWORD_HASH = "hashed_password"; // 实际应用中应存储哈希值

    private static final String PREFS_NAME = "app_env_config";
    private static final String KEY_ENV_TYPE = "env_type";

    // 获取当前环境类型（默认正式环境）
    public static AppEnvType getCurrentEnvType(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String envName = prefs.getString(KEY_ENV_TYPE, AppEnvType.RELEASE.name());
        try {
            return AppEnvType.valueOf(envName);
        } catch (Exception e) {
            return AppEnvType.RELEASE;
        }
    }

    public static void checkAndUpdateVersion(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String curEnvType = prefs.getString(KEY_ENV_TYPE, "");
        if(curEnvType.isEmpty()){
            // 重置为默认环境（正式环境）
            forceEnvType(context, AppEnvType.RELEASE);
        } else {
            forceEnvType(context, getCurrentEnvType(context));
        }
    }

    /**
     * 强制设置环境类型（绕过密码验证）
     */
    public static void forceEnvType(Context context, AppEnvType targetEnv) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(KEY_ENV_TYPE, targetEnv.name()).apply();

        ApiUrl.switchEnv(targetEnv);
    }

    /**
     * 获取当前应用版本
     */
    public static String getAppVersion(Context context) {
        try {
            PackageInfo pInfo = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
            return pInfo.versionName + "\n" + getCurrentEnvType(context).displayName;
        } catch (PackageManager.NameNotFoundException e) {
            return "unknown";
        }
    }

    public static String getVersionCode(Context context){
        PackageManager packageManager=context.getPackageManager();
        PackageInfo packageInfo;
        String versionCode="";
        try {
            packageInfo=packageManager.getPackageInfo(context.getPackageName(),0);
            versionCode=packageInfo.versionCode+"";
        } catch (PackageManager.NameNotFoundException e) {
        }
        return versionCode;
    }

    /**
     * get App versionName
     * @param context
     * @return
     */
    public static String getVersionName(Context context){
        PackageManager packageManager=context.getPackageManager();
        PackageInfo packageInfo;
        String versionName="";
        try {
            packageInfo=packageManager.getPackageInfo(context.getPackageName(),0);
            versionName=packageInfo.versionName;
        } catch (PackageManager.NameNotFoundException e) {
            e.printStackTrace();
        }
        return versionName;
    }

    // 尝试切换环境（需要密码验证）
    public static boolean trySwitchEnv(Context context, AppEnvType targetEnv, String password) {
        // 从正式环境切换到测试环境需要密码验证
        if (targetEnv == AppEnvType.INTERNAL_TEST && !isValidPassword(password)) {
            return false;
        }

        // 切换环境不需要密码的情况：
        // 1. 从测试环境切换回正式环境
        // 2. 已经是目标环境

        forceEnvType(context, targetEnv);
        return true;
    }

    // 验证密码
    private static boolean isValidPassword(String input) {
        return TEST_ENV_PASSWORD.equals(input);
    }

    public static String sha256WithSalt(String password, String salt) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            digest.update((password + salt).getBytes());
            byte[] hash = digest.digest();

            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if(hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    }
}
