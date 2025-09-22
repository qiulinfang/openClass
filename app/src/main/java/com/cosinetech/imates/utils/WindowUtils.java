package com.cosinetech.imates.utils;

import android.app.Activity;
import android.content.pm.ActivityInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;

public class WindowUtils {
    public static void hideSystemUI(Activity activity) {
        // 设置全屏模式并隐藏系统UI元素
        View decorView = activity.getWindow().getDecorView();
        decorView.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN);
    }

    public static void setFullScreenMode(Activity activity) {
        // 设置全屏模式
        activity.requestWindowFeature(Window.FEATURE_NO_TITLE);
        activity.getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN);

        // 隐藏系统导航栏
        WindowUtils.hideSystemUI(activity);
        activity.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE);

        // 设置全屏并不遮挡导航栏
        View decorView = activity.getWindow().getDecorView();
        decorView.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
        );
    }

    /**
     *此方法直接截取屏幕指定view区域的内容
     * @param view 需要截取屏幕的图片view
     * @return Bitmap
     */
    public static Bitmap getScreenshot2Bitmap(Activity activity, View view) {
        View screenView = activity.getWindow().getDecorView();
        screenView.setDrawingCacheEnabled(true);
        screenView.buildDrawingCache();
        //获取屏幕整张图片
        Bitmap screenBitmap = screenView.getDrawingCache();
        Bitmap bitmap = null;
        if (screenBitmap != null) {
            //需要截取的长和宽
            int outWidth = view.getWidth();
            int outHeight = view.getHeight();
            //获取需要截图部分的在屏幕上的坐标(view的左上角坐标）
            int[] viewLocationArray = new int[2];
            view.getLocationOnScreen(viewLocationArray);
            //从屏幕截图中截取指定区域
            bitmap = Bitmap.createBitmap(screenBitmap, viewLocationArray[0], viewLocationArray[1], outWidth, outHeight);
            view.setDrawingCacheEnabled(false);
        }
        //记得加上，不然重复生成时 返回的还是第一次生成的bitmap截图
        screenView.destroyDrawingCache();
        return bitmap ;
    }

    public static Bitmap getScreenshot2BitmapV2(Activity activity, View view) {
        // 获取屏幕内容到 Bitmap
        View screenView = activity.getWindow().getDecorView();
        Bitmap screenBitmap = Bitmap.createBitmap(screenView.getWidth(), screenView.getHeight(), Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(screenBitmap);
        screenView.draw(canvas);

        // 获取 View 的坐标和大小
        int outWidth = view.getWidth();
        int outHeight = view.getHeight();
        int[] viewLocationArray = new int[2];
        view.getLocationOnScreen(viewLocationArray);

        // 截取部分屏幕内容
        int x = viewLocationArray[0];
        int y = viewLocationArray[1];
        if (x + outWidth > screenBitmap.getWidth()) outWidth = screenBitmap.getWidth() - x;
        if (y + outHeight > screenBitmap.getHeight()) outHeight = screenBitmap.getHeight() - y;

        if (x < 0 || y < 0 || outWidth <= 0 || outHeight <= 0) {
            // 无效区域，返回 null
            return null;
        }

        return Bitmap.createBitmap(screenBitmap, x, y, outWidth, outHeight);
    }

}
