package com.cosinetech.imates.teachermessagemq;

import com.cosinetech.imates.ApplicationModelShared;
import com.cosinetech.imates.data.models.ChatMessage;
import com.cosinetech.imates.utils.AppUtils;
import com.cosinetech.imates.utils.ImageUtils;
import com.cosinetech.imates.utils.VoiceDbUtil;
import com.cosinetech.imates.ui.views.ChatAiView;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.util.UUID;
import android.util.Log;

/**
 * Represents a message sent by a teacher to a student.
 * Follows the userId_a message format.
 */
public class TeacherMessage {
    private String messageId;
    private String sessionId;
    private int messageType;
    private String content;
    private long timestamp;
    // Optional field for when teachers initiate conversations
    private String subjectId;

    /**
     * Constructor for creating a new teacher message
     */
    public TeacherMessage(String sessionId, int messageType, String content) {
        this.messageId = UUID.randomUUID().toString(); // Generate a new UUID
        this.sessionId = sessionId;
        this.messageType = messageType;
        this.content = content;
        this.timestamp = System.currentTimeMillis();
    }

    /**
     * Constructor for creating a new teacher message with subject ID
     * (for when teachers initiate conversations)
     */
    public TeacherMessage(String sessionId, String subjectId, int messageType, String content) {
        this(sessionId, messageType, content);
        this.subjectId = subjectId;
    }

    /**
     * Constructor for recreating a message from JSON
     */
    public TeacherMessage(JSONObject json) throws JSONException {
        this.messageId = json.getString("messageId");
        this.sessionId = json.getString("sessionId");
        this.messageType = json.getInt("messageType");
        this.content = json.getString("content");
        this.timestamp = json.getLong("timestamp");
        
        // Optional field
        if (json.has("subjectId")) {
            this.subjectId = json.getString("subjectId");
        }
    }

    /**
     * Convert the message to a JSON object
     */
    public JSONObject toJson() throws JSONException {
        JSONObject json = new JSONObject();
        json.put("messageId", messageId);
        json.put("sessionId", sessionId);
        json.put("messageType", messageType);
        json.put("content", content);
        json.put("timestamp", timestamp);
        
        // Add optional field if present
        if (subjectId != null) {
            json.put("subjectId", subjectId);
        }
        
        return json;
    }

    /**
     * Convert the message to a JSON string
     */
    public String toJsonString() throws JSONException {
        return toJson().toString();
    }

    public ChatMessage toChatMessage() {
        ChatMessage chatMessage = null;
        switch (this.getMessageType()) {
            case TeacherQaType.QA_MSG_TYPE_TEXT:
            {
                chatMessage = new ChatMessage(this.getContent(),
                        false,
                        ChatMessage.MessageType.TEXT,
                        this.getSessionId(),
                        this.getTimestamp(),
                        ChatAiView.ChatRole.CHAT_ROLE_TEACHER);
            }
            break;
            case TeacherQaType.QA_MSG_TYPE_PICTURE:
            {
                chatMessage = new ChatMessage("",
                        false,
                        ChatMessage.MessageType.IMAGE,
                        this.getSessionId(),
                        this.getTimestamp(),
                        ChatAiView.ChatRole.CHAT_ROLE_TEACHER);
                
                // 获取文件路径，如果用户路径为null，使用应用外部存储目录作为备用
                File userFilePath = AppUtils.getUserFilePath();
                File baseDir;
                if (userFilePath != null) {
                    baseDir = userFilePath;
                } else {
                    // 使用应用外部存储目录作为备用路径
                    ApplicationModelShared app = ApplicationModelShared.getInstance();
                    if (app != null) {
                        File externalFilesDir = app.getExternalFilesDir(null);
                        if (externalFilesDir != null) {
                            baseDir = externalFilesDir;
                            Log.w("TeacherMessage", "getUserFilePath() returned null, using externalFilesDir: " + baseDir.getAbsolutePath());
                        } else {
                            Log.e("TeacherMessage", "Both getUserFilePath() and getExternalFilesDir() returned null, cannot save image");
                            return null; // 无法保存文件，返回null
                        }
                    } else {
                        Log.e("TeacherMessage", "ApplicationModelShared.getInstance() returned null, cannot save image");
                        return null; // 无法获取应用实例，返回null
                    }
                }
                
                String filePath = baseDir.getAbsolutePath() + "/" + chatMessage.messageId + ".png";
                ImageUtils.saveImageFile(this.getContent(), filePath);
                chatMessage.content = filePath;
            }
            break;
            case TeacherQaType.QA_MSG_TYPE_VOICE:
            {
                chatMessage = new ChatMessage("",
                        false,
                        ChatMessage.MessageType.VOICE,
                        this.getSessionId(),
                        this.getTimestamp(),
                        ChatAiView.ChatRole.CHAT_ROLE_TEACHER);
                
                // 获取文件路径，如果用户路径为null，使用应用外部存储目录作为备用
                File userFilePath = AppUtils.getUserFilePath();
                File baseDir;
                if (userFilePath != null) {
                    baseDir = userFilePath;
                } else {
                    // 使用应用外部存储目录作为备用路径
                    ApplicationModelShared app = ApplicationModelShared.getInstance();
                    if (app != null) {
                        File externalFilesDir = app.getExternalFilesDir(null);
                        if (externalFilesDir != null) {
                            baseDir = externalFilesDir;
                            Log.w("TeacherMessage", "getUserFilePath() returned null, using externalFilesDir: " + baseDir.getAbsolutePath());
                        } else {
                            Log.e("TeacherMessage", "Both getUserFilePath() and getExternalFilesDir() returned null, cannot save voice");
                            return null; // 无法保存文件，返回null
                        }
                    } else {
                        Log.e("TeacherMessage", "ApplicationModelShared.getInstance() returned null, cannot save voice");
                        return null; // 无法获取应用实例，返回null
                    }
                }
                
                String filePath = baseDir.getAbsolutePath() + "/" + chatMessage.messageId + ".voice";
                VoiceDbUtil.saveVoiceFile(this.getContent(), filePath);
                long duration = VoiceDbUtil.getDuration(filePath);
                chatMessage.content = duration + "," +  filePath;
            }
            break;
        }

        if(chatMessage != null) {
            chatMessage.messageId = UUID.nameUUIDFromBytes(this.messageId.getBytes()).toString();
        }

        return chatMessage;
    }

    // Getters and setters
    public String getMessageId() { return messageId; }
    public void setMessageId(String messageId) { this.messageId = messageId; }

    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }

    public int getMessageType() { return messageType; }
    public void setMessageType(int messageType) { this.messageType = messageType; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public long getTimestamp() { return timestamp; }
    public void setTimestamp(long timestamp) { this.timestamp = timestamp; }

    public String getSubjectId() { return subjectId; }
    public void setSubjectId(String subjectId) { this.subjectId = subjectId; }
}

