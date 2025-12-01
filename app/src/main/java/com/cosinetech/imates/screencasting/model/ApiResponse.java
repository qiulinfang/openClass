package com.cosinetech.imates.screencasting.model;

import org.json.JSONObject;

/**
 * API响应封装
 */
public class ApiResponse {
    private boolean success;
    private String code;
    private String msg;
    private JSONObject data;

    public ApiResponse(boolean success, String code, String msg, JSONObject data) {
        this.success = success;
        this.code = code;
        this.msg = msg;
        this.data = data;
    }

    public static ApiResponse success(JSONObject data) {
        return new ApiResponse(true, "0", "OK", data);
    }

    public static ApiResponse error(String code, String msg) {
        return new ApiResponse(false, code, msg, null);
    }

    public boolean isSuccess() {
        return success;
    }

    public String getCode() {
        return code;
    }

    public String getMsg() {
        return msg;
    }

    public JSONObject getData() {
        return data;
    }

    public String getDataAsString() {
        return data != null ? data.toString() : null;
    }
}
