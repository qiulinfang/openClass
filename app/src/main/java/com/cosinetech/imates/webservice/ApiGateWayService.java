package com.cosinetech.imates.webservice;

import android.graphics.Bitmap;

import com.cosinetech.imates.model.ExerciseToAddList;

import org.json.JSONObject;

import okhttp3.MediaType;
import okhttp3.MultipartBody;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

public class ApiGateWayService {
    public interface ExerciseImageRecognitionCallback {
        void onSuccess(String msg);
        void onFailure(String msg, int code);
    }
    public interface PostCallback {
        void onResponse(boolean success, String response);
    }

    private static final ExecutorService executor = Executors.newSingleThreadExecutor();

    public static String parseResult(String jsonString) {
        String message = "";
        try {
            JSONObject jsonObject = new JSONObject(jsonString);

            // 解析 success
            boolean success = jsonObject.getBoolean("success");
            if(success) {
                // 解析 code
                //int code = jsonObject.getInt("code");
                // 解析 message
                message = jsonObject.getString("message");

                // 解析 data
                //JSONObject dataObject = jsonObject.getJSONObject("data");
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        return message;
    }

    public static void postMessage(final MessageVO messageVO, String URL, String token, final MessagePoster.PostCallback callback) {
        ExecutorService executor = Executors.newSingleThreadExecutor();
        Runnable task = () -> {
            try {
                OkHttpClient client = new OkHttpClient();

                JSONObject json = new JSONObject();
                json.put("sessionId", messageVO.getSessionId());
                json.put("newValue", messageVO.getNewValue());
                json.put("coversation", messageVO.getCoversation());
                json.put("question", messageVO.getQuestion());
                json.put("answer", messageVO.getAnswer());
                json.put("name", messageVO.getName());
                json.put("reason", messageVO.getReason());

                RequestBody body = RequestBody.create(
                        MediaType.parse("application/json; charset=utf-8"),
                        json.toString()
                );

                Request request = new Request.Builder()
                        .url(URL)
                        .addHeader("Token", token)
                        .post(body)
                        .build();

                Response response = client.newCall(request).execute();
                if (!response.isSuccessful()) throw new IOException("Unexpected code " + response);

                // 读取响应并调用回调
                assert response.body() != null;
                final String message = parseResult(response.body().string());

                callback.onResponse(true, message);

            } catch (Exception e) {
                e.printStackTrace();
                callback.onResponse(false, e.getMessage());
            }
        };

        executor.submit(task);
    }

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
                        .url(ApiUrl.URL_QUESTION_IMAGE_RECOGNISE)
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
