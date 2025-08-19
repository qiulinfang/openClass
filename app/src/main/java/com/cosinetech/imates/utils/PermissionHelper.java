package com.cosinetech.imates.utils;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
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

    private enum PermissionType { NORMAL, SPECIAL }

    private static class PermissionItem {
        String permission;
        PermissionType type;

        PermissionItem(String permission, PermissionType type) {
            this.permission = permission;
            this.type = type;
        }
    }

    private void initQueue() {
        permissionQueue.clear();
        // 普通权限
        permissionQueue.add(new PermissionItem(Manifest.permission.CAMERA, PermissionType.NORMAL));
        permissionQueue.add(new PermissionItem(Manifest.permission.RECORD_AUDIO, PermissionType.NORMAL));

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            permissionQueue.add(new PermissionItem(Manifest.permission.READ_EXTERNAL_STORAGE, PermissionType.NORMAL));
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                permissionQueue.add(new PermissionItem(Manifest.permission.WRITE_EXTERNAL_STORAGE, PermissionType.NORMAL));
            }
        } else {
            // Android 11+ 全部文件特殊权限
            permissionQueue.add(new PermissionItem("MANAGE_ALL_FILES", PermissionType.SPECIAL));
        }

        // 特殊权限
        permissionQueue.add(new PermissionItem("DRAW_OVERLAY", PermissionType.SPECIAL));
        permissionQueue.add(new PermissionItem("INSTALL_UNKNOWN_APPS", PermissionType.SPECIAL));
    }

    public void requestAllPermissionsWithPreDialog() {
        initQueue();
        if (!allPermissionsGranted()) {
            new AlertDialog.Builder(activity)
                    .setTitle("权限提示")
                    .setMessage("本应用需要获取全部权限才能正常使用，点击确定后将依次请求权限，否则无法使用应用。")
                    .setCancelable(false)
                    .setPositiveButton("确定", (dialog, which) -> processNextPermission())
                    .setNegativeButton("取消", (dialog, which) -> activity.finish())
                    .show();
        }
    }

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

    private void processNextPermission() {
        if (permissionQueue.isEmpty()) {
            Toast.makeText(activity, "所有权限已授予", Toast.LENGTH_SHORT).show();
            return;
        }

        PermissionItem item = permissionQueue.peek();
        if (item.type == PermissionType.NORMAL) {
            if (ContextCompat.checkSelfPermission(activity, item.permission) == PackageManager.PERMISSION_GRANTED) {
                permissionQueue.poll();
                processNextPermission();
            } else {
                ActivityCompat.requestPermissions(activity, new String[]{item.permission}, REQUEST_CODE_PERMISSION);
            }
        } else {
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
                return Build.VERSION.SDK_INT < Build.VERSION_CODES.O || activity.getPackageManager().canRequestPackageInstalls();
            case "MANAGE_ALL_FILES":
                return Build.VERSION.SDK_INT < Build.VERSION_CODES.R || Environment.isExternalStorageManager();
            default:
                return true;
        }
    }

    private void showSpecialPermissionDialog(String permission) {
        String msg = "";
        Intent intent = null;
        switch (permission) {
            case "DRAW_OVERLAY":
                msg = "需要允许悬浮窗权限";
                intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:" + activity.getPackageName()));
                break;
            case "INSTALL_UNKNOWN_APPS":
                msg = "需要允许安装未知应用";
                intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + activity.getPackageName()));
                break;
            case "MANAGE_ALL_FILES":
                msg = "需要允许管理所有文件权限";
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION,
                            Uri.parse("package:" + activity.getPackageName()));
                }
                break;
        }

        Intent finalIntent = intent;
        new AlertDialog.Builder(activity)
                .setTitle("权限提示")
                .setMessage(msg)
                .setCancelable(false)
                .setPositiveButton("去设置", (dialog, which) -> {
                    isFromSettings = true;
                    try {
                        if (finalIntent != null) {
                            activity.startActivity(finalIntent);
                        }
                    } catch (ActivityNotFoundException e) {
                        // fallback: 打开通用应用设置页
                        Intent fallback = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                                Uri.parse("package:" + activity.getPackageName()));
                        try {
                            activity.startActivity(fallback);
                        } catch (ActivityNotFoundException ex) {
                            Toast.makeText(activity, "无法打开设置，请手动开启权限", Toast.LENGTH_LONG).show();
                        }
                    }
                })
                .setNegativeButton("取消", (dialog, which) -> activity.finish())
                .show();
    }

    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        if (requestCode != REQUEST_CODE_PERMISSION
            || permissions.length == 0) {
            return;
        }

        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            permissionQueue.poll();
        }
        processNextPermission();
    }

    public void onResumeCheck() {
        if (isFromSettings) {
            isFromSettings = false;
            processNextPermission();
        }
    }
}

