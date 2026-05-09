package com.cosinetech.imates.screencasting;

import android.content.Context;
import android.util.Log;

import com.cosinetech.imates.network.UnsafeOkHttpClient;
import com.cosinetech.imates.screencasting.api.DeviceApiClient;
import com.cosinetech.imates.screencasting.core.ClassroomManager;
import com.cosinetech.imates.screencasting.core.DeviceManager;
import com.cosinetech.imates.screencasting.model.DeviceLocationInfo;
import com.cosinetech.imates.screencasting.model.DeviceType;
import com.cosinetech.imates.screencasting.model.ClassroomInfo;
import com.cosinetech.imates.screencasting.ui.ClassroomSelectionDialog;
import com.cosinetech.imates.screencasting.listener.DeviceChangeListener;

import org.json.JSONObject;

/**
 * 设备客户端Wrapper - 对外的主接口
 * 
 * 用法示例：
 * 
 * // 1. 创建Teacher客户端
 * DeviceClientWrapper client = new DeviceClientWrapper(context, "192.168.1.100", 8080, "device_123", DeviceType.TEACHER);
 * 
 * // 2. 获取所有教室并显示选择Dialog
 * client.showClassroomSelectionDialog(new DeviceClientWrapper.OnClassroomSelectedListener() {
 *     public void onSelected(String city, String school, ClassroomInfo classroom) {
 *         client.register();
 *         client.startHeartbeat();
 *     }
 * });
 * 
 * // 或者直接设置教室
 * client.setLocation("北京", "第一中学", "classroom_001");
 * client.register();
 * client.startHeartbeat();
 * 
 * // 3. 监听设备信息变化
 * client.addDeviceChangeListener(change -> {
 *     Log.d("Change", "Device changed: " + change.getChangeType());
 * });
 */
public class DeviceClientWrapper {
    private static final String TAG = "DeviceClientWrapper";

    private final Context context;
    private final DeviceApiClient apiClient;
    private final DeviceManager deviceManager;
    private final ClassroomManager classroomManager;
    private ClassroomSelectionDialog classroomDialog;
    private String baseUrl;

    /**
     * 教室选择完成监听器
     */
    public interface OnClassroomSelectedListener {
        void onSelected(String city, String school, ClassroomInfo classroom);
        void onCancelled();
    }

    /**
     * 设备事件监听器
     */
    public interface OnDeviceEventListener {
        void onRegistrationSuccess();
        void onRegistrationFailed(String errorCode, String errorMsg);
        void onHeartbeatSuccess();
        void onHeartbeatFailed(String errorCode, String errorMsg);
        void onQuerySuccess(JSONObject data);
        void onQueryFailed(String errorCode, String errorMsg);
    }

    /**
     * 构造函数 - 指定URL
     */
    public DeviceClientWrapper(Context context, String baseUrl, String deviceId, DeviceType type) {
        this.context = context;
        this.apiClient = new DeviceApiClient(baseUrl);
        this.deviceManager = new DeviceManager(apiClient, new DeviceLocationInfo(deviceId, type));
        this.classroomManager = new ClassroomManager();
        Log.d(TAG, "DeviceClientWrapper created with URL: " + baseUrl + ", type: " + type);
    }

    /**
     * 构造函数 - 指定IP和端口
     */
    public DeviceClientWrapper(Context context, String host, int port, String deviceId, DeviceType type) {
        this(context, host, port, false, deviceId, type);
    }

    /**
     * 构造函数 - 指定IP、端口、协议
     */
    public DeviceClientWrapper(Context context, String host, int port, boolean useHttps, 
                              String deviceId, DeviceType type) {
        this.context = context;
        this.apiClient = new DeviceApiClient(host, port, useHttps);
        this.deviceManager = new DeviceManager(apiClient, new DeviceLocationInfo(deviceId, type));
        this.classroomManager = new ClassroomManager();
        String protocol = useHttps ? "HTTPS" : "HTTP";
        this.baseUrl = useHttps ? "https://" : "http://" + host + ":" + port;
        Log.d(TAG, "DeviceClientWrapper created: " + host + ":" + port + " (" + protocol + "), type: " + type);
    }

    // ========== 教室选择相关 ==========

    /**
     * 显示教室选择Dialog
     * 首先会自动查询所有教室
     */
    public void showClassroomSelectionDialog(OnClassroomSelectedListener listener) {
        showClassroomSelectionDialog(this.context, listener);
    }

    /**
     * 显示教室选择Dialog
     * @param uiContext 用于显示Dialog的Activity Context
     */
    public void showClassroomSelectionDialog(Context uiContext, OnClassroomSelectedListener listener) {
        new Thread(() -> {
            try {
                // 先查询所有教室
                apiClient.getAllClassrooms();
                String url = baseUrl + "/all_classrooms";
                okhttp3.OkHttpClient client = UnsafeOkHttpClient.getUnsafeOkHttpClient();
                okhttp3.Request request = new okhttp3.Request.Builder().url(url).build();
                okhttp3.Response response = client.newCall(request).execute();
                
                if (response.isSuccessful() && response.body() != null) {
                    String body = response.body().string();
                    JSONObject jsonObject = new JSONObject(body);
                    JSONObject data = jsonObject.optJSONObject("classrooms");
                    
                    if (data != null) {
                        classroomManager.setClassroomTreeData(data);
                        
                        // 在主线程显示Dialog
                        android.os.Handler handler = new android.os.Handler(android.os.Looper.getMainLooper());
                        handler.post(() -> {
                            showClassroomDialogInternal(uiContext, listener);
                        });
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "Error fetching classroom data", e);
            }
        }).start();
    }

    /**
     * 同步获取教室树数据 JSON 字符串（提供给上层/Web 使用，不直接弹出对话框）
     *
     * @return classrooms 字段对应的 JSON 字符串，失败时返回 null
     */
    public String fetchAllClassroomsTreeJsonSync() {
        try {
            apiClient.getAllClassrooms();
            String url = baseUrl + "/all_classrooms";
            okhttp3.OkHttpClient client = UnsafeOkHttpClient.getUnsafeOkHttpClient();
            okhttp3.Request request = new okhttp3.Request.Builder().url(url).build();
            okhttp3.Response response = client.newCall(request).execute();

            if (response.isSuccessful() && response.body() != null) {
                String body = response.body().string();
                JSONObject jsonObject = new JSONObject(body);

                String preview = body.length() > 200 ? body.substring(0, 200) : body;
                Log.d(TAG, "[Classroom][Native][Tree] http ok url=" + url + " len=" + body.length() + " preview=" + preview);

                JSONObject treeData = jsonObject.optJSONObject("classrooms");
                String picked = "classrooms";

                if (treeData == null) {
                    treeData = jsonObject.optJSONObject("classroom");
                    picked = "classroom";
                }

                if (treeData == null) {
                    JSONObject dataObj = jsonObject.optJSONObject("data");
                    if (dataObj != null) {
                        JSONObject nested = dataObj.optJSONObject("classrooms");
                        if (nested != null) {
                            treeData = nested;
                            picked = "data.classrooms";
                        }
                    }
                }

                if (treeData != null) {
                    Log.d(TAG, "[Classroom][Native][Tree] parsed picked=" + picked + " keys=" + treeData.length());
                    classroomManager.setClassroomTreeData(treeData);
                    return treeData.toString();
                }

                Log.w(TAG, "[Classroom][Native][Tree] parsed no tree field, keys=" + jsonObject.length());
            }
        } catch (Exception e) {
            Log.e(TAG, "Error fetching classroom data synchronously", e);
        }
        return null;
    }

    /**
     * 内部显示Dialog方法
     */
    private void showClassroomDialogInternal(Context uiContext, OnClassroomSelectedListener listener) {
        // 检查 uiContext 是否为 Activity 且未销毁
        if (uiContext instanceof android.app.Activity) {
            android.app.Activity activity = (android.app.Activity) uiContext;
            if (activity.isFinishing() || (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.JELLY_BEAN_MR1 && activity.isDestroyed())) {
                Log.e(TAG, "Activity is finishing or destroyed, cannot show dialog");
                return;
            }
        } else {
            Log.e(TAG, "uiContext is not an Activity, cannot show dialog. Context: " + uiContext);
            return;
        }

        classroomDialog = new ClassroomSelectionDialog(uiContext, classroomManager);
        classroomDialog.setOnSelectionListener(new ClassroomSelectionDialog.OnSelectionListener() {
            @Override
            public void onSelected(String city, String school, ClassroomInfo classroom) {
                deviceManager.updateDeviceLocation(city, school, classroom.getName());
                if (listener != null) {
                    listener.onSelected(city, school, classroom);
                }
            }

            @Override
            public void onCancelled() {
                if (listener != null) {
                    listener.onCancelled();
                }
            }
        });
        classroomDialog.show();
    }

    /**
     * 关闭教室选择Dialog
     */
    public void dismissClassroomSelectionDialog() {
        if (classroomDialog != null) {
            classroomDialog.dismiss();
        }
    }

    /**
     * 直接设置位置信息（城市、学校、教室）
     */
    public boolean setLocation(String city, String school, String classroom) {
        boolean success = classroomManager.setLocation(city, school, classroom);
        if (success) {
            deviceManager.updateDeviceLocation(city, school, classroom);
            Log.d(TAG, "Location set: " + city + " - " + school + " - " + classroom);
        } else {
            Log.w(TAG, "Failed to set location");
        }
        return success;
    }

    /**
     * 获取当前选中的城市
     */
    public String getSelectedCity() {
        return classroomManager.getSelectedCity();
    }

    /**
     * 获取当前选中的学校
     */
    public String getSelectedSchool() {
        return classroomManager.getSelectedSchool();
    }

    /**
     * 获取当前选中的教室
     */
    public ClassroomInfo getSelectedClassroom() {
        return classroomManager.getSelectedClassroom();
    }

    // ========== 设备注册相关 ==========

    /**
     * 注册设备（异步）
     */
    public void register(String device_ip) {
        deviceManager.registerDevice(device_ip);
        Log.d(TAG, "Device registration initiated");
    }

    // ========== 心跳相关 ==========

    /**
     * 开始心跳
     */
    public void startHeartbeat() {
        deviceManager.startHeartbeat();
        Log.d(TAG, "Heartbeat started");
    }

    /**
     * 以指定间隔开始心跳
     */
    public void startHeartbeat(long intervalSeconds) {
        deviceManager.startHeartbeat(intervalSeconds);
        Log.d(TAG, "Heartbeat started with interval: " + intervalSeconds + "s");
    }

    /**
     * 停止心跳
     */
    public void stopHeartbeat() {
        deviceManager.stopHeartbeat();
        Log.d(TAG, "Heartbeat stopped");
    }

    /**
     * 心跳是否运行中
     */
    public boolean isHeartbeatRunning() {
        return deviceManager.isHeartbeatRunning();
    }

    // ========== 查询相关 ==========

    /**
     * 查询所有教室（异步）
     */
    public void queryAllClassrooms() {
        deviceManager.queryAllClassrooms();
    }

    /**
     * 同步查询所有教室
     */
    public com.cosinetech.imates.screencasting.model.ApiResponse queryAllClassroomsSync() {
        return deviceManager.queryAllClassroomsSync();
    }

    /**
     * 查询某学校的教室列表（异步）
     */
    public void queryClassroomsBySchool(String city, String school) {
        deviceManager.queryClassroomsBySchool(city, school);
    }

    /**
     * 同步查询某学校的教室列表
     */
    public com.cosinetech.imates.screencasting.model.ApiResponse queryClassroomsBySchoolSync(String city, String school) {
        return deviceManager.queryClassroomsBySchoolSync(city, school);
    }

    /**
     * 查询教室详情（异步）
     */
    public void queryClassroomDetail(String classroomId) {
        deviceManager.queryClassroomDetail(classroomId);
    }

    /**
     * 同步查询教室详情
     */
    public com.cosinetech.imates.screencasting.model.ApiResponse queryClassroomDetailSync(String classroomId) {
        return deviceManager.queryClassroomDetailSync(classroomId);
    }

    /**
     * 查询服务器状态（异步）
     */
    public void queryServerStatus() {
        deviceManager.queryServerStatus();
    }

    /**
     * 同步查询服务器状态
     */
    public com.cosinetech.imates.screencasting.model.ApiResponse queryServerStatusSync() {
        return deviceManager.queryServerStatusSync();
    }

    // ========== 事件监听 ==========

    /**
     * 设置设备事件监听器
     */
    public void setEventListener(OnDeviceEventListener listener) {
        if (listener != null) {
            deviceManager.setCallback(new DeviceManager.DeviceManagerCallback() {
                @Override
                public void onRegistrationSuccess() {
                    listener.onRegistrationSuccess();
                }

                @Override
                public void onRegistrationFailed(String errorCode, String errorMsg) {
                    listener.onRegistrationFailed(errorCode, errorMsg);
                }

                @Override
                public void onHeartbeatSuccess() {
                    listener.onHeartbeatSuccess();
                }

                @Override
                public void onHeartbeatFailed(String errorCode, String errorMsg) {
                    listener.onHeartbeatFailed(errorCode, errorMsg);
                }

                @Override
                public void onQuerySuccess(JSONObject data) {
                    listener.onQuerySuccess(data);
                }

                @Override
                public void onQueryFailed(String errorCode, String errorMsg) {
                    listener.onQueryFailed(errorCode, errorMsg);
                }
            });
        }
    }


    /**
     * 添加设备变化监听器
     * 当心跳检测到设备信息变化时会触发回调
     * @param listener 变化监听器
     */
    public void addDeviceChangeListener(DeviceChangeListener listener) {
        if (listener != null) {
            deviceManager.addDeviceChangeListener(listener);
            Log.d(TAG, "Device change listener added");
        }
    }

    /**
     * 移除设备变化监听器
     * @param listener 要移除的监听器
     */
    public void removeDeviceChangeListener(DeviceChangeListener listener) {
        if (listener != null) {
            deviceManager.removeDeviceChangeListener(listener);
            Log.d(TAG, "Device change listener removed");
        }
    }

    /**
     * 清空所有设备变化监听器
     */
    public void clearDeviceChangeListeners() {
        deviceManager.clearDeviceChangeListeners();
        Log.d(TAG, "All device change listeners cleared");
    }

    // ========== 辅助方法 ==========

    /**
     * 获取设备类型
     */
    public DeviceType getDeviceType() {
        return deviceManager.getDeviceInfo().getType();
    }

    /**
     * 获取设备ID
     */
    public String getDeviceId() {
        return deviceManager.getDeviceInfo().getDeviceId();
    }

    /**
     * 清理资源
     */
    public void destroy() {
        deviceManager.destroy();
        classroomManager.clear();
        dismissClassroomSelectionDialog();
        Log.d(TAG, "DeviceClientWrapper destroyed");
    }
}
