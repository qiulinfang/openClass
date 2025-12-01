package com.cosinetech.imates.screencasting.model;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

/**
 * 教室树状结构
 * 用于管理城市->学校->教室的层级关系
 */
public class ClassroomTree {
    private Map<String, Map<String, List<ClassroomInfo>>> tree = new HashMap<>();

    /**
     * 从API响应数据构建树
     */
    public static ClassroomTree fromApiResponse(JSONObject data) {
        ClassroomTree tree = new ClassroomTree();
        
        try {
            JSONObject citiesObj = data.getJSONObject("cities");

            for (Iterator<String> it = citiesObj.keys(); it.hasNext(); ) {
                String cityName = it.next();
                JSONObject cityData = citiesObj.getJSONObject(cityName);
                JSONObject schoolsObj = cityData.getJSONObject("schools");

                Map<String, List<ClassroomInfo>> schoolMap = new HashMap<>();

                for (Iterator<String> iter = schoolsObj.keys(); iter.hasNext(); ) {
                    String schoolName = iter.next();
                    JSONArray classroomsArray = schoolsObj.getJSONArray(schoolName);
                    List<ClassroomInfo> classroomList = new ArrayList<>();

                    for (int i = 0; i < classroomsArray.length(); i++) {
                        JSONObject classroomObj = classroomsArray.getJSONObject(i);
                        ClassroomInfo info = new ClassroomInfo(
                                classroomObj.getString("id"),
                                classroomObj.getString("name"),
                                cityName,
                                schoolName,
                                classroomObj.optString("description", ""),
                                classroomObj.optInt("capacity", 0)
                        );
                        classroomList.add(info);
                    }

                    schoolMap.put(schoolName, classroomList);
                }

                tree.tree.put(cityName, schoolMap);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        
        return tree;
    }

    /**
     * 获取所有城市
     */
    public List<String> getCities() {
        return new ArrayList<>(tree.keySet());
    }

    /**
     * 获取某城市的所有学校
     */
    public List<String> getSchools(String city) {
        if (tree.containsKey(city)) {
            return new ArrayList<>(tree.get(city).keySet());
        }
        return new ArrayList<>();
    }

    /**
     * 获取某学校的所有教室
     */
    public List<ClassroomInfo> getClassrooms(String city, String school) {
        if (tree.containsKey(city) && tree.get(city).containsKey(school)) {
            return new ArrayList<>(tree.get(city).get(school));
        }
        return new ArrayList<>();
    }

    /**
     * 获取教室信息
     */
    public ClassroomInfo getClassroomInfo(String city, String school, String classroomId) {
        List<ClassroomInfo> classrooms = getClassrooms(city, school);
        for (ClassroomInfo classroom : classrooms) {
            if (classroom.getId().equals(classroomId)) {
                return classroom;
            }
        }
        return null;
    }

    /**
     * 清空树
     */
    public void clear() {
        tree.clear();
    }

    public boolean isEmpty() {
        return tree.isEmpty();
    }
}
