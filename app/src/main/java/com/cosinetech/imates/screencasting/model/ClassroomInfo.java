package com.cosinetech.imates.screencasting.model;

import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * 教室信息
 */
public class ClassroomInfo {
    private static final String TAG = "ClassroomInfo";
    private String name;
    private String city;
    private String school;
    private List<DeviceInfo> teachers;
    private List<DeviceInfo> screens;
    private int teacherCount;
    private int screenCount;

    public static class DeviceInfo {
        private String ip;
        private String name;
        private double lastActive;

        public DeviceInfo(String ip, String name, double lastActive) {
            this.ip = ip;
            this.name = name;
            this.lastActive = lastActive;
        }

        public String getIp() {
            return ip;
        }
    }

    public ClassroomInfo(String name, String city, String school,
                         List<DeviceInfo> teachers,
                         List<DeviceInfo> screens,
                         int teacherCount,
                         int screenCount) {
        this.name = name;
        this.city = city;
        this.school = school;
        this.teachers = teachers;
        this.screens = screens;
        this.teacherCount = teacherCount;
        this.screenCount = screenCount;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getCity() {
        return city;
    }

    public void setCity(String city) {
        this.city = city;
    }

    public String getSchool() {
        return school;
    }

    public void setSchool(String school) {
        this.school = school;
    }

    public List<DeviceInfo> getTeachers() {
        return teachers;
    }

    public List<DeviceInfo> getScreens() {
        return screens;
    }

    public static ClassroomInfo parseClassroomInfo(JSONObject data) {
        try {
            if (data == null) {
                return null;
            }

            String city = data.optString("city", "");
            String school = data.optString("school", "");
            String name = data.optString("name", "");
            int teacherCount = data.optInt("teacher_count", 0);
            int screenCount = data.optInt("screen_count", 0);

            // 解析教师设备列表
            List<DeviceInfo> teachers = new ArrayList<>();
            JSONArray teachersArray = data.optJSONArray("teachers");
            if (teachersArray != null) {
                for (int i = 0; i < teachersArray.length(); i++) {
                    JSONObject teacherObj = teachersArray.optJSONObject(i);
                    if (teacherObj != null) {
                        String ip = teacherObj.optString("ip", "");
                        String teacherName = teacherObj.optString("name", "");
                        double lastActive = teacherObj.optDouble("last_active", 0);
                        teachers.add(new DeviceInfo(ip, teacherName, lastActive));
                    }
                }
            }

            // 解析大屏设备列表
            List<DeviceInfo> screens = new ArrayList<>();
            JSONArray screensArray = data.optJSONArray("screens");
            if (screensArray != null) {
                for (int i = 0; i < screensArray.length(); i++) {
                    JSONObject screenObj = screensArray.optJSONObject(i);
                    if (screenObj != null) {
                        String ip = screenObj.optString("ip", "");
                        String screenName = screenObj.optString("name", "");
                        double lastActive = screenObj.optDouble("last_active", 0);
                        screens.add(new DeviceInfo(ip, screenName, lastActive));
                    }
                }
            }

            return new ClassroomInfo(name, city, school, teachers, screens, teacherCount, screenCount);

        } catch (Exception e) {
            Log.e(TAG, "Error parsing classroom info: " + e.getMessage());
            return null;
        }
    }

    @Override
    public String toString() {
        return "ClassroomInfo{" +
                ", name='" + name + '\'' +
                ", city='" + city + '\'' +
                ", school='" + school + '\'' +
                '}';
    }
}
