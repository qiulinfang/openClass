#!/bin/bash
# USB调试相关的ADB命令
# com.android.documentsui 文件管理
# com.android.gallery3d 图库
# com.android.settings 设置
# com.android.camera2 

PACKAGE_NAME="com.cosinetech.imates"

echo "=== Kiosk Controller Debug Commands ==="

# 检查Device Owner状态
echo "1. Checking Device Owner status..."
adb shell dpm list-owners

# 检查USB调试状态
echo "2. Checking USB debugging status..."
adb shell settings get global adb_enabled

# 启用USB调试 (如果需要)
echo "3. Enabling USB debugging..."
adb shell settings put global adb_enabled 1

# 检查开发者选项状态
echo "4. Checking developer options..."
adb shell settings get global development_settings_enabled

# 启用开发者选项
echo "5. Enabling developer options..."
adb shell settings put global development_settings_enabled 1

# 检查应用权限
echo "6. Checking app permissions..."
adb shell dumpsys deviceidle whitelist | grep $PACKAGE_NAME

# 检查锁定任务包
echo "7. Checking lock task packages..."
adb shell dpm get-lock-task-packages

# 启动调试管理界面
echo "8. Launching debug management..."
adb shell am start -n "$PACKAGE_NAME/.DebugManagementActivity"

echo "Debug commands completed!"


# 方法1: 通过ADB命令设置 (设备需要未设置锁屏密码)
adb shell dpm set-device-owner com.cosinetech.imates/.admin.KioskDeviceAdminReceiver

# 移除
adb shell dpm remove-active-admin com.cosinetech.imates/.admin.KioskDeviceAdminReceiver

# 方法2: 工厂重置后首次开机时设置
adb shell dpm set-device-owner com.cosinetech.imates/.admin.KioskDeviceAdminReceiver

# 验证Device Owner状态
adb shell dpm list-owners