package com.cosinetech.imates.screencasting.core;

import android.util.Log;

import com.cosinetech.imates.screencasting.model.ClassroomInfo;
import com.cosinetech.imates.screencasting.model.ClassroomTree;
import org.json.JSONObject;

/**
 * 教室管理器 - 管理教室选择和树状结构
 * 负责城市、学校、教室的选择和验证
 */
public class ClassroomManager {
    private static final String TAG = "ClassroomManager";

    private ClassroomTree classroomTree;
    private String selectedCity;
    private String selectedSchool;
    private ClassroomInfo selectedClassroom;

    public ClassroomManager() {
        this.classroomTree = new ClassroomTree();
    }

    /**
     * 设置教室树数据
     */
    public void setClassroomTreeData(JSONObject treeData) {
        classroomTree = ClassroomTree.fromApiResponse(treeData);
        Log.d(TAG, "Classroom tree data updated. Cities count: " + classroomTree.getCities().size());
    }

    /**
     * 选择城市
     */
    public boolean selectCity(String city) {
        if (classroomTree.getCities().contains(city)) {
            this.selectedCity = city;
            this.selectedSchool = null; // 重置学校选择
            this.selectedClassroom = null; // 重置教室选择
            Log.d(TAG, "City selected: " + city);
            return true;
        } else {
            Log.w(TAG, "City not found: " + city);
            return false;
        }
    }

    /**
     * 选择学校
     */
    public boolean selectSchool(String school) {
        if (selectedCity == null) {
            Log.w(TAG, "Please select city first");
            return false;
        }

        if (classroomTree.getSchools(selectedCity).contains(school)) {
            this.selectedSchool = school;
            this.selectedClassroom = null; // 重置教室选择
            Log.d(TAG, "School selected: " + school);
            return true;
        } else {
            Log.w(TAG, "School not found: " + school);
            return false;
        }
    }

    /**
     * 选择教室
     */
    public boolean selectClassroom(String classroomId) {
        if (selectedCity == null || selectedSchool == null) {
            Log.w(TAG, "Please select city and school first");
            return false;
        }

        ClassroomInfo classroom = classroomTree.getClassroomInfo(selectedCity, selectedSchool, classroomId);
        if (classroom != null) {
            this.selectedClassroom = classroom;
            Log.d(TAG, "Classroom selected: " + classroom.getName());
            return true;
        } else {
            Log.w(TAG, "Classroom not found: " + classroomId);
            return false;
        }
    }

    /**
     * 直接设置城市、学校、教室（用于批量设置）
     * @return 是否设置成功
     */
    public boolean setLocation(String city, String school, String classroomId) {
        if (!selectCity(city)) {
            return false;
        }
        if (!selectSchool(school)) {
            return false;
        }
        if (classroomId != null && !classroomId.isEmpty()) {
            if (!selectClassroom(classroomId)) {
                return false;
            }
        }
        return true;
    }

    /**
     * 获取所有城市列表
     */
    public java.util.List<String> getCities() {
        return classroomTree.getCities();
    }

    /**
     * 获取当前选中城市的所有学校
     */
    public java.util.List<String> getSchools() {
        if (selectedCity == null) {
            return new java.util.ArrayList<>();
        }
        return classroomTree.getSchools(selectedCity);
    }

    /**
     * 获取当前选中学校的所有教室
     */
    public java.util.List<ClassroomInfo> getClassrooms() {
        if (selectedCity == null || selectedSchool == null) {
            return new java.util.ArrayList<>();
        }
        return classroomTree.getClassrooms(selectedCity, selectedSchool);
    }

    /**
     * 获取选中的城市
     */
    public String getSelectedCity() {
        return selectedCity;
    }

    /**
     * 获取选中的学校
     */
    public String getSelectedSchool() {
        return selectedSchool;
    }

    /**
     * 获取选中的教室
     */
    public ClassroomInfo getSelectedClassroom() {
        return selectedClassroom;
    }

    /**
     * 获取选中的教室ID
     */
    public String getSelectedClassroomId() {
        return selectedClassroom != null ? selectedClassroom.getId() : null;
    }

    /**
     * 检查选择是否完整
     */
    public boolean isLocationSelected() {
        return selectedCity != null && selectedSchool != null && selectedClassroom != null;
    }

    /**
     * 重置所有选择
     */
    public void reset() {
        selectedCity = null;
        selectedSchool = null;
        selectedClassroom = null;
        Log.d(TAG, "Location selection reset");
    }

    /**
     * 清空树数据
     */
    public void clear() {
        classroomTree.clear();
        reset();
        Log.d(TAG, "ClassroomManager cleared");
    }
}
