package com.cosinetech.imates.screencasting.model;

/**
 * 设备信息
 */
public class DeviceLocationInfo {
    private String deviceId;
    private DeviceType type;
    private String classroom;
    private String school;
    private String city;
    private String name;

    public DeviceLocationInfo(String deviceId, DeviceType type) {
        this.deviceId = deviceId;
        this.type = type;
    }

    public String getDeviceId() {
        return deviceId;
    }

    public DeviceType getType() {
        return type;
    }

    public String getClassroom() {
        return classroom;
    }

    public void setClassroom(String classroom) {
        this.classroom = classroom;
    }

    public String getSchool() {
        return school;
    }

    public void setSchool(String school) {
        this.school = school;
    }

    public String getCity() {
        return city;
    }

    public void setCity(String city) {
        this.city = city;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    @Override
    public String toString() {
        return "DeviceLocationInfo{" +
                "deviceId='" + deviceId + '\'' +
                ", type=" + type +
                ", classroom='" + classroom + '\'' +
                ", school='" + school + '\'' +
                ", city='" + city + '\'' +
                '}';
    }
}
