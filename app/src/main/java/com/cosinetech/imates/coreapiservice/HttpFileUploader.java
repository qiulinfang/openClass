package com.cosinetech.imates.coreapiservice;

import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Log;
import androidx.annotation.NonNull;
import okhttp3.*;

import java.io.IOException;
import java.io.InputStream;

public class HttpFileUploader {
    private static final String TAG = "FileUploader";
    private static final String UPLOAD_URL = ApiUrl.URL_RESOURCE_BASE + "/upload";

    public interface UploadCallback {
        void onSuccess(String message);
        void onFailure(String error);
    }

    public static void uploadFile(Context context, Uri fileUri, String remoteName, UploadCallback callback) {
        OkHttpClient client = new OkHttpClient();
        try {
            // 获取文件名
            //String fileName = getFileName(context, fileUri);

            // 创建MultipartBody
            RequestBody requestBody = new MultipartBody.Builder()
                    .setType(MultipartBody.FORM)
                    .addFormDataPart("file", remoteName,
                            RequestBody.create(getBytes(context, fileUri),
                                    MediaType.parse(context.getContentResolver().getType(fileUri))))
                    .build();

            // 创建请求
            Request request = new Request.Builder()
                    .url(UPLOAD_URL)
                    .post(requestBody)
                    .build();

            // 执行请求
            client.newCall(request).enqueue(new Callback() {
                @Override
                public void onFailure(@NonNull Call call, @NonNull IOException e) {
                    Log.e(TAG, "Upload failed: " + e.getMessage());
                    callback.onFailure("Upload failed: " + e.getMessage());
                }

                @Override
                public void onResponse(@NonNull Call call, @NonNull Response response) throws IOException {
                    if (response.isSuccessful()) {
                        String responseBody = response.body().string();
                        Log.d(TAG, "Upload successful: " + responseBody);
                        callback.onSuccess("File uploaded successfully");
                    } else {
                        Log.e(TAG, "Upload failed: " + response.code());
                        callback.onFailure("Upload failed: " + response.code());
                    }
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "Error preparing upload: " + e.getMessage());
            callback.onFailure("Error preparing upload: " + e.getMessage());
        }
    }

    private static String getFileName(Context context, Uri uri) {
        String result = null;
        if (uri.getScheme().equals("content")) {
            try (Cursor cursor = context.getContentResolver().query(uri, null, null, null, null)) {
                if (cursor != null && cursor.moveToFirst()) {
                    result = cursor.getString(cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME));
                }
            }
        }
        if (result == null) {
            result = uri.getPath();
            int cut = result.lastIndexOf('/');
            if (cut != -1) {
                result = result.substring(cut + 1);
            }
        }
        return result;
    }

    private static byte[] getBytes(Context context, Uri uri) throws IOException {
        InputStream inputStream = context.getContentResolver().openInputStream(uri);
        byte[] bytes = new byte[inputStream.available()];
        inputStream.read(bytes);
        return bytes;
    }
}
