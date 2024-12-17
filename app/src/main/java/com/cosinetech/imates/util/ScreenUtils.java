package com.cosinetech.imates.util;

import android.content.Context;
import android.util.DisplayMetrics;

public class ScreenUtils {

    /**
     * 获取屏幕宽度（单位：像素）
     */
    public static int getScreenWidth(Context context) {
        DisplayMetrics displayMetrics = context.getResources().getDisplayMetrics();
        return displayMetrics.widthPixels;
    }

    /**
     * 获取屏幕高度（单位：像素）
     */
    public static int getScreenHeight(Context context) {
        DisplayMetrics displayMetrics = context.getResources().getDisplayMetrics();
        return displayMetrics.heightPixels;
    }
}
