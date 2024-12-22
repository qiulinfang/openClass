package com.cosinetech.imates.util;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.AssetManager;
import android.util.Log;

import java.io.Closeable;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;

public class AssetsCopyUtils {
    private static final String PREFS_NAME = "FileCopyPrefs";
    private static final String KEY_FILE_VERSION = "file_version";
    private static final String CURRENT_VERSION = "1.0"; // 当前文件版本号

    public static void copyAssetsToDocuments(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String savedVersion = prefs.getString(KEY_FILE_VERSION, "");

        if (CURRENT_VERSION.equals(savedVersion)) {
            return; // 版本未变化，跳过拷贝
        }

        AssetManager assetManager = context.getAssets();
        try {
            copyAssetFiles(context, assetManager, "");

            prefs.edit()
                    .putString(KEY_FILE_VERSION, CURRENT_VERSION)
                    .apply(); // 更新版本号

        } catch (IOException e) {
            Log.e("FileCopyUtil", "Error copying assets: " + e.getMessage());
        }
    }

    private static void copyAssetFiles(Context context, AssetManager assetManager, String path) throws IOException {
        String[] files = assetManager.list(path);
        for (String filename : files) {
            String fullPath = path.isEmpty() ? filename : path + "/" + filename;
            if (assetManager.list(fullPath).length > 0) { // 如果是目录
                copyAssetFiles(context, assetManager, fullPath); // 递归复制子目录
            } else {
                copyFile(context, assetManager, fullPath);
            }
        }
    }

    private static void copyFile(Context context, AssetManager assetManager, String filename) throws IOException {
        File outFile = new File(context.getExternalFilesDir(null), filename);
        if (outFile.exists() && outFile.length() > 0) {
            Log.i("FileCopyUtil", "File already exists, skipping: " + filename);
            return;
        }

        File parent = outFile.getParentFile();
        if (!parent.exists() && !parent.mkdirs()) {
            throw new IOException("Failed to create directories for file: " + filename);
        }

        InputStream in = null;
        FileOutputStream out = null;
        try {
            in = assetManager.open(filename);
            out = new FileOutputStream(outFile);

            byte[] buffer = new byte[8192];
            int read;
            while ((read = in.read(buffer)) != -1) {
                out.write(buffer, 0, read);
            }
            out.flush();

            Log.i("FileCopyUtil", "Copied file: " + filename + " to " + outFile.getAbsolutePath());
        } finally {
            closeStream(in);
            closeStream(out);
        }
    }

    private static void closeStream(Closeable stream) {
        if (stream != null) {
            try {
                stream.close();
            } catch (IOException e) {
                Log.w("FileCopyUtil", "Failed to close stream: " + e.getMessage());
            }
        }
    }
}
