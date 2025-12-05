package com.cosinetech.imates.screencasting.core;

import com.cosinetech.imates.screencasting.model.ClassroomInfo;
import com.cosinetech.imates.screencasting.model.ApiResponse;

/**
 * 设备信息缓存，用于检测变化
 */
public class DeviceInfoCache {
    private ClassroomInfo cachedClassroomInfo;
    private String cachedDeviceId;
    private String cachedIp;

    public DeviceInfoCache() {
    }

    public void updateCache(ClassroomInfo classroomInfo, String deviceId, String ip) {
        this.cachedClassroomInfo = classroomInfo;
        this.cachedDeviceId = deviceId;
        this.cachedIp = ip;
    }

    public ClassroomInfo getCachedClassroomInfo() {
        return cachedClassroomInfo;
    }

    public String getCachedDeviceId() {
        return cachedDeviceId;
    }

    public String getCachedIp() {
        return cachedIp;
    }

    public void clear() {
        this.cachedClassroomInfo = null;
        this.cachedDeviceId = null;
        this.cachedIp = null;
    }
}
