package com.cosinetech.imates.screencasting.model;

/**
 * 设备类型枚举
 */
public enum DeviceType {
    TEACHER("teacher"),
    SCREEN("screen"),
    STUDENT("student");

    private final String value;

    DeviceType(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    public static DeviceType fromString(String value) {
        for (DeviceType type : DeviceType.values()) {
            if (type.value.equalsIgnoreCase(value)) {
                return type;
            }
        }
        return null;
    }
}
