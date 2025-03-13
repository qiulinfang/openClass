package com.cosinetech.imates.mq;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.UUID;

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

