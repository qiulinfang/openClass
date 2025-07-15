package com.cosinetech.imates;

import android.os.Handler;
import android.os.Looper;
import okhttp3.*;

import org.json.JSONException;
import org.json.JSONObject;
import org.json.JSONArray;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.util.Base64;

public class OkHttpTicketCreator {
    private static final String ZAMMAD_URL = "http://app.imates.com.cn:8080/api/v1";
    private static final String API_TOKEN = "tOsDC4Qjw-W9zPwK93p_o2DvwxQ6lYC9o2AKUT2zP736YbExUNiiUvbHlTQYn2tk";

    private static final String USER_EMAIL = "app@imates.com.cn";
    private static final OkHttpClient client = new OkHttpClient();
    private static final Handler mainHandler = new Handler(Looper.getMainLooper());

    public interface TicketCreationCallback {
        void onSuccess(String response);
        void onFailure(String error);
    }

    public static void createTicketWithAttachments(String title, String body, File imageFile, TicketCreationCallback callback) {
        try {
            JSONObject ticketJson = new JSONObject();
            ticketJson.put("title", title);
            ticketJson.put("group", "Users"); // Adjust group name as needed
            ticketJson.put("customer", USER_EMAIL);

            JSONObject articleJson = new JSONObject();
            articleJson.put("subject", title);
            articleJson.put("body", body);
            articleJson.put("type", "note");
            articleJson.put("internal", false);

            if(imageFile != null && imageFile.exists()) {
                //Add attachments
                JSONArray attachments = new JSONArray();
                attachments.put(createAttachmentJson(imageFile));
                //attachments.put(createAttachmentJson(documentFile));
                articleJson.put("attachments", attachments);
            }

            ticketJson.put("article", articleJson);

            RequestBody requestBody = RequestBody.create(
                    MediaType.parse("application/json"), ticketJson.toString());

            Request request = new Request.Builder()
                    .url(ZAMMAD_URL + "/tickets")
                    .addHeader("Authorization", "Token token=" + API_TOKEN)
                    .post(requestBody)
                    .build();

            client.newCall(request).enqueue(new Callback() {
                @Override
                public void onFailure(Call call, IOException e) {
                    mainHandler.post(() -> callback.onFailure("Error: " + e.getMessage()));
                }

                @Override
                public void onResponse(Call call, Response response) throws IOException {
                    try (ResponseBody responseBody = response.body()) {
                        if (!response.isSuccessful()) {
                            mainHandler.post(() -> callback.onFailure("Failed to create ticket: " + response.code()));
                        } else {
                            String responseData = responseBody != null ? responseBody.string() : "";
                            mainHandler.post(() -> callback.onSuccess("Ticket created successfully: " + responseData));
                        }
                    }
                }
            });
        } catch (Exception e) {
            mainHandler.post(() -> callback.onFailure("Error: " + e.getMessage()));
        }
    }

    private static JSONObject createAttachmentJson(File file) throws IOException, JSONException {
        String base64Data = null;
        base64Data = Base64.getEncoder().encodeToString(Files.readAllBytes(file.toPath()));
        String mimeType = null;
        mimeType = Files.probeContentType(file.toPath());

        JSONObject attachment = new JSONObject();
        attachment.put("filename", file.getName());
        attachment.put("data", base64Data);
        attachment.put("mime-type", mimeType);

        return attachment;
    }

//    public static void main(String[] args) {
//        File imageFile = new File("path/to/image.jpg");
//        File documentFile = new File("path/to/document.pdf");
//        createTicketWithAttachments("Help needed", "This is a test ticket with attachments", imageFile, documentFile);
//    }
}
