package com.cosinetech.imates.screencasting.api;

import android.util.Log;

import com.cosinetech.imates.screencasting.model.ApiResponse;

import org.json.JSONException;
import org.json.JSONObject;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.MediaType;

/**
 * 设备API客户端 - 基于OkHttp
 * 负责所有HTTP通信，不做业务逻辑处理
 */
public class DeviceApiClient {
    private static final String TAG = "DeviceApiClient";
    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");

    private final String baseUrl;
    private final OkHttpClient httpClient;

    /**
     * 构造函数
     * @param baseUrl API服务器地址（如 http://192.168.1.100:8080）
     */
    public DeviceApiClient(String baseUrl) {
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        this.httpClient = new OkHttpClient();
    }

    /**
     * 构造函数 - 支持指定IP和端口
     * @param host 服务器IP或域名
     * @param port 端口号
     * @param useHttps 是否使用HTTPS
     */
    public DeviceApiClient(String host, int port, boolean useHttps) {
        String protocol = useHttps ? "https" : "http";
        this.baseUrl = String.format("%s://%s:%d", protocol, host, port);
        this.httpClient = new OkHttpClient();
    }

    /**
     * 注册设备
     */
    public ApiResponse register(String deviceId, String type, String city, 
                               String school, String classroom) {
        try {
            JSONObject body = new JSONObject();
            body.put("device_id", deviceId);
            body.put("type", type);
            body.put("city", city);
            body.put("school", school);
            body.put("classroom", classroom);

            return postRequest("/register", body);
        } catch (JSONException e) {
            Log.e(TAG, "Error creating register request", e);
            return ApiResponse.error("JSON_ERROR", e.getMessage());
        }
    }

    /**
     * 心跳
     */
    public ApiResponse heartbeat(String deviceId, String type) {
        try {
            JSONObject body = new JSONObject();
            body.put("device_id", deviceId);
            body.put("type", type);

            return postRequest("/heartbeat", body);
        } catch (JSONException e) {
            Log.e(TAG, "Error creating heartbeat request", e);
            return ApiResponse.error("JSON_ERROR", e.getMessage());
        }
    }

    /**
     * 查询所有教室（树状结构）
     */
    public ApiResponse getAllClassrooms() {
        return getRequest("/all_classrooms");
    }

    /**
     * 查询某学校的所有教室
     */
    public ApiResponse getClassroomsBySchool(String city, String school) {
        return getRequest("/classrooms?city=" + city + "&school=" + school);
    }

    /**
     * 查询具体教室详情
     */
    public ApiResponse getClassroomDetail(String city, String school, String classroom) {
        return getRequest("/classroom?city=" + city + "&school=" + school + "&classroom=" + classroom);
    }

    /**
     * 查询服务器状态
     */
    public ApiResponse getStatus() {
        return getRequest("/status");
    }

    /**
     * GET请求
     */
    private ApiResponse getRequest(String path) {
        try {
            String url = baseUrl + path;
            Request request = new Request.Builder()
                    .url(url)
                    .build();

            Response response = httpClient.newCall(request).execute();
            return parseResponse(response);
        } catch (Exception e) {
            Log.e(TAG, "GET request failed: " + path, e);
            return ApiResponse.error("NETWORK_ERROR", e.getMessage());
        }
    }

    /**
     * POST请求
     */
    private ApiResponse postRequest(String path, JSONObject body) {
        try {
            String url = baseUrl + path;
            RequestBody requestBody = RequestBody.create(body.toString(), JSON);
            Request request = new Request.Builder()
                    .url(url)
                    .post(requestBody)
                    .build();

            Response response = httpClient.newCall(request).execute();
            return parseResponse(response);
        } catch (Exception e) {
            Log.e(TAG, "POST request failed: " + path, e);
            return ApiResponse.error("NETWORK_ERROR", e.getMessage());
        }
    }

    /**
     * 解析响应
     */
    private ApiResponse parseResponse(Response response) {
        try {
            String responseBody = response.body() != null ? response.body().string() : "{}";
            JSONObject jsonObject = new JSONObject(responseBody);

            String code = jsonObject.optString("status", "");
            String msg = jsonObject.optString("message", "");
            JSONObject data = jsonObject.optJSONObject("classroom");

            boolean success = response.isSuccessful() && "success".equals(code);

            Log.d(TAG, "Response code: " + code + ", msg: " + msg);

            if (success) {
                return ApiResponse.success(data);
            } else {
                return ApiResponse.error(code, msg);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error parsing response", e);
            return ApiResponse.error("PARSE_ERROR", e.getMessage());
        }
    }
}
