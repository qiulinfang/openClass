package com.cosinetech.imates.ui.webview.common;

import android.content.Context;
import android.content.Intent;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;
import android.app.Activity;
import android.media.MediaRecorder;
import android.media.MediaPlayer;
import android.os.Environment;
import android.util.Log;
import android.Manifest;
import android.content.pm.PackageManager;
import androidx.activity.result.ActivityResultLauncher;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import android.provider.MediaStore;
import android.net.Uri;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import androidx.core.content.FileProvider;
import java.io.FileOutputStream;
import java.io.FileInputStream;
import java.io.InputStream;

import com.cosinetech.imates.ui.activities.ExerciseSolveActivity;
import com.cosinetech.imates.ui.activities.PhotoSearchActivity;
import com.cosinetech.imates.data.models.Subject;
import com.cosinetech.imates.utils.AppUtils;
import com.cosinetech.imates.data.models.ChatMessage;
import com.cosinetech.imates.data.models.ChatMessageSession;
import com.cosinetech.imates.data.models.ChatMessageHistoryDB;
import com.cosinetech.imates.ui.views.ChatAiView;
import com.cosinetech.imates.teachermessagemq.MessagingManager;
import com.cosinetech.imates.teachermessagemq.StudentMessage;
import com.cosinetech.imates.utils.ImageUtils;
import com.cosinetech.imates.utils.VoiceDbUtil;

import java.io.File;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class WebAppInterface {
    Context mContext;
    private ExerciseSolveActivityBridge exerciseBridge;

    // 语音录制相关
    private MediaRecorder mediaRecorder;
    private MediaPlayer mediaPlayer;
    private String currentAudioFilePath;
    private boolean isRecording = false;
    private boolean isPlaying = false;
    private long recordStartTime;

    private static final String TAG = "WebAppInterface";
    private static final int REQUEST_RECORD_AUDIO_PERMISSION = 200;
    private static final int REQUEST_IMAGE_PICK = 201;
    private static final int REQUEST_IMAGE_CAPTURE = 202;
    private static final int REQUEST_CAMERA_PERMISSION = 203;

    // 图片相关
    private String currentImageFilePath;
    private Uri currentImageUri;

    // Activity Result Launchers
    private ActivityResultLauncher<Intent> imagePickLauncher;
    private ActivityResultLauncher<Intent> imageCaptureLauncher;

    public WebAppInterface(Context c) {
        mContext = c;
    }

    // 设置ExerciseSolve桥接器
    public void setExerciseBridge(ExerciseSolveActivityBridge bridge) {
        this.exerciseBridge = bridge;
    }

    /**
     * 设置图片相关的 ActivityResultLauncher
     */
    public void setImageLaunchers(ActivityResultLauncher<Intent> imagePickLauncher,
            ActivityResultLauncher<Intent> imageCaptureLauncher) {
        this.imagePickLauncher = imagePickLauncher;
        this.imageCaptureLauncher = imageCaptureLauncher;
    }

    /**
     * 这个方法暴露给JS调用
     * 必须有 @JavascriptInterface 注解
     */
    @JavascriptInterface
    public void showToast(String toast) {
        Toast.makeText(mContext, toast, Toast.LENGTH_SHORT).show();
    }

    @JavascriptInterface
    public String getUserToken() {
        return AppUtils.getUserToken();
    }

    // ========== ExerciseSolve 相关接口 ==========
    // HTTP接口已移至Vue前端实现，仅保留原生功能接口

    @JavascriptInterface
    public void startPhotoSearch(String subject) {
        if (exerciseBridge != null) {
            exerciseBridge.startPhotoSearch(subject);
        }
    }

    // ========== 老师双向对话HTTP接口已移至Vue前端实现 ==========
    // 所有老师对话相关的HTTP接口已删除，仅保留消息监听功能

    /**
     * 发送文本消息给老师
     * 与ChatAiView.sendTextMessageToTeacher逻辑一致
     */
    @JavascriptInterface
    public String sendTextMessageToTeacher(String content, String sessionId, String subject) {
        
        try {
            // 获取用户ID
            String userId = AppUtils.getUserId();
            if (userId == null || userId.isEmpty()) {
                return createResponse(false, "用户未登录", null);
            }

            // 确定学科类型（与TeacherQaType定义一致）
            String teacherSubject;
            int messageType = 0; // QA_MSG_TYPE_TEXT
            if ("biology".equals(subject)) {
                teacherSubject = "6"; // SCHOOL_SUBJECT_BIOLOGY
            } else if ("math".equals(subject)) {
                teacherSubject = "2"; // SCHOOL_SUBJECT_MATH
            } else {
                return createResponse(false, "不支持的学科类型", null);
            }

            // 创建StudentMessage（与ChatAiView.sendTextMessageToTeacher逻辑一致）
            String messageId = UUID.randomUUID().toString();
            long timestamp = System.currentTimeMillis();

            try {
                // 构建StudentMessage JSON
                JSONObject studentMsgJson = new JSONObject();
                studentMsgJson.put("userId", userId);
                studentMsgJson.put("messageId", messageId);
                studentMsgJson.put("sessionId", sessionId);
                studentMsgJson.put("subjectId", teacherSubject);
                studentMsgJson.put("messageType", messageType);
                studentMsgJson.put("content", content);
                studentMsgJson.put("timestamp", timestamp);


                // 发送消息到MessagingManager
                StudentMessage studentMsg = new StudentMessage(
                        userId, sessionId, teacherSubject, messageType, content);
                studentMsg.setMessageId(messageId);

                MessagingManager.getInstance().sendMessageToTeacher(studentMsg, null);

                // 保存消息到本地数据库
                ChatMessageHistoryDB chatDb = ChatMessageHistoryDB.getInstance(mContext, userId);
                ChatMessage chatMessage = new ChatMessage(
                        content,
                        true, // isSelf
                        ChatMessage.MessageType.TEXT,
                        sessionId,
                        timestamp,
                        ChatAiView.ChatRole.CHAT_ROLE_MYSELF);
                chatMessage.messageId = messageId;
                chatDb.addChatMessageDetail(chatMessage);

                // 构建返回数据
                String messageData = String.format(Locale.getDefault(),
                        "{\"messageId\":\"%s\",\"userId\":\"%s\",\"sessionId\":\"%s\",\"subject\":\"%s\",\"messageType\":\"TEXT\",\"content\":\"%s\",\"timestamp\":%d}",
                        messageId, userId, sessionId, teacherSubject, content, timestamp);

                return createResponseWithJsonData(true, "消息发送成功", messageData);

            } catch (JSONException e) {
                return createResponse(false, "构建消息失败: " + e.getMessage(), null);
            }

        } catch (Exception e) {
            return createResponse(false, "发送消息失败: " + e.getMessage(), null);
        }
    }

    /**
     * 发送语音消息给老师
     * 与ChatAiView.sendVoiceMessageToTeacher逻辑一致
     */
    @JavascriptInterface
    public String sendVoiceMessageToTeacher(String voicePath, String duration, String sessionId, String subject) {
        try {
            // 获取用户ID
            String userId = AppUtils.getUserId();
            if (userId == null || userId.isEmpty()) {
                return createResponse(false, "用户未登录", null);
            }

            // 检查语音文件是否存在
            File voiceFile = new File(voicePath);
            if (!voiceFile.exists()) {
                return createResponse(false, "语音文件不存在: " + voicePath, null);
            }

            // 确定学科类型
            String teacherSubject;
            int messageType = 2; // QA_MSG_TYPE_VOICE
            if ("biology".equals(subject)) {
                teacherSubject = "6"; // SCHOOL_SUBJECT_BIOLOGY
            } else if ("math".equals(subject)) {
                teacherSubject = "2"; // SCHOOL_SUBJECT_MATH
            } else {
                return createResponse(false, "不支持的学科类型", null);
            }

            // 创建StudentMessage（与ChatAiView.sendVoiceMessageToTeacher逻辑一致）
            String messageId = UUID.randomUUID().toString();
            long timestamp = System.currentTimeMillis();

            try {
                // 读取语音文件并转换为Base64（与VoiceDbUtil.getRawVoiceBase64逻辑一致）
                String voiceBase64WithPrefix = VoiceDbUtil.getRawVoiceBase64(voicePath);
                if (voiceBase64WithPrefix == null || voiceBase64WithPrefix.equals("null")) {
                    return createResponse(false, "语音文件读取失败", null);
                }

                // 保持完整的Base64内容（包含data:audio前缀），与Android原生版本一致
                String voiceBase64Content = voiceBase64WithPrefix;

                // 验证Base64内容不为空
                if (voiceBase64Content == null || voiceBase64Content.trim().isEmpty()) {
                    return createResponse(false, "语音Base64编码为空", null);
                }

                // 构建StudentMessage JSON
                JSONObject studentMsgJson = new JSONObject();
                studentMsgJson.put("userId", userId);
                studentMsgJson.put("messageId", messageId);
                studentMsgJson.put("sessionId", sessionId);
                studentMsgJson.put("subjectId", teacherSubject);
                studentMsgJson.put("messageType", messageType);
                studentMsgJson.put("content", voiceBase64Content);
                studentMsgJson.put("timestamp", timestamp);

                // 发送消息到MessagingManager
                StudentMessage studentMsg = new StudentMessage(
                        userId, sessionId, teacherSubject, messageType, voiceBase64Content);
                studentMsg.setMessageId(messageId);

                MessagingManager.getInstance().sendMessageToTeacher(studentMsg,
                        (success, sentMessageId, errorMessage) -> {
                            // 语音消息发送结果处理
                        });

                // 保存消息到本地数据库（使用VoiceDbUtil.makeVoiceDbContent格式）
                VoiceDbUtil.VoiceDbItem voiceItem = new VoiceDbUtil.VoiceDbItem();
                voiceItem.voicePath = voicePath;
                voiceItem.duration = Integer.parseInt(duration);
                String dbContent = VoiceDbUtil.makeVoiceDbContent(voiceItem);

                ChatMessageHistoryDB chatDb = ChatMessageHistoryDB.getInstance(mContext, userId);
                ChatMessage chatMessage = new ChatMessage(
                        dbContent,
                        true, // isSelf
                        ChatMessage.MessageType.VOICE,
                        sessionId,
                        timestamp,
                        ChatAiView.ChatRole.CHAT_ROLE_MYSELF);
                chatMessage.messageId = messageId;
                chatDb.addChatMessageDetail(chatMessage);

                // 构建返回数据
                String messageData = String.format(Locale.getDefault(),
                        "{\"messageId\":\"%s\",\"userId\":\"%s\",\"sessionId\":\"%s\",\"subject\":\"%s\",\"messageType\":\"VOICE\",\"voicePath\":\"%s\",\"duration\":%s,\"timestamp\":%d}",
                        messageId, userId, sessionId, teacherSubject, voicePath, duration, timestamp);

                return createResponseWithJsonData(true, "语音消息发送成功", messageData);

            } catch (JSONException e) {
                return createResponse(false, "构建语音消息失败: " + e.getMessage(), null);
            }

        } catch (Exception e) {
            return createResponse(false, "发送语音消息失败: " + e.getMessage(), null);
        }
    }

    /**
     * 发送图片消息给老师
     * 与ChatAiView.sendPictureToTeacher逻辑一致
     */
    @JavascriptInterface
    public String sendPictureToTeacher(String imagePath, String sessionId, String subject) {
        try {
            // 获取用户ID
            String userId = AppUtils.getUserId();
            if (userId == null || userId.isEmpty()) {
                return createResponse(false, "用户未登录", null);
            }

            // 检查图片文件是否存在
            File imageFile = new File(imagePath);
            if (!imageFile.exists()) {
                return createResponse(false, "图片文件不存在: " + imagePath, null);
            }

            // 确定学科类型
            String teacherSubject;
            int messageType = 1; // QA_MSG_TYPE_PICTURE
            if ("biology".equals(subject)) {
                teacherSubject = "6"; // SCHOOL_SUBJECT_BIOLOGY
            } else if ("math".equals(subject)) {
                teacherSubject = "2"; // SCHOOL_SUBJECT_MATH
            } else {
                return createResponse(false, "不支持的学科类型", null);
            }

            // 创建StudentMessage（与ChatAiView.sendPictureToTeacher逻辑一致）
            String messageId = UUID.randomUUID().toString();
            long timestamp = System.currentTimeMillis();

            try {
                // 读取图片文件并转换为Base64（与ImageUtils.loadImageFileToBase64逻辑一致）
                String imageBase64WithPrefix = ImageUtils.loadImageFileToBase64(imagePath);
                if (imageBase64WithPrefix == null || imageBase64WithPrefix.trim().isEmpty()) {
                    return createResponse(false, "图片文件读取失败", null);
                }

                // 保持完整的Base64内容（包含data:image前缀），与Android原生版本一致
                String imageBase64Content = imageBase64WithPrefix;

                // 验证Base64内容不为空
                if (imageBase64Content == null || imageBase64Content.trim().isEmpty()) {
                    return createResponse(false, "图片Base64编码为空", null);
                }

                // 构建StudentMessage JSON
                JSONObject studentMsgJson = new JSONObject();
                studentMsgJson.put("userId", userId);
                studentMsgJson.put("messageId", messageId);
                studentMsgJson.put("sessionId", sessionId);
                studentMsgJson.put("subjectId", teacherSubject);
                studentMsgJson.put("messageType", messageType);
                studentMsgJson.put("content", imageBase64Content);
                studentMsgJson.put("timestamp", timestamp);

                // 发送消息到MessagingManager
                StudentMessage studentMsg = new StudentMessage(
                        userId, sessionId, teacherSubject, messageType, imageBase64Content);
                studentMsg.setMessageId(messageId);

                MessagingManager.getInstance().sendMessageToTeacher(studentMsg,
                        (success, sentMessageId, errorMessage) -> {
                            // 图片消息发送结果处理
                        });

                // 保存消息到本地数据库
                ChatMessageHistoryDB chatDb = ChatMessageHistoryDB.getInstance(mContext, userId);
                ChatMessage chatMessage = new ChatMessage(
                        imagePath, // 存储图片路径
                        true, // isSelf
                        ChatMessage.MessageType.IMAGE,
                        sessionId,
                        timestamp,
                        ChatAiView.ChatRole.CHAT_ROLE_MYSELF);
                chatMessage.messageId = messageId;
                chatDb.addChatMessageDetail(chatMessage);

                // 构建返回数据
                String messageData = String.format(Locale.getDefault(),
                        "{\"messageId\":\"%s\",\"userId\":\"%s\",\"sessionId\":\"%s\",\"subject\":\"%s\",\"messageType\":\"IMAGE\",\"imagePath\":\"%s\",\"timestamp\":%d}",
                        messageId, userId, sessionId, teacherSubject, imagePath, timestamp);

                return createResponseWithJsonData(true, "图片消息发送成功", messageData);

            } catch (JSONException e) {
                return createResponse(false, "构建图片消息失败: " + e.getMessage(), null);
            }

        } catch (Exception e) {
            return createResponse(false, "发送图片消息失败: " + e.getMessage(), null);
        }
    }

    /**
     * 转发AI对话记录给老师
     * 与ChatAiView中选择消息转发逻辑一致
     */
    @JavascriptInterface
    public String forwardAiChatToTeacher(String selectedMessagesData, String teacherSessionId) {
        
        try {
            // 获取用户ID
            String userId = AppUtils.getUserId();
            if (userId == null || userId.isEmpty()) {
                return createResponse(false, "用户未登录", null);
            }

            // 解析选中的消息数据
            JSONArray messagesArray = new JSONArray(selectedMessagesData);
            
            int forwardedCount = 0;

            // 获取老师会话信息以确定学科
            ChatMessageHistoryDB chatDb = ChatMessageHistoryDB.getInstance(mContext, userId);
            ChatMessageSession teacherSession = chatDb.getMessageSessionBySessionId(teacherSessionId);
            if (teacherSession == null) {
                return createResponse(false, "老师会话不存在", null);
            }

            // 确定学科类型
            String subject = (teacherSession.type == ChatMessageSession.SessionType.USER_TALK_TEACHER_BIOLOGY)
                    ? "biology"
                    : "math";

            // 为每条选中的消息创建转发记录
            for (int i = 0; i < messagesArray.length(); i++) {
                try {
                    JSONObject message = messagesArray.getJSONObject(i);
                    String messageType = message.optString("type", "TEXT");
                    String content = message.optString("content", "");

                    // 根据消息类型转发
                    String result;
                    if ("TEXT".equals(messageType)) {
                        result = sendTextMessageToTeacher(content, teacherSessionId, subject);
                    } else if ("IMAGE".equals(messageType)) {
                        result = sendPictureToTeacher(content, teacherSessionId, subject);
                    } else if ("VOICE".equals(messageType)) {
                        // 对于语音消息，需要解析duration
                        String duration = message.optString("duration", "0");
                        result = sendVoiceMessageToTeacher(content, duration, teacherSessionId, subject);
                    } else {
                        continue; // 跳过不支持的消息类型
                    }

                    // 检查发送结果
                    JSONObject resultJson = new JSONObject(result);
                    boolean success = resultJson.optBoolean("success", false);
                    
                    if (success) {
                        forwardedCount++;
                    }

                } catch (JSONException e) {
                    // 解析转发消息失败，跳过此消息
                }
            }

            String resultData = String.format(Locale.getDefault(),
                    "{\"forwardedCount\":%d,\"totalCount\":%d,\"teacherSessionId\":\"%s\"}",
                    forwardedCount, messagesArray.length(), teacherSessionId);

            return createResponseWithJsonData(true,
                    String.format("成功转发 %d/%d 条消息", forwardedCount, messagesArray.length()),
                    resultData);

        } catch (Exception e) {
            return createResponse(false, "转发消息失败: " + e.getMessage(), null);
        }
    }

    /**
     * 获取老师会话的消息历史
     */
    @JavascriptInterface
    public String getTeacherChatHistory(String sessionId) {
        try {
            // 获取用户ID
            String userId = AppUtils.getUserId();
            if (userId == null || userId.isEmpty()) {
                return createResponse(false, "用户未登录", null);
            }

            // 从数据库获取聊天历史
            ChatMessageHistoryDB chatDb = ChatMessageHistoryDB.getInstance(mContext, userId);
            List<ChatMessage> messages = chatDb.getChatMessageDetail(sessionId);

            // 构建消息历史JSON数组
            JSONArray historyArray = new JSONArray();
            for (ChatMessage message : messages) {
                try {
                    JSONObject messageJson = new JSONObject();
                    messageJson.put("messageId", message.messageId);
                    messageJson.put("sessionId", message.sessionId);
                    messageJson.put("content", message.content);
                    messageJson.put("messageType", getMessageTypeString(message.type));
                    messageJson.put("isSelf", message.isSelf);
                    messageJson.put("timestamp", message.timestamp);
                    messageJson.put("chatRole", getChatRoleString(message.role));

                    historyArray.put(messageJson);
                } catch (JSONException e) {
                    // 构建消息JSON失败，跳过此消息
                }
            }

            return createResponseWithJsonData(true, "获取聊天历史成功", historyArray.toString());

        } catch (Exception e) {
            Log.e(TAG, "获取聊天历史失败", e);
            return createResponse(false, "获取聊天历史失败: " + e.getMessage(), null);
        }
    }

    private String getMessageTypeString(ChatMessage.MessageType type) {
        switch (type) {




            case TEXT:
                return "TEXT";
            case IMAGE:
                return "IMAGE";
            case VOICE:
                return "VOICE";
            case DATE:
                return "DATE";
            default:
                return "TEXT";
        }
    }

    private String getChatRoleString(int role) {
        // 根据ChatAiView.ChatRole枚举值转换
        switch (role) {
            case 0:
                return "AI_MATE";
            case 1:
                return "AI_MENTOR";
            case 2:
                return "AI_RESEARCHER";
            case 3:
                return "MYSELF";
            case 4:
                return "TEACHER";
            default:
                return "MYSELF";
        }
    }

    /**
     * 检查老师会话是否存在
     */
    @JavascriptInterface
    public String checkTeacherSessionExists(String sessionId) {
        try {
            // 获取用户ID
            String userId = AppUtils.getUserId();
            if (userId == null || userId.isEmpty()) {
                return createResponse(false, "用户未登录", null);
            }

            // 从数据库查询会话是否存在
            ChatMessageHistoryDB chatDb = ChatMessageHistoryDB.getInstance(mContext, userId);
            ChatMessageSession session = chatDb.getMessageSessionBySessionId(sessionId);

            boolean exists = (session != null);

            String result = String.format(Locale.getDefault(),
                    "{\"exists\":%b,\"sessionId\":\"%s\"}", exists, sessionId);

            return createResponseWithJsonData(true, "检查会话状态成功", result);

        } catch (Exception e) {
            Log.e(TAG, "检查会话状态失败", e);
            return createResponse(false, "检查会话状态失败: " + e.getMessage(), null);
        }
    }

    /**
     * 获取当前会话的消息数量
     */
    @JavascriptInterface
    public String getCurrentSessionMessageCount(String sessionId) {
        try {
            // 获取用户ID
            String userId = AppUtils.getUserId();
            if (userId == null || userId.isEmpty()) {
                return createResponse(false, "用户未登录", null);
            }

            // 从数据库获取消息数量
            ChatMessageHistoryDB chatDb = ChatMessageHistoryDB.getInstance(mContext, userId);
            List<ChatMessage> messages = chatDb.getChatMessageDetail(sessionId);
            int count = messages.size();

            String result = String.format(Locale.getDefault(),
                    "{\"count\":%d,\"sessionId\":\"%s\"}", count, sessionId);

            return createResponseWithJsonData(true, "获取消息数量成功", result);

        } catch (Exception e) {
            return createResponse(false, "获取消息数量失败: " + e.getMessage(), null);
        }
    }

    /**
     * 设置老师消息接收回调
     * 当收到老师回复时，会调用JavaScript中的回调函数
     */
    public void setTeacherMessageCallback(String callbackName) {
        // 这个方法将在Activity中被调用，用于设置消息回调
        if (exerciseBridge != null) {
            exerciseBridge.setTeacherMessageCallback(callbackName);
        }
    }

    /**
     * 通知Vue端收到老师消息
     * 这个方法会被Activity调用，当MessagingManager收到老师回复时
     */
    public void notifyTeacherMessageReceived(ChatMessage teacherMessage) {
        if (mContext instanceof Activity) {
            ((Activity) mContext).runOnUiThread(() -> {
                try {
                    // 构建老师消息JSON
                    JSONObject messageJson = new JSONObject();
                    messageJson.put("messageId", teacherMessage.messageId);
                    messageJson.put("sessionId", teacherMessage.sessionId);
                    messageJson.put("content", teacherMessage.content);
                    messageJson.put("messageType", getMessageTypeString(teacherMessage.type));
                    messageJson.put("isSelf", teacherMessage.isSelf);
                    messageJson.put("timestamp", teacherMessage.timestamp);
                    messageJson.put("chatRole", "TEACHER");

                    // 保存到数据库
                    String userId = AppUtils.getUserId();
                    if (userId != null && !userId.isEmpty()) {
                        ChatMessageHistoryDB chatDb = ChatMessageHistoryDB.getInstance(mContext, userId);
                        chatDb.addChatMessageDetail(teacherMessage);
                    }

                    // 调用JavaScript回调函数
                    String script = String.format(Locale.getDefault(),
                            "if (window.onTeacherMessageReceived) { window.onTeacherMessageReceived(%s); }",
                            messageJson.toString());

                    Log.d(TAG, "Teacher message received: " + messageJson.toString());

                    // 这里需要WebView实例来执行JavaScript
                    // 在实际实现中，应该通过Activity获取WebView实例并调用evaluateJavascript

                } catch (Exception e) {
                    Log.e(TAG, "Failed to notify teacher message", e);
                }
            });
        }
    }

    /**
     * 创建老师对话会话
     * 与ExerciseSolveActivity.createChatTeacherSession逻辑一致
     */
    @JavascriptInterface
    public String createTeacherChatSession(String aiSessionId, String aiSessionName, String subject) {
        Log.d(TAG, "🔍 Android创建老师会话 - 开始");
        Log.d(TAG, "🔍 Android创建老师会话 - 输入参数: aiSessionId=" + aiSessionId + 
                ", aiSessionName=" + aiSessionName + ", subject=" + subject);
        
        try {
            // 获取用户ID
            String userId = AppUtils.getUserId();
            if (userId == null || userId.isEmpty()) {
                Log.e(TAG, "🔍 Android创建老师会话 - 用户未登录");
                return createResponse(false, "用户未登录", null);
            }
            Log.d(TAG, "🔍 Android创建老师会话 - 用户ID: " + userId);

            // 生成老师会话ID（与ExerciseSolveActivity.createChatTeacherSession逻辑一致）
            String teacherSessionId = UUID.nameUUIDFromBytes(aiSessionId.getBytes()).toString();
            Log.d(TAG, "🔍 Android创建老师会话 - 生成会话ID: " + teacherSessionId);

            // 确定会话类型
            ChatMessageSession.SessionType sessionType;
            if ("biology".equals(subject)) {
                sessionType = ChatMessageSession.SessionType.USER_TALK_TEACHER_BIOLOGY;
            } else if ("math".equals(subject)) {
                sessionType = ChatMessageSession.SessionType.USER_TALK_TEACHER_MATH;
            } else {
                Log.e(TAG, "🔍 Android创建老师会话 - 不支持的学科类型: " + subject);
                return createResponse(false, "不支持的学科类型", null);
            }
            Log.d(TAG, "🔍 Android创建老师会话 - 会话类型: " + sessionType.name());

            // 创建老师会话
            long currentTime = System.currentTimeMillis();
            ChatMessageSession teacherSession = new ChatMessageSession(
                    teacherSessionId,
                    "CATEGORY_TEACHER_QA", // ChatMessageCatalogue.CATEGORY_TEACHER_QA.catalogId
                    aiSessionName,
                    sessionType,
                    currentTime,
                    currentTime,
                    0);
            Log.d(TAG, "🔍 Android创建老师会话 - 创建会话对象: " + teacherSession.sessionName);

            // 保存到数据库
            ChatMessageHistoryDB chatDb = ChatMessageHistoryDB.getInstance(mContext, userId);
            long result = chatDb.addMessageSession(teacherSession);
            Log.d(TAG, "🔍 Android创建老师会话 - 数据库操作结果: " + result);

            if (result > 0) {
                // 新会话创建成功
                String sessionData = String.format(Locale.getDefault(),
                        "{\"sessionId\":\"%s\",\"catalogId\":\"%s\",\"sessionName\":\"%s\",\"sessionType\":\"%s\",\"createTime\":%d,\"updateTime\":%d}",
                        teacherSessionId, teacherSession.catalogId, aiSessionName, sessionType.name(), currentTime,
                        currentTime);

                Log.d(TAG, "🔍 Android创建老师会话 - 新会话创建成功");
                return createResponseWithJsonData(true, "老师会话创建成功", sessionData);
            } else if (result == -1) {
                // 会话已存在，直接返回现有会话
                String sessionData = String.format(Locale.getDefault(),
                        "{\"sessionId\":\"%s\",\"catalogId\":\"%s\",\"sessionName\":\"%s\",\"sessionType\":\"%s\",\"createTime\":%d,\"updateTime\":%d}",
                        teacherSessionId, teacherSession.catalogId, aiSessionName, sessionType.name(), currentTime,
                        currentTime);

                Log.d(TAG, "🔍 Android创建老师会话 - 会话已存在");
                return createResponseWithJsonData(true, "老师会话已存在", sessionData);
            } else {
                Log.e(TAG, "🔍 Android创建老师会话 - 会话创建失败");
                return createResponse(false, "会话创建失败", null);
            }

        } catch (Exception e) {
            Log.e(TAG, "🔍 Android创建老师会话 - 创建老师会话失败", e);
            return createResponse(false, "创建老师会话失败: " + e.getMessage(), null);
        }
    }

    /**
     * 初始化老师消息监听器
     */
    @JavascriptInterface
    public String initTeacherMessageListener() {
        try {
            String userId = AppUtils.getUserId();
            if (userId == null || userId.isEmpty()) {
                return createResponse(false, "用户未登录", null);
            }

            // 初始化MessagingManager
            MessagingManager.getInstance().initialize(mContext, userId);

            // 添加消息监听器
            MessagingManager.getInstance().addMessageListener(this::notifyTeacherMessageReceived);

            Log.d(TAG, "Teacher message listener initialized");
            return createResponse(true, "老师消息监听器初始化成功", null);

        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize teacher message listener", e);
            return createResponse(false, "初始化老师消息监听器失败: " + e.getMessage(), null);
        }
    }

    /**
     * 清理老师消息监听器
     */
    @JavascriptInterface
    public String cleanupTeacherMessageListener() {
        try {
            // 移除消息监听器
            MessagingManager.getInstance().removeMessageListener(this::notifyTeacherMessageReceived);

            Log.d(TAG, "Teacher message listener cleaned up");
            return createResponse(true, "老师消息监听器清理成功", null);

        } catch (Exception e) {
            Log.e(TAG, "Failed to cleanup teacher message listener", e);
            return createResponse(false, "清理老师消息监听器失败: " + e.getMessage(), null);
        }
    }

    @JavascriptInterface
    public void exitActivity() {
        if (mContext instanceof Activity) {
            ((Activity) mContext).finish();
        }
    }

    // HTTP接口已移至Vue前端实现，getUserInfo和saveExerciseProgress已删除

    /**
     * 接收来自 JavaScript 的日志消息
     * 用于在 Android 日志中查看 Vue 的 console.log 输出
     */
    @JavascriptInterface
    public void logMessage(String level, String message) {
        String tag = "WebView-Vue";

        switch (level.toUpperCase()) {
            case "DEBUG":
                android.util.Log.d(tag, message);
                break;
            case "INFO":
                android.util.Log.i(tag, message);
                break;
            case "WARN":
                android.util.Log.w(tag, message);
                break;
            case "ERROR":
                android.util.Log.e(tag, message);
                break;
            default:
                android.util.Log.i(tag, "[" + level + "] " + message);
                break;
        }
    }

    /**
     * 简化的日志方法，默认为 INFO 级别
     */
    @JavascriptInterface
    public void log(String message) {
        android.util.Log.i("WebView-Vue", message);
    }

    // ========== 语音录制相关接口 ==========

    /**
     * 开始录音 - 类似微信按住录音
     */
    @JavascriptInterface
    public String startVoiceRecording() {
        try {
            // 检查录音权限
            if (!checkAudioPermission()) {
                return createResponse(false, "需要录音权限", null);
            }

            if (isRecording) {
                return createResponse(false, "正在录音中", null);
            }

            // 创建录音文件
            currentAudioFilePath = createAudioFilePath();

            // 初始化MediaRecorder
            mediaRecorder = new MediaRecorder();
            mediaRecorder.setAudioSource(MediaRecorder.AudioSource.MIC);
            mediaRecorder.setOutputFormat(MediaRecorder.OutputFormat.AAC_ADTS);
            mediaRecorder.setOutputFile(currentAudioFilePath);
            mediaRecorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            mediaRecorder.setAudioSamplingRate(44100);
            mediaRecorder.setAudioEncodingBitRate(96000);

            mediaRecorder.prepare();
            mediaRecorder.start();

            isRecording = true;
            recordStartTime = System.currentTimeMillis();

            Log.d(TAG, "开始录音: " + currentAudioFilePath);
            return createResponse(true, "开始录音", currentAudioFilePath);

        } catch (Exception e) {
            Log.e(TAG, "开始录音失败", e);
            releaseMediaRecorder();
            return createResponse(false, "录音失败: " + e.getMessage(), null);
        }
    }

    /**
     * 停止录音并返回录音信息 - 类似微信松开手指
     */
    @JavascriptInterface
    public String stopVoiceRecording() {
        try {
            if (!isRecording || mediaRecorder == null) {
                return createResponse(false, "未在录音", null);
            }

            mediaRecorder.stop();
            releaseMediaRecorder();

            long duration = System.currentTimeMillis() - recordStartTime;
            isRecording = false;

            // 检查录音时长
            if (duration < 1000) {
                // 录音时间太短，删除文件
                deleteAudioFile(currentAudioFilePath);
                return createResponse(false, "录音时间太短", null);
            }

            // 获取文件大小
            File audioFile = new File(currentAudioFilePath);
            long fileSize = audioFile.length();

            String result = String.format(Locale.getDefault(),
                    "{\"filePath\":\"%s\",\"duration\":%d,\"fileSize\":%d}",
                    currentAudioFilePath, duration, fileSize);

            Log.d(TAG, "录音完成: " + result);
            return createResponseWithJsonData(true, "录音完成", result);

        } catch (Exception e) {
            Log.e(TAG, "停止录音失败", e);
            releaseMediaRecorder();
            isRecording = false;
            return createResponse(false, "停止录音失败: " + e.getMessage(), null);
        }
    }

    /**
     * 取消录音 - 类似微信滑动取消
     */
    @JavascriptInterface
    public String cancelVoiceRecording() {
        try {
            if (!isRecording || mediaRecorder == null) {
                return createResponse(false, "未在录音", null);
            }

            mediaRecorder.stop();
            releaseMediaRecorder();

            // 删除录音文件
            deleteAudioFile(currentAudioFilePath);

            isRecording = false;
            currentAudioFilePath = null;

            Log.d(TAG, "取消录音");
            return createResponse(true, "已取消录音", null);

        } catch (Exception e) {
            Log.e(TAG, "取消录音失败", e);
            releaseMediaRecorder();
            isRecording = false;
            return createResponse(false, "取消录音失败: " + e.getMessage(), null);
        }
    }

    /**
     * 播放语音消息
     */
    @JavascriptInterface
    public String playVoiceMessage(String filePath) {
        try {
            if (isPlaying) {
                stopVoicePlayback();
            }

            File audioFile = new File(filePath);
            if (!audioFile.exists()) {
                return createResponse(false, "音频文件不存在", null);
            }

            mediaPlayer = new MediaPlayer();
            mediaPlayer.setDataSource(filePath);
            mediaPlayer.setOnCompletionListener(mp -> {
                isPlaying = false;
                releaseMediaPlayer();
            });
            mediaPlayer.setOnErrorListener((mp, what, extra) -> {
                Log.e(TAG, "播放出错: what=" + what + ", extra=" + extra);
                isPlaying = false;
                releaseMediaPlayer();
                return true;
            });

            mediaPlayer.prepare();
            mediaPlayer.start();
            isPlaying = true;

            Log.d(TAG, "开始播放: " + filePath);
            return createResponse(true, "开始播放", null);

        } catch (Exception e) {
            Log.e(TAG, "播放失败", e);
            releaseMediaPlayer();
            return createResponse(false, "播放失败: " + e.getMessage(), null);
        }
    }

    /**
     * 停止播放语音
     */
    @JavascriptInterface
    public String stopVoicePlayback() {
        try {
            if (mediaPlayer != null && isPlaying) {
                mediaPlayer.stop();
                releaseMediaPlayer();
                isPlaying = false;
                Log.d(TAG, "停止播放");
                return createResponse(true, "停止播放", null);
            }
            return createResponse(false, "未在播放", null);
        } catch (Exception e) {
            Log.e(TAG, "停止播放失败", e);
            releaseMediaPlayer();
            isPlaying = false;
            return createResponse(false, "停止播放失败: " + e.getMessage(), null);
        }
    }

    // HTTP接口已移至Vue前端实现，sendVoiceMessage接口已删除

    /**
     * 获取录音状态
     */
    @JavascriptInterface
    public String getVoiceRecordingStatus() {
        String status = String.format(Locale.getDefault(),
                "{\"isRecording\":%b,\"isPlaying\":%b,\"currentFile\":\"%s\"}",
                isRecording, isPlaying, currentAudioFilePath != null ? currentAudioFilePath : "");
        return createResponseWithJsonData(true, "获取状态成功", status);
    }

    // ========== 图片发送相关接口 ==========

    /**
     * 选择图片 - 从相册选择
     */
    @JavascriptInterface
    public String selectImageFromGallery() {
        try {
            if (imagePickLauncher == null) {
                return createResponse(false, "图片选择器未初始化", null);
            }

            Intent intent = new Intent(Intent.ACTION_PICK, MediaStore.Images.Media.EXTERNAL_CONTENT_URI);
            intent.setType("image/*");

            imagePickLauncher.launch(intent);

            Log.d(TAG, "启动图片选择器");
            return createResponse(true, "启动图片选择器", null);

        } catch (Exception e) {
            Log.e(TAG, "选择图片失败", e);
            return createResponse(false, "选择图片失败: " + e.getMessage(), null);
        }
    }

    /**
     * 拍照获取图片
     */
    @JavascriptInterface
    public String captureImageFromCamera() {
        try {
            if (imageCaptureLauncher == null) {
                return createResponse(false, "拍照功能未初始化", null);
            }

            // 检查相机权限
            if (!checkCameraPermission()) {
                return createResponse(false, "需要相机权限", null);
            }

            // 创建图片文件
            currentImageFilePath = createImageFilePath();
            File imageFile = new File(currentImageFilePath);

            // 使用FileProvider获取URI
            currentImageUri = FileProvider.getUriForFile(mContext,
                    mContext.getPackageName() + ".fileprovider", imageFile);

            Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            intent.putExtra(MediaStore.EXTRA_OUTPUT, currentImageUri);

            imageCaptureLauncher.launch(intent);

            Log.d(TAG, "启动相机拍照: " + currentImageFilePath);
            return createResponse(true, "启动相机拍照", currentImageFilePath);

        } catch (Exception e) {
            Log.e(TAG, "拍照失败", e);
            return createResponse(false, "拍照失败: " + e.getMessage(), null);
        }
    }

    /**
     * 显示图片选择对话框
     */
    @JavascriptInterface
    public String showImagePickerDialog() {
        try {
            if (!(mContext instanceof Activity)) {
                return createResponse(false, "需要Activity上下文", null);
            }

            // 这里可以通过回调让Activity显示选择对话框
            // 或者直接返回选项让前端处理
            String options = "{\"gallery\":\"从相册选择\",\"camera\":\"拍照\"}";
            return createResponseWithJsonData(true, "获取选择选项", options);

        } catch (Exception e) {
            Log.e(TAG, "显示选择对话框失败", e);
            return createResponse(false, "显示选择对话框失败: " + e.getMessage(), null);
        }
    }

    /**
     * 处理图片选择结果 - 由Activity调用
     */
    public String handleImagePickResult(Uri imageUri) {
        try {
            if (imageUri == null) {
                return createResponse(false, "未选择图片", null);
            }

            // 将选择的图片复制到应用目录
            String savedImagePath = saveImageToAppDirectory(imageUri);
            if (savedImagePath == null) {
                return createResponse(false, "保存图片失败", null);
            }

            // 获取图片信息
            BitmapFactory.Options options = new BitmapFactory.Options();
            options.inJustDecodeBounds = true;
            BitmapFactory.decodeFile(savedImagePath, options);

            File imageFile = new File(savedImagePath);
            long fileSize = imageFile.length();

            String result = String.format(Locale.getDefault(),
                    "{\"filePath\":\"%s\",\"width\":%d,\"height\":%d,\"fileSize\":%d}",
                    savedImagePath, options.outWidth, options.outHeight, fileSize);

            Log.d(TAG, "图片选择完成: " + result);

            // 图片选择完成，结果已返回

            return createResponseWithJsonData(true, "图片选择完成", result);

        } catch (Exception e) {
            Log.e(TAG, "处理图片选择结果失败", e);
            return createResponse(false, "处理图片失败: " + e.getMessage(), null);
        }
    }

    /**
     * 处理拍照结果 - 由Activity调用
     */
    public String handleImageCaptureResult(boolean success) {
        try {
            if (!success || currentImageFilePath == null) {
                return createResponse(false, "拍照失败或取消", null);
            }

            File imageFile = new File(currentImageFilePath);
            if (!imageFile.exists()) {
                return createResponse(false, "拍照文件不存在", null);
            }

            // 获取图片信息
            BitmapFactory.Options options = new BitmapFactory.Options();
            options.inJustDecodeBounds = true;
            BitmapFactory.decodeFile(currentImageFilePath, options);

            long fileSize = imageFile.length();

            String result = String.format(Locale.getDefault(),
                    "{\"filePath\":\"%s\",\"width\":%d,\"height\":%d,\"fileSize\":%d}",
                    currentImageFilePath, options.outWidth, options.outHeight, fileSize);

            Log.d(TAG, "拍照完成: " + result);

            // 拍照完成，结果已返回

            return createResponseWithJsonData(true, "拍照完成", result);

        } catch (Exception e) {
            Log.e(TAG, "处理拍照结果失败", e);
            return createResponse(false, "处理拍照失败: " + e.getMessage(), null);
        }
    }

    // HTTP接口已移至Vue前端实现，sendImageMessage接口已删除

    /**
     * 压缩图片
     */
    @JavascriptInterface
    public String compressImage(String filePath, int quality) {
        try {
            File originalFile = new File(filePath);
            if (!originalFile.exists()) {
                return createResponse(false, "原图片文件不存在", null);
            }

            // 读取原图片
            Bitmap originalBitmap = BitmapFactory.decodeFile(filePath);
            if (originalBitmap == null) {
                return createResponse(false, "无法读取图片", null);
            }

            // 创建压缩后的文件路径
            String compressedPath = filePath.replace(".jpg", "_compressed.jpg")
                    .replace(".jpeg", "_compressed.jpeg")
                    .replace(".png", "_compressed.jpg");

            // 压缩并保存
            FileOutputStream out = new FileOutputStream(compressedPath);
            originalBitmap.compress(Bitmap.CompressFormat.JPEG, quality, out);
            out.flush();
            out.close();

            // 释放原图片内存
            originalBitmap.recycle();

            // 获取压缩后的文件信息
            File compressedFile = new File(compressedPath);
            long originalSize = originalFile.length();
            long compressedSize = compressedFile.length();

            String result = String.format(Locale.getDefault(),
                    "{\"originalPath\":\"%s\",\"compressedPath\":\"%s\",\"originalSize\":%d,\"compressedSize\":%d,\"compressionRatio\":%.2f}",
                    filePath, compressedPath, originalSize, compressedSize,
                    (double) compressedSize / originalSize);

            Log.d(TAG, "图片压缩完成: " + result);
            return createResponseWithJsonData(true, "图片压缩完成", result);

        } catch (Exception e) {
            Log.e(TAG, "压缩图片失败", e);
            return createResponse(false, "压缩失败: " + e.getMessage(), null);
        }
    }

    /**
     * 删除图片文件
     */
    @JavascriptInterface
    public String deleteImageFile(String filePath) {
        try {
            File file = new File(filePath);
            if (file.exists() && file.delete()) {
                Log.d(TAG, "删除图片文件: " + filePath);
                return createResponse(true, "删除成功", null);
            } else {
                return createResponse(false, "文件不存在或删除失败", null);
            }
        } catch (Exception e) {
            Log.e(TAG, "删除图片文件失败", e);
            return createResponse(false, "删除失败: " + e.getMessage(), null);
        }
    }

    // ========== 私有辅助方法 ==========

    /**
     * 读取文件并转换为Base64字符串
     */
    private String readFileToBase64(String filePath) {
        try {
            File file = new File(filePath);
            if (!file.exists()) {
                return "";
            }

            byte[] fileBytes = new byte[(int) file.length()];
            FileInputStream fis = new FileInputStream(file);
            fis.read(fileBytes);
            fis.close();

            return android.util.Base64.encodeToString(fileBytes, android.util.Base64.DEFAULT);
        } catch (Exception e) {
            Log.e(TAG, "读取文件转Base64失败: " + filePath, e);
            return "";
        }
    }

    private boolean checkAudioPermission() {
        return ContextCompat.checkSelfPermission(mContext,
                Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
    }

    private String createAudioFilePath() {
        File audioDir = new File(mContext.getExternalFilesDir(Environment.DIRECTORY_MUSIC), "voice_messages");
        if (!audioDir.exists()) {
            audioDir.mkdirs();
        }

        String timeStamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(new Date());
        return new File(audioDir, "voice_" + timeStamp + ".aac").getAbsolutePath();
    }

    private void releaseMediaRecorder() {
        if (mediaRecorder != null) {
            try {
                mediaRecorder.release();
            } catch (Exception e) {
                Log.e(TAG, "释放MediaRecorder失败", e);
            }
            mediaRecorder = null;
        }
    }

    private void releaseMediaPlayer() {
        if (mediaPlayer != null) {
            try {
                mediaPlayer.release();
            } catch (Exception e) {
                Log.e(TAG, "释放MediaPlayer失败", e);
            }
            mediaPlayer = null;
        }
    }

    private void deleteAudioFile(String filePath) {
        if (filePath != null) {
            File file = new File(filePath);
            if (file.exists()) {
                file.delete();
            }
        }
    }

    private String createResponse(boolean success, String message, String data) {
        return String.format(Locale.getDefault(),
                "{\"success\":%b,\"message\":\"%s\",\"data\":%s}",
                success, message, data != null ? "\"" + data + "\"" : "null");
    }

    private String createResponseWithJsonData(boolean success, String message, String jsonData) {
        return String.format(Locale.getDefault(),
                "{\"success\":%b,\"message\":\"%s\",\"data\":%s}",
                success, message, jsonData != null ? jsonData : "null");
    }

    private boolean checkCameraPermission() {
        return ContextCompat.checkSelfPermission(mContext,
                Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
    }

    private String createImageFilePath() {
        File imageDir = new File(mContext.getExternalFilesDir(Environment.DIRECTORY_PICTURES), "chat_images");
        if (!imageDir.exists()) {
            imageDir.mkdirs();
        }

        String timeStamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(new Date());
        return new File(imageDir, "IMG_" + timeStamp + ".jpg").getAbsolutePath();
    }

    private String saveImageToAppDirectory(Uri imageUri) {
        try {
            InputStream inputStream = mContext.getContentResolver().openInputStream(imageUri);
            if (inputStream == null) {
                return null;
            }

            String savedPath = createImageFilePath();
            FileOutputStream outputStream = new FileOutputStream(savedPath);

            byte[] buffer = new byte[1024];
            int length;
            while ((length = inputStream.read(buffer)) > 0) {
                outputStream.write(buffer, 0, length);
            }

            outputStream.close();
            inputStream.close();

            return savedPath;

        } catch (Exception e) {
            Log.e(TAG, "保存图片到应用目录失败", e);
            return null;
        }
    }

    // 桥接器接口，用于连接原有的ExerciseSolveActivity功能
    // HTTP接口已移至Vue前端实现，仅保留原生功能接口
    public interface ExerciseSolveActivityBridge {
        void startPhotoSearch(String subject);

        // HTTP接口已移至Vue前端实现，语音和图片消息发送接口已删除

        // 图片选择回调接口（保留原生功能）
        default void onImageSelected(String imageInfo) {
            // 默认实现，可以在具体的Activity中重写
        }

        default void onImageCaptured(String imageInfo) {
            // 默认实现，可以在具体的Activity中重写
            Log.e(TAG, "默认实现，可以在具体的Activity中重写");
        }

        // HTTP接口已移至Vue前端实现，老师双向对话接口已删除

        // 老师消息回调接口（保留消息监听功能）
        void setTeacherMessageCallback(String callbackName);

        void onTeacherMessageReceived(String messageData);
    }

    // ========== FindExercise 相关接口 ==========
    
    /**
     * 启动练习页面
     */
    @JavascriptInterface
    public void startExerciseSolve() {
        if (exerciseBridge != null) {
            // 这里可以添加启动练习页面的逻辑
            Log.d(TAG, "启动练习页面");
        } else {
            Log.e(TAG, "没有可用的桥接器来启动练习页面");
        }
    }

    /**
     * 启动练习页面 - WebView版本
     */
    @JavascriptInterface
    public void startExerciseSolveWebView() {
        Log.d(TAG, "startExerciseSolveWebView 被调用");
        Log.d(TAG, "findExerciseBridge: " + (findExerciseBridge != null ? "已设置" : "未设置"));
        Log.d(TAG, "exerciseBridge: " + (exerciseBridge != null ? "已设置" : "未设置"));
        
        if (findExerciseBridge != null) {
            Log.d(TAG, "使用 findExerciseBridge 调用 startExerciseSolveWebView");
            findExerciseBridge.startExerciseSolveWebView();
        } else if (exerciseBridge instanceof FindExerciseActivityBridge) {
            Log.d(TAG, "使用 exerciseBridge 调用 startExerciseSolveWebView");
            ((FindExerciseActivityBridge) exerciseBridge).startExerciseSolveWebView();
        } else {
            Log.e(TAG, "没有可用的桥接器来启动练习页面");
        }
    }

    /**
     * 关闭Activity
     */
    @JavascriptInterface
    public void finishActivity() {
        Log.d(TAG, "🔙 finishActivity 被调用");
        Log.d(TAG, "🔙 findExerciseBridge: " + (findExerciseBridge != null ? "已设置" : "未设置"));
        Log.d(TAG, "🔙 exerciseBridge: " + (exerciseBridge != null ? "已设置" : "未设置"));
        
        if (findExerciseBridge != null) {
            Log.d(TAG, "🔙 使用 findExerciseBridge 调用 finishActivity");
            findExerciseBridge.finishActivity();
        } else if (exerciseBridge instanceof FindExerciseActivityBridge) {
            Log.d(TAG, "🔙 使用 exerciseBridge 调用 finishActivity");
            ((FindExerciseActivityBridge) exerciseBridge).finishActivity();
        } else {
            Log.e(TAG, "🔙 没有可用的桥接器来关闭Activity");
        }
    }

    /**
     * 显示Toast消息
     */
    @JavascriptInterface
    public void showToastMessage(String message) {
        if (findExerciseBridge != null) {
            findExerciseBridge.showToast(message);
        } else if (exerciseBridge instanceof FindExerciseActivityBridge) {
            ((FindExerciseActivityBridge) exerciseBridge).showToast(message);
        }
    }

    // ========== 键盘控制相关接口 ==========
    
    /**
     * 禁用原生键盘弹出
     * 通过设置WebView中所有输入元素的属性来阻止键盘弹出
     */
    @JavascriptInterface
    public String disableNativeKeyboard() {
        try {
            Log.d(TAG, "🎯 [ANDROID] 禁用原生键盘弹出");
            
            // 通过JavaScript设置所有输入元素的属性
            String script = 
                "document.querySelectorAll('input, textarea, [contenteditable], math-field').forEach(el => {" +
                "  el.setAttribute('inputmode', 'none');" +
                "  el.setAttribute('readonly', 'true');" +
                "  el.style.setProperty('-webkit-user-select', 'none');" +
                "  el.style.setProperty('pointer-events', 'none');" +
                "  console.log('🎯 [ANDROID] 禁用元素键盘:', el.tagName, el.className);" +
                "});" +
                "console.log('🎯 [ANDROID] 原生键盘已禁用');";
            
            // 执行JavaScript
            executeJavaScript(script);
            
            return createResponse(true, "原生键盘已禁用", null);
            
        } catch (Exception e) {
            Log.e(TAG, "禁用原生键盘失败", e);
            return createResponse(false, "禁用原生键盘失败: " + e.getMessage(), null);
        }
    }
    
    /**
     * 启用原生键盘弹出
     * 恢复WebView中所有输入元素的正常属性
     */
    @JavascriptInterface
    public String enableNativeKeyboard() {
        try {
            Log.d(TAG, "🎯 [ANDROID] 启用原生键盘弹出");
            
            // 通过JavaScript恢复所有输入元素的属性
            String script = 
                "document.querySelectorAll('input, textarea, [contenteditable], math-field').forEach(el => {" +
                "  el.removeAttribute('inputmode');" +
                "  el.removeAttribute('readonly');" +
                "  el.style.removeProperty('-webkit-user-select');" +
                "  el.style.removeProperty('pointer-events');" +
                "  console.log('🎯 [ANDROID] 启用元素键盘:', el.tagName, el.className);" +
                "});" +
                "console.log('🎯 [ANDROID] 原生键盘已启用');";
            
            // 执行JavaScript
            executeJavaScript(script);
            
            return createResponse(true, "原生键盘已启用", null);
            
        } catch (Exception e) {
            Log.e(TAG, "启用原生键盘失败", e);
            return createResponse(false, "启用原生键盘失败: " + e.getMessage(), null);
        }
    }
    
    // WebView实例引用，用于执行JavaScript
    private WebView webView;
    
    /**
     * 设置WebView实例
     */
    public void setWebView(WebView webView) {
        this.webView = webView;
    }
    
    /**
     * 执行JavaScript代码
     * 确保在主线程上执行WebView操作
     */
    public void executeJavaScript(String script) {
        if (webView != null) {
            if (mContext instanceof Activity) {
                ((Activity) mContext).runOnUiThread(() -> {
                    webView.evaluateJavascript(script, null);
                    Log.d(TAG, "🎯 [ANDROID] 执行JavaScript: " + script);
                });
            } else {
                Log.w(TAG, "🎯 [ANDROID] Context不是Activity，无法执行JavaScript");
            }
        } else {
            Log.w(TAG, "🎯 [ANDROID] WebView实例为空，无法执行JavaScript");
        }
    }
}
