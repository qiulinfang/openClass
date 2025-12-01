package com.cosinetech.imates.screencasting.listener;

import com.cosinetech.imates.screencasting.model.ClassroomInfo;

/**
 * 设备变化事件
 */
public class DeviceChange {
    private DeviceChangeType changeType;
    private String deviceId;
    private Object oldValue;
    private Object newValue;
    private long timestamp;

    public DeviceChange(DeviceChangeType changeType, String deviceId, Object oldValue, Object newValue) {
        this.changeType = changeType;
        this.deviceId = deviceId;
        this.oldValue = oldValue;
        this.newValue = newValue;
        this.timestamp = System.currentTimeMillis();
    }

    public DeviceChangeType getChangeType() {
        return changeType;
    }

    public String getDeviceId() {
        return deviceId;
    }

    public Object getOldValue() {
        return oldValue;
    }

    public Object getNewValue() {
        return newValue;
    }

    public long getTimestamp() {
        return timestamp;
    }

    @Override
    public String toString() {
        return "DeviceChange{" +
                "changeType=" + changeType +
                ", deviceId='" + deviceId + '\'' +
                ", oldValue=" + oldValue +
                ", newValue=" + newValue +
                ", timestamp=" + timestamp +
                '}';
    }
}
