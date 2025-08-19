package com.cosinetech.imates.utils;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import android.widget.Toast;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import java.util.LinkedList;
import java.util.Queue;

public class PermissionHelper {
    private final Activity activity;
    private final Queue<PermissionItem> permissionQueue = new LinkedList<>();
    private boolean isFromSettings = false;
    private static final int REQUEST_CODE_PERMISSION = 100;

    public PermissionHelper(Activity activity) {
        this.activity = activity;
    }

    // 权限类型：普通或特殊
    private enum PermissionType { NORMAL, SPECIAL }

    private static class PermissionItem {
        String permission;        // Manifest.permission 或特殊标识
        PermissionType type;

        PermissionItem(String permission, PermissionType type) {
            this.permission = permission;
            this.type = type;
        }
    }

    // 初始化队列
    private void initQueue() {
        permissionQueue.clear();
        // 普通权限
        permissionQueue.add(new PermissionItem(Manifest.permission.CAMERA, PermissionType.NORMAL));
        permissionQueue.add(new PermissionItem(Manifest.permission.RECORD_AUDIO, PermissionType.NORMAL));
        permissionQueue.add(new PermissionItem(Manifest.permission.READ_EXTERNAL_STORAGE, PermissionType.NORMAL));
        permissionQueue.add(new PermissionItem(Manifest.permission.WRITE_EXTERNAL_STORAGE, PermissionType.NORMAL));

        // 特殊权限
        permissionQueue.add(new PermissionItem("DRAW_OVERLAY", PermissionType.SPECIAL));
        permissionQueue.add(new PermissionItem("INSTALL_UNKNOWN_APPS", PermissionType.SPECIAL));
        permissionQueue.add(new PermissionItem("MANAGE_ALL_FILES", PermissionType.SPECIAL));
    }

    // 外部调用
    public void requestAllPermissionsWithPreDialog() {
        initQueue();
        if (!allPermissionsGranted()) {
            new AlertDialog.Builder(activity)
                    .setTitle("权限提示")
                    .setMessage("本应用需要获取全部权限才能正常使用，点击确定后将依次请求权限，否则无法使用应用。")
                    .setCancelable(false)
                    .setPositiveButton("确定", (dialog, which) -> {dialog.dismiss(); processNextPermission();})
                    .setNegativeButton("取消", (dialog, which) -> activity.finish())
                    .show();
        }
    }

    // 检查所有权限是否已授予
    private boolean allPermissionsGranted() {
        for (PermissionItem item : permissionQueue) {
            if (item.type == PermissionType.NORMAL) {
                if (ContextCompat.checkSelfPermission(activity, item.permission) != PackageManager.PERMISSION_GRANTED) {
                    return false;
                }
            } else if (item.type == PermissionType.SPECIAL) {
                if (!checkSpecialPermissionGranted(item.permission)) return false;
            }
        }
        return true;
    }

    // 处理队列
    private void processNextPermission() {
        if (permissionQueue.isEmpty()) {
            Toast.makeText(activity, "所有权限已授予", Toast.LENGTH_SHORT).show();
            return;
        }

        PermissionItem item = permissionQueue.peek();
        if (item.type == PermissionType.NORMAL) {
            if (ContextCompat.checkSelfPermission(activity, item.permission) == PackageManager.PERMISSION_GRANTED) {
                permissionQueue.poll(); // 已授权，跳过
                processNextPermission();
            } else {
                // 请求普通权限
                ActivityCompat.requestPermissions(activity, new String[]{item.permission}, REQUEST_CODE_PERMISSION);
            }
        } else {
            // 特殊权限
            if (checkSpecialPermissionGranted(item.permission)) {
                permissionQueue.poll();
                processNextPermission();
            } else {
                showSpecialPermissionDialog(item.permission);
            }
        }
    }

    private boolean checkSpecialPermissionGranted(String permission) {
        switch (permission) {
            case "DRAW_OVERLAY":
                return Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(activity);
            case "INSTALL_UNKNOWN_APPS":
                return Build.VERSION.SDK_INT < Build.VERSION_CODES.O ||
                        activity.getPackageManager().canRequestPackageInstalls();
            case "MANAGE_ALL_FILES":
                return Build.VERSION.SDK_INT < Build.VERSION_CODES.R ||
                        Environment.isExternalStorageManager();
            default:
                return true;
        }
    }

    private void showSpecialPermissionDialog(String permission) {
        String msg = "";
        Intent intent = switch (permission) {
            case "DRAW_OVERLAY" -> {
                msg = "需要允许悬浮窗权限";
                yield new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:" + activity.getPackageName()));
            }
            case "INSTALL_UNKNOWN_APPS" -> {
                msg = "需要允许安装未知应用";
                yield new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + activity.getPackageName()));
            }
            case "MANAGE_ALL_FILES" -> {
                msg = "需要允许管理所有文件权限";
                yield new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION,
                        Uri.parse("package:" + activity.getPackageName()));
            }
            default -> null;
        };

        Intent finalIntent = intent;
        new AlertDialog.Builder(activity)
                .setTitle("权限提示")
                .setMessage(msg)
                .setCancelable(false)
                .setPositiveButton("去设置", (dialog, which) -> {
                    isFromSettings = true;
                    activity.startActivity(finalIntent);
                })
                .setNegativeButton("取消", (dialog, which) -> activity.finish())
                .show();
    }

    // 调用在 Activity 的 onRequestPermissionsResult
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        if (requestCode != REQUEST_CODE_PERMISSION) return;

        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            permissionQueue.poll(); // 授权成功，移出队列
        }
        // 拒绝则保留在队列头，下一次仍会请求
        processNextPermission();
    }

    // 调用在 Activity 的 onResume
    public void onResumeCheck() {
        if (isFromSettings) {
            isFromSettings = false;
            processNextPermission();
        }
    }
}
