package com.cosinetech.imates.webservice;

import okhttp3.*;
import org.json.JSONObject;

import java.io.IOException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MessagePoster {
    public interface PostCallback {
        void onResponse(boolean success, String response);
    }

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

    public static void postMessage(final MessageVO messageVO, String URL, String token, final PostCallback callback) {
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

}
