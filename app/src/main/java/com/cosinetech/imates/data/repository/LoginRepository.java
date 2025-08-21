package com.cosinetech.imates.data.repository;

import com.cosinetech.imates.data.models.UserInfo;
import com.cosinetech.imates.coreapiservice.ApiUrl;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import org.json.JSONObject;

public class LoginRepository {
    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");

    private final OkHttpClient client;
    public LoginRepository() {
        this.client = new OkHttpClient();
    }

    public String login(String account, String password) throws Exception {
        JSONObject json = new JSONObject();
        json.put("account", account);
        json.put("password", password);

        RequestBody body = RequestBody.create(json.toString(), JSON);
        Request request = new Request.Builder()
                .url(ApiUrl.URL_LOGIN)
                .post(body)
                .build();

        try (Response response = client.newCall(request).execute()) {
            if (response.isSuccessful()) {
                JSONObject responseJson = new JSONObject(response.body().string());
                if(responseJson.getBoolean("success")) {
                    return responseJson.getJSONObject("data").getString("token");
                } else {
                    throw new Exception(responseJson.getString("message"));
                }
            } else {
                throw new Exception("登录失败, 请检查网络连接:" + response.message());
            }
        }
    }

    public UserInfo getUserInfo(String token) throws Exception {
        Request request = new Request.Builder()
                .url(ApiUrl.URL_USER_INFO + "?token=" + token)
                .get()
                .addHeader("Token", token)
                .build();

        try (Response response = client.newCall(request).execute()) {
            if (response.isSuccessful()) {
                JSONObject responseJson = new JSONObject(response.body().string());
                if(responseJson.getBoolean("success")) {
                    JSONObject data = responseJson.getJSONObject("data");

                    UserInfo userInfo = new UserInfo();
                    userInfo.setPermissionValueList(null); // Assuming empty list
                    //userInfo.setRoles(data.getJSONArray("roles").());
                    userInfo.setName(data.getString("name"));
                    userInfo.setAvatar(data.getString("avatar"));
                    return userInfo;
                } else {
                    throw new Exception(responseJson.getString("message"));
                }
            } else {
                throw new Exception("获取用户信息失败");
            }
        }
    }
}