package com.cosinetech.imates.screencasting.model;

import java.util.ArrayList;
import java.util.List;

public class ClassroomInfo {
    public List<DeviceInfo> teachers = new ArrayList<>();
    public List<DeviceInfo> screens = new ArrayList<>();
    public int teacherCount;
    public int screenCount;

    public ClassroomInfo() {}

    public String getFirstTeacherIp() {
        if (teachers.isEmpty()) return null;
        return teachers.get(0).ip;
    }

    public String getFirstScreenIp() {
        if (screens.isEmpty()) return null;
        return screens.get(0).ip;
    }
}
