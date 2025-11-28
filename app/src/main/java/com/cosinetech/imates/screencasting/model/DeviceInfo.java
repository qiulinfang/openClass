package com.cosinetech.imates.screencasting.model;

import androidx.annotation.Nullable;

public class DeviceInfo {
    public String city;
    public String school;
    @Nullable
    public String classroom; // may be null initially for teacher
    public String ip;
    public String type;   // teacher / screen / student
    public String name;

    public DeviceInfo() {}

    public DeviceInfo(String city, String school, String classroom, String ip, String type, String name) {
        this.city = city;
        this.school = school;
        this.classroom = classroom;
        this.ip = ip;
        this.type = type;
        this.name = name;
    }
}
