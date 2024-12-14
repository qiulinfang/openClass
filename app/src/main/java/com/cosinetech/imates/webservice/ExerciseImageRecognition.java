package com.cosinetech.imates.webservice;

import android.graphics.Bitmap;

import com.cosinetech.imates.model.ExerciseToAddList;

import okhttp3.MediaType;
import okhttp3.MultipartBody;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

import java.io.ByteArrayOutputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

public class ExerciseImageRecognition {
    public interface ExerciseImageRecognitionCallback {
        void onSuccess(String msg);
        void onFailure(String msg, int code);
    }

    private static final ExecutorService executor = Executors.newSingleThreadExecutor();
    public static void recognizeImage(Bitmap bitmap, String token, ExerciseImageRecognitionCallback callback) {
        Runnable task = () -> {
            try {
                ByteArrayOutputStream stream = new ByteArrayOutputStream();
                if(!bitmap.compress(Bitmap.CompressFormat.JPEG, 100, stream)) {
                    if (callback != null) {
                        callback.onFailure("", 0);
                    }
                }

                OkHttpClient client = new OkHttpClient.Builder()
                        .connectTimeout(10, TimeUnit.SECONDS)
                        .readTimeout(20, TimeUnit.SECONDS)
                        .writeTimeout(10, TimeUnit.SECONDS)
                        .build();


                // 构建请求体
                RequestBody requestBody = new MultipartBody.Builder()
                        .setType(MultipartBody.FORM)
                        .addFormDataPart("imgFile", "default.jpg",
                                RequestBody.create(stream.toByteArray(), MediaType.parse("image/jpeg")))
                        .build();

                // 构建请求
                Request request = new Request.Builder()
                        .url(EnumApiUrl.URL_QUESTION_IMAGE_RECOGNISE)
                        .addHeader("token", token)
                        .post(requestBody)
                        .build();

                // 发送请求
                try (Response response = client. newCall(request).execute()) {
                    if (response.isSuccessful()) {
                        if (callback != null && response.body() != null) {
                            callback.onSuccess(response.body().string());
                        }
                    } else {
                        if (callback != null) {
                            callback.onFailure(response.message(), response.code());
                        }
                    }
                }
            } catch (Exception e) {
                if(callback != null) {
                    callback.onFailure(e.getMessage(), 1);
                }
            }
        };

        executor.submit(task);
    }

    public static void addExerciseToList(ExerciseToAddList item, String Url, String token) {
        Runnable task = () -> {
            try {
                OkHttpClient client = new OkHttpClient();

                // 创建请求体
                RequestBody body = RequestBody.create(
                        MediaType.parse("application/json; charset=utf-8"),
                        item.toString()
                );

                // 创建请求
                Request request = new Request.Builder()
                        .url(Url) // 替换为你的 API 地址
                        .post(body)
                        .addHeader("token", token)
                        .build();

                try (Response response = client.newCall(request).execute();) {
                    if (response.isSuccessful()) {
                        // 获取响应体
                        String responseBody = response.body().string();
                        System.out.println("Response: " + responseBody);
                    } else {
                        System.out.println("Request failed: " + response.code());
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        };

        executor.submit(task);
    }
}
