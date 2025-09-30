package com.cosinetech.imates.coreapiservice;

import android.graphics.Bitmap;
import android.os.Handler;
import android.os.Looper;
import android.widget.Toast;

import com.cosinetech.imates.ApplicationModelShared;
import com.cosinetech.imates.data.models.AddQuestionRequest;
import com.cosinetech.imates.data.models.FindSimilarQuestionRequest;
import com.cosinetech.imates.network.UnsafeOkHttpClient;
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
                json.put("subject", aiChatMessageRequest.getSubject());

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
                ByteArrayOutputStream stream = new ByteArrayOutputStream();
                if(!bitmap.compress(Bitmap.CompressFormat.JPEG, 100, stream)) {
                    if (callback != null) {
                        callback.onFailure("压缩图片失败", 0);
                    }
                }

                OkHttpClient client = createClient();


                // 构建请求体
                RequestBody requestBody = new MultipartBody.Builder()
                        .setType(MultipartBody.FORM)
                        .addFormDataPart("imgFile", "default.jpg",
                                RequestBody.create(stream.toByteArray(), MediaType.parse("image/jpeg")))
                        .build();

                // 构建请求
                Request request = new Request.Builder()
                        .url(url)
                        .addHeader("token", token)
                        .post(requestBody)
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

    public interface QueryKnowledgeIdCallback {
        void onSuccess(String ids);
        void onFailure(String msg, int code);
    }

    public static void queryExerciseList(String url, String token, QueryExerciseListCallback callback) {
        Runnable task = () -> {
            try {
                OkHttpClient client = createClient();

                // 创建请求
                Request request = new Request.Builder()
                        .url(url) // 替换为你的 API 地址
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

    public static void queryKnowledgeIdsByNodeId(String url, String reqBody, QueryKnowledgeIdCallback callback) {
        Runnable task = () -> {
            try {
                OkHttpClient client = UnsafeOkHttpClient.getUnsafeOkHttpClient(); // 你已有的方法，跳过证书验证

                // 创建请求体
                RequestBody body = RequestBody.create(
                        MediaType.parse("application/json; charset=utf-8"),
                        reqBody
                );
                Request request = new Request.Builder()
                        .url(url)
                        .post(body)
                        .build();

                try (Response response = client.newCall(request).execute();) {
                    if (response.isSuccessful()) {
                        if (callback != null && response.body() != null) {
                            int code = response.code();

                            String respBody = response.body().string();

                            // 假设返回 JSON 结构如下：
                            // {"success":true,"subject":"math","knowledge":"KN001,KN002"}
                            try {
                                com.google.gson.JsonObject json = new com.google.gson.JsonParser()
                                        .parse(respBody)
                                        .getAsJsonObject();
                                boolean success = json.get("success").getAsBoolean();
                                if (success) {
                                    String ids = json.get("knowledge").getAsString();
                                    callback.onSuccess(ids);
                                } else {
                                    callback.onFailure("查询知识点失败", code);
                                }
                            } catch (Exception e) {
                                callback.onFailure("解析响应失败: " + e.getMessage(), code);
                            }
                        }
                    } else {
                        if (callback != null) {
                            callback.onFailure(response.message(), response.code());
                        }
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
