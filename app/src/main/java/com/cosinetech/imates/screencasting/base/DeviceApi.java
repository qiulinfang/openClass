package com.cosinetech.imates.screencasting.base;

import android.os.Handler;
import android.os.Looper;

import com.cosinetech.imates.screencasting.model.DeviceInfo;

import com.google.gson.Gson;
import com.google.gson.JsonObject;

import java.io.IOException;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

/**
 * Minimal DeviceApi using OkHttp and Gson. All callbacks are posted on main thread.
 */
public class DeviceApi {
    private final OkHttpClient client;
    private final String baseUrl;
    private final Gson gson = new Gson();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    public interface ApiCallback<T> {
        void onSuccess(T result);
        void onFailure(int httpCode, String errorBody, Throwable t);
    }

    public DeviceApi(String baseUrl) {
        this(baseUrl, new OkHttpClient());
    }

    public DeviceApi(String baseUrl, OkHttpClient client) {
        this.baseUrl = baseUrl;
        this.client = client;
    }

    private String url(String path) {
        if (baseUrl.endsWith("/")) return baseUrl + path;
        return baseUrl + "/" + path;
    }

    // POST /register
    public void postRegister(DeviceInfo info, final ApiCallback<JsonObject> cb) {
        String json = gson.toJson(info);
        RequestBody body = RequestBody.create(json, MediaType.parse("application/json; charset=utf-8"));
        Request req = new Request.Builder().url(url("register")).post(body).build();
        client.newCall(req).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                postFailure(cb, -1, null, e);
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                String s = response.body() != null ? response.body().string() : null;
                if (!response.isSuccessful()) {
                    postFailure(cb, response.code(), s, null);
                    return;
                }
                JsonObject obj = gson.fromJson(s, JsonObject.class);
                postSuccess(cb, obj);
            }
        });
    }

    // POST /heartbeat
    public void postHeartbeat(DeviceInfo info, final ApiCallback<JsonObject> cb) {
        String json = gson.toJson(info);
        RequestBody body = RequestBody.create(json, MediaType.parse("application/json; charset=utf-8"));
        Request req = new Request.Builder().url(url("heartbeat")).post(body).build();
        client.newCall(req).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                postFailure(cb, -1, null, e);
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                String s = response.body() != null ? response.body().string() : null;
                if (!response.isSuccessful()) {
                    postFailure(cb, response.code(), s, null);
                    return;
                }
                JsonObject obj = gson.fromJson(s, JsonObject.class);
                postSuccess(cb, obj);
            }
        });
    }

    // GET /classroom?city=...&school=...&classroom=...
    public void getClassroom(String city, String school, String classroom, final ApiCallback<JsonObject> cb) {
        String path = String.format("classroom?city=%s&school=%s&classroom=%s", encode(city), encode(school), encode(classroom));
        Request req = new Request.Builder().url(url(path)).get().build();
        client.newCall(req).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                postFailure(cb, -1, null, e);
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                String s = response.body() != null ? response.body().string() : null;
                if (!response.isSuccessful()) {
                    postFailure(cb, response.code(), s, null);
                    return;
                }
                JsonObject obj = gson.fromJson(s, JsonObject.class);
                postSuccess(cb, obj);
            }
        });
    }

    // GET /classrooms?city=...&school=...
    public void getClassrooms(String city, String school, final ApiCallback<JsonObject> cb) {
        String path = String.format("classrooms?city=%s&school=%s", encode(city), encode(school));
        Request req = new Request.Builder().url(url(path)).get().build();
        client.newCall(req).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                postFailure(cb, -1, null, e);
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                String s = response.body() != null ? response.body().string() : null;
                if (!response.isSuccessful()) {
                    postFailure(cb, response.code(), s, null);
                    return;
                }
                JsonObject obj = gson.fromJson(s, JsonObject.class);
                postSuccess(cb, obj);
            }
        });
    }

    // GET /status
    public void getStatus(final ApiCallback<JsonObject> cb) {
        Request req = new Request.Builder().url(url("status")).get().build();
        client.newCall(req).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                postFailure(cb, -1, null, e);
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                String s = response.body() != null ? response.body().string() : null;
                if (!response.isSuccessful()) {
                    postFailure(cb, response.code(), s, null);
                    return;
                }
                JsonObject obj = gson.fromJson(s, JsonObject.class);
                postSuccess(cb, obj);
            }
        });
    }

    private void postSuccess(final ApiCallback cb, final Object result) {
        mainHandler.post(new Runnable() {
            @Override
            public void run() {
                cb.onSuccess(result);
            }
        });
    }

    private void postFailure(final ApiCallback cb, final int httpCode, final String body, final Throwable t) {
        mainHandler.post(new Runnable() {
            @Override
            public void run() {
                cb.onFailure(httpCode, body, t);
            }
        });
    }

    private String encode(String s) {
        if (s == null) return "";
        return s.replace(" ", "%20");
    }
}
