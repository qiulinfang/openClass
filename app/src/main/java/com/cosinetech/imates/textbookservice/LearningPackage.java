package com.cosinetech.imates.textbookservice;

import java.util.ArrayList;
import java.util.List;

public class LearningPackage {
    public String id;
    public String sectionId;
    public String packageName;
    public String description;
    public String updateTime;
    public int isDefault;
    public String userId;
    public boolean releaseStatus;
    public int visibility;
    public String authors;
    public String tags;
    public List<ResourceFile> resourceList;

    public void eliminateNull() {
        if (id == null) id = "";
        if (sectionId == null) sectionId = "";
        if (packageName == null) packageName = "";
        if (description == null) description = "";
        if (updateTime == null) updateTime = "";
        if (userId == null) userId = "";
        if (authors == null) authors = "";
        if (tags == null) tags = "";

        // 处理 resourceList
        if (resourceList == null) {
            resourceList = new ArrayList<>();
        } else {
            // 确保列表中的每个 ResourceFile 也是安全的
            for (int i = 0; i < resourceList.size(); i++) {
                if (resourceList.get(i) == null) {
                    resourceList.set(i, new ResourceFile()); // 假设 ResourceFile 有默认构造函数
                } else {
                    // 如果 ResourceFile 也有 eliminateNull 方法
                    resourceList.get(i).eliminateNull();
                }
            }
        }
    }
}
