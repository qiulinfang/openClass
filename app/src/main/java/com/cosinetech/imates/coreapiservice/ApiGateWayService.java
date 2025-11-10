package com.cosinetech.imates.coreapiservice;

import android.graphics.Bitmap;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.widget.Toast;

import com.cosinetech.imates.ApplicationModelShared;
import com.cosinetech.imates.data.models.AddQuestionRequest;
import com.cosinetech.imates.data.models.FindSimilarQuestionRequest;
import com.cosinetech.imates.utils.AppUtils;

import org.json.JSONObject;

import okhttp3.MediaType;
import okhttp3.MultipartBody;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

public class ApiGateWayService {
    private static final int HTTP_STATE_UNAUTHORIZED = 401;
    private static final int HTTP_STATE_FORBIDDEN = 403;
    private static final ExecutorService executor = Executors.newSingleThreadExecutor();

    private static class AiResponse {
        public boolean success = false;
        public String sessionId = "";
        public String content = "";
    }

    // ========ai聊天接口========
    public interface ChatMessageCallback {
        void onChatResponse(boolean success, String response, String sessionId, String msgId);
    }

    public static OkHttpClient createClient() {
        OkHttpClient client = new OkHttpClient.Builder()
                .connectTimeout(120, TimeUnit.SECONDS)
                .readTimeout(120, TimeUnit.SECONDS)
                .writeTimeout(120, TimeUnit.SECONDS)
                .build();
        return client;
    }

    public static void fileterFailedResponse(Response response) {
        if(response.code() == HTTP_STATE_UNAUTHORIZED || response.code() == HTTP_STATE_FORBIDDEN) {
            Handler handler = new Handler(Looper.getMainLooper());
            handler.post(() -> {
                // 更新UI
                Toast.makeText(ApplicationModelShared.getInstance(), "账号已在其他设备登录!", Toast.LENGTH_LONG).show();
                AppUtils.restartApp(ApplicationModelShared.getInstance());
            });
        }
    }

    public static AiResponse parseChatMessageResult(String jsonString) {
        AiResponse res = new AiResponse();
        try {
            JSONObject jsonObject = new JSONObject(jsonString);

            // 解析 success
            boolean success = jsonObject.getBoolean("success");
            res.success = success;
            if(success) {
                // 解析 code
                //int code = jsonObject.getInt("code");
                // 解析 message
                res.content = jsonObject.getString("message");
                res.sessionId = jsonObject.getString("sessionId");
                // 解析 data
                //JSONObject dataObject = jsonObject.getJSONObject("data");
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        return res;
    }
    public static void sendChatMessage(final AiChatMessageRequest aiChatMessageRequest, String msgId, String URL, String token, final ChatMessageCallback callback) {
        Runnable task = () -> {
            try {
                OkHttpClient client = createClient();

                JSONObject json = new JSONObject();
                json.put("sessionId", aiChatMessageRequest.getSessionId());
                json.put("newValue", aiChatMessageRequest.getNewValue());
                json.put("coversation", aiChatMessageRequest.getCoversation());
                json.put("question", aiChatMessageRequest.getQuestion());
                json.put("answer", aiChatMessageRequest.getAnswer());
                json.put("name", aiChatMessageRequest.getName());
                json.put("reason", aiChatMessageRequest.getReason());
                json.put("bmNo", aiChatMessageRequest.getBmNo());
                json.put("isWebSearch", aiChatMessageRequest.getIsWebSearch());
                json.put("role", aiChatMessageRequest.getChatRole());

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
                if (!response.isSuccessful())  {
                    fileterFailedResponse(response);
                    throw new IOException("Unexpected code " + response);
                }

                // 读取响应并调用回调
                if(response.body() != null && !response.body().toString().isEmpty()) {
                    final AiResponse res = parseChatMessageResult(response.body().string());
                    callback.onChatResponse(true, res.content, res.sessionId, msgId);
                } else {
                    callback.onChatResponse(false, "接收消息失败", aiChatMessageRequest.getSessionId(), msgId);
                }
            } catch (Exception e) {
                e.printStackTrace();
                callback.onChatResponse(false, e.getMessage(), aiChatMessageRequest.getSessionId(), msgId);
            }
        };

        executor.submit(task);
    }

    // ========图像识别接口========
    public interface ExerciseRecognitionCallback {
        void onSuccess(Question q);
        void onFailure(String msg, int code);
    }

    public static void searchQuestionByKeyText(String baseUrl, String keyText, String token, ExerciseRecognitionCallback callback) {
        Runnable task = () -> {
            try {
                OkHttpClient client = createClient();

//                Uri.Builder builder = Uri.parse(baseUrl).buildUpon()
//                        .appendPath(URLEncoder.encode(keyText, "UTF-8")); // 对路径参数进行编码
//
//                String url = builder.build().toString();

                // 创建请求
                Request request = new Request.Builder()
                        .url(baseUrl + "/" + keyText)
                        .get()
                        .addHeader("token", token)
                        .build();

                // 发送请求
                try (Response response = client. newCall(request).execute()) {
                    if (response.isSuccessful()) {
                        if (callback != null && response.body() != null) {
                            QuestionImageResponse q = QuestionImageResponse.fromJson(response.body().string());
                            if(!q.data.item.questionsConfirm.isEmpty()) {
                                callback.onSuccess(q.data.item.questionsConfirm.get(0));
                            } else {
                                callback.onFailure(response.message(), response.code());
                            }
                        }
                    } else {
                        if (callback != null) {
                            callback.onFailure(response.message(), response.code());
                        }
                        fileterFailedResponse(response);
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


    public static void recognizeImage(String url, Bitmap bitmap, String token, ExerciseRecognitionCallback callback) {
        Runnable task = () -> {
            try {
                // 检查 bitmap 是否有效
                if (bitmap == null || bitmap.isRecycled()) {
                    if (callback != null) {
                        callback.onFailure("图片无效", 0);
                    }
                    return;
                }

                // 压缩图片
                ByteArrayOutputStream stream = new ByteArrayOutputStream();
                boolean compressSuccess = bitmap.compress(Bitmap.CompressFormat.JPEG, 100, stream);
                if (!compressSuccess) {
                    if (callback != null) {
                        callback.onFailure("压缩图片失败", 0);
                    }
                    return;
                }

                byte[] imageBytes = stream.toByteArray();
                if (imageBytes == null || imageBytes.length == 0) {
                    if (callback != null) {
                        callback.onFailure("图片数据为空", 0);
                    }
                    return;
                }

                android.util.Log.d("ApiGateWayService", "图片压缩成功 - 尺寸: " + bitmap.getWidth() + "x" + bitmap.getHeight() + ", 压缩后大小: " + imageBytes.length + " bytes");

                OkHttpClient client = createClient();

                // 构建请求体
                RequestBody requestBody = new MultipartBody.Builder()
                        .setType(MultipartBody.FORM)
                        .addFormDataPart("imgFile", "default.jpg",
                                RequestBody.create(imageBytes, MediaType.parse("image/jpeg")))
                        .build();

                // 构建请求
                Request request = new Request.Builder()
                        .url(url)
                        .addHeader("Token", token)
                        .post(requestBody)
                        .build();

                android.util.Log.d("ApiGateWayService", "发送图片识别请求 - URL: " + url);

                // 发送请求
                try (Response response = client.newCall(request).execute()) {
                    android.util.Log.d("ApiGateWayService", "收到响应 - 状态码: " + response.code());
                    
                    if (response.isSuccessful()) {
                        if (callback != null && response.body() != null) {
                            String responseBody = response.body().string();
                            android.util.Log.d("ApiGateWayService", "响应内容: " + responseBody);
                            
                            QuestionImageResponse q = QuestionImageResponse.fromJson(responseBody);
                            
                            // 检查响应是否成功
                            if (q.success && q.data != null && q.data.item != null && !q.data.item.questionsConfirm.isEmpty()) {
                                android.util.Log.d("ApiGateWayService", "识别成功 - 题目数量: " + q.data.item.questionsConfirm.size());
                                callback.onSuccess(q.data.item.questionsConfirm.get(0));
                            } else {
                                String errorMsg = q.message != null && !q.message.isEmpty() ? q.message : "未识别到题目";
                                android.util.Log.w("ApiGateWayService", "识别失败 - " + errorMsg + ", code: " + q.code);
                                callback.onFailure(errorMsg, q.code != 0 ? q.code : response.code());
                            }
                        } else {
                            android.util.Log.w("ApiGateWayService", "响应体为空");
                            if (callback != null) {
                                callback.onFailure("服务器响应为空", response.code());
                            }
                        }
                    } else {
                        String errorMsg = response.message();
                        android.util.Log.e("ApiGateWayService", "HTTP请求失败 - 状态码: " + response.code() + ", 错误: " + errorMsg);
                        if (callback != null) {
                            callback.onFailure(errorMsg != null ? errorMsg : "请求失败", response.code());
                        }
                        fileterFailedResponse(response);
                    }
                }
            } catch (Exception e) {
                android.util.Log.e("ApiGateWayService", "图片识别异常", e);
                if (callback != null) {
                    callback.onFailure(e.getMessage() != null ? e.getMessage() : "未知错误", 1);
                }
            }
        };

        executor.submit(task);
    }

    // ========添加习题接口========
    public static void addExerciseToList(AddQuestionRequest item, String Url, String token, AddExerciseCallback callback) {
        Runnable task = () -> {
            try {
                OkHttpClient client = createClient();

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
                        //String responseBody = response.body().string();
                        if(callback != null) {
                            callback.onSuccess();
                        }
                    } else {
                        if(callback != null) {
                            callback.onFailure(response.message(), response.code());
                        }
                        fileterFailedResponse(response);
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

    // ========查询练习题接口========
    public interface QueryExerciseListCallback {
        void onSuccess(List<Question> questions, long totalCount, long pageSize, long currentPageNo);
        void onFailure(String msg, int code);
    }

    public interface AddExerciseCallback {
        void onSuccess();
        void onFailure(String msg, int code);
    }

    /**
     * 查询题目列表 - 通过完整URL
     */
    public static void queryExerciseList(String url, String token, QueryExerciseListCallback callback) {
        Runnable task = () -> {
            try {
                Log.e("====", token);
                OkHttpClient client = createClient();

                // 创建请求
                Request request = new Request.Builder()
                        .url(url) // 完整的API地址
                        .get()
                        .addHeader("token", token)
                        .build();

                try (Response response = client.newCall(request).execute();) {
                    if (response.isSuccessful()) {
                        if (callback != null && response.body() != null) {
                            QueryQuestionListResponse q = QueryQuestionListResponse.fromJson(response.body().string());
                            if(!q.getData().getQuestionsList().isEmpty()) {
                                callback.onSuccess(q.getData().getQuestionsList(),
                                        q.getData().getQuestionsList().size(),
                                        q.getData().getQuestionsList().size(),
                                        1);
                            } else {
                                callback.onFailure(response.message(), response.code());
                            }
                        }
                    } else {
                        if (callback != null) {
                            callback.onFailure(response.message(), response.code());
                        }
                        fileterFailedResponse(response);
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

    /**
     * 查询题目列表 - 通过科目类型（语义化接口）
     */
    public static void queryExerciseListBySubject(String subjectType, String token, QueryExerciseListCallback callback) {
        String baseUrl = getBaseUrl(); // 需要添加获取baseUrl的方法
        String url;
        
        // 根据科目类型构建URL
        switch (subjectType.toLowerCase()) {
            case "math":
            case "数学":
                url = baseUrl + "/permission/selectExercises/math";
                break;
            case "biology":
            case "生物":
                url = baseUrl + "/permission/selectExercises/biology";
                break;
            default:
                if (callback != null) {
                    callback.onFailure("不支持的科目类型: " + subjectType, 400);
                }
                return;
        }
        
        // 调用原有方法
        queryExerciseList(url, token, callback);
    }
    
    /**
     * 获取基础URL（需要根据实际情况实现）
     */
    private static String getBaseUrl() {
        // 这里应该从ApiUrl类获取baseUrl
        // 暂时返回一个占位符，实际实现需要访问ApiUrl的baseUrl
        return "https://api.showcode.xyz/blw-edu-service-alc";
    }

    // ========查询相似题接口========
    public static void querySimilarExerciseList(FindSimilarQuestionRequest item, String url, String token, QueryExerciseListCallback callback) {
        Runnable task = () -> {
            try {
                OkHttpClient client = createClient();

                // 创建请求体
                RequestBody body = RequestBody.create(
                        MediaType.parse("application/json; charset=utf-8"),
                        item.toJsonString()
                );

                // 创建请求
                Request request = new Request.Builder()
                        .url(url) // 替换为你的 API 地址
                        .post(body)
                        .addHeader("Token", token)
                        .build();

                try (Response response = client.newCall(request).execute();) {
                    if (response.isSuccessful()) {
                        if (callback != null && response.body() != null) {
                            SimilarExerciseResponse q = SimilarExerciseResponse.fromJson(response.body().string());
                            if(!q.getData().getQuestions().isEmpty()) {
                                callback.onSuccess(q.getData().getQuestions(),
                                        q.getTotalCount(),
                                        q.getPageSize(),
                                        q.getPageNo());
                            } else {
                                callback.onFailure(response.message(), response.code());
                            }
                        }
                    } else {
                        if (callback != null) {
                            callback.onFailure(response.message(), response.code());
                        }
                        fileterFailedResponse(response);
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

    public interface ExerciseDeleteLister{
        void onDeleteSuccess();
        void onDeleteFailed(String msg);
    }

    public static void deleteExercise(String url, String token, ExerciseDeleteLister callback) {
        Runnable task = () -> {
            try {
                OkHttpClient client = createClient();

                // 创建请求
                Request request = new Request.Builder()
                        .url(url) // 替换为你的 API 地址
                        .delete()
                        .addHeader("token", token)
                        .build();

                try (Response response = client.newCall(request).execute();) {
                    if (response.isSuccessful()) {
                        if (callback != null) {
                            callback.onDeleteSuccess();
                        }
                    } else {
                        if (callback != null) {
                            callback.onDeleteFailed(response.body().string());
                        }
                        fileterFailedResponse(response);
                    }
                } catch (Exception e) {
                    if (callback != null) {
                        callback.onDeleteFailed(e.getMessage());
                    }
                }
            } catch (Exception e) {
                if (callback != null) {
                    callback.onDeleteFailed(e.getMessage());
                }
            }
        };

        executor.submit(task);
    }
}
