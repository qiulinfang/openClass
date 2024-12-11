package com.cosinetech.imates;

import okhttp3.*;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;

public class LoginService {
    private static final String BASE_URL = "https://xxx.xxx"; // 替换为实际的服务器地址

    public void login(String account, String password) throws IOException, JSONException {
        // Step 1: POST a JSON to the server for login.
        OkHttpClient client = new OkHttpClient();

        JSONObject jsonBody = new JSONObject();
        jsonBody.put("account", account);
        jsonBody.put("password", password);

        RequestBody body = RequestBody.create(
                jsonBody.toString(),
                MediaType.parse("application/json; charset=utf-8")
        );

        Request request = new Request.Builder()
                .url(BASE_URL + "/login") // 替换为实际的登录接口路径
                .post(body)
                .build();

        try (Response response = client.newCall(request).execute()) {
            if (!response.isSuccessful()) throw new IOException("Unexpected code " + response);

            // Step 2: Parse the response and get the token.
            JSONObject jsonResponse = new JSONObject(response.body().string());
            boolean success = jsonResponse.getBoolean("success");
            int code = jsonResponse.getInt("code");

            if (success && code == 20000) {
                String token = jsonResponse.getJSONObject("data").getString("token");

                // Step 3: Use GET method with the token to verify login status.
                String urlWithToken = BASE_URL + "?token=" + token;
                Request getRequest = new Request.Builder()
                        .url(urlWithToken)
                        .get()
                        .build();

                try (Response getResponse = client.newCall(getRequest).execute()) {
                    if (!getResponse.isSuccessful()) throw new IOException("Unexpected code " + getResponse);

                    // Step 4: Parse the GET response to confirm login success.
                    JSONObject getJsonResponse = new JSONObject(getResponse.body().string());
                    boolean getSuccess = getJsonResponse.getBoolean("success");
                    int getStatusCode = getJsonResponse.getInt("code");

                    if (getSuccess && getStatusCode == 20000) {
                        System.out.println("Login successful!");
                        // Handle the successful login here...
                    } else {
                        System.out.println("Failed to verify login.");
                    }
                }
            } else {
                System.out.println("Login failed.");
            }
        }
    }
}
