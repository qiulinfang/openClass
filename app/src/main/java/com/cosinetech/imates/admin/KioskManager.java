package com.cosinetech.imates.admin;

import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.os.UserManager;
import android.os.Build;
import android.app.Activity;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class KioskManager {
    private static final String TAG = "KioskManager";
    private static final String PREFS_NAME = "kiosk_prefs";
    private static final String KEY_ALLOWED_APPS = "allowed_apps";
    private static final String KEY_KIOSK_ENABLED = "kiosk_enabled";

    private static KioskManager instance;
    private Context context;
    private DevicePolicyManager devicePolicyManager;
    private ComponentName adminComponent;
    private SharedPreferences preferences;

    // 默认允许的应用包名
    private static final String[] DEFAULT_ALLOWED_APPS = {
            "com.android.settings", // 系统设置（受限）
            "com.cosinetech.imates" // 本应用
    };

    public static KioskManager getInstance() {
        if (instance == null) {
            instance = new KioskManager();
        }
        return instance;
    }

    public void initialize(Context context) {
        this.context = context.getApplicationContext();
        this.devicePolicyManager = (DevicePolicyManager) context.getSystemService(Context.DEVICE_POLICY_SERVICE);
        this.adminComponent = new ComponentName(context, KioskDeviceAdminReceiver.class);
        this.preferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

        // 初始化默认允许的应用列表
        initializeDefaultAllowedApps();
    }

    private void initializeDefaultAllowedApps() {
        Set<String> allowedApps = preferences.getStringSet(KEY_ALLOWED_APPS, null);
        if (allowedApps == null) {
            allowedApps = new HashSet<>(Arrays.asList(DEFAULT_ALLOWED_APPS));
            preferences.edit().putStringSet(KEY_ALLOWED_APPS, allowedApps).apply();
        }
    }

    public boolean isDeviceOwner() {
        return devicePolicyManager != null &&
                devicePolicyManager.isDeviceOwnerApp(context.getPackageName());
    }

    public boolean isDeviceAdmin() {
        return devicePolicyManager != null &&
                devicePolicyManager.isAdminActive(adminComponent);
    }

    public void onDeviceAdminEnabled(Context context) {
        if (isDeviceOwner()) {
            setupDeviceOwnerPolicies();
        }
    }

    public void onDeviceAdminDisabled(Context context) {
        Log.w(TAG, "Device admin disabled - Kiosk mode may not work properly");
    }

    private void setupDeviceOwnerPolicies() {
        try {
            // 设置锁定任务包
            setLockTaskPackages();

            // 禁用状态栏
//            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
//                devicePolicyManager.setStatusBarDisabled(adminComponent, true);
//            }

            // 禁用键盘锁
            devicePolicyManager.setKeyguardDisabled(adminComponent, true);
            // 设置用户限制
            setUserRestrictions();
            updateAllowedApps(getAllowedApps());
            //setAsDefaultLauncherAndLock();

            Log.d(TAG, "Device Owner policies configured successfully!!!");

        } catch (Exception e) {
            Log.e(TAG, "Error setting up Device Owner policies", e);
        }
    }

    private void setLockTaskPackages() {
        Set<String> allowedApps = getAllowedApps();
        String[] packages = allowedApps.toArray(new String[0]);

        devicePolicyManager.setLockTaskPackages(adminComponent, packages);
        Log.d(TAG, "Lock task packages set: " + Arrays.toString(packages));
    }

    private void setUserRestrictions() {
        try {
            // 基础限制 (适用于大多数Android版本)
            setBasicRestrictions();

            // 高级限制 (需要更高API级别)
            setAdvancedRestrictions();

            // Android 13 特定限制
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                setAndroid13SpecificRestrictions();
            }

            Log.d(TAG, "All user restrictions applied successfully");

        } catch (Exception e) {
            Log.e(TAG, "Error applying user restrictions", e);
        }
    }

    private void setBasicRestrictions() {
        // 禁用安装未知来源应用
        //addUserRestrictionSafely(UserManager.DISALLOW_INSTALL_UNKNOWN_SOURCES);

        // 禁用USB文件传输
        //addUserRestrictionSafely(UserManager.DISALLOW_USB_FILE_TRANSFER);

        // 禁用添加用户
        addUserRestrictionSafely(UserManager.DISALLOW_ADD_USER);

        // 禁用卸载应用
        //addUserRestrictionSafely(UserManager.DISALLOW_UNINSTALL_APPS);

        // 禁用修改账户
        addUserRestrictionSafely(UserManager.DISALLOW_MODIFY_ACCOUNTS);

        // 禁用应用安装
        //addUserRestrictionSafely(UserManager.DISALLOW_INSTALL_APPS);
    }

    private void setAdvancedRestrictions() {
        // 禁用工厂重置 (API 21+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            addUserRestrictionSafely(UserManager.DISALLOW_FACTORY_RESET);
        }

        // 禁用安全设置修改 (API 23+)
//        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
//            addUserRestrictionSafely(UserManager.DISALLOW_CONFIG_CREDENTIALS);
//            addUserRestrictionSafely(UserManager.DISALLOW_CONFIG_SECURITY);
//        }

        // 禁用网络设置 (API 23+)
//        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
//            addUserRestrictionSafely(UserManager.DISALLOW_CONFIG_WIFI);
//            addUserRestrictionSafely(UserManager.DISALLOW_CONFIG_MOBILE_NETWORKS);
//        }

        // 禁用蓝牙设置 (API 18+)
        addUserRestrictionSafely(UserManager.DISALLOW_BLUETOOTH);
        addUserRestrictionSafely(UserManager.DISALLOW_CONFIG_BLUETOOTH);

        // 禁用开发者选项 (API 24+)
//        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
//            addUserRestrictionSafely(UserManager.DISALLOW_DEBUGGING_FEATURES);
//        }

        // 禁用数据漫游 (API 18+)
        addUserRestrictionSafely(UserManager.DISALLOW_DATA_ROAMING);

        // 禁用分享位置 (API 18+)
        addUserRestrictionSafely(UserManager.DISALLOW_SHARE_LOCATION);

        // 禁用外发通话 (API 18+)
        addUserRestrictionSafely(UserManager.DISALLOW_OUTGOING_CALLS);

        // 禁用短信 (API 18+)
        addUserRestrictionSafely(UserManager.DISALLOW_SMS);
    }

    private void setAndroid13SpecificRestrictions() {
        // Android 13 特定的限制
        try {
            // 禁用系统错误对话框
            addUserRestrictionSafely(UserManager.DISALLOW_SYSTEM_ERROR_DIALOGS);

            // 禁用跨配置文件复制粘贴 (如果适用)
            addUserRestrictionSafely(UserManager.DISALLOW_CROSS_PROFILE_COPY_PASTE);

            // 禁用NFC (如果设备支持)
            //addUserRestrictionSafely(UserManager.DISALLOW_CONFIG_NFC);

            Log.d(TAG, "Android 13 specific restrictions applied");

        } catch (Exception e) {
            Log.w(TAG, "Some Android 13 restrictions may not be available", e);
        }
    }

    /**
     * 安全地添加用户限制，避免因为不支持的限制导致崩溃
     */
    private void addUserRestrictionSafely(String restriction) {
        try {
            devicePolicyManager.addUserRestriction(adminComponent, restriction);
            Log.d(TAG, "Applied restriction: " + restriction);
        } catch (Exception e) {
            Log.w(TAG, "Failed to apply restriction: " + restriction, e);
        }
    }

    /**
     * 移除用户限制（用于调试或管理员操作）
     */
    private void removeUserRestrictionSafely(String restriction) {
        try {
            devicePolicyManager.clearUserRestriction(adminComponent, restriction);
            Log.d(TAG, "Removed restriction: " + restriction);
        } catch (Exception e) {
            Log.w(TAG, "Failed to remove restriction: " + restriction, e);
        }
    }

    /**
     * 检查特定限制是否已应用
     */
    private boolean isRestrictionActive(String restriction) {
        try {
            UserManager userManager = (UserManager) context.getSystemService(Context.USER_SERVICE);
            return userManager.hasUserRestriction(restriction);
        } catch (Exception e) {
            Log.w(TAG, "Failed to check restriction: " + restriction, e);
            return false;
        }
    }

    /**
     * 获取所有可用的用户限制列表（用于调试）
     */
    private void logAvailableRestrictions() {
        String[] allRestrictions = {
                UserManager.DISALLOW_INSTALL_UNKNOWN_SOURCES,
                UserManager.DISALLOW_USB_FILE_TRANSFER,
                UserManager.DISALLOW_FACTORY_RESET,
                UserManager.DISALLOW_ADD_USER,
                UserManager.DISALLOW_UNINSTALL_APPS,
                UserManager.DISALLOW_MODIFY_ACCOUNTS,
                UserManager.DISALLOW_INSTALL_APPS,
                UserManager.DISALLOW_CONFIG_CREDENTIALS,
                //UserManager.DISALLOW_CONFIG_SECURITY,
                UserManager.DISALLOW_CONFIG_WIFI,
                UserManager.DISALLOW_CONFIG_MOBILE_NETWORKS,
                UserManager.DISALLOW_BLUETOOTH,
                UserManager.DISALLOW_CONFIG_BLUETOOTH,
                UserManager.DISALLOW_DEBUGGING_FEATURES,
                UserManager.DISALLOW_DATA_ROAMING,
                UserManager.DISALLOW_SHARE_LOCATION,
                UserManager.DISALLOW_OUTGOING_CALLS,
                UserManager.DISALLOW_SMS,
                UserManager.DISALLOW_SYSTEM_ERROR_DIALOGS,
                UserManager.DISALLOW_CROSS_PROFILE_COPY_PASTE,
                //UserManager.DISALLOW_CONFIG_NFC
        };

        Log.d(TAG, "Checking available restrictions:");
        for (String restriction : allRestrictions) {
            boolean isActive = isRestrictionActive(restriction);
            Log.d(TAG, restriction + ": " + (isActive ? "ACTIVE" : "INACTIVE"));
        }
    }

    /**
     * 隐藏所有非白名单应用
     */
    public void hideNonWhitelistApps() {
        if (!isDeviceOwner()) {
            Log.w(TAG, "Cannot hide apps - not device owner");
            return;
        }

        // 获取所有已安装的应用
        List<ApplicationInfo> installedApps = context.getPackageManager()
                .getInstalledApplications(PackageManager.GET_META_DATA);

        Set<String> allowedApps = getAllowedApps();
        int hiddenCount = 0;

        for (ApplicationInfo appInfo : installedApps) {
            try {
                    String packageName = appInfo.packageName;

                    // 跳过系统关键应用和白名单应用
                    if (shouldSkipHiding(packageName, allowedApps)) {
                        continue;
                    }

                    // 隐藏应用
                    boolean hidden = devicePolicyManager.setApplicationHidden(adminComponent, packageName, true);
                    if (hidden) {
                        hiddenCount++;
                        Log.d(TAG, "Hidden app: " + packageName);
                    } else {
                        Log.w(TAG, "Failed to hide app: " + packageName);
                    }

                Log.d(TAG, "Hidden " + hiddenCount + " non-whitelist apps");

            } catch (Exception e) {
                Log.e(TAG, "Error hiding non-whitelist apps", e);
            }
        }
    }

    public boolean hasLauncherIcon(Context context, String packageName) {
        PackageManager pm = context.getPackageManager();
        Intent intent = pm.getLaunchIntentForPackage(packageName);
        return intent != null;
    }
    /**
     * 显示所有隐藏的应用（用于调试或管理）
     */
    public void showAllHiddenApps() {
        if (!isDeviceOwner()) {
            Log.w(TAG, "Cannot show apps - not device owner");
            return;
        }

        try {
            List<ApplicationInfo> installedApps = context.getPackageManager()
                    .getInstalledApplications(PackageManager.GET_META_DATA);

            int shownCount = 0;
            for (ApplicationInfo appInfo : installedApps) {
                String packageName = appInfo.packageName;

                if (devicePolicyManager.isApplicationHidden(adminComponent, packageName)) {
                    boolean shown = devicePolicyManager.setApplicationHidden(adminComponent, packageName, false);
                    if (shown) {
                        shownCount++;
                        Log.d(TAG, "Shown app: " + packageName);
                    }
                }
            }

            Log.d(TAG, "Shown " + shownCount + " previously hidden apps");

        } catch (Exception e) {
            Log.e(TAG, "Error showing hidden apps", e);
        }
    }

    /**
     * 检查应用是否应该跳过隐藏
     */
    private boolean shouldSkipHiding(String packageName, Set<String> allowedApps) {
        // 白名单应用
        if (allowedApps.contains(packageName)) {
            return true;
        }

        if(!hasLauncherIcon(context, packageName)) {
            return true;
        }

        // 系统关键应用
        if (isSystemCriticalApp(packageName)) {
            return true;
        }

        // 系统UI相关应用
        if (isSystemUIApp(packageName)) {
            return true;
        }

        return false;
    }

    /**
     * 检查是否为系统关键应用
     */
    private boolean isSystemCriticalApp(String packageName) {
        String[] criticalApps = {
                "android",                          // Android系统
                "com.android.systemui",            // 系统UI
                "com.android.launcher",            // 系统桌面
                "com.android.launcher3",           // 系统桌面3
                "com.android.inputmethod.latin",   // 输入法
                "com.google.android.inputmethod.latin", // Google输入法
                "com.android.phone",               // 电话应用
                "com.android.emergency",           // 紧急呼叫
                "com.android.settings",
                "com.android.providers.settings",  // 设置提供者
                "com.android.providers.media",     // 媒体提供者
                "com.android.packageinstaller",    // 包安装器
                "com.android.permissioncontroller", // 权限控制器
                "com.android.providers.telephony",
        };

        for (String criticalApp : criticalApps) {
            if (packageName.startsWith(criticalApp)) {
                return true;
            }
        }

        return false;
    }

    /**
     * 检查是否为系统UI相关应用
     */
    private boolean isSystemUIApp(String packageName) {
        return packageName.contains("systemui") ||
                packageName.contains("launcher") ||
                packageName.contains("inputmethod") ||
                packageName.startsWith("com.android.") &&
                        (packageName.contains("keyboard") || packageName.contains("ime"));
    }

    /**
     * 获取所有隐藏的应用列表
     */
    public List<String> getHiddenApps() {
        List<String> hiddenApps = new ArrayList<>();

        if (!isDeviceOwner()) {
            return hiddenApps;
        }

        try {
            List<ApplicationInfo> installedApps = context.getPackageManager()
                    .getInstalledApplications(PackageManager.GET_META_DATA);

            for (ApplicationInfo appInfo : installedApps) {
                String packageName = appInfo.packageName;
                if (devicePolicyManager.isApplicationHidden(adminComponent, packageName)) {
                    hiddenApps.add(packageName);
                }
            }

        } catch (Exception e) {
            Log.e(TAG, "Error getting hidden apps", e);
        }

        return hiddenApps;
    }

    /**
     * 更新白名单时自动调整应用可见性
     */
    public void updateAllowedApps(Set<String> allowedApps) {
        preferences.edit().putStringSet(KEY_ALLOWED_APPS, allowedApps).apply();

        // 更新锁定任务包
        if (isDeviceOwner()) {
            setLockTaskPackages();

            // 重新隐藏非白名单应用
            hideNonWhitelistApps();
        }
    }

    public void startKioskMode(Activity activity) {
        if (!isDeviceOwner()) {
            Log.e(TAG, "Cannot start kiosk mode - not device owner");
            return;
        }

        try {
            activity.startLockTask();
            preferences.edit().putBoolean(KEY_KIOSK_ENABLED, true).apply();
            Log.d(TAG, "Kiosk mode started");
        } catch (Exception e) {
            Log.e(TAG, "Error starting kiosk mode", e);
        }
    }

    public void stopKioskMode(Activity activity) {
        try {
            activity.stopLockTask();
            preferences.edit().putBoolean(KEY_KIOSK_ENABLED, false).apply();
            Log.d(TAG, "Kiosk mode stopped");
        } catch (Exception e) {
            Log.e(TAG, "Error stopping kiosk mode", e);
        }
    }

    public boolean isKioskModeEnabled() {
        return preferences.getBoolean(KEY_KIOSK_ENABLED, false);
    }

    public Set<String> getAllowedApps() {
        return preferences.getStringSet(KEY_ALLOWED_APPS,
                new HashSet<>(Arrays.asList(DEFAULT_ALLOWED_APPS)));
    }

    public boolean isAppAllowed(String packageName) {
        return getAllowedApps().contains(packageName);
    }

//    /**
//     * 设置本应用为默认Launcher并锁定
//     */
//    public void setAsDefaultLauncherAndLock() {
//        if (!isDeviceOwner()) {
//            Log.w(TAG, "Cannot set default launcher - not device owner");
//            return;
//        }
//
//        try {
//            // 1. 设置本应用为默认Launcher
//            setAsDefaultLauncher();
//
//            // 2. 隐藏其他Launcher应用
//            hideOtherLaunchers();
//
//            // 3. 锁定Launcher选择
//            lockLauncherSelection();
//
//            // 4. 禁用相关设置页面
//            disableLauncherSettings();
//
//            Log.d(TAG, "Successfully set as default launcher and locked");
//
//        } catch (Exception e) {
//            Log.e(TAG, "Error setting as default launcher", e);
//        }
//    }
//
//    /**
//     * 设置本应用为默认Launcher
//     */
//    private void setAsDefaultLauncher() {
//        try {
//            // 创建Intent过滤器
//            IntentFilter homeFilter = new IntentFilter(Intent.ACTION_MAIN);
//            homeFilter.addCategory(Intent.CATEGORY_HOME);
//            homeFilter.addCategory(Intent.CATEGORY_DEFAULT);
//
//            // 设置本应用的Launcher Activity为首选
//            ComponentName launcherComponent = new ComponentName(
//                    context.getPackageName(),
//                    KioskLauncherActivity.class.getName()
//            );
//
//            // 添加持久化首选Activity
//            devicePolicyManager.addPersistentPreferredActivity(
//                    adminComponent,
//                    homeFilter,
//                    launcherComponent
//            );
//
//            Log.d(TAG, "Set as default launcher: " + launcherComponent);
//
//        } catch (Exception e) {
//            Log.e(TAG, "Error setting as default launcher", e);
//        }
//    }
//
//    /**
//     * 隐藏其他Launcher应用
//     */
//    private void hideOtherLaunchers() {
//        try {
//            Intent homeIntent = new Intent(Intent.ACTION_MAIN);
//            homeIntent.addCategory(Intent.CATEGORY_HOME);
//
//            List<ResolveInfo> launchers = context.getPackageManager()
//                    .queryIntentActivities(homeIntent, 0);
//
//            String myPackageName = context.getPackageName();
//            int hiddenCount = 0;
//
//            for (ResolveInfo launcher : launchers) {
//                String packageName = launcher.activityInfo.packageName;
//
//                // 跳过自己的应用
//                if (packageName.equals(myPackageName)) {
//                    continue;
//                }
//
//                // 跳过系统关键组件
//                if (isSystemCriticalLauncher(packageName)) {
//                    Log.d(TAG, "Skipping system critical launcher: " + packageName);
//                    continue;
//                }
//
//                try {
//                    // 使用 setApplicationHidden 隐藏整个应用
//                    boolean hidden = devicePolicyManager.setApplicationHidden(
//                            adminComponent, packageName, true);
//
//                    if (hidden) {
//                        hiddenCount++;
//                        Log.d(TAG, "Hidden launcher app: " + packageName);
//                    } else {
//                        Log.w(TAG, "Failed to hide launcher app: " + packageName);
//                    }
//
//                } catch (Exception e) {
//                    Log.w(TAG, "Failed to hide launcher: " + packageName, e);
//                }
//            }
//
//            Log.d(TAG, "Hidden " + hiddenCount + " other launcher apps");
//
//        } catch (Exception e) {
//            Log.e(TAG, "Error hiding other launchers", e);
//        }
//    }
//
//    /**
//     * 检查是否为系统关键Launcher
//     */
//    private boolean isSystemCriticalLauncher(String packageName) {
//        String[] criticalLaunchers = {
//                "com.android.launcher",
//                "com.android.launcher2",
//                "com.android.launcher3",
//                "com.google.android.apps.nexuslauncher", // Pixel Launcher
//                "com.android.systemui" // 系统UI
//        };
//
//        for (String critical : criticalLaunchers) {
//            if (packageName.equals(critical) || packageName.startsWith(critical)) {
//                return true;
//            }
//        }
//
//        return false;
//    }
//
//    /**
//     * 锁定Launcher选择，防止用户更改
//     */
//    private void lockLauncherSelection() {
//        try {
//            // 禁用默认应用设置
//            devicePolicyManager.addUserRestriction(adminComponent,
//                    UserManager.DISALLOW_CONFIG_DEFAULT_APPS);
//
//            // 禁用应用设置
//            devicePolicyManager.addUserRestriction(adminComponent,
//                    UserManager.DISALLOW_APPS_CONTROL);
//
//            Log.d(TAG, "Launcher selection locked");
//
//        } catch (Exception e) {
//            Log.w(TAG, "Error locking launcher selection", e);
//        }
//    }
//
//    /**
//     * 禁用Launcher相关的设置页面
//     */
//    private void disableLauncherSettings() {
//        try {
//            // 隐藏默认应用设置相关的应用
//            String[] settingsToHide = {
//                    "com.android.settings.applications.DefaultAppSettings",
//                    "com.android.settings.applications.ManageDefaultApps"
//            };
//
//            for (String settingPackage : settingsToHide) {
//                try {
//                    devicePolicyManager.setApplicationHidden(adminComponent, settingPackage, true);
//                    Log.d(TAG, "Hidden settings: " + settingPackage);
//                } catch (Exception e) {
//                    Log.w(TAG, "Could not hide setting: " + settingPackage, e);
//                }
//            }
//
//            // 设置全局设置来隐藏相关选项
//            devicePolicyManager.setGlobalSetting(adminComponent,
//                    "hide_launcher_icon_management", "1");
//
//            Log.d(TAG, "Launcher settings disabled");
//
//        } catch (Exception e) {
//            Log.w(TAG, "Error disabling launcher settings", e);
//        }
//    }
//
//    /**
//     * 使用PackageManager禁用组件（需要系统权限）
//     */
//    private void disableComponentWithPackageManager(String packageName, String activityName) {
//        try {
//            PackageManager packageManager = context.getPackageManager();
//            ComponentName component = new ComponentName(packageName, activityName);
//
//            // 这需要系统级权限，在Device Owner模式下可能可用
//            packageManager.setComponentEnabledSetting(
//                    component,
//                    PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
//                    PackageManager.DONT_KILL_APP
//            );
//
//            Log.d(TAG, "Disabled component: " + component);
//
//        } catch (Exception e) {
//            Log.w(TAG, "Failed to disable component: " + packageName + "/" + activityName, e);
//        }
//    }
//
//    /**
//     * 通过Intent过滤器阻止其他Launcher
//     */
//    private void blockOtherLaunchersWithIntentFilter() {
//        try {
//            // 清除所有现有的HOME Intent处理器
//            Intent homeIntent = new Intent(Intent.ACTION_MAIN);
//            homeIntent.addCategory(Intent.CATEGORY_HOME);
//
//            List<ResolveInfo> launchers = context.getPackageManager()
//                    .queryIntentActivities(homeIntent, 0);
//
//            // 清除其他应用的持久化首选项
//            for (ResolveInfo launcher : launchers) {
//                String packageName = launcher.activityInfo.packageName;
//                if (!packageName.equals(context.getPackageName())) {
//                    devicePolicyManager.clearPackagePersistentPreferredActivities(
//                            adminComponent, packageName);
//                }
//            }
//
//            Log.d(TAG, "Cleared other launcher preferences");
//
//        } catch (Exception e) {
//            Log.e(TAG, "Error blocking other launchers", e);
//        }
//    }
//
//    /**
//     * 检查是否为默认Launcher
//     */
//    public boolean isDefaultLauncher() {
//        try {
//            Intent homeIntent = new Intent(Intent.ACTION_MAIN);
//            homeIntent.addCategory(Intent.CATEGORY_HOME);
//
//            ResolveInfo resolveInfo = context.getPackageManager()
//                    .resolveActivity(homeIntent, PackageManager.MATCH_DEFAULT_ONLY);
//
//            if (resolveInfo != null && resolveInfo.activityInfo != null) {
//                String defaultLauncher = resolveInfo.activityInfo.packageName;
//                boolean isDefault = context.getPackageName().equals(defaultLauncher);
//                Log.d(TAG, "Current default launcher: " + defaultLauncher + ", isDefault: " + isDefault);
//                return isDefault;
//            }
//
//        } catch (Exception e) {
//            Log.e(TAG, "Error checking default launcher", e);
//        }
//
//        return false;
//    }
//
//    /**
//     * 强制启动自己的Launcher
//     */
//    public void forceLaunchOwnLauncher() {
//        try {
//            Intent intent = new Intent(context, KioskLauncherActivity.class);
//            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK |
//                    Intent.FLAG_ACTIVITY_CLEAR_TASK |
//                    Intent.FLAG_ACTIVITY_CLEAR_TOP);
//            intent.addCategory(Intent.CATEGORY_HOME);
//            context.startActivity(intent);
//
//            Log.d(TAG, "Forced launch of own launcher");
//
//        } catch (Exception e) {
//            Log.e(TAG, "Error forcing launcher", e);
//        }
//    }
//
//    /**
//     * 恢复其他Launcher（用于调试或紧急情况）
//     */
//    public void restoreOtherLaunchers() {
//        if (!isDeviceOwner()) {
//            Log.w(TAG, "Cannot restore launchers - not device owner");
//            return;
//        }
//
//        try {
//            // 显示所有隐藏的Launcher应用
//            Intent homeIntent = new Intent(Intent.ACTION_MAIN);
//            homeIntent.addCategory(Intent.CATEGORY_HOME);
//
//            List<ResolveInfo> launchers = context.getPackageManager()
//                    .queryIntentActivities(homeIntent, PackageManager.MATCH_DISABLED_COMPONENTS);
//
//            String myPackageName = context.getPackageName();
//            int restoredCount = 0;
//
//            for (ResolveInfo launcher : launchers) {
//                String packageName = launcher.activityInfo.packageName;
//
//                if (packageName.equals(myPackageName)) {
//                    continue;
//                }
//
//                try {
//                    // 显示隐藏的应用
//                    if (devicePolicyManager.isApplicationHidden(adminComponent, packageName)) {
//                        boolean shown = devicePolicyManager.setApplicationHidden(
//                                adminComponent, packageName, false);
//
//                        if (shown) {
//                            restoredCount++;
//                            Log.d(TAG, "Restored launcher: " + packageName);
//                        }
//                    }
//
//                } catch (Exception e) {
//                    Log.w(TAG, "Failed to restore launcher: " + packageName, e);
//                }
//            }
//
//            // 移除用户限制
//            devicePolicyManager.clearUserRestriction(adminComponent,
//                    UserManager.DISALLOW_CONFIG_DEFAULT_APPS);
//            devicePolicyManager.clearUserRestriction(adminComponent,
//                    UserManager.DISALLOW_APPS_CONTROL);
//
//            Log.d(TAG, "Restored " + restoredCount + " launchers");
//
//        } catch (Exception e) {
//            Log.e(TAG, "Error restoring other launchers", e);
//        }
//    }
//
//    /**
//     * 获取Launcher状态信息
//     */
//    public String getLauncherStatusInfo() {
//        StringBuilder info = new StringBuilder();
//        info.append("=== Launcher Status ===\n");
//        info.append("Is Default Launcher: ").append(isDefaultLauncher()).append("\n");
//        info.append("Device Owner: ").append(isDeviceOwner()).append("\n");
//
//        try {
//            Intent homeIntent = new Intent(Intent.ACTION_MAIN);
//            homeIntent.addCategory(Intent.CATEGORY_HOME);
//
//            List<ResolveInfo> launchers = context.getPackageManager()
//                    .queryIntentActivities(homeIntent, 0);
//
//            info.append("Available Launchers: ").append(launchers.size()).append("\n");
//            for (ResolveInfo launcher : launchers) {
//                String packageName = launcher.activityInfo.packageName;
//                boolean isHidden = devicePolicyManager.isApplicationHidden(adminComponent, packageName);
//                info.append("  - ").append(packageName)
//                        .append(" (Hidden: ").append(isHidden).append(")\n");
//            }
//
//        } catch (Exception e) {
//            info.append("Error getting launcher info: ").append(e.getMessage()).append("\n");
//        }
//
//        return info.toString();
//    }
}