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

import java.util.ArrayList;
import java.util.LinkedList;
import java.util.List;
import java.util.Queue;

public class PermissionHelper {

    public interface Callback {
        void onAllPermissionsGranted();
        void onPermissionDenied(String permission);
    }

    private static final int REQUEST_CODE_PERMISSION = 1001;
    private static final int REQUEST_CODE_SPECIAL = 1002;

    private final Activity activity;
    private final Callback callback;
    private final Queue<String> permissionQueue = new LinkedList<>();
    private final List<String> deniedList = new ArrayList<>();
    private boolean isRequesting = false;

    public PermissionHelper(Activity activity, Callback callback) {
        this.activity = activity;
        this.callback = callback;
    }

    // 普通危险权限列表，可扩展
    public static final String[] NORMAL_PERMISSIONS = new String[]{
            Manifest.permission.CAMERA,
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.READ_EXTERNAL_STORAGE,
            Manifest.permission.WRITE_EXTERNAL_STORAGE,
            Manifest.permission.READ_MEDIA_IMAGES,
            Manifest.permission.READ_MEDIA_VIDEO,
            Manifest.permission.READ_MEDIA_AUDIO
    };

    // 特殊权限类型
    public enum SpecialPermission { INSTALL, OVERLAY, MANAGE_ALL_FILES }

    // 外部调用
    public void requestAllPermissionsWithPreDialog() {
        // 检查是否有未授权的普通权限
        List<String> toRequest = new ArrayList<>();
        for (String perm : NORMAL_PERMISSIONS) {
            if (!isPermissionGranted(perm)) {
                toRequest.add(perm);
            }
        }

        // 检查特殊权限
        List<SpecialPermission> specialList = new ArrayList<>();
        if (!isOverlayGranted()) specialList.add(SpecialPermission.OVERLAY);
        if (!isInstallGranted()) specialList.add(SpecialPermission.INSTALL);
        if (!isManageAllFilesGranted()) specialList.add(SpecialPermission.MANAGE_ALL_FILES);

        if (toRequest.isEmpty() && specialList.isEmpty()) {
            callback.onAllPermissionsGranted();
            return;
        }

        // 弹提示框告知用户必须授权
        new AlertDialog.Builder(activity)
                .setTitle("权限请求")
                .setMessage("本应用需要所有权限才能正常使用，请授予以下权限")
                .setCancelable(false)
                .setPositiveButton("确定", (d, w) -> {
                    permissionQueue.addAll(toRequest);
                    deniedList.clear();
                    isRequesting = true;
                    requestNextPermission();
                    requestSpecialPermissions(specialList);
                })
                .show();
    }

    private void requestNextPermission() {
        if (permissionQueue.isEmpty()) {
            if (deniedList.isEmpty()) {
                checkSpecialPermissions(); // 全部普通权限授权后检查特殊权限
            } else {
                // 有普通权限被拒绝，继续循环请求
                permissionQueue.addAll(deniedList);
                deniedList.clear();
                requestNextPermission();
            }
            return;
        }

        String perm = permissionQueue.poll();
        if (isPermissionGranted(perm)) {
            requestNextPermission(); // 已授权，跳下一个
        } else {
            ActivityCompat.requestPermissions(activity, new String[]{perm}, REQUEST_CODE_PERMISSION);
        }
    }

    // 调用Activity的onRequestPermissionsResult
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        if (requestCode != REQUEST_CODE_PERMISSION || permissions.length == 0) return;

        String perm = permissions[0];
        if (grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            // 授权成功，继续下一个
            requestNextPermission();
        } else {
            // 拒绝
            if (ActivityCompat.shouldShowRequestPermissionRationale(activity, perm)) {
                // 可以再次弹窗
                deniedList.add(perm);
            } else {
                // 勾了不再询问，引导设置
                showPermissionSettingDialog(perm);
            }
            requestNextPermission();
        }
    }

    private void showPermissionSettingDialog(String permission) {
        String msg = "请在设置中开启权限: " + permission;
        new AlertDialog.Builder(activity)
                .setTitle("应用权限")
                .setMessage(msg)
                .setCancelable(false)
                .setPositiveButton("去设置", (d, w) -> {
                    Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                    intent.setData(Uri.fromParts("package", activity.getPackageName(), null));
                    activity.startActivity(intent);
                })
                .setNegativeButton("退出应用", (d, w) -> activity.finish())
                .show();
    }

    private boolean isPermissionGranted(String permission) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (permission.equals(Manifest.permission.READ_EXTERNAL_STORAGE)
                    || permission.equals(Manifest.permission.WRITE_EXTERNAL_STORAGE)) {
                return true; // Android 13 以后存储分权限
            }
        }
        return ContextCompat.checkSelfPermission(activity, permission) == PackageManager.PERMISSION_GRANTED;
    }

    // ----- 特殊权限 -----
    private boolean isOverlayGranted() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(activity);
    }

    private boolean isInstallGranted() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O || activity.getPackageManager().canRequestPackageInstalls();
    }

    private boolean isManageAllFilesGranted() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.R || Environment.isExternalStorageManager();
    }

    private void requestSpecialPermissions(List<SpecialPermission> list) {
        for (SpecialPermission sp : list) {
            switch (sp) {
                case OVERLAY:
                    showSpecialPermissionDialog("悬浮窗权限", Settings.ACTION_MANAGE_OVERLAY_PERMISSION);
                    break;
                case INSTALL:
                    showSpecialPermissionDialog("安装未知应用权限", Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                    break;
                case MANAGE_ALL_FILES:
                    showSpecialPermissionDialog("访问所有文件权限", Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION);
                    break;
            }
        }
    }

    private void showSpecialPermissionDialog(String title, String action) {
        new AlertDialog.Builder(activity)
                .setTitle(title)
                .setMessage("请在设置中开启 " + title)
                .setCancelable(false)
                .setPositiveButton("去设置", (d, w) -> {
                    Intent intent = new Intent(action);
                    if (action.equals(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES)) {
                        intent.setData(Uri.parse("package:" + activity.getPackageName()));
                    } else if (action.equals(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION)) {
                        intent.setData(Uri.parse("package:" + activity.getPackageName()));
                    }
                    if (intent.resolveActivity(activity.getPackageManager()) != null) {
                        activity.startActivity(intent);
                    } else {
                        Toast.makeText(activity, "无法打开设置页面，请手动开启", Toast.LENGTH_SHORT).show();
                    }
                })
                .setNegativeButton("退出应用", (d, w) -> activity.finish())
                .show();
    }

    private void checkSpecialPermissions() {
        // 如果全都授予了
        if (isOverlayGranted() && isInstallGranted() && isManageAllFilesGranted()) {
            callback.onAllPermissionsGranted();
        }
    }
}
