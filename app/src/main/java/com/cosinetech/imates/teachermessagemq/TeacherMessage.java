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
import java.util.List;
import java.util.ArrayList;
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
    // 调试日志（用于传递到Web端）
    private List<String> debugLogs;
    // 构造函数中收集的日志（用于传递到Web端）
    private List<String> constructorLogs;

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
        
        // 记录从JSON解析出的content信息（用于调试，并传递到Web端）
        if (this.messageType == TeacherQaType.QA_MSG_TYPE_VOICE) {
            this.constructorLogs = new ArrayList<>();
            this.constructorLogs.add("[TeacherMessage构造函数] 从JSON解析语音消息");
            this.constructorLogs.add("[TeacherMessage构造函数] messageId: " + this.messageId);
            this.constructorLogs.add("[TeacherMessage构造函数] sessionId: " + this.sessionId);
            this.constructorLogs.add("[TeacherMessage构造函数] timestamp: " + this.timestamp);
            this.constructorLogs.add("[TeacherMessage构造函数] content长度: " + (this.content != null ? this.content.length() : 0));
            
            // 同时输出到Android Log
            Log.d("TeacherMessage", "[构造函数] 从JSON解析语音消息，messageId: " + this.messageId);
            Log.d("TeacherMessage", "[构造函数] content长度: " + (this.content != null ? this.content.length() : 0));
            
            if (this.content != null && this.content.length() > 0) {
                int previewLength = Math.min(200, this.content.length());
                String preview = this.content.substring(0, previewLength);
                this.constructorLogs.add("[TeacherMessage构造函数] content预览（前" + previewLength + "字符）: " + preview + 
                      (this.content.length() > previewLength ? "..." : ""));
                this.constructorLogs.add("[TeacherMessage构造函数] content是否以data:audio开头: " + this.content.startsWith("data:audio"));
                int commaIndex = this.content.indexOf(',');
                if (commaIndex >= 0) {
                    this.constructorLogs.add("[TeacherMessage构造函数] content包含逗号，位置: " + commaIndex);
                } else {
                    this.constructorLogs.add("[TeacherMessage构造函数] ⚠️ content不包含逗号");
                }
                
                // 同时输出到Android Log
                Log.d("TeacherMessage", "[构造函数] content预览（前" + previewLength + "字符）: " + preview + 
                      (this.content.length() > previewLength ? "..." : ""));
            } else {
                this.constructorLogs.add("[TeacherMessage构造函数] ⚠️ content为null或空");
                Log.w("TeacherMessage", "[构造函数] ⚠️ content为null或空");
            }
        }
        
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
                // 创建日志收集器（所有日志都会传递到Web端）
                VoiceDbUtil.VoiceDebugLogs debugLogs = new VoiceDbUtil.VoiceDebugLogs();
                debugLogs.addLog("========== 开始处理语音消息 ==========");
                
                // 首先添加构造函数中收集的日志（如果有）
                if (this.constructorLogs != null && !this.constructorLogs.isEmpty()) {
                    debugLogs.addLog("--- 从JSON解析时的信息 ---");
                    for (String log : this.constructorLogs) {
                        debugLogs.addLog(log);
                    }
                    debugLogs.addLog("--- 开始转换为ChatMessage ---");
                }
                
                debugLogs.addLog("[TeacherMessage.toChatMessage] 开始处理语音消息");
                debugLogs.addLog("[TeacherMessage.toChatMessage] messageId: " + this.getMessageId());
                debugLogs.addLog("[TeacherMessage.toChatMessage] sessionId: " + this.getSessionId());
                debugLogs.addLog("[TeacherMessage.toChatMessage] timestamp: " + this.getTimestamp());
                debugLogs.addLog("[TeacherMessage.toChatMessage] 消息类型: VOICE (" + this.getMessageType() + ")");
                debugLogs.addLog("[TeacherMessage.toChatMessage] content长度: " + (this.getContent() != null ? this.getContent().length() : 0));
                
                // 添加content的详细预览
                if (this.getContent() != null && this.getContent().length() > 0) {
                    int previewLength = Math.min(200, this.getContent().length());
                    String preview = this.getContent().substring(0, previewLength);
                    debugLogs.addLog("[TeacherMessage.toChatMessage] content预览（前" + previewLength + "字符）: " + preview + 
                                    (this.getContent().length() > previewLength ? "..." : ""));
                    debugLogs.addLog("[TeacherMessage.toChatMessage] content是否以data:audio开头: " + this.getContent().startsWith("data:audio"));
                    // 如果包含逗号，显示逗号位置
                    int commaIndex = this.getContent().indexOf(',');
                    if (commaIndex >= 0) {
                        debugLogs.addLog("[TeacherMessage.toChatMessage] content包含逗号，位置: " + commaIndex);
                    } else {
                        debugLogs.addLog("[TeacherMessage.toChatMessage] ⚠️ content不包含逗号");
                    }
                } else {
                    debugLogs.addLog("[TeacherMessage.toChatMessage] ⚠️ content为null或空");
                }
                
                chatMessage = new ChatMessage("",
                        false,
                        ChatMessage.MessageType.VOICE,
                        this.getSessionId(),
                        this.getTimestamp(),
                        ChatAiView.ChatRole.CHAT_ROLE_TEACHER);
                
                debugLogs.addLog("[TeacherMessage.toChatMessage] ChatMessage创建成功，临时messageId: " + chatMessage.messageId);
                
                // 获取文件路径，如果用户路径为null，使用应用外部存储目录作为备用
                File userFilePath = AppUtils.getUserFilePath();
                File baseDir;
                if (userFilePath != null) {
                    baseDir = userFilePath;
                    debugLogs.addLog("[TeacherMessage.toChatMessage] 使用userFilePath: " + baseDir.getAbsolutePath());
                } else {
                    // 使用应用外部存储目录作为备用路径
                    ApplicationModelShared app = ApplicationModelShared.getInstance();
                    if (app != null) {
                        File externalFilesDir = app.getExternalFilesDir(null);
                        if (externalFilesDir != null) {
                            baseDir = externalFilesDir;
                            Log.w("TeacherMessage", "getUserFilePath() returned null, using externalFilesDir: " + baseDir.getAbsolutePath());
                            debugLogs.addLog("[TeacherMessage.toChatMessage] ⚠️ getUserFilePath()返回null，使用externalFilesDir: " + baseDir.getAbsolutePath());
                        } else {
                            String errorMsg = "Both getUserFilePath() and getExternalFilesDir() returned null, cannot save voice";
                            Log.e("TeacherMessage", errorMsg);
                            debugLogs.addLog("[TeacherMessage.toChatMessage] ❌ " + errorMsg);
                            this.debugLogs = debugLogs.getLogs();
                            return null; // 无法保存文件，返回null
                        }
                    } else {
                        String errorMsg = "ApplicationModelShared.getInstance() returned null, cannot save voice";
                        Log.e("TeacherMessage", errorMsg);
                        debugLogs.addLog("[TeacherMessage.toChatMessage] ❌ " + errorMsg);
                        this.debugLogs = debugLogs.getLogs();
                        return null; // 无法获取应用实例，返回null
                    }
                }
                
                String filePath = baseDir.getAbsolutePath() + "/" + chatMessage.messageId + ".voice";
                debugLogs.addLog("[TeacherMessage.toChatMessage] 生成文件路径: " + filePath);
                
                // 保存文件（带日志收集）
                boolean saveSuccess = VoiceDbUtil.saveVoiceFile(this.getContent(), filePath, debugLogs);
                debugLogs.addLog("[TeacherMessage.toChatMessage] 文件保存结果: " + saveSuccess);
                
                if (!saveSuccess) {
                    String errorMsg = "⚠️ 文件保存失败，无法生成有效的语音消息";
                    debugLogs.addLog("[TeacherMessage.toChatMessage] ❌ " + errorMsg);
                    debugLogs.addLog("[TeacherMessage.toChatMessage] ========== 错误诊断 ==========");
                    debugLogs.addLog("[TeacherMessage.toChatMessage] ⚠️ 问题分析:");
                    debugLogs.addLog("[TeacherMessage.toChatMessage]   1. 检查content是否包含完整的base64数据");
                    debugLogs.addLog("[TeacherMessage.toChatMessage]   2. content预期格式: data:audio/aac;base64,<base64数据>");
                    debugLogs.addLog("[TeacherMessage.toChatMessage]   3. content预期长度: 前缀(22字符) + 逗号(1字符) + base64数据(通常数千字符)");
                    debugLogs.addLog("[TeacherMessage.toChatMessage]   4. 当前content长度: " + (this.getContent() != null ? this.getContent().length() : 0));
                    if (this.getContent() != null && this.getContent().length() <= 22) {
                        debugLogs.addLog("[TeacherMessage.toChatMessage]   ⚠️ 检测到content只有22字符，说明只有前缀没有base64数据");
                        debugLogs.addLog("[TeacherMessage.toChatMessage]   ⚠️ 这表明RabbitMQ消息中的content字段不完整");
                    }
                    debugLogs.addLog("[TeacherMessage.toChatMessage] ⚠️ 可能原因:");
                    debugLogs.addLog("[TeacherMessage.toChatMessage]   1. RabbitMQ消息发送端未正确编码base64数据");
                    debugLogs.addLog("[TeacherMessage.toChatMessage]   2. 消息在传输过程中被截断");
                    debugLogs.addLog("[TeacherMessage.toChatMessage]   3. JSON解析时base64数据被错误处理");
                    debugLogs.addLog("[TeacherMessage.toChatMessage]   4. 发送端消息构建逻辑有误");
                    debugLogs.addLog("[TeacherMessage.toChatMessage] ⚠️ 影响:");
                    debugLogs.addLog("[TeacherMessage.toChatMessage]   - 文件无法保存到本地");
                    debugLogs.addLog("[TeacherMessage.toChatMessage]   - 无法获取音频时长");
                    debugLogs.addLog("[TeacherMessage.toChatMessage]   - Web端将无法播放语音消息");
                    debugLogs.addLog("[TeacherMessage.toChatMessage] ⚠️ 继续尝试获取时长（但文件不存在，将返回0）");
                    debugLogs.addLog("[TeacherMessage.toChatMessage] ========== 诊断结束 ==========");
                    
                    // 继续处理，但会在日志中明确标记问题
                }
                
                // 获取时长（带日志收集）
                long duration = VoiceDbUtil.getDuration(filePath, debugLogs);
                debugLogs.addLog("[TeacherMessage.toChatMessage] 获取到的时长(秒): " + duration);
                
                if (!saveSuccess) {
                    debugLogs.addLog("[TeacherMessage.toChatMessage] ⚠️ 由于文件保存失败，时长返回0，文件路径可能无效");
                }
                
                chatMessage.content = duration + "," +  filePath;
                debugLogs.addLog("[TeacherMessage.toChatMessage] 最终content: " + chatMessage.content);
                
                if (!saveSuccess) {
                    debugLogs.addLog("[TeacherMessage.toChatMessage] ⚠️ 警告: 生成的content包含无效的文件路径，Web端将无法播放语音");
                }
                
                debugLogs.addLog("========== 处理完成 ==========");
                
                // 保存日志到ChatMessage，供Web端使用（包含构造函数日志和处理过程日志）
                chatMessage.debugLogs = debugLogs.getLogs();
                
                // 同时保存日志到实例变量
                this.debugLogs = debugLogs.getLogs();
            }
            break;
        }

        if(chatMessage != null) {
            chatMessage.messageId = UUID.nameUUIDFromBytes(this.messageId.getBytes()).toString();
            if (chatMessage.debugLogs != null) {
                // 更新日志中的messageId信息
                for (int i = 0; i < chatMessage.debugLogs.size(); i++) {
                    String log = chatMessage.debugLogs.get(i);
                    if (log.contains("临时messageId")) {
                        chatMessage.debugLogs.set(i, log + " -> 最终messageId: " + chatMessage.messageId);
                    }
                }
            }
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
    
    public List<String> getDebugLogs() { return debugLogs; }
    public void setDebugLogs(List<String> debugLogs) { this.debugLogs = debugLogs; }
}

