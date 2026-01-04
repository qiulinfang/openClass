package com.cosinetech.imates.screencasting.core;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import com.cosinetech.imates.screencasting.api.DeviceApiClient;
import com.cosinetech.imates.screencasting.model.ApiResponse;
import com.cosinetech.imates.screencasting.model.ClassroomInfo;
import com.cosinetech.imates.screencasting.model.DeviceLocationInfo;
import com.cosinetech.imates.screencasting.model.DeviceType;
import com.cosinetech.imates.screencasting.listener.DeviceChangeListener;

import org.json.JSONObject;

import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * 设备管理器 - 核心业务逻辑
 * 负责设备注册、心跳、查询等核心业务逻辑
 * 对外隐藏API细节
 */
public class DeviceManager {
    private static final String TAG = "DeviceManager";
    private static final long HEARTBEAT_INTERVAL = 30; // 默认30秒

    private final DeviceApiClient apiClient;
    private final DeviceLocationInfo deviceLocationInfo;
    private final Handler mainHandler;
    private final List<DeviceChangeListener> changeListeners;
    private final DeviceInfoCache infoCache;

    private ScheduledExecutorService heartbeatExecutor;
    private boolean isHeartbeatRunning = false;

    private DeviceManagerCallback callback;

    private String deviceIp = "1.2.3.4";

    /**
     * 设备管理器回调接口
     */
    public interface DeviceManagerCallback {
        void onRegistrationSuccess();
        void onRegistrationFailed(String errorCode, String errorMsg);
        void onHeartbeatSuccess();
        void onHeartbeatFailed(String errorCode, String errorMsg);
        void onQuerySuccess(JSONObject data);
        void onQueryFailed(String errorCode, String errorMsg);
    }

    /**
     * 构造函数
     * @param apiClient API客户端
     * @param deviceLocationInfo 设备信息
     */
    public DeviceManager(DeviceApiClient apiClient, DeviceLocationInfo deviceLocationInfo) {
        this.apiClient = apiClient;
        this.deviceLocationInfo = deviceLocationInfo;
        this.mainHandler = new Handler(Looper.getMainLooper());
        this.changeListeners = new CopyOnWriteArrayList<>();
        this.infoCache = new DeviceInfoCache();
    }

    /**
     * 设置回调监听
     */
    public void setCallback(DeviceManagerCallback callback) {
        this.callback = callback;
    }

    /**
     * 添加设备变化监听器
     */
    public void addDeviceChangeListener(DeviceChangeListener listener) {
        if (listener != null && !changeListeners.contains(listener)) {
            changeListeners.add(listener);
            Log.d(TAG, "Device change listener added, total listeners: " + changeListeners.size());
        }
    }

    /**
     * 移除设备变化监听器
     */
    public void removeDeviceChangeListener(DeviceChangeListener listener) {
        if (listener != null) {
            changeListeners.remove(listener);
            Log.d(TAG, "Device change listener removed, total listeners: " + changeListeners.size());
        }
    }

    /**
     * 清空所有监听器
     */
    public void clearDeviceChangeListeners() {
        changeListeners.clear();
        Log.d(TAG, "All device change listeners cleared");
    }

    /**
     * 注册设备（异步）
     */
    public void registerDevice(String deviceIp) {
        this.deviceIp = deviceIp;
        new Thread(() -> {
            registerDeviceSync();
        }).start();
    }

    /**
     * 同步注册设备
     */
    private ApiResponse registerDeviceSync() {
        String classroom = deviceLocationInfo.getClassroom() != null ? deviceLocationInfo.getClassroom() : "";
        
        ApiResponse response = apiClient.register(
                deviceIp,
                deviceLocationInfo.getType().getValue(),
                deviceLocationInfo.getCity() != null ? deviceLocationInfo.getCity() : "",
                deviceLocationInfo.getSchool() != null ? deviceLocationInfo.getSchool() : "",
                classroom,
                deviceLocationInfo.getName() != null ? deviceLocationInfo.getName() : ""
        );

        if (response.isSuccess()) {
            Log.d(TAG, "Device registered successfully");
            if (callback != null) {
                mainHandler.post(() -> callback.onRegistrationSuccess());
            }
        } else {
            Log.e(TAG, "Device registration failed: " + response.getMsg());
            if (callback != null) {
                String code = response.getCode();
                String msg = response.getMsg();
                mainHandler.post(() -> callback.onRegistrationFailed(code, msg));
            }
        }

        return response;
    }

    /**
     * 开始心跳（只支持teacher和screen）
     */
    public void startHeartbeat(long intervalSeconds) {
        if (isHeartbeatRunning) {
            Log.w(TAG, "Heartbeat is already running");
            return;
        }

        heartbeatExecutor = Executors.newScheduledThreadPool(1);
        isHeartbeatRunning = true;

        heartbeatExecutor.scheduleWithFixedDelay(this::sendHeartbeat, 0, intervalSeconds, TimeUnit.SECONDS);

        Log.d(TAG, "Heartbeat started with interval: " + intervalSeconds + "s");
    }

    /**
     * 开始心跳（使用默认间隔）
     */
    public void startHeartbeat() {
        startHeartbeat(HEARTBEAT_INTERVAL);
    }

    /**
     * 停止心跳
     */
    public void stopHeartbeat() {
        if (heartbeatExecutor != null) {
            heartbeatExecutor.shutdown();
            isHeartbeatRunning = false;
            Log.d(TAG, "Heartbeat stopped");
        }
    }

    /**
     * 发送单次心跳（异步）
     */
    public void sendHeartbeat() {
        new Thread(() -> {
            if(deviceLocationInfo.getType() == DeviceType.STUDENT) {
                detectDeviceChanges();
            } else {
                detectDeviceChanges();
                sendHeartbeatSync();
            }
        }).start();
    }

    /**
     * 同步发送心跳
     */
    public ApiResponse sendHeartbeatSync() {
        String classroom = deviceLocationInfo.getClassroom() != null ? deviceLocationInfo.getClassroom() : "";
        ApiResponse response = apiClient.heartbeat(
                deviceIp,
                deviceLocationInfo.getType().getValue(),
                deviceLocationInfo.getCity() != null ? deviceLocationInfo.getCity() : "",
                deviceLocationInfo.getSchool() != null ? deviceLocationInfo.getSchool() : "",
                classroom,
                deviceLocationInfo.getName() != null ? deviceLocationInfo.getName() : ""
        );

        if (response.isSuccess()) {
            Log.d(TAG, "Heartbeat sent successfully");
            detectDeviceChanges();
            if (callback != null) {
                mainHandler.post(() -> callback.onHeartbeatSuccess());
            }
        } else {
            Log.e(TAG, "Heartbeat failed: " + response.getMsg());
            if (callback != null) {
                String code = response.getCode();
                String msg = response.getMsg();
                mainHandler.post(() -> callback.onHeartbeatFailed(code, msg));
            }
        }

        return response;
    }

    /**
     * 检测设备信息变化（在心跳后调用）
     * 查询当前教室详情并与缓存对比
     */
    private void detectDeviceChanges() {
        // 只有在设置了教室信息的设备才检测变化
        String classroomId = deviceLocationInfo.getClassroom();
        if (classroomId == null || classroomId.isEmpty()) {
            return;
        }

        try {
            ApiResponse response = apiClient.getClassroomDetail(deviceLocationInfo.getCity(), deviceLocationInfo.getSchool(), classroomId);
            if (response.isSuccess()) {
                ClassroomInfo newClassroomInfo = ClassroomInfo.parseClassroomInfo(response.getData());
                if (newClassroomInfo != null) {
                    detectAndNotifyChanges(newClassroomInfo);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error detecting device changes: " + e.getMessage());
        }
    }

    /**
     * 检测并通知所有监听器关于变化
     */
    private void detectAndNotifyChanges(ClassroomInfo newClassroomInfo) {
        ClassroomInfo cachedInfo = infoCache.getCachedClassroomInfo();

        notifyListeners(cachedInfo, newClassroomInfo);

        if (cachedInfo == null) {
            infoCache.updateCache(newClassroomInfo, deviceLocationInfo.getDeviceId(), null);
        }
        // 更新缓存
        infoCache.updateCache(newClassroomInfo, deviceLocationInfo.getDeviceId(), null);
    }

    /**
     * 通知所有监听器
     */
    private void notifyListeners(ClassroomInfo oldInfo, ClassroomInfo newInfo) {
        Log.d(TAG, "Device change detected: " + newInfo.toString());
        mainHandler.post(() -> {
            for (DeviceChangeListener listener : changeListeners) {
                try {
                    listener.onDeviceChanged(oldInfo, newInfo);
                } catch (Exception e) {
                    Log.e(TAG, "Error notifying listener: " + e.getMessage());
                }
            }
        });
    }

    /**
     * 查询所有教室（异步）
     */
    public void queryAllClassrooms() {
        new Thread(() -> {
            queryAllClassroomsSync();
        }).start();
    }

    /**
     * 同步查询所有教室
     */
    public ApiResponse queryAllClassroomsSync() {
        ApiResponse response = apiClient.getAllClassrooms();

        if (response.isSuccess()) {
            Log.d(TAG, "Query all classrooms success");
            if (callback != null) {
                mainHandler.post(() -> callback.onQuerySuccess(response.getData()));
            }
        } else {
            Log.e(TAG, "Query all classrooms failed: " + response.getMsg());
            if (callback != null) {
                mainHandler.post(() -> callback.onQueryFailed(response.getCode(), response.getMsg()));
            }
        }

        return response;
    }

    /**
     * 查询某学校教室列表（异步）
     */
    public void queryClassroomsBySchool(String city, String school) {
        new Thread(() -> {
            queryClassroomsBySchoolSync(city, school);
        }).start();
    }

    /**
     * 同步查询某学校教室列表
     */
    public ApiResponse queryClassroomsBySchoolSync(String city, String school) {
        ApiResponse response = apiClient.getClassroomsBySchool(city, school);

        if (response.isSuccess()) {
            Log.d(TAG, "Query classrooms by school success: " + school);
            if (callback != null) {
                mainHandler.post(() -> callback.onQuerySuccess(response.getData()));
            }
        } else {
            Log.e(TAG, "Query classrooms by school failed: " + response.getMsg());
            if (callback != null) {
                mainHandler.post(() -> callback.onQueryFailed(response.getCode(), response.getMsg()));
            }
        }

        return response;
    }

    /**
     * 查询教室详情（异步）
     */
    public void queryClassroomDetail(String classroomId) {
        new Thread(() -> {
            queryClassroomDetailSync(classroomId);
        }).start();
    }

    /**
     * 同步查询教室详情
     */
    public ApiResponse queryClassroomDetailSync(String classroomId) {
        ApiResponse response = apiClient.getClassroomDetail(deviceLocationInfo.getCity(), deviceLocationInfo.getSchool(), classroomId);

        if (response.isSuccess()) {
            Log.d(TAG, "Query classroom detail success: " + classroomId);
            if (callback != null) {
                mainHandler.post(() -> callback.onQuerySuccess(response.getData()));
            }
        } else {
            Log.e(TAG, "Query classroom detail failed: " + response.getMsg());
            if (callback != null) {
                mainHandler.post(() -> callback.onQueryFailed(response.getCode(), response.getMsg()));
            }
        }

        return response;
    }

    /**
     * 查询服务器状态（异步）
     */
    public void queryServerStatus() {
        new Thread(() -> {
            queryServerStatusSync();
        }).start();
    }

    /**
     * 同步查询服务器状态
     */
    public ApiResponse queryServerStatusSync() {
        ApiResponse response = apiClient.getStatus();

        if (response.isSuccess()) {
            Log.d(TAG, "Server status query success");
            if (callback != null) {
                mainHandler.post(() -> callback.onQuerySuccess(response.getData()));
            }
        } else {
            Log.e(TAG, "Server status query failed: " + response.getMsg());
            if (callback != null) {
                mainHandler.post(() -> callback.onQueryFailed(response.getCode(), response.getMsg()));
            }
        }

        return response;
    }

    /**
     * 更新设备的城市、学校、教室信息
     */
    public void updateDeviceLocation(String city, String school, String classroom) {
        deviceLocationInfo.setCity(city);
        deviceLocationInfo.setSchool(school);
        deviceLocationInfo.setClassroom(classroom);
        Log.d(TAG, "Device location updated: " + city + " - " + school + " - " + classroom);
    }

    /**
     * 获取设备信息
     */
    public DeviceLocationInfo getDeviceInfo() {
        return deviceLocationInfo;
    }

    /**
     * 心跳是否运行中
     */
    public boolean isHeartbeatRunning() {
        return isHeartbeatRunning;
    }

    /**
     * 销毁资源
     */
    public void destroy() {
        stopHeartbeat();
        clearDeviceChangeListeners();
        Log.d(TAG, "DeviceManager destroyed");
    }
}
