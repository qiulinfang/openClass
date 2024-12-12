package com.cosinetech.imates.model;

import java.util.ArrayList;
import java.util.List;

public class UserInfo {
    private List<String> permissionValueList = new ArrayList<>();
    private List<String> roles = new ArrayList<>();
    private String name = "";
    private String avatar = "";

    // Getters and Setters
    public List<String> getPermissionValueList() {
        return permissionValueList;
    }

    public void setPermissionValueList(List<String> permissionValueList) {
        this.permissionValueList = permissionValueList;
    }

    public List<String> getRoles() {
        return roles;
    }

    public void setRoles(List<String> roles) {
        this.roles = roles;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getAvatar() {
        return avatar;
    }

    public void setAvatar(String avatar) {
        this.avatar = avatar;
    }
}
