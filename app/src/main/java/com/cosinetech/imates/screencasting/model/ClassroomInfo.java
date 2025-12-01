package com.cosinetech.imates.screencasting.model;

/**
 * 教室信息
 */
public class ClassroomInfo {
    private String id;
    private String name;
    private String city;
    private String school;
    private String description;
    private int capacity;

    public ClassroomInfo(String id, String name, String city, String school, 
                         String description, int capacity) {
        this.id = id;
        this.name = name;
        this.city = city;
        this.school = school;
        this.description = description;
        this.capacity = capacity;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
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

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public int getCapacity() {
        return capacity;
    }

    public void setCapacity(int capacity) {
        this.capacity = capacity;
    }

    @Override
    public String toString() {
        return "ClassroomInfo{" +
                "id='" + id + '\'' +
                ", name='" + name + '\'' +
                ", city='" + city + '\'' +
                ", school='" + school + '\'' +
                '}';
    }
}
