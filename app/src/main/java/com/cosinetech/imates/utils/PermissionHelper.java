package com.cosinetech.imates.utils;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import java.util.ArrayList;
import java.util.List;

public class PermissionHelper {
    private static final int REQUEST_CODE_PERMISSION = 1001;
    private final Activity activity;
    private final List<String> allPermissions = new ArrayList<>();
    private final List<String> pendingPermissions = new ArrayList<>();
    private final List<String> tempDenied = new ArrayList<>();
    private final List<String> blockedPermissions = new ArrayList<>();

    public PermissionHelper(Activity activity) {
        this.activity = activity;
        initPermissions();
    }

    private void initPermissions() {
        allPermissions.clear();

        // 存储权限
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // Android 11+ 使用特殊权限，不加入普通权限列表
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            allPermissions.add(android.Manifest.permission.WRITE_EXTERNAL_STORAGE);
        }

        // 媒体读取权限
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            allPermissions.add(android.Manifest.permission.READ_MEDIA_IMAGES);
            allPermissions.add(android.Manifest.permission.READ_MEDIA_VIDEO);
            allPermissions.add(android.Manifest.permission.READ_MEDIA_AUDIO);
        } else {
            allPermissions.add(android.Manifest.permission.READ_EXTERNAL_STORAGE);
        }

        allPermissions.add(android.Manifest.permission.CAMERA);
        allPermissions.add(android.Manifest.permission.RECORD_AUDIO);
    }

    public void requestAllPermissionsWithPreDialog() {
        // 先检查是否有未授权的普通权限
        List<String> ungranted = new ArrayList<>();
        for (String perm : allPermissions) {
            if (ContextCompat.checkSelfPermission(activity, perm) != PackageManager.PERMISSION_GRANTED) {
                ungranted.add(perm);
            }
        }

        // Android 11+ 所有文件访问
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R &&
                !Environment.isExternalStorageManager()) {
            ungranted.add("MANAGE_EXTERNAL_STORAGE");
        }

        // 悬浮窗
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
                !Settings.canDrawOverlays(activity)) {
            ungranted.add("DRAW_OVERLAY");
        }

        // 安装未知应用
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
                !activity.getPackageManager().canRequestPackageInstalls()) {
            ungranted.add("UNKNOWN_APP_INSTALL");
        }

        if (ungranted.isEmpty()) {
            // 全部权限已经授予
            Toast.makeText(activity, "所有权限已授予", Toast.LENGTH_SHORT).show();
            checkSpecialPermissions(); // 可选，检查特殊权限状态
            return;
        }

        // 有未授权的权限，弹窗提示用户必须授予
        new AlertDialog.Builder(activity)
                .setTitle("权限提示")
                .setMessage("本应用需要获取全部权限才能正常使用，点击确定后将依次请求权限，否则无法使用应用。")
                .setCancelable(false)
                .setPositiveButton("确定", (dialog, which) -> {
                    dialog.dismiss();
                    requestAllPermissions();
                })
                .setNegativeButton("取消", (dialog, which) -> {
                    Toast.makeText(activity, "权限未授予，应用无法使用", Toast.LENGTH_SHORT).show();
                    activity.finish(); // 或者锁定功能
                })
                .show();
    }

    public void requestAllPermissions() {
        pendingPermissions.clear();
        tempDenied.clear();
        blockedPermissions.clear();

        for (String perm : allPermissions) {
            if (ContextCompat.checkSelfPermission(activity, perm) != PackageManager.PERMISSION_GRANTED) {
                pendingPermissions.add(perm);
            }
        }

        requestNext();
    }

    private void requestNext() {
        if (!pendingPermissions.isEmpty()) {
            String permission = pendingPermissions.get(0);
            ActivityCompat.requestPermissions(activity,
                    new String[]{permission},
                    REQUEST_CODE_PERMISSION);
            return;
        }

        if (!tempDenied.isEmpty()) {
            pendingPermissions.addAll(tempDenied);
            tempDenied.clear();
            requestNext();
            return;
        }

        if (!blockedPermissions.isEmpty()) {
            showSettingsDialog("部分权限被永久拒绝，需要手动开启权限", this::goToAppSettings);
            return;
        }

        checkSpecialPermissions();
    }

    private void checkSpecialPermissions() {
        // Android 11+ 所有文件访问
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R &&
                !Environment.isExternalStorageManager()) {
            showSettingsDialog("需要允许“所有文件访问权限”", this::goToAllFilesPermission);
            return;
        }

        // 悬浮窗
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(activity)) {
            showSettingsDialog("需要开启悬浮窗权限", () ->
                    safeGoToSettings(Settings.ACTION_MANAGE_OVERLAY_PERMISSION));
            return;
        }

        // 安装未知应用
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
                !activity.getPackageManager().canRequestPackageInstalls()) {
            showSettingsDialog("需要允许安装未知应用", () ->
                    safeGoToSettings(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES));
            return;
        }

        Toast.makeText(activity, "所有权限已授予或请求完成", Toast.LENGTH_SHORT).show();
    }

    private void showSettingsDialog(String message, Runnable onConfirm) {
        new AlertDialog.Builder(activity)
                .setTitle("权限提示")
                .setMessage(message)
                .setCancelable(false)
                .setPositiveButton("去设置", (dialog, which) -> onConfirm.run())
                .setNegativeButton("取消", (dialog, which) -> requestNext()) // 取消也继续请求下一个
                .show();
    }

    private void safeGoToSettings(String action) {
        Intent intent = new Intent(action, Uri.parse("package:" + activity.getPackageName()));
        if (intent.resolveActivity(activity.getPackageManager()) != null) {
            activity.startActivity(intent);
        } else {
            goToAppSettings();
        }
    }

    private void goToAppSettings() {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.parse("package:" + activity.getPackageName()));
        if (intent.resolveActivity(activity.getPackageManager()) != null) {
            activity.startActivity(intent);
        } else {
            Toast.makeText(activity, "无法打开设置，请手动开启权限", Toast.LENGTH_SHORT).show();
        }
    }

    private void goToAllFilesPermission() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
                intent.setData(Uri.parse("package:" + activity.getPackageName()));
                activity.startActivity(intent);
            }
        } catch (Exception e) {
            goToAppSettings();
        }
    }

    public void onRequestPermissionsResult(int requestCode,
                                           @NonNull String[] permissions,
                                           @NonNull int[] grantResults) {
        if (requestCode != REQUEST_CODE_PERMISSION || permissions.length == 0) return;

        String permission = permissions[0];
        pendingPermissions.remove(permission);

        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            // 已授权
        } else {
            if (!ActivityCompat.shouldShowRequestPermissionRationale(activity, permission)) {
                if (!blockedPermissions.contains(permission)) blockedPermissions.add(permission);
            } else {
                if (!tempDenied.contains(permission)) tempDenied.add(permission);
            }
        }

        requestNext();
    }
}




