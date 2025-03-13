package com.cosinetech.imates.mq;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.UUID;

/**
 * Represents a message sent by a student to a teacher.
 * Follows the userId_q message format.
 */
public class StudentMessage {
    private String userId;
    private String messageId;
    private String sessionId;
    private String subjectId;
    private int messageType;
    private String content;
    private long timestamp;

    /**
     * Constructor for creating a new student message
     */
    public StudentMessage(String userId, String sessionId, String subjectId, 
                         int messageType, String content) {
        this.userId = userId;
        this.messageId = UUID.randomUUID().toString(); // Generate a new UUID
        this.sessionId = sessionId;
        this.subjectId = subjectId;
        this.messageType = messageType;
        this.content = content;
        this.timestamp = System.currentTimeMillis();
    }

    /**
     * Constructor for recreating a message from JSON
     */
    public StudentMessage(JSONObject json) throws JSONException {
        this.userId = json.getString("userId");
        this.messageId = json.getString("messageId");
        this.sessionId = json.getString("sessionId");
        this.subjectId = json.getString("subjectId");
        this.messageType = json.getInt("messageType");
        this.content = json.getString("content");
        this.timestamp = json.getLong("timestamp");
    }

    /**
     * Convert the message to a JSON object
     */
    public JSONObject toJson() throws JSONException {
        JSONObject json = new JSONObject();
        json.put("userId", userId);
        json.put("messageId", messageId);
        json.put("sessionId", sessionId);
        json.put("subjectId", subjectId);
        json.put("messageType", messageType);
        json.put("content", content);
        json.put("timestamp", timestamp);
        return json;
    }

    /**
     * Convert the message to a JSON string
     */
    public String toJsonString() throws JSONException {
        return toJson().toString();
    }

    // Getters and setters
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getMessageId() { return messageId; }
    public void setMessageId(String messageId) { this.messageId = messageId; }

    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }

    public String getSubjectId() { return subjectId; }
    public void setSubjectId(String subjectId) { this.subjectId = subjectId; }

    public int getMessageType() { return messageType; }
    public void setMessageType(int messageType) { this.messageType = messageType; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public long getTimestamp() { return timestamp; }
    public void setTimestamp(long timestamp) { this.timestamp = timestamp; }
}

