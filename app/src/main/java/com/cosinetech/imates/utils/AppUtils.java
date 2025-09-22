package com.cosinetech.imates.utils;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.MediaStore;
import android.util.Log;

import androidx.lifecycle.ViewModelProvider;
import androidx.lifecycle.ViewModelStoreOwner;

import com.cosinetech.imates.ApplicationModelShared;
import com.cosinetech.imates.data.models.UserInfoViewModel;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

public class AppUtils {
    public static void restartApp(Context context) {
        Intent intent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (intent != null) {
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        }

        PendingIntent restartIntent = PendingIntent.getActivity(
                context,
                0,
                intent,
                PendingIntent.FLAG_CANCEL_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager != null) {
            alarmManager.set(
                    AlarmManager.RTC,
                    System.currentTimeMillis() + 3000, // 延迟 1 秒
                    restartIntent
            );
        }

        // 结束当前进程
        android.os.Process.killProcess(android.os.Process.myPid());
        System.exit(0);
    }
    public static String getUserId() {
        UserInfoViewModel userInfoViewModel = new ViewModelProvider(
                ApplicationModelShared.getInstance(),
                new ViewModelProvider.AndroidViewModelFactory(ApplicationModelShared.getInstance())
        ).get(UserInfoViewModel.class);
        return userInfoViewModel.userId.getValue();
    }

    public static String getUserPassword() {
        UserInfoViewModel userInfoViewModel = new ViewModelProvider(
                ApplicationModelShared.getInstance(),
                new ViewModelProvider.AndroidViewModelFactory(ApplicationModelShared.getInstance())
        ).get(UserInfoViewModel.class);
        return userInfoViewModel.password.getValue();
    }

    public static String getUserNickName() {
        UserInfoViewModel userInfoViewModel = new ViewModelProvider(
                ApplicationModelShared.getInstance(),
                new ViewModelProvider.AndroidViewModelFactory(ApplicationModelShared.getInstance())
        ).get(UserInfoViewModel.class);
        if(userInfoViewModel.userInfo.getValue() != null) {
            return userInfoViewModel.userInfo.getValue().getName();
        } else {
            return "";
        }
    }

    public static File getUserFilePath() {
        ViewModelStoreOwner owner = ApplicationModelShared.getInstance();
        UserInfoViewModel userInfoViewModel = new ViewModelProvider(
                owner,
                new ViewModelProvider.AndroidViewModelFactory(ApplicationModelShared.getInstance())
        ).get(UserInfoViewModel.class);

        return userInfoViewModel.userPath.getValue();
    }

    /**
     * 根据路径删除图片
     *
     * @param path
     */
    public static void deleteTempFile(String path) {
        File file = new File(path);
        if (file.exists()) {
            file.delete();
        }
    }

    public String getRealPathFromURI(Context context, Uri uri) {
        String[] projection = {MediaStore.Images.Media.DATA};
        Cursor cursor = context.getContentResolver().query(uri, projection, null, null, null);
        if (cursor != null) {
            int columnIndex = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DATA);
            cursor.moveToFirst();
            String path = cursor.getString(columnIndex);
            cursor.close();
            return path;
        }
        return uri.toString();
    }

    public static boolean copyImageToExternalFilesDir(Context context, Uri imageUri, String filePath) {
        File destinationFile = new File(filePath);

        try (InputStream inputStream = context.getContentResolver().openInputStream(imageUri);
             OutputStream outputStream = new FileOutputStream(destinationFile)) {

            if (inputStream == null) {
                Log.e("CopyImage", "Failed to open input stream.");
                return false;
            }

            byte[] buffer = new byte[8192];
            int bytesRead;
            while ((bytesRead = inputStream.read(buffer)) != -1) {
                outputStream.write(buffer, 0, bytesRead);
            }

            Log.d("CopyImage", "Image copied to: " + destinationFile.getAbsolutePath());
            return true;

        } catch (IOException e) {
            Log.e("CopyImage", "Error copying image: " + e.getMessage());
            return false;
        }
    }
}
