package com.cosinetech.imates.ui.activities;

public class TabItemAttribute {
    private final String title;  // Tab 的文本
    private final int iconResId; // Tab 的图标资源 ID

    // 构造函数
    public TabItemAttribute(String title, int iconResId) {
        this.title = title;
        this.iconResId = iconResId;
    }

    // Getter 方法
    public String getTitle() {
        return title;
    }

    public int getIconResId() {
        return iconResId;
    }
}
