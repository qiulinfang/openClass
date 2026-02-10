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
import android.os.Bundle;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import android.provider.MediaStore;
import android.net.Uri;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import android.view.View;
import android.content.ContentValues;
import android.os.Build;
import androidx.core.content.FileProvider;
import java.io.FileOutputStream;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;

import com.cosinetech.imates.ui.webview.common.LocalStorageHelper;
import com.cosinetech.imates.ui.activities.ExerciseSolveActivity;
import com.cosinetech.imates.data.models.Subject;
import com.cosinetech.imates.utils.AppUtils;
import com.cosinetech.imates.utils.ImageUtils;
import com.cosinetech.imates.data.models.ChatMessage;
import com.cosinetech.imates.data.models.UserInfoViewModel;
import com.cosinetech.imates.teachermessagemq.MessagingManager;
import com.cosinetech.imates.teachermessagemq.StudentMessage;
import com.cosinetech.imates.utils.VoiceDbUtil;
import com.cosinetech.imates.screenshot.MediaProjectionScreenshotManager;
import com.cosinetech.imates.screencasting.ScreenCastingManager;
import com.cosinetech.imates.screencasting.DeviceClientWrapper;
import com.cosinetech.imates.screencasting.model.DeviceType;
import com.cosinetech.imates.ApplicationModelShared;
import androidx.lifecycle.ViewModelProvider;
import org.loka.screensharekit.ScreenShareKit;
import org.loka.screensharekit.EncodeBuilder;
import com.cosinetech.imates.screencasting.H264MpegTSStreamerManager;
import com.cosinetech.imates.screencasting.H264IFrameCache;
import com.cosinetech.imates.screencasting.FFmpegPipeStreamer;
import com.cosinetech.imates.screencasting.UdpForwarderManager;
import com.cosinetech.imates.textbookservice.LearnResourceManager;
import com.cosinetech.imates.textbookservice.UserLearnData;
import com.cosinetech.imates.textbookservice.UserTextbookInfo;
import com.cosinetech.imates.textbookservice.LocalFileInfo;
import com.cosinetech.imates.textbookservice.LocalPackageInfo;
import com.cosinetech.imates.ui.mupdfviewer.activity.MuPDFActivity;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;

import java.io.File;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import com.cosinetech.imates.coreapiservice.ApiUrl;

public class WebAppInterface {
    Context mContext;
    private ExerciseSolveActivityBridge exerciseBridge;
    private FindExerciseActivityBridge findExerciseBridge;
    private WebAppReadyCallback webAppReadyCallback;

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
    private ActivityResultLauncher<String> cameraPermissionLauncher;
    private ActivityResultLauncher<String> audioPermissionLauncher;

    public WebAppInterface(Context c) {
        mContext = c;
        // 初始化 MediaProjection 截图管理器
        mScreenshotManager = new MediaProjectionScreenshotManager(c);
    }

    // 设置ExerciseSolve桥接器
    public void setExerciseBridge(ExerciseSolveActivityBridge bridge) {
        this.exerciseBridge = bridge;
    }

    // 设置FindExercise桥接器
    public void setFindExerciseBridge(FindExerciseActivityBridge bridge) {
        this.findExerciseBridge = bridge;
    }

    // 设置Web应用就绪回调
    public void setWebAppReadyCallback(WebAppReadyCallback callback) {
        this.webAppReadyCallback = callback;
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
     * 设置相机权限请求的 ActivityResultLauncher
     */
    public void setCameraPermissionLauncher(ActivityResultLauncher<String> cameraPermissionLauncher) {
        this.cameraPermissionLauncher = cameraPermissionLauncher;
    }

    /**
     * 设置录音权限请求的 ActivityResultLauncher
     */
    public void setAudioPermissionLauncher(ActivityResultLauncher<String> audioPermissionLauncher) {
        this.audioPermissionLauncher = audioPermissionLauncher;
    }

    /**
     * 这个方法暴露给JS调用
     * 必须有 @JavascriptInterface 注解
     */
    @JavascriptInterface
    public void showToast(String toast) {
        Toast.makeText(mContext, toast, Toast.LENGTH_SHORT).show();
    }

    /**
     * 控制系统级悬浮 FAB 显示/隐藏
     * 由 Web 侧根据路由与面板状态同步给原生
     */
    @JavascriptInterface
    public void setFloatingFabVisible(boolean visible) {
        try {
            ApplicationModelShared app = ApplicationModelShared.getInstance();
            if (app == null) {
                Log.w(TAG, "setFloatingFabVisible: ApplicationModelShared is null");
                return;
            }

            // 先缓存，避免 Service 尚未启动/注册导致指令丢失
            app.setPendingFloatingFabVisible(visible);

            com.cosinetech.imates.ui.fab.FloatingFabService service = app.getFloatingFabService();
            if (service == null) {
                Log.w(TAG, "setFloatingFabVisible: FloatingFabService is null, try start service");
                // 兜底：尝试启动服务，等待其 onCreate 注册后再应用 pending 状态
                try {
                    app.startFloatingFabService();
                } catch (Exception e) {
                    Log.w(TAG, "setFloatingFabVisible: startFloatingFabService failed", e);
                }
                return;
            }

            if (visible) {
                service.showFab();
            } else {
                service.hideFab();
            }
        } catch (Exception e) {
            Log.e(TAG, "setFloatingFabVisible failed", e);
        }
    }

    /**
     * Web应用就绪通知
     * 由Web端主动调用，通知Android端应用已就绪
     * 替代Android端的轮询检测机制
     */
    @JavascriptInterface
    public void notifyWebAppReady() {
        Log.d(TAG, "✅ 收到Web应用就绪通知");
        if (webAppReadyCallback != null) {
            Log.d(TAG, "✅ WebAppReadyCallback已设置，开始执行回调");
            webAppReadyCallback.onWebAppReady();
            Log.d(TAG, "✅ onWebAppReady回调执行完成");
        } else {
            Log.w(TAG, "⚠️ WebAppReadyCallback未设置，无法处理就绪通知");
        }
    }

    /**
     * 供原生侧（如 FloatingFabService）直接向 Web 派发 floating-fab-action 事件。
     * 避免通过 startActivity 拉起/重启 MainWebViewActivity 导致 Web 端路由守卫跳转 login。
     */
    public void dispatchFloatingFabActionEventToWeb(String action) {
        try {
            if (webView == null) {
                Log.w(TAG, "dispatchFloatingFabActionEventToWeb: webView is null");
                return;
            }
            if (action == null) {
                Log.w(TAG, "dispatchFloatingFabActionEventToWeb: action is null");
                return;
            }

            String safeAction = action.replace("'", "\\'");
            String jsCode = "javascript:(function() {" +
                    "  try {" +
                    "    var event = new CustomEvent('floating-fab-action', { detail: { action: '" + safeAction + "' } });" +
                    "    window.dispatchEvent(event);" +
                    "    console.log('📡 [Android] 触发 floating-fab-action 事件', {action: '" + safeAction + "'});" +
                    "  } catch(e) {" +
                    "    console.error('📡 [Android] 触发事件失败:', e);" +
                    "  }" +
                    "})()";

            webView.post(() -> {
                try {
                    webView.evaluateJavascript(jsCode, null);
                } catch (Exception e) {
                    Log.e(TAG, "dispatchFloatingFabActionEventToWeb: evaluateJavascript failed", e);
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "dispatchFloatingFabActionEventToWeb failed", e);
        }
    }

    @JavascriptInterface
    public String getUserToken() {
        return AppUtils.getUserToken();
    }

    /**
     * 获取用户信息
     * 返回JSON格式的用户信息，包含userId、userName、nickName等字段
     * 
     * @return 用户信息JSON字符串
     */
    @JavascriptInterface
    public String getUserInfo() {
        try {
            String userId = AppUtils.getUserId();
            String nickName = AppUtils.getUserNickName();

            // 获取UserInfoViewModel以获取更多用户信息
            UserInfoViewModel userInfoViewModel = new ViewModelProvider(
                    ApplicationModelShared.getInstance(),
                    new ViewModelProvider.AndroidViewModelFactory(ApplicationModelShared.getInstance()))
                    .get(UserInfoViewModel.class);

            JSONObject userInfoJson = new JSONObject();
            if (userId != null && !userId.isEmpty()) {
                userInfoJson.put("userId", userId);
                userInfoJson.put("id", userId); // 同时提供id字段以兼容不同前端
            }
            if (nickName != null && !nickName.isEmpty()) {
                userInfoJson.put("nickName", nickName);
                userInfoJson.put("userName", nickName); // 同时提供userName字段
            }

            // 如果UserInfoViewModel中有用户信息，也添加到JSON中
            if (userInfoViewModel.userInfo.getValue() != null) {
                com.cosinetech.imates.data.models.UserInfo userInfo = userInfoViewModel.userInfo.getValue();
                if (userInfo.getName() != null && !userInfo.getName().isEmpty()) {
                    userInfoJson.put("name", userInfo.getName());
                }
                if (userInfo.getAvatar() != null && !userInfo.getAvatar().isEmpty()) {
                    userInfoJson.put("avatar", userInfo.getAvatar());
                }
            }

            Log.d(TAG, "获取用户信息: " + userInfoJson.toString());
            return userInfoJson.toString();
        } catch (JSONException e) {
            Log.e(TAG, "获取用户信息失败", e);
            // 返回空对象而不是null，避免前端解析错误
            return "{}";
        } catch (Exception e) {
            Log.e(TAG, "获取用户信息失败", e);
            // 返回空对象而不是null，避免前端解析错误
            return "{}";
        }
    }

    /**
     * 同步Web端用户信息到Android原生ViewModel
     * 用于Web登录后同步状态
     * 
     * @param userId   用户ID
     * @param token    用户Token
     * @param password 用户密码（可选）
     * @return 同步结果
     */
    @JavascriptInterface
    public String syncUserInfo(String userId, String token, String password) {
        try {
            if (userId == null || userId.isEmpty()) {
                return createResponse(false, "用户ID不能为空", null);
            }

            if (token == null || token.isEmpty()) {
                return createResponse(false, "Token不能为空", null);
            }

            // 第1步：获取UserInfoViewModel实例
            UserInfoViewModel userInfoViewModel = new ViewModelProvider(
                    ApplicationModelShared.getInstance(),
                    new ViewModelProvider.AndroidViewModelFactory(ApplicationModelShared.getInstance()))
                    .get(UserInfoViewModel.class);

            // 第2步：同步用户信息到ViewModel
            userInfoViewModel.userId.postValue(userId);
            userInfoViewModel.token.postValue(token);
            if (password != null && !password.isEmpty()) {
                userInfoViewModel.password.postValue(password);
            }

            Log.d(TAG, "用户信息同步成功: userId=" + userId);
            return createResponse(true, "用户信息同步成功", null);

        } catch (Exception e) {
            Log.e(TAG, "同步用户信息失败", e);
            return createResponse(false, "同步用户信息失败: " + e.getMessage(), null);
        }
    }

    // ========== ExerciseSolve 相关接口 ==========

    /**
     * 发送文本消息给老师（简化版：不保存到本地数据库）
     * 第1步：验证用户登录
     * 第2步：检查RabbitMQ连接状态
     * 第3步：构建StudentMessage
     * 第4步：通过RabbitMQ发送（带回调）
     * 第5步：返回结果
     */
    @JavascriptInterface
    public String sendTextMessageToTeacher(String content, String sessionId, String subject) {
        String userId = null;
        String messageId = null;
        long timestamp = System.currentTimeMillis();

        try {
            Log.d(TAG, "sendTextMessageToTeacher: 开始发送消息");
            Log.d(TAG, "sendTextMessageToTeacher: content长度=" + (content != null ? content.length() : 0) +
                    ", sessionId=" + sessionId + ", subject=" + subject);

            // 第1步：验证用户登
            userId = AppUtils.getUserId();
            if (userId == null || userId.isEmpty()) {
                Log.e(TAG, "sendTextMessageToTeacher: 用户未登录");
                return createResponse(false, "用户未登录", null);
            }
            Log.d(TAG, "sendTextMessageToTeacher: userId=" + userId);

            // 第2步：检查RabbitMQ连接状态
            MessagingManager messagingManager = MessagingManager.getInstance();

            // 详细检查初始化状态
            boolean initialized = messagingManager.isInitialized();
            Log.d(TAG, "sendTextMessageToTeacher: MessagingManager初始化状态检查");
            Log.d(TAG, "sendTextMessageToTeacher: isInitialized()=" + initialized);

            if (!initialized) {
                Log.w(TAG, "sendTextMessageToTeacher: MessagingManager未初始化，检查是否正在初始化中");

                // 检查是否正在初始化中
                boolean connecting = messagingManager.isConnecting();
                if (connecting) {
                    Log.d(TAG, "sendTextMessageToTeacher: MessagingManager正在初始化中，等待完成");
                    // 如果正在初始化中，等待最多10秒
                    int waitCount = 0;
                    int maxWait = 100; // 100次 * 100ms = 10秒
                    while ((messagingManager.isConnecting() || !messagingManager.isInitialized())
                            && waitCount < maxWait) {
                        Thread.sleep(100);
                        waitCount++;
                        // 每2秒输出一次进度日志
                        if (waitCount % 20 == 0) {
                            Log.d(TAG, "sendTextMessageToTeacher: 等待初始化中... (" + (waitCount * 100) + "ms/"
                                    + (maxWait * 100) + "ms)");
                        }
                    }

                    if (messagingManager.isInitialized()) {
                        Log.d(TAG, "sendTextMessageToTeacher: 等待初始化成功，等待耗时=" + (waitCount * 100) + "ms");
                    } else {
                        Log.w(TAG, "sendTextMessageToTeacher: 等待初始化超时（10秒）");
                        return createResponse(false, "RabbitMQ连接正在初始化中，请稍后重试", null);
                    }
                } else {
                    // 没有正在初始化，尝试自动初始化（如果mContext可用）
                    if (mContext != null && userId != null && !userId.isEmpty()) {
                        try {
                            Log.d(TAG, "sendTextMessageToTeacher: 开始自动初始化MessagingManager, userId=" + userId);
                            messagingManager.initialize(mContext, userId);

                            // 等待初始化完成，最多等待10秒（RabbitMQ连接可能需要更长时间）
                            int waitCount = 0;
                            int maxWait = 100; // 100次 * 100ms = 10秒
                            while (!messagingManager.isInitialized() && waitCount < maxWait) {
                                Thread.sleep(100);
                                waitCount++;
                                // 每2秒输出一次进度日志
                                if (waitCount % 20 == 0) {
                                    Log.d(TAG, "sendTextMessageToTeacher: 等待初始化中... (" + (waitCount * 100) + "ms/"
                                            + (maxWait * 100) + "ms)");
                                }
                            }

                            if (messagingManager.isInitialized()) {
                                Log.d(TAG, "sendTextMessageToTeacher: 自动初始化成功，等待耗时=" + (waitCount * 100) + "ms");
                            } else {
                                Log.w(TAG, "sendTextMessageToTeacher: 自动初始化超时（10秒），可能仍在后台初始化中");
                                return createResponse(false, "RabbitMQ连接正在初始化中，请稍后重试", null);
                            }
                        } catch (Exception e) {
                            Log.e(TAG, "sendTextMessageToTeacher: 自动初始化失败", e);
                            return createResponse(false, "RabbitMQ连接初始化失败: " + e.getMessage(), null);
                        }
                    } else {
                        Log.e(TAG,
                                "sendTextMessageToTeacher: 无法自动初始化 - mContext=" + (mContext != null ? "可用" : "null") +
                                        ", userId=" + (userId != null ? userId : "null"));
                        return createResponse(false, "RabbitMQ连接未初始化，请稍后重试", null);
                    }
                }
            }

            Log.d(TAG, "sendTextMessageToTeacher: MessagingManager已初始化，可以发送消息");

            // 第3步：确定学科类型
            String teacherSubject;
            if ("biology".equals(subject)) {
                teacherSubject = "6"; // SCHOOL_SUBJECT_BIOLOGY
            } else if ("math".equals(subject)) {
                teacherSubject = "2"; // SCHOOL_SUBJECT_MATH
            } else {
                Log.e(TAG, "sendTextMessageToTeacher: 不支持的学科类型=" + subject);
                return createResponse(false, "不支持的学科类型: " + subject, null);
            }
            Log.d(TAG, "sendTextMessageToTeacher: teacherSubject=" + teacherSubject + " (from " + subject + ")");

            // 第4步：创建StudentMessage
            messageId = UUID.randomUUID().toString();

            // 诊断：检查发送消息的userId是否与初始化时的userId一致
            String initializedUserId = messagingManager.getUserId();
            if (initializedUserId != null && !initializedUserId.equals(userId)) {
                Log.e(TAG, "========================================");
                Log.e(TAG, "【严重警告】sendTextMessageToTeacher: 发送消息的userId与初始化时的userId不一致！");
                Log.e(TAG, "发送消息的userId=" + userId);
                Log.e(TAG, "初始化时的userId=" + initializedUserId);
                Log.e(TAG, "监听队列=" + initializedUserId + "_a");
                Log.e(TAG, "消息目标队列=" + userId + "_a");
                Log.e(TAG, "监听队列和消息目标队列不匹配，无法接收老师回复！");
                Log.e(TAG, "请确保发送消息时使用的userId与初始化时一致！");
                Log.e(TAG, "========================================");
            } else if (initializedUserId == null) {
                Log.w(TAG, "sendTextMessageToTeacher: MessagingManager已初始化但userId为null，可能初始化时传入了null");
            } else {
                Log.d(TAG, "sendTextMessageToTeacher: userId检查通过，发送消息的userId=" + userId + " 与初始化userId="
                        + initializedUserId + " 一致");
            }

            StudentMessage studentMsg = new StudentMessage(
                    userId, sessionId, teacherSubject, 0, content); // 0 = QA_MSG_TYPE_TEXT
            studentMsg.setMessageId(messageId);
            Log.d(TAG, "sendTextMessageToTeacher: 创建StudentMessage完成, messageId=" + messageId);

            // 第5步：通过RabbitMQ发送（带回调，使用CountDownLatch等待异步结果）
            final CountDownLatch latch = new CountDownLatch(1);
            final boolean[] sendSuccess = { false };
            final String[] actualMessageId = { null };
            final String[] errorMessage = { null };

            MessagingManager.SendCallback callback = new MessagingManager.SendCallback() {
                @Override
                public void onSendResult(boolean success, String msgId, String error) {
                    sendSuccess[0] = success;
                    actualMessageId[0] = msgId;
                    errorMessage[0] = error;
                    Log.d(TAG, "sendTextMessageToTeacher: 回调结果 - success=" + success +
                            ", messageId=" + msgId + ", error=" + error);
                    latch.countDown();
                }
            };

            Log.d(TAG, "sendTextMessageToTeacher: 开始发送到RabbitMQ");
            messagingManager.sendMessageToTeacher(studentMsg, callback);

            // 等待回调完成，最多等待5秒
            boolean completed = latch.await(5, TimeUnit.SECONDS);
            if (!completed) {
                Log.e(TAG, "sendTextMessageToTeacher: 等待回调超时（5秒）");
                return createResponse(false, "消息发送超时，请检查网络连接", null);
            }

            // 第6步：根据回调结果返回
            if (!sendSuccess[0]) {
                String error = errorMessage[0] != null ? errorMessage[0] : "未知错误";
                Log.e(TAG, "sendTextMessageToTeacher: RabbitMQ发送失败 - " + error);
                return createResponse(false, "消息发送失败: " + error, null);
            }

            // 使用回调返回的实际messageId（如果有）
            String finalMessageId = actualMessageId[0] != null ? actualMessageId[0] : messageId;
            Log.d(TAG, "sendTextMessageToTeacher: 消息发送成功, messageId=" + finalMessageId);

            // 构建返回数据（使用JSONObject避免特殊字符转义问题）
            JSONObject messageDataObj = new JSONObject();
            messageDataObj.put("messageId", finalMessageId);
            messageDataObj.put("userId", userId);
            messageDataObj.put("sessionId", sessionId);
            messageDataObj.put("subject", teacherSubject);
            messageDataObj.put("messageType", "TEXT");
            messageDataObj.put("content", content);
            messageDataObj.put("timestamp", timestamp);
            String messageData = messageDataObj.toString();

            return createResponseWithJsonData(true, "消息发送成功", messageData);

        } catch (InterruptedException e) {
            Log.e(TAG, "sendTextMessageToTeacher: 等待回调被中断", e);
            Thread.currentThread().interrupt();
            return createResponse(false, "消息发送被中断: " + e.getMessage(), null);
        } catch (Exception e) {
            Log.e(TAG, "sendTextMessageToTeacher: 发送消息异常", e);
            return createResponse(false, "发送消息失败: " + e.getMessage(), null);
        }
    }

    /**
     * 发送语音消息给老师（简化版：不保存到本地数据库）
     * 第1步：验证用户登录
     * 第2步：检查RabbitMQ连接状态
     * 第3步：检查语音文件
     * 第4步：读取并转Base64
     * 第5步：通过RabbitMQ发送（带回调）
     * 第6步：返回结果
     */
    @JavascriptInterface
    public String sendVoiceMessageToTeacher(String voicePath, String duration, String sessionId, String subject) {
        String userId = null;
        String messageId = null;
        long timestamp = System.currentTimeMillis();

        try {
            Log.d(TAG, "sendVoiceMessageToTeacher: 开始发送语音消息");
            Log.d(TAG, "sendVoiceMessageToTeacher: voicePath=" + voicePath +
                    ", duration=" + duration + ", sessionId=" + sessionId + ", subject=" + subject);

            // 第1步：验证用户登录
            userId = AppUtils.getUserId();
            if (userId == null || userId.isEmpty()) {
                Log.e(TAG, "sendVoiceMessageToTeacher: 用户未登录");
                return createResponse(false, "用户未登录", null);
            }
            Log.d(TAG, "sendVoiceMessageToTeacher: userId=" + userId);

            // 第2步：检查RabbitMQ连接状态
            MessagingManager messagingManager = MessagingManager.getInstance();

            // 详细检查初始化状态
            boolean initialized = messagingManager.isInitialized();
            Log.d(TAG, "sendVoiceMessageToTeacher: MessagingManager初始化状态检查");
            Log.d(TAG, "sendVoiceMessageToTeacher: isInitialized()=" + initialized);

            if (!initialized) {
                Log.w(TAG, "sendVoiceMessageToTeacher: MessagingManager未初始化，检查是否正在初始化中");

                // 检查是否正在初始化中
                boolean connecting = messagingManager.isConnecting();
                if (connecting) {
                    Log.d(TAG, "sendVoiceMessageToTeacher: MessagingManager正在初始化中，等待完成");
                    // 如果正在初始化中，等待最多10秒
                    int waitCount = 0;
                    int maxWait = 100; // 100次 * 100ms = 10秒
                    while ((messagingManager.isConnecting() || !messagingManager.isInitialized())
                            && waitCount < maxWait) {
                        Thread.sleep(100);
                        waitCount++;
                        // 每2秒输出一次进度日志
                        if (waitCount % 20 == 0) {
                            Log.d(TAG, "sendVoiceMessageToTeacher: 等待初始化中... (" + (waitCount * 100) + "ms/"
                                    + (maxWait * 100) + "ms)");
                        }
                    }

                    if (messagingManager.isInitialized()) {
                        Log.d(TAG, "sendVoiceMessageToTeacher: 等待初始化成功，等待耗时=" + (waitCount * 100) + "ms");
                    } else {
                        Log.w(TAG, "sendVoiceMessageToTeacher: 等待初始化超时（10秒）");
                        return createResponse(false, "RabbitMQ连接正在初始化中，请稍后重试", null);
                    }
                } else {
                    // 没有正在初始化，尝试自动初始化（如果mContext可用）
                    if (mContext != null && userId != null && !userId.isEmpty()) {
                        try {
                            Log.d(TAG, "sendVoiceMessageToTeacher: 开始自动初始化MessagingManager, userId=" + userId);
                            messagingManager.initialize(mContext, userId);

                            // 等待初始化完成，最多等待10秒（RabbitMQ连接可能需要更长时间）
                            int waitCount = 0;
                            int maxWait = 100; // 100次 * 100ms = 10秒
                            while (!messagingManager.isInitialized() && waitCount < maxWait) {
                                Thread.sleep(100);
                                waitCount++;
                                // 每2秒输出一次进度日志
                                if (waitCount % 20 == 0) {
                                    Log.d(TAG, "sendVoiceMessageToTeacher: 等待初始化中... (" + (waitCount * 100) + "ms/"
                                            + (maxWait * 100) + "ms)");
                                }
                            }

                            if (messagingManager.isInitialized()) {
                                Log.d(TAG, "sendVoiceMessageToTeacher: 自动初始化成功，等待耗时=" + (waitCount * 100) + "ms");
                            } else {
                                Log.w(TAG, "sendVoiceMessageToTeacher: 自动初始化超时（10秒），可能仍在后台初始化中");
                                return createResponse(false, "RabbitMQ连接正在初始化中，请稍后重试", null);
                            }
                        } catch (Exception e) {
                            Log.e(TAG, "sendVoiceMessageToTeacher: 自动初始化失败", e);
                            return createResponse(false, "RabbitMQ连接初始化失败: " + e.getMessage(), null);
                        }
                    } else {
                        Log.e(TAG,
                                "sendVoiceMessageToTeacher: 无法自动初始化 - mContext=" + (mContext != null ? "可用" : "null") +
                                        ", userId=" + (userId != null ? userId : "null"));
                        return createResponse(false, "RabbitMQ连接未初始化，请稍后重试", null);
                    }
                }
            }

            Log.d(TAG, "sendVoiceMessageToTeacher: MessagingManager已初始化，可以发送消息");

            // 第3步：检查语音文件是否存在
            File voiceFile = new File(voicePath);
            if (!voiceFile.exists()) {
                Log.e(TAG, "sendVoiceMessageToTeacher: 语音文件不存在 - " + voicePath);
                return createResponse(false, "语音文件不存在: " + voicePath, null);
            }
            Log.d(TAG, "sendVoiceMessageToTeacher: 语音文件存在, 大小=" + voiceFile.length() + " bytes");

            // 第4步：确定学科类型
            String teacherSubject;
            if ("biology".equals(subject)) {
                teacherSubject = "6"; // SCHOOL_SUBJECT_BIOLOGY
            } else if ("math".equals(subject)) {
                teacherSubject = "2"; // SCHOOL_SUBJECT_MATH
            } else {
                Log.e(TAG, "sendVoiceMessageToTeacher: 不支持的学科类型=" + subject);
                return createResponse(false, "不支持的学科类型: " + subject, null);
            }
            Log.d(TAG, "sendVoiceMessageToTeacher: teacherSubject=" + teacherSubject + " (from " + subject + ")");

            // 第5步：创建StudentMessage
            messageId = UUID.randomUUID().toString();

            // 第6步：读取语音文件并转换为Base64
            Log.d(TAG, "sendVoiceMessageToTeacher: 开始读取语音文件并转换为Base64");
            String voiceBase64Content = VoiceDbUtil.getRawVoiceBase64(voicePath);
            if (voiceBase64Content == null || voiceBase64Content.equals("null")) {
                Log.e(TAG, "sendVoiceMessageToTeacher: 语音文件读取失败");
                return createResponse(false, "语音文件读取失败", null);
            }
            Log.d(TAG, "sendVoiceMessageToTeacher: Base64编码完成, 长度=" +
                    (voiceBase64Content != null ? voiceBase64Content.length() : 0));

            StudentMessage studentMsg = new StudentMessage(
                    userId, sessionId, teacherSubject, 2, voiceBase64Content); // 2 = QA_MSG_TYPE_VOICE
            studentMsg.setMessageId(messageId);
            Log.d(TAG, "sendVoiceMessageToTeacher: 创建StudentMessage完成, messageId=" + messageId);

            // 第7步：通过RabbitMQ发送（带回调，使用CountDownLatch等待异步结果）
            final CountDownLatch latch = new CountDownLatch(1);
            final boolean[] sendSuccess = { false };
            final String[] actualMessageId = { null };
            final String[] errorMessage = { null };

            MessagingManager.SendCallback callback = new MessagingManager.SendCallback() {
                @Override
                public void onSendResult(boolean success, String msgId, String error) {
                    sendSuccess[0] = success;
                    actualMessageId[0] = msgId;
                    errorMessage[0] = error;
                    Log.d(TAG, "sendVoiceMessageToTeacher: 回调结果 - success=" + success +
                            ", messageId=" + msgId + ", error=" + error);
                    latch.countDown();
                }
            };

            Log.d(TAG, "sendVoiceMessageToTeacher: 开始发送到RabbitMQ");
            messagingManager.sendMessageToTeacher(studentMsg, callback);

            // 等待回调完成，最多等待10秒（语音文件可能较大，需要更长时间）
            boolean completed = latch.await(10, TimeUnit.SECONDS);
            if (!completed) {
                Log.e(TAG, "sendVoiceMessageToTeacher: 等待回调超时（10秒）");
                return createResponse(false, "语音消息发送超时，请检查网络连接", null);
            }

            // 第8步：根据回调结果返回
            if (!sendSuccess[0]) {
                String error = errorMessage[0] != null ? errorMessage[0] : "未知错误";
                Log.e(TAG, "sendVoiceMessageToTeacher: RabbitMQ发送失败 - " + error);
                return createResponse(false, "语音消息发送失败: " + error, null);
            }

            // 使用回调返回的实际messageId（如果有）
            String finalMessageId = actualMessageId[0] != null ? actualMessageId[0] : messageId;
            Log.d(TAG, "sendVoiceMessageToTeacher: 语音消息发送成功, messageId=" + finalMessageId);

            // 构建返回数据（使用JSONObject避免特殊字符转义问题）
            JSONObject messageDataObj = new JSONObject();
            messageDataObj.put("messageId", finalMessageId);
            messageDataObj.put("userId", userId);
            messageDataObj.put("sessionId", sessionId);
            messageDataObj.put("subject", teacherSubject);
            messageDataObj.put("messageType", "VOICE");
            messageDataObj.put("voicePath", voicePath);
            messageDataObj.put("duration", duration);
            messageDataObj.put("timestamp", timestamp);
            String messageData = messageDataObj.toString();

            return createResponseWithJsonData(true, "语音消息发送成功", messageData);

        } catch (InterruptedException e) {
            Log.e(TAG, "sendVoiceMessageToTeacher: 等待回调被中断", e);
            Thread.currentThread().interrupt();
            return createResponse(false, "语音消息发送被中断: " + e.getMessage(), null);
        } catch (Exception e) {
            Log.e(TAG, "sendVoiceMessageToTeacher: 发送语音消息异常", e);
            return createResponse(false, "发送语音消息失败: " + e.getMessage(), null);
        }
    }

    /**
     * 发送图片消息给老师（简化版：不保存到本地数据库）
     * 第1步：验证用户登录
     * 第2步：检查图片文件
     * 第3步：读取并转Base64
     * 第4步：通过RabbitMQ发送
     * 第5步：返回结果
     */
    @JavascriptInterface
    public String sendPictureToTeacher(String imagePath, String sessionId, String subject) {
        String userId = null;

        try {
            // 第1步：验证用户登录
            userId = AppUtils.getUserId();
            if (userId == null || userId.isEmpty()) {
                return createResponse(false, "用户未登录", null);
            }

            // 第2步：检查RabbitMQ连接状态
            MessagingManager messagingManager = MessagingManager.getInstance();

            // 详细检查初始化状态
            boolean initialized = messagingManager.isInitialized();
            Log.d(TAG, "sendPictureToTeacher: MessagingManager初始化状态检查");
            Log.d(TAG, "sendPictureToTeacher: isInitialized()=" + initialized);

            if (!initialized) {
                Log.w(TAG, "sendPictureToTeacher: MessagingManager未初始化，检查是否正在初始化中");

                // 检查是否正在初始化中
                boolean connecting = messagingManager.isConnecting();
                if (connecting) {
                    Log.d(TAG, "sendPictureToTeacher: MessagingManager正在初始化中，等待完成");
                    // 如果正在初始化中，等待最多10秒
                    int waitCount = 0;
                    int maxWait = 100; // 100次 * 100ms = 10秒
                    while ((messagingManager.isConnecting() || !messagingManager.isInitialized())
                            && waitCount < maxWait) {
                        Thread.sleep(100);
                        waitCount++;
                        // 每2秒输出一次进度日志
                        if (waitCount % 20 == 0) {
                            Log.d(TAG, "sendPictureToTeacher: 等待初始化中... (" + (waitCount * 100) + "ms/" + (maxWait * 100)
                                    + "ms)");
                        }
                    }

                    if (messagingManager.isInitialized()) {
                        Log.d(TAG, "sendPictureToTeacher: 等待初始化成功，等待耗时=" + (waitCount * 100) + "ms");
                    } else {
                        Log.w(TAG, "sendPictureToTeacher: 等待初始化超时（10秒）");
                        return createResponse(false, "RabbitMQ连接正在初始化中，请稍后重试", null);
                    }
                } else {
                    // 没有正在初始化，尝试自动初始化（如果mContext可用）
                    if (mContext != null && userId != null && !userId.isEmpty()) {
                        try {
                            Log.d(TAG, "sendPictureToTeacher: 开始自动初始化MessagingManager, userId=" + userId);
                            messagingManager.initialize(mContext, userId);

                            // 等待初始化完成，最多等待10秒（RabbitMQ连接可能需要更长时间）
                            int waitCount = 0;
                            int maxWait = 100; // 100次 * 100ms = 10秒
                            while (!messagingManager.isInitialized() && waitCount < maxWait) {
                                Thread.sleep(100);
                                waitCount++;
                                // 每2秒输出一次进度日志
                                if (waitCount % 20 == 0) {
                                    Log.d(TAG, "sendPictureToTeacher: 等待初始化中... (" + (waitCount * 100) + "ms/"
                                            + (maxWait * 100) + "ms)");
                                }
                            }

                            if (messagingManager.isInitialized()) {
                                Log.d(TAG, "sendPictureToTeacher: 自动初始化成功，等待耗时=" + (waitCount * 100) + "ms");
                            } else {
                                Log.w(TAG, "sendPictureToTeacher: 自动初始化超时（10秒），可能仍在后台初始化中");
                                return createResponse(false, "RabbitMQ连接正在初始化中，请稍后重试", null);
                            }
                        } catch (Exception e) {
                            Log.e(TAG, "sendPictureToTeacher: 自动初始化失败", e);
                            return createResponse(false, "RabbitMQ连接初始化失败: " + e.getMessage(), null);
                        }
                    } else {
                        Log.e(TAG, "sendPictureToTeacher: 无法自动初始化 - mContext=" + (mContext != null ? "可用" : "null") +
                                ", userId=" + (userId != null ? userId : "null"));
                        return createResponse(false, "RabbitMQ连接未初始化，请稍后重试", null);
                    }
                }
            }

            Log.d(TAG, "sendPictureToTeacher: MessagingManager已初始化，可以发送消息");

            // 第3步：确定学科类型
            String teacherSubject;
            if ("biology".equals(subject)) {
                teacherSubject = "6"; // SCHOOL_SUBJECT_BIOLOGY
            } else if ("math".equals(subject)) {
                teacherSubject = "2"; // SCHOOL_SUBJECT_MATH
            } else {
                return createResponse(false, "不支持的学科类型", null);
            }

            // 第4步：创建StudentMessage
            String messageId = UUID.randomUUID().toString();
            long timestamp = System.currentTimeMillis();

            // 第5步：判断输入参数是文件路径还是base64数据URL
            String imageBase64Content;
            if (imagePath != null && imagePath.startsWith("data:image")) {
                // 如果是base64数据URL，直接使用
                imageBase64Content = imagePath;
                Log.d(TAG, "使用base64数据URL发送图片消息");
            } else {
                // 如果是文件路径，读取文件并转换为Base64
                File imageFile = new File(imagePath);
                if (!imageFile.exists()) {
                    return createResponse(false, "图片文件不存在: " + imagePath, null);
                }
                imageBase64Content = ImageUtils.loadImageFileToBase64(imagePath);
                if (imageBase64Content == null || imageBase64Content.trim().isEmpty()) {
                    return createResponse(false, "图片文件读取失败", null);
                }
                Log.d(TAG, "使用文件路径发送图片消息: " + imagePath);
            }

            StudentMessage studentMsg = new StudentMessage(
                    userId, sessionId, teacherSubject, 1, imageBase64Content); // 1 = QA_MSG_TYPE_PICTURE
            studentMsg.setMessageId(messageId);

            // 诊断：检查发送消息的userId是否与初始化时的userId一致
            String initializedUserId = messagingManager.getUserId();
            if (initializedUserId != null && !initializedUserId.equals(userId)) {
                Log.e(TAG, "========================================");
                Log.e(TAG, "【严重警告】sendPictureToTeacher: 发送消息的userId与初始化时的userId不一致！");
                Log.e(TAG, "发送消息的userId=" + userId);
                Log.e(TAG, "初始化时的userId=" + initializedUserId);
                Log.e(TAG, "监听队列=" + initializedUserId + "_a");
                Log.e(TAG, "消息目标队列=" + userId + "_a");
                Log.e(TAG, "监听队列和消息目标队列不匹配，无法接收老师回复！");
                Log.e(TAG, "请确保发送消息时使用的userId与初始化时一致！");
                Log.e(TAG, "========================================");
            } else if (initializedUserId == null) {
                Log.w(TAG, "sendPictureToTeacher: MessagingManager已初始化但userId为null，可能初始化时传入了null");
            } else {
                Log.d(TAG, "sendPictureToTeacher: userId检查通过，发送消息的userId=" + userId + " 与初始化userId=" + initializedUserId
                        + " 一致");
            }

            // 第6步：通过RabbitMQ发送（带回调，使用CountDownLatch等待异步结果）
            final CountDownLatch latch = new CountDownLatch(1);
            final boolean[] sendSuccess = { false };
            final String[] actualMessageId = { null };
            final String[] errorMessage = { null };

            MessagingManager.SendCallback callback = new MessagingManager.SendCallback() {
                @Override
                public void onSendResult(boolean success, String msgId, String error) {
                    sendSuccess[0] = success;
                    actualMessageId[0] = msgId;
                    errorMessage[0] = error;
                    Log.d(TAG, "sendPictureToTeacher: 回调结果 - success=" + success +
                            ", messageId=" + msgId + ", error=" + error);
                    latch.countDown();
                }
            };

            Log.d(TAG, "sendPictureToTeacher: 开始发送到RabbitMQ");
            messagingManager.sendMessageToTeacher(studentMsg, callback);

            // 等待回调完成，最多等待5秒
            boolean completed = latch.await(5, TimeUnit.SECONDS);
            if (!completed) {
                Log.e(TAG, "sendPictureToTeacher: 等待回调超时（5秒）");
                return createResponse(false, "图片消息发送超时，请检查网络连接", null);
            }

            // 第7步：根据回调结果返回
            if (!sendSuccess[0]) {
                String error = errorMessage[0] != null ? errorMessage[0] : "未知错误";
                Log.e(TAG, "sendPictureToTeacher: RabbitMQ发送失败 - " + error);
                return createResponse(false, "图片消息发送失败: " + error, null);
            }

            // 使用回调返回的实际messageId（如果有）
            String finalMessageId = actualMessageId[0] != null ? actualMessageId[0] : messageId;
            Log.d(TAG, "sendPictureToTeacher: 图片消息发送成功, messageId=" + finalMessageId);

            // 第8步：构建返回数据（使用JSONObject避免特殊字符转义问题）
            JSONObject messageDataObj = new JSONObject();
            messageDataObj.put("messageId", finalMessageId);
            messageDataObj.put("userId", userId);
            messageDataObj.put("sessionId", sessionId);
            messageDataObj.put("subject", teacherSubject);
            messageDataObj.put("messageType", "IMAGE");
            messageDataObj.put("imagePath", imagePath);
            messageDataObj.put("timestamp", timestamp);
            String messageData = messageDataObj.toString();

            return createResponseWithJsonData(true, "图片消息发送成功", messageData);

        } catch (InterruptedException e) {
            Log.e(TAG, "sendPictureToTeacher: 等待回调被中断", e);
            Thread.currentThread().interrupt();
            return createResponse(false, "图片消息发送被中断: " + e.getMessage(), null);
        } catch (Exception e) {
            Log.e(TAG, "sendPictureToTeacher: 发送图片消息异常", e);
            return createResponse(false, "发送图片消息失败: " + e.getMessage(), null);
        }
    }

    /**
     * 转发AI对话记录给老师
     * 第1步：验证用户登录
     * 第2步：检查RabbitMQ连接状态
     * 第3步：解析消息列表JSON
     * 第4步：遍历消息列表，根据类型发送
     * 第5步：返回结果
     */
    @JavascriptInterface
    public String forwardAiChatToTeacher(String selectedMessagesData, String teacherSessionId) {
        String userId = null;

        try {
            Log.d(TAG, "forwardAiChatToTeacher: 开始转发AI对话记录");
            Log.d(TAG, "forwardAiChatToTeacher: selectedMessagesData长度=" +
                    (selectedMessagesData != null ? selectedMessagesData.length() : 0) +
                    ", teacherSessionId=" + teacherSessionId);

            // 第1步：验证用户登录
            userId = AppUtils.getUserId();
            if (userId == null || userId.isEmpty()) {
                Log.e(TAG, "forwardAiChatToTeacher: 用户未登录");
                return createResponse(false, "用户未登录", null);
            }
            Log.d(TAG, "forwardAiChatToTeacher: userId=" + userId);

            // 第2步：检查RabbitMQ连接状态
            MessagingManager messagingManager = MessagingManager.getInstance();

            boolean initialized = messagingManager.isInitialized();
            Log.d(TAG, "forwardAiChatToTeacher: MessagingManager初始化状态检查");
            Log.d(TAG, "forwardAiChatToTeacher: isInitialized()=" + initialized);

            if (!initialized) {
                Log.w(TAG, "forwardAiChatToTeacher: MessagingManager未初始化，检查是否正在初始化中");

                boolean connecting = messagingManager.isConnecting();
                if (connecting) {
                    Log.d(TAG, "forwardAiChatToTeacher: MessagingManager正在初始化中，等待完成");
                    int waitCount = 0;
                    int maxWait = 100; // 100次 * 100ms = 10秒
                    while ((messagingManager.isConnecting() || !messagingManager.isInitialized())
                            && waitCount < maxWait) {
                        Thread.sleep(100);
                        waitCount++;
                        if (waitCount % 20 == 0) {
                            Log.d(TAG, "forwardAiChatToTeacher: 等待初始化中... (" + (waitCount * 100) + "ms/"
                                    + (maxWait * 100) + "ms)");
                        }
                    }

                    if (messagingManager.isInitialized()) {
                        Log.d(TAG, "forwardAiChatToTeacher: 等待初始化成功，等待耗时=" + (waitCount * 100) + "ms");
                    } else {
                        Log.w(TAG, "forwardAiChatToTeacher: 等待初始化超时（10秒）");
                        return createResponse(false, "RabbitMQ连接正在初始化中，请稍后重试", null);
                    }
                } else {
                    if (mContext != null && userId != null && !userId.isEmpty()) {
                        try {
                            Log.d(TAG, "forwardAiChatToTeacher: 开始自动初始化MessagingManager, userId=" + userId);
                            messagingManager.initialize(mContext, userId);

                            int waitCount = 0;
                            int maxWait = 100;
                            while (!messagingManager.isInitialized() && waitCount < maxWait) {
                                Thread.sleep(100);
                                waitCount++;
                                if (waitCount % 20 == 0) {
                                    Log.d(TAG, "forwardAiChatToTeacher: 等待初始化中... (" + (waitCount * 100) + "ms/"
                                            + (maxWait * 100) + "ms)");
                                }
                            }

                            if (messagingManager.isInitialized()) {
                                Log.d(TAG, "forwardAiChatToTeacher: 自动初始化成功，等待耗时=" + (waitCount * 100) + "ms");
                            } else {
                                Log.w(TAG, "forwardAiChatToTeacher: 自动初始化超时（10秒）");
                                return createResponse(false, "RabbitMQ连接正在初始化中，请稍后重试", null);
                            }
                        } catch (Exception e) {
                            Log.e(TAG, "forwardAiChatToTeacher: 自动初始化失败", e);
                            return createResponse(false, "RabbitMQ连接初始化失败: " + e.getMessage(), null);
                        }
                    } else {
                        Log.e(TAG, "forwardAiChatToTeacher: 无法自动初始化");
                        return createResponse(false, "RabbitMQ连接未初始化，请稍后重试", null);
                    }
                }
            }

            Log.d(TAG, "forwardAiChatToTeacher: MessagingManager已初始化，可以发送消息");

            // 第3步：解析消息列表JSON
            JSONArray messagesArray;
            try {
                messagesArray = new JSONArray(selectedMessagesData);
                Log.d(TAG, "forwardAiChatToTeacher: 解析消息列表成功，消息数量=" + messagesArray.length());
            } catch (JSONException e) {
                Log.e(TAG, "forwardAiChatToTeacher: 解析消息列表JSON失败", e);
                return createResponse(false, "消息格式错误: " + e.getMessage(), null);
            }

            if (messagesArray.length() == 0) {
                Log.w(TAG, "forwardAiChatToTeacher: 消息列表为空");
                return createResponse(false, "消息列表为空", null);
            }

            // 第4步：从会话ID获取学科信息（从localStorage获取，这里简化处理，默认使用数学）
            // 注意：如果需要从会话中获取subject，需要访问会话存储
            // 这里先使用默认值，后续可以优化
            String subject = "math"; // 默认数学

            // 尝试从Android的SharedPreferences获取当前教师科目
            try {
                android.content.SharedPreferences prefs = mContext.getSharedPreferences("imates_prefs",
                        android.content.Context.MODE_PRIVATE);
                String teacherSubjectPref = prefs.getString(userId + "_currentTeacherSubject", "MATH");
                if ("BIOLOGY".equals(teacherSubjectPref)) {
                    subject = "biology";
                } else {
                    subject = "math";
                }
                Log.d(TAG, "forwardAiChatToTeacher: 从SharedPreferences获取学科=" + subject);
            } catch (Exception e) {
                Log.w(TAG, "forwardAiChatToTeacher: 获取学科失败，使用默认值math", e);
            }

            // 第5步：遍历消息列表，根据类型发送
            int successCount = 0;
            int failCount = 0;
            StringBuilder errorMessages = new StringBuilder();

            for (int i = 0; i < messagesArray.length(); i++) {
                try {
                    JSONObject message = messagesArray.getJSONObject(i);
                    String messageType = message.optString("type", "TEXT");
                    String content = message.optString("content", "");

                    Log.d(TAG, "forwardAiChatToTeacher: 处理消息 " + (i + 1) + "/" + messagesArray.length() +
                            ", type=" + messageType + ", contentLength=" + content.length());

                    String result;

                    if ("TEXT".equals(messageType)) {
                        // 文本消息
                        result = sendTextMessageToTeacher(content, teacherSessionId, subject);
                        JSONObject resultObj = new JSONObject(result);
                        if (resultObj.optBoolean("success", false)) {
                            successCount++;
                            Log.d(TAG, "forwardAiChatToTeacher: 文本消息转发成功");
                        } else {
                            failCount++;
                            String error = resultObj.optString("message", "未知错误");
                            errorMessages.append("消息").append(i + 1).append(": ").append(error).append("; ");
                            Log.e(TAG, "forwardAiChatToTeacher: 文本消息转发失败 - " + error);
                        }
                    } else if ("IMAGE".equals(messageType)) {
                        // 图片消息 - 需要从content中提取图片路径或base64
                        // 如果content是base64数据URL，直接使用；如果是文件路径，需要读取文件
                        String imagePath = content;
                        result = sendPictureToTeacher(imagePath, teacherSessionId, subject);
                        JSONObject resultObj = new JSONObject(result);
                        if (resultObj.optBoolean("success", false)) {
                            successCount++;
                            Log.d(TAG, "forwardAiChatToTeacher: 图片消息转发成功");
                        } else {
                            failCount++;
                            String error = resultObj.optString("message", "未知错误");
                            errorMessages.append("消息").append(i + 1).append(": ").append(error).append("; ");
                            Log.e(TAG, "forwardAiChatToTeacher: 图片消息转发失败 - " + error);
                        }
                    } else if ("VOICE".equals(messageType)) {
                        // 语音消息 - 需要从content中提取语音路径和时长
                        // 注意：前端传递的content格式可能需要解析
                        // 这里假设content是文件路径，duration从消息中获取
                        String voicePath = content;
                        String duration = message.optString("duration", "0");
                        result = sendVoiceMessageToTeacher(voicePath, duration, teacherSessionId, subject);
                        JSONObject resultObj = new JSONObject(result);
                        if (resultObj.optBoolean("success", false)) {
                            successCount++;
                            Log.d(TAG, "forwardAiChatToTeacher: 语音消息转发成功");
                        } else {
                            failCount++;
                            String error = resultObj.optString("message", "未知错误");
                            errorMessages.append("消息").append(i + 1).append(": ").append(error).append("; ");
                            Log.e(TAG, "forwardAiChatToTeacher: 语音消息转发失败 - " + error);
                        }
                    } else {
                        failCount++;
                        String error = "不支持的消息类型: " + messageType;
                        errorMessages.append("消息").append(i + 1).append(": ").append(error).append("; ");
                        Log.e(TAG, "forwardAiChatToTeacher: " + error);
                    }

                    // 每条消息之间稍作延迟，避免发送过快
                    if (i < messagesArray.length() - 1) {
                        Thread.sleep(50);
                    }

                } catch (JSONException e) {
                    failCount++;
                    String error = "解析消息失败: " + e.getMessage();
                    errorMessages.append("消息").append(i + 1).append(": ").append(error).append("; ");
                    Log.e(TAG, "forwardAiChatToTeacher: 解析消息失败", e);
                } catch (InterruptedException e) {
                    Log.e(TAG, "forwardAiChatToTeacher: 等待被中断", e);
                    Thread.currentThread().interrupt();
                    failCount++;
                    errorMessages.append("消息").append(i + 1).append(": 等待被中断; ");
                } catch (Exception e) {
                    failCount++;
                    String error = "处理消息失败: " + e.getMessage();
                    errorMessages.append("消息").append(i + 1).append(": ").append(error).append("; ");
                    Log.e(TAG, "forwardAiChatToTeacher: 处理消息失败", e);
                }
            }

            // 第6步：返回结果
            if (failCount == 0) {
                Log.d(TAG, "forwardAiChatToTeacher: 所有消息转发成功，共" + successCount + "条");
                return createResponse(true, "所有消息转发成功，共" + successCount + "条", null);
            } else if (successCount > 0) {
                Log.w(TAG, "forwardAiChatToTeacher: 部分消息转发成功，成功" + successCount + "条，失败" + failCount + "条");
                return createResponse(false, "部分消息转发失败（成功" + successCount + "条，失败" + failCount + "条）: " +
                        errorMessages.toString(), null);
            } else {
                Log.e(TAG, "forwardAiChatToTeacher: 所有消息转发失败");
                return createResponse(false, "所有消息转发失败: " + errorMessages.toString(), null);
            }

        } catch (InterruptedException e) {
            Log.e(TAG, "forwardAiChatToTeacher: 等待被中断", e);
            Thread.currentThread().interrupt();
            return createResponse(false, "转发被中断: " + e.getMessage(), null);
        } catch (Exception e) {
            Log.e(TAG, "forwardAiChatToTeacher: 转发异常", e);
            return createResponse(false, "转发失败: " + e.getMessage(), null);
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
     * 通知Vue端收到老师消息（简化版：不保存到数据库，由前端保存）
     * 第1步：构建消息JSON
     * 第2步：调用JavaScript回调
     * 第3步：前端负责保存到IndexedDB
     */
    private void notifyTeacherMessageReceived(ChatMessage teacherMessage) {
        if (mContext instanceof Activity) {
            ((Activity) mContext).runOnUiThread(() -> {
                try {
                    // 第1步：构建老师消息JSON
                    JSONObject messageJson = new JSONObject();
                    messageJson.put("messageId", teacherMessage.messageId);
                    messageJson.put("sessionId", teacherMessage.sessionId);
                    messageJson.put("content", teacherMessage.content);
                    messageJson.put("messageType", getMessageTypeString(teacherMessage.type));
                    messageJson.put("isSelf", teacherMessage.isSelf);
                    messageJson.put("timestamp", teacherMessage.timestamp);
                    messageJson.put("chatRole", "TEACHER");

                    // 添加调试日志（如果有）
                    if (teacherMessage.debugLogs != null && !teacherMessage.debugLogs.isEmpty()) {
                        org.json.JSONArray logsArray = new org.json.JSONArray();
                        for (String log : teacherMessage.debugLogs) {
                            logsArray.put(log);
                        }
                        messageJson.put("debugLogs", logsArray);
                        Log.d(TAG, "添加调试日志到消息，日志数量: " + teacherMessage.debugLogs.size());
                    }

                    // 第2步：调用JavaScript回调（前端负责保存）
                    // 先检查回调函数是否存在（异步检查，仅用于日志）
                    String checkScript = "typeof window.onTeacherMessageReceived";
                    webView.evaluateJavascript(checkScript, (result) -> {
                        Log.d(TAG, "检查回调函数类型: " + result);
                    });

                    // 构建调用脚本，包含详细的错误处理和调试信息
                    String messageId = messageJson.optString("messageId", "unknown");
                    String script = String.format(Locale.getDefault(),
                            "(function() { " +
                                    "  try { " +
                                    "    const callback = window.onTeacherMessageReceived; " +
                                    "    const callbackType = typeof callback; " +
                                    "    console.log('[Android] 🔍 准备调用回调函数', { " +
                                    "      messageId: %s, " +
                                    "      callbackType: callbackType, " +
                                    "      isFunction: callbackType === 'function', " +
                                    "      isNull: callback === null, " +
                                    "      isUndefined: callback === undefined " +
                                    "    }); " +
                                    "    if (callbackType === 'function') { " +
                                    "      console.log('[Android] ✅ 调用回调函数，消息ID:', %s); " +
                                    "      callback(%s); " +
                                    "    } else { " +
                                    "      console.error('[Android] ❌ onTeacherMessageReceived 不是函数！', { " +
                                    "        type: callbackType, " +
                                    "        value: callback, " +
                                    "        isNull: callback === null, " +
                                    "        isUndefined: callback === undefined, " +
                                    "        messageId: %s " +
                                    "      }); " +
                                    "    } " +
                                    "  } catch (e) { " +
                                    "    console.error('[Android] ❌ 调用回调函数时出错:', e, { " +
                                    "      messageId: %s, " +
                                    "      stack: e.stack " +
                                    "    }); " +
                                    "  } " +
                                    "})();",
                            "\"" + messageId + "\"",
                            "\"" + messageId + "\"",
                            messageJson.toString(),
                            "\"" + messageId + "\"",
                            "\"" + messageId + "\"");

                    executeJavaScript(script);
                    Log.d(TAG, "Teacher message received: " + messageJson.toString());

                } catch (Exception e) {
                    Log.e(TAG, "Failed to notify teacher message", e);
                }
            });
        }
    }

    /**
     * 辅助方法：将消息类型转为字符串
     */
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

    /**
     * 初始化老师消息监听器
     * 如果AppUtils.getUserId()返回null，会尝试从localStorage获取userInfo
     */
    @JavascriptInterface
    public String initTeacherMessageListener() {
        try {
            Log.d(TAG, "========================================");
            Log.d(TAG, "initTeacherMessageListener: 开始初始化老师消息监听器");

            String userId = AppUtils.getUserId();
            Log.d(TAG, "initTeacherMessageListener: AppUtils.getUserId()=" + userId);

            // 如果userId为null或空，尝试从localStorage获取
            if (userId == null || userId.isEmpty()) {
                Log.w(TAG, "initTeacherMessageListener: AppUtils.getUserId()返回null，尝试从localStorage获取userInfo");
                userId = getUserIdFromLocalStorage();

                if (userId == null || userId.isEmpty()) {
                    Log.e(TAG, "========================================");
                    Log.e(TAG, "【严重警告】initTeacherMessageListener: 无法从localStorage获取userId，用户未登录");
                    Log.e(TAG, "AppUtils.getUserId()=" + AppUtils.getUserId());
                    Log.e(TAG, "localStorage中未找到userInfo或userInfo中没有userId/id字段");
                    Log.e(TAG, "无法初始化消息监听器，后续发送消息时userId可能不匹配！");
                    Log.e(TAG, "========================================");
                    return createResponse(false, "用户未登录，无法初始化消息监听器", null);
                }

                Log.d(TAG, "initTeacherMessageListener: 从localStorage获取到userId=" + userId);
            }

            // 诊断：记录最终使用的userId和队列名
            String queueName = userId + "_a";
            Log.d(TAG, "initTeacherMessageListener: 最终使用的userId=" + userId);
            Log.d(TAG, "initTeacherMessageListener: 将监听的队列名=" + queueName);
            Log.d(TAG, "initTeacherMessageListener: 后续发送消息时userId必须与此一致，否则无法接收老师回复！");

            // 初始化MessagingManager
            MessagingManager.getInstance().initialize(mContext, userId);

            // 添加消息监听器
            MessagingManager.getInstance().addMessageListener(this::notifyTeacherMessageReceived);

            Log.d(TAG, "initTeacherMessageListener: 老师消息监听器初始化成功");
            Log.d(TAG, "initTeacherMessageListener: userId=" + userId + ", 监听队列=" + queueName);
            Log.d(TAG, "========================================");
            return createResponse(true, "老师消息监听器初始化成功", null);

        } catch (Exception e) {
            Log.e(TAG, "========================================");
            Log.e(TAG, "initTeacherMessageListener: 初始化失败", e);
            Log.e(TAG, "========================================");
            return createResponse(false, "初始化老师消息监听器失败: " + e.getMessage(), null);
        }
    }

    /**
     * 从localStorage获取userId
     * 只获取userInfo项，从中提取userId或id字段
     * 优先级：userInfo.userId > userInfo.id
     * 
     * @return userId，如果获取失败则返回null
     */
    private String getUserIdFromLocalStorage() {
        if (webView == null) {
            Log.e(TAG, "getUserIdFromLocalStorage: WebView为null，无法获取localStorage");
            return null;
        }

        try {
            // 使用LocalStorageHelper只获取userInfo项
            LocalStorageHelper helper = new LocalStorageHelper(webView);

            // 使用锁等待异步回调
            final String[] result = { null };
            final Object lock = new Object();
            final boolean[] completed = { false };

            // 只获取userInfo项
            helper.getItem("userInfo", new LocalStorageHelper.ItemCallback() {
                @Override
                public void onResult(String userInfoStr) {
                    synchronized (lock) {
                        try {
                            if (userInfoStr != null && !userInfoStr.isEmpty() &&
                                    !userInfoStr.equals("null") && !userInfoStr.equals("undefined")) {
                                try {
                                    JSONObject userInfo = new JSONObject(userInfoStr);
                                    if (userInfo.has("userId")) {
                                        result[0] = userInfo.getString("userId");
                                        Log.d(TAG, "getUserIdFromLocalStorage: 从userInfo.userId获取到userId=" + result[0]);
                                    } else if (userInfo.has("id")) {
                                        result[0] = userInfo.getString("id");
                                        Log.d(TAG, "getUserIdFromLocalStorage: 从userInfo.id获取到userId=" + result[0]);
                                    } else {
                                        Log.w(TAG, "getUserIdFromLocalStorage: userInfo中未找到userId或id字段");
                                    }
                                } catch (JSONException e) {
                                    Log.e(TAG, "getUserIdFromLocalStorage: 解析userInfo失败", e);
                                }
                            } else {
                                Log.w(TAG, "getUserIdFromLocalStorage: localStorage中userInfo为空或不存在");
                            }
                        } catch (Exception e) {
                            Log.e(TAG, "getUserIdFromLocalStorage: 处理userInfo失败", e);
                        } finally {
                            completed[0] = true;
                            lock.notify();
                        }
                    }
                }
            });

            // 等待回调完成（最多等待3秒）
            synchronized (lock) {
                if (!completed[0]) {
                    try {
                        lock.wait(3000);
                    } catch (InterruptedException e) {
                        Log.e(TAG, "getUserIdFromLocalStorage: 等待localStorage回调被中断", e);
                        Thread.currentThread().interrupt();
                    }
                }
            }

            if (result[0] != null && !result[0].isEmpty()) {
                Log.d(TAG, "getUserIdFromLocalStorage: 成功获取到userId=" + result[0]);
                return result[0];
            } else {
                Log.w(TAG, "getUserIdFromLocalStorage: 未能从localStorage获取到userId");
                return null;
            }

        } catch (Exception e) {
            Log.e(TAG, "getUserIdFromLocalStorage: 获取localStorage失败", e);
            return null;
        }
    }

    /**
     * 从 localStorage 获取 Web 环境类型 app_env_type
     * 返回值示例："RELEASE" 或 "INTERNAL_TEST"，获取失败返回 null
     * 注意：WebView 操作必须在主线程执行
     */
    private String getEnvTypeFromLocalStorage() {
        if (webView == null) {
            Log.e(TAG, "getEnvTypeFromLocalStorage: WebView为null，无法获取localStorage");
            return null;
        }

        try {
            final String[] result = { null };
            final Object lock = new Object();
            final boolean[] completed = { false };

            // 必须在主线程执行 WebView 操作
            if (mContext instanceof Activity) {
                ((Activity) mContext).runOnUiThread(() -> {
                    try {
                        LocalStorageHelper helper = new LocalStorageHelper(webView);
                        helper.getItem("app_env_type", new LocalStorageHelper.ItemCallback() {
                            @Override
                            public void onResult(String value) {
                                synchronized (lock) {
                                    try {
                                        if (value != null && !value.isEmpty() && !"null".equals(value) && !"undefined".equals(value)) {
                                            result[0] = value;
                                            Log.d(TAG, "getEnvTypeFromLocalStorage: 获取到 app_env_type=" + result[0]);
                                        } else {
                                            Log.w(TAG, "getEnvTypeFromLocalStorage: localStorage 中 app_env_type 为空或不存在");
                                        }
                                    } catch (Exception e) {
                                        Log.e(TAG, "getEnvTypeFromLocalStorage: 处理 app_env_type 失败", e);
                                    } finally {
                                        completed[0] = true;
                                        lock.notify();
                                    }
                                }
                            }
                        });
                    } catch (Exception e) {
                        Log.e(TAG, "getEnvTypeFromLocalStorage: 主线程执行失败", e);
                        synchronized (lock) {
                            completed[0] = true;
                            lock.notify();
                        }
                    }
                });
            } else {
                Log.e(TAG, "getEnvTypeFromLocalStorage: Context 不是 Activity");
                return null;
            }

            // 等待回调完成（最多等待 5 秒，分多次检查）
            synchronized (lock) {
                long startTime = System.currentTimeMillis();
                while (!completed[0] && (System.currentTimeMillis() - startTime) < 5000) {
                    try {
                        lock.wait(500); // 每 500ms 检查一次
                    } catch (InterruptedException e) {
                        Log.e(TAG, "getEnvTypeFromLocalStorage: 等待 localStorage 回调被中断", e);
                        Thread.currentThread().interrupt();
                        break;
                    }
                }
            }

            if (!completed[0]) {
                Log.w(TAG, "getEnvTypeFromLocalStorage: 等待超时，使用默认值");
            }

            return result[0];

        } catch (Exception e) {
            Log.e(TAG, "getEnvTypeFromLocalStorage: 获取 localStorage 失败", e);
            return null;
        }
    }

    /**
     * 从 localStorage 获取指定 key 的 Token
     * @param key localStorage 的 key，如 "YANBAN_TOKEN"
     * @return Token 值，获取失败返回 null
     * 注意：WebView 操作必须在主线程执行
     */
    private String getTokenFromLocalStorage(String key) {
        if (webView == null) {
            Log.e(TAG, "getTokenFromLocalStorage: WebView为null，无法获取localStorage");
            return null;
        }

        try {
            final String[] result = { null };
            final Object lock = new Object();
            final boolean[] completed = { false };

            // 必须在主线程执行 WebView 操作
            if (mContext instanceof Activity) {
                ((Activity) mContext).runOnUiThread(() -> {
                    try {
                        LocalStorageHelper helper = new LocalStorageHelper(webView);
                        helper.getItem(key, new LocalStorageHelper.ItemCallback() {
                            @Override
                            public void onResult(String value) {
                                synchronized (lock) {
                                    try {
                                        if (value != null && !value.isEmpty() && !"null".equals(value) && !"undefined".equals(value)) {
                                            result[0] = value;
                                            Log.d(TAG, "getTokenFromLocalStorage: 获取到 " + key + "=" + (result[0] != null ? "***" : "null"));
                                        } else {
                                            Log.w(TAG, "getTokenFromLocalStorage: localStorage 中 " + key + " 为空或不存在");
                                        }
                                    } catch (Exception e) {
                                        Log.e(TAG, "getTokenFromLocalStorage: 处理 " + key + " 失败", e);
                                    } finally {
                                        completed[0] = true;
                                        lock.notify();
                                    }
                                }
                            }
                        });
                    } catch (Exception e) {
                        Log.e(TAG, "getTokenFromLocalStorage: 主线程执行失败", e);
                        synchronized (lock) {
                            completed[0] = true;
                            lock.notify();
                        }
                    }
                });
            } else {
                Log.e(TAG, "getTokenFromLocalStorage: Context 不是 Activity");
                return null;
            }

            // 等待回调完成（最多等待 5 秒，分多次检查）
            synchronized (lock) {
                long startTime = System.currentTimeMillis();
                while (!completed[0] && (System.currentTimeMillis() - startTime) < 5000) {
                    try {
                        lock.wait(500); // 每 500ms 检查一次
                    } catch (InterruptedException e) {
                        Log.e(TAG, "getTokenFromLocalStorage: 等待 localStorage 回调被中断", e);
                        Thread.currentThread().interrupt();
                        break;
                    }
                }
            }

            if (!completed[0]) {
                Log.w(TAG, "getTokenFromLocalStorage: 等待超时，Token 可能为空");
            }

            return result[0];

        } catch (Exception e) {
            Log.e(TAG, "getTokenFromLocalStorage: 获取 localStorage 失败", e);
            return null;
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

    /**
     * 检查MessagingManager是否已初始化
     * 供前端检查初始化状态
     */
    @JavascriptInterface
    public boolean isMessagingManagerInitialized() {
        try {
            boolean initialized = MessagingManager.getInstance().isInitialized();
            Log.d(TAG, "isMessagingManagerInitialized: " + initialized);
            return initialized;
        } catch (Exception e) {
            Log.e(TAG, "Failed to check MessagingManager initialization status", e);
            return false;
        }
    }

    /**
     * 检查MessagingManager是否正在初始化中
     * 供前端判断是否正在连接中
     */
    @JavascriptInterface
    public boolean isMessagingManagerConnecting() {
        try {
            boolean connecting = MessagingManager.getInstance().isConnecting();
            Log.d(TAG, "isMessagingManagerConnecting: " + connecting);
            return connecting;
        } catch (Exception e) {
            Log.e(TAG, "Failed to check MessagingManager connecting status", e);
            return false;
        }
    }

    @JavascriptInterface
    public void exitActivity() {
        if (mContext instanceof Activity) {
            ((Activity) mContext).finish();
        }
    }

    /**
     * 启动空白页面
     * 从 WebView 跳转到空白 Android 页面
     */
    @JavascriptInterface
    public void openBlankPage() {
        try {
            Intent intent = new Intent(mContext, com.cosinetech.imates.ui.activities.BlankActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            mContext.startActivity(intent);
            Log.d(TAG, "已启动空白页面");
        } catch (Exception e) {
            Log.e(TAG, "启动空白页面失败", e);
        }
    }

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
                // 如果权限未授予，尝试请求权限
                if (audioPermissionLauncher != null && mContext instanceof Activity) {
                    // 请求权限（异步操作，权限授予后会在回调中启动录音）
                    ((Activity) mContext).runOnUiThread(() -> {
                        audioPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO);
                    });
                    Log.d(TAG, "正在请求录音权限");
                    return createResponse(true, "正在请求录音权限", null);
                } else {
                    // 无法请求权限，返回错误
                    return createResponse(false, "需要录音权限，请前往设置中授予", null);
                }
            }

            if (isRecording) {
                return createResponse(false, "正在录音中", null);
            }

            // 权限已授予，开始录音
            startVoiceRecordingInternal();

            Log.d(TAG, "开始录音: " + currentAudioFilePath);
            return createResponse(true, "开始录音", currentAudioFilePath);

        } catch (Exception e) {
            Log.e(TAG, "开始录音失败", e);
            releaseMediaRecorder();
            return createResponse(false, "录音失败: " + e.getMessage(), null);
        }
    }

    /**
     * 开始录音（权限已授予后调用）
     */
    private void startVoiceRecordingInternal() throws Exception {
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
            sendLogToWeb("INFO", "PhotoCapture", "📸 [拍照搜题] 开始拍照流程");

            if (imageCaptureLauncher == null) {
                sendLogToWeb("ERROR", "PhotoCapture", "❌ [拍照搜题] 拍照功能未初始化");
                return createResponse(false, "拍照功能未初始化", null);
            }

            // 第1步：检查相机权限
            sendLogToWeb("DEBUG", "PhotoCapture", "🔍 [拍照搜题] 步骤1: 检查相机权限");
            if (!checkCameraPermission()) {
                sendLogToWeb("WARN", "PhotoCapture", "⚠️ [拍照搜题] 相机权限未授予");
                // 第2步：如果权限未授予，尝试请求权限
                if (cameraPermissionLauncher != null && mContext instanceof Activity) {
                    // 第3步：请求权限（异步操作，权限授予后会在回调中启动相机）
                    sendLogToWeb("INFO", "PhotoCapture", "📝 [拍照搜题] 步骤2: 请求相机权限");
                    ((Activity) mContext).runOnUiThread(() -> {
                        cameraPermissionLauncher.launch(Manifest.permission.CAMERA);
                    });
                    Log.d(TAG, "正在请求相机权限");
                    sendLogToWeb("INFO", "PhotoCapture", "✅ [拍照搜题] 已发送权限请求");
                    return createResponse(true, "正在请求相机权限", null);
                } else {
                    // 无法请求权限，返回错误
                    sendLogToWeb("ERROR", "PhotoCapture", "❌ [拍照搜题] 无法请求权限，请前往设置中授予");
                    return createResponse(false, "需要相机权限，请前往设置中授予", null);
                }
            }

            sendLogToWeb("INFO", "PhotoCapture", "✅ [拍照搜题] 相机权限已授予");
            // 第4步：权限已授予，直接启动相机
            sendLogToWeb("INFO", "PhotoCapture", "🚀 [拍照搜题] 步骤3: 启动相机拍照");
            startCameraCapture();
            Log.d(TAG, "启动相机拍照: " + currentImageFilePath);
            sendLogToWeb("INFO", "PhotoCapture", "✅ [拍照搜题] 相机已启动，等待用户拍照");
            return createResponse(true, "启动相机拍照", currentImageFilePath);

        } catch (Exception e) {
            Log.e(TAG, "拍照失败", e);
            sendLogToWeb("ERROR", "PhotoCapture", "❌ [拍照搜题] 拍照失败: " + e.getMessage());
            return createResponse(false, "拍照失败: " + e.getMessage(), null);
        }
    }

    /**
     * 启动相机拍照（权限已授予后调用）
     */
    private void startCameraCapture() {
        try {
            // 第1步：创建图片文件
            sendLogToWeb("DEBUG", "PhotoCapture", "📁 [拍照搜题] 步骤3.1: 创建图片文件");
            currentImageFilePath = createImageFilePath();
            File imageFile = new File(currentImageFilePath);
            sendLogToWeb("INFO", "PhotoCapture", "✅ [拍照搜题] 图片文件路径: " + currentImageFilePath);

            // 第2步：使用FileProvider获取URI
            sendLogToWeb("DEBUG", "PhotoCapture", "🔗 [拍照搜题] 步骤3.2: 获取FileProvider URI");
            currentImageUri = FileProvider.getUriForFile(mContext,
                    mContext.getPackageName() + ".fileprovider", imageFile);
            sendLogToWeb("INFO", "PhotoCapture", "✅ [拍照搜题] URI获取成功: " + currentImageUri.toString());

            // 第3步：创建拍照Intent
            sendLogToWeb("DEBUG", "PhotoCapture", "📋 [拍照搜题] 步骤3.3: 创建拍照Intent");
            Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            intent.putExtra(MediaStore.EXTRA_OUTPUT, currentImageUri);
            sendLogToWeb("INFO", "PhotoCapture", "✅ [拍照搜题] Intent创建成功");

            // 第4步：启动相机
            sendLogToWeb("DEBUG", "PhotoCapture", "📷 [拍照搜题] 步骤3.4: 启动相机Activity");
            imageCaptureLauncher.launch(intent);
            sendLogToWeb("INFO", "PhotoCapture", "✅ [拍照搜题] 相机Activity已启动");
        } catch (Exception e) {
            Log.e(TAG, "启动相机失败", e);
            sendLogToWeb("ERROR", "PhotoCapture", "❌ [拍照搜题] 启动相机失败: " + e.getMessage());
        }
    }

    /**
     * 处理相机权限请求结果（由Activity调用）
     */
    public void onCameraPermissionResult(boolean granted) {
        if (granted) {
            // 权限已授予，启动相机
            Log.d(TAG, "相机权限已授予，启动相机");
            sendLogToWeb("INFO", "PhotoCapture", "✅ [拍照搜题] 相机权限已授予");
            sendLogToWeb("INFO", "PhotoCapture", "🚀 [拍照搜题] 开始启动相机拍照");
            startCameraCapture();
        } else {
            // 权限被拒绝，通知前端
            Log.w(TAG, "相机权限被拒绝");
            sendLogToWeb("WARN", "PhotoCapture", "⚠️ [拍照搜题] 相机权限被拒绝");
            if (mContext instanceof Activity) {
                ((Activity) mContext).runOnUiThread(() -> {
                    Toast.makeText(mContext, "需要相机权限才能拍照", Toast.LENGTH_SHORT).show();
                });
            }
        }
    }

    /**
     * 处理录音权限请求结果（由Activity调用）
     */
    public void onAudioPermissionResult(boolean granted) {
        if (granted) {
            if (!isRecording) {
                // 权限已授予，开始录音
                Log.d(TAG, "录音权限已授予，开始录音");
                try {
                    startVoiceRecordingInternal();
                    Log.d(TAG, "开始录音: " + currentAudioFilePath);

                    // 通知前端录音已开始（需要通过Activity的WebView来触发）
                    if (mContext instanceof Activity) {
                        ((Activity) mContext).runOnUiThread(() -> {
                            // 通过WebView的JavaScript接口通知前端
                            notifyVoiceRecordingStarted();
                        });
                    }
                } catch (Exception e) {
                    Log.e(TAG, "录音权限已授予但启动录音失败", e);
                    releaseMediaRecorder();
                    if (mContext instanceof Activity) {
                        ((Activity) mContext).runOnUiThread(() -> {
                            Toast.makeText(mContext, "录音启动失败: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                        });
                    }
                }
            }
        } else {
            // 权限被拒绝，通知前端
            Log.w(TAG, "录音权限被拒绝");
            if (mContext instanceof Activity) {
                ((Activity) mContext).runOnUiThread(() -> {
                    Toast.makeText(mContext, "需要录音权限才能使用语音功能", Toast.LENGTH_SHORT).show();
                });
            }
        }
    }

    /**
     * 通知前端录音已开始（通过WebView JavaScript接口）
     */
    private void notifyVoiceRecordingStarted() {
        if (webView == null) {
            Log.w(TAG, "WebView未设置，无法通知前端录音已开始");
            return;
        }

        try {
            // 构造录音状态信息
            org.json.JSONObject detailObj = new org.json.JSONObject();
            detailObj.put("success", true);
            detailObj.put("message", "录音已开始");
            detailObj.put("isRecording", true);
            if (currentAudioFilePath != null) {
                detailObj.put("filePath", currentAudioFilePath);
            }

            // 转换为JSON字符串
            String detailJson = detailObj.toString();

            // 构造JavaScript代码
            String jsCode = "javascript:(function() {" +
                    "  try {" +
                    "    var detailStr = '" + detailJson.replace("'", "\\'") + "';" +
                    "    var detail = JSON.parse(detailStr);" +
                    "    var event = new CustomEvent('nativeVoiceRecordingStarted', { detail: detail });" +
                    "    window.dispatchEvent(event);" +
                    "    console.log('📡 [Android] 触发 nativeVoiceRecordingStarted 事件', detail);" +
                    "  } catch(e) {" +
                    "    console.error('📡 [Android] 触发事件失败:', e);" +
                    "  }" +
                    "})()";

            webView.evaluateJavascript(jsCode, null);
            Log.d(TAG, "已通知前端录音已开始");
        } catch (Exception e) {
            Log.e(TAG, "通知前端录音已开始失败", e);
            e.printStackTrace();
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

            // 读取图片并转换为Base64 Data URL（完整格式，包含data:image前缀）
            String base64DataUrl = ImageUtils.loadImageFileToBase64(savedImagePath);
            if (base64DataUrl == null || base64DataUrl.trim().isEmpty()) {
                return createResponse(false, "图片读取失败", null);
            }

            String result = String.format(Locale.getDefault(),
                    "{\"filePath\":\"%s\",\"width\":%d,\"height\":%d,\"fileSize\":%d,\"base64DataUrl\":\"%s\"}",
                    savedImagePath, options.outWidth, options.outHeight, fileSize, base64DataUrl);

            Log.d(TAG, "图片选择完成: filePath=" + savedImagePath + ", base64DataUrlLength=" + base64DataUrl.length());

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
            sendLogToWeb("INFO", "PhotoCapture", "📥 [拍照搜题] 收到拍照结果，success=" + success);

            if (!success || currentImageFilePath == null) {
                sendLogToWeb("WARN", "PhotoCapture", "⚠️ [拍照搜题] 拍照失败或取消");
                return createResponse(false, "拍照失败或取消", null);
            }

            sendLogToWeb("DEBUG", "PhotoCapture", "🔍 [拍照搜题] 步骤4.1: 检查图片文件是否存在");
            File imageFile = new File(currentImageFilePath);
            if (!imageFile.exists()) {
                sendLogToWeb("ERROR", "PhotoCapture", "❌ [拍照搜题] 拍照文件不存在: " + currentImageFilePath);
                return createResponse(false, "拍照文件不存在", null);
            }
            sendLogToWeb("INFO", "PhotoCapture", "✅ [拍照搜题] 图片文件存在: " + currentImageFilePath);

            // 获取图片信息
            sendLogToWeb("DEBUG", "PhotoCapture", "📐 [拍照搜题] 步骤4.2: 获取图片尺寸信息");
            BitmapFactory.Options options = new BitmapFactory.Options();
            options.inJustDecodeBounds = true;
            BitmapFactory.decodeFile(currentImageFilePath, options);

            long fileSize = imageFile.length();
            sendLogToWeb("INFO", "PhotoCapture", "📊 [拍照搜题] 图片信息 - 尺寸: " + options.outWidth + "x" + options.outHeight
                    + ", 文件大小: " + fileSize + " bytes");

            // 读取图片并转换为Base64 Data URL（完整格式，包含data:image前缀）
            sendLogToWeb("DEBUG", "PhotoCapture", "🔄 [拍照搜题] 步骤4.3: 读取图片并转换为Base64");
            String base64DataUrl = ImageUtils.loadImageFileToBase64(currentImageFilePath);
            if (base64DataUrl == null || base64DataUrl.trim().isEmpty()) {
                sendLogToWeb("ERROR", "PhotoCapture", "❌ [拍照搜题] 图片读取失败");
                return createResponse(false, "图片读取失败", null);
            }
            sendLogToWeb("INFO", "PhotoCapture", "✅ [拍照搜题] Base64转换完成，长度: " + base64DataUrl.length() + " 字符");

            String result = String.format(Locale.getDefault(),
                    "{\"filePath\":\"%s\",\"width\":%d,\"height\":%d,\"fileSize\":%d,\"base64DataUrl\":\"%s\"}",
                    currentImageFilePath, options.outWidth, options.outHeight, fileSize, base64DataUrl);

            Log.d(TAG, "拍照完成: filePath=" + currentImageFilePath + ", base64DataUrlLength=" + base64DataUrl.length());
            sendLogToWeb("INFO", "PhotoCapture", "✅ [拍照搜题] 拍照流程完成，准备返回结果给Web端");

            // 拍照完成，结果已返回

            return createResponseWithJsonData(true, "拍照完成", result);

        } catch (Exception e) {
            Log.e(TAG, "处理拍照结果失败", e);
            sendLogToWeb("ERROR", "PhotoCapture", "❌ [拍照搜题] 处理拍照结果失败: " + e.getMessage());
            return createResponse(false, "处理拍照失败: " + e.getMessage(), null);
        }
    }

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

    /**
     * 将图片文件路径转换为Base64 Data URL
     * 用于前端显示Android本地保存的图片文件
     */
    @JavascriptInterface
    public String loadImageFileToBase64(String filePath) {
        try {
            if (filePath == null || filePath.isEmpty()) {
                return createResponse(false, "文件路径为空", null);
            }

            File imageFile = new File(filePath);
            if (!imageFile.exists()) {
                Log.e(TAG, "图片文件不存在: " + filePath);
                return createResponse(false, "图片文件不存在: " + filePath, null);
            }

            // 使用ImageUtils.loadImageFileToBase64方法，它返回完整的Data URL格式
            String base64DataUrl = ImageUtils.loadImageFileToBase64(filePath);
            if (base64DataUrl == null || base64DataUrl.trim().isEmpty()) {
                Log.e(TAG, "图片文件读取失败: " + filePath);
                return createResponse(false, "图片文件读取失败", null);
            }

            Log.d(TAG, "图片文件转换为Base64成功: " + filePath + ", base64长度=" + base64DataUrl.length());
            return createResponseWithJsonData(true, "转换成功", "\"" + base64DataUrl + "\"");

        } catch (Exception e) {
            Log.e(TAG, "转换图片文件为Base64失败: " + filePath, e);
            return createResponse(false, "转换失败: " + e.getMessage(), null);
        }
    }

    @JavascriptInterface
    public String saveBase64ImageToGallery(String base64DataUrl, String filename) {
        try {
            if (base64DataUrl == null || base64DataUrl.isEmpty()) {
                return createResponse(false, "图片数据为空", null);
            }

            String name = (filename != null && !filename.isEmpty()) ? filename : ("IMG_" + System.currentTimeMillis() + ".png");

            String data = base64DataUrl;
            String mime = "image/png";

            if (data.startsWith("data:")) {
                int commaIndex = data.indexOf(',');
                if (commaIndex > 0) {
                    String header = data.substring(5, commaIndex);
                    int semiIndex = header.indexOf(';');
                    if (semiIndex > 0) {
                        mime = header.substring(0, semiIndex);
                    } else {
                        mime = header;
                    }
                    data = data.substring(commaIndex + 1);
                }
            }

            byte[] bytes = Base64.decode(data, Base64.DEFAULT);

            ContentValues values = new ContentValues();
            values.put(MediaStore.Images.Media.DISPLAY_NAME, name);
            values.put(MediaStore.Images.Media.MIME_TYPE, mime);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + File.separator + "imates");
                values.put(MediaStore.Images.Media.IS_PENDING, 1);
            }

            Uri uri = mContext.getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
            if (uri == null) {
                return createResponse(false, "保存失败", null);
            }

            try (java.io.OutputStream os = mContext.getContentResolver().openOutputStream(uri)) {
                if (os == null) {
                    return createResponse(false, "保存失败", null);
                }
                os.write(bytes);
                os.flush();
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues pending = new ContentValues();
                pending.put(MediaStore.Images.Media.IS_PENDING, 0);
                mContext.getContentResolver().update(uri, pending, null, null);
            }

            return createResponse(true, "保存成功", null);
        } catch (Exception e) {
            Log.e(TAG, "保存图片到相册失败", e);
            return createResponse(false, "保存失败: " + e.getMessage(), null);
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
        try {
            // 使用JSONObject构建响应，自动处理特殊字符转义
            JSONObject response = new JSONObject();
            response.put("success", success);
            response.put("message", message != null ? message : "");
            response.put("data", data != null ? data : JSONObject.NULL);
            return response.toString();
        } catch (JSONException e) {
            Log.e(TAG, "createResponse: 构建JSON响应失败", e);
            // 降级处理：使用String.format（但转义message和data中的特殊字符）
            String escapedMessage = message != null ? message.replace("\\", "\\\\")
                    .replace("\"", "\\\"")
                    .replace("\n", "\\n")
                    .replace("\r", "\\r") : "";
            String escapedData = data != null ? data.replace("\\", "\\\\")
                    .replace("\"", "\\\"")
                    .replace("\n", "\\n")
                    .replace("\r", "\\r") : "";
            return String.format(Locale.getDefault(),
                    "{\"success\":%b,\"message\":\"%s\",\"data\":%s}",
                    success, escapedMessage, escapedData != null ? "\"" + escapedData + "\"" : "null");
        }
    }

    private String createResponseWithJsonData(boolean success, String message, String jsonData) {
        try {
            // 使用JSONObject构建响应，自动处理特殊字符转义
            JSONObject response = new JSONObject();
            response.put("success", success);
            response.put("message", message != null ? message : "");

            // 如果jsonData是有效的JSON字符串，解析后放入data字段；否则直接作为字符串放入
            if (jsonData != null && !jsonData.isEmpty()) {
                try {
                    // 尝试解析jsonData，如果是有效的JSON对象，则解析后放入
                    JSONObject dataObj = new JSONObject(jsonData);
                    response.put("data", dataObj);
                } catch (JSONException e) {
                    // 如果不是有效的JSON对象，作为字符串放入
                    response.put("data", jsonData);
                }
            } else {
                response.put("data", JSONObject.NULL);
            }

            return response.toString();
        } catch (JSONException e) {
            Log.e(TAG, "createResponseWithJsonData: 构建JSON响应失败", e);
            // 降级处理：使用String.format（但转义message中的特殊字符）
            String escapedMessage = message != null ? message.replace("\\", "\\\\")
                    .replace("\"", "\\\"")
                    .replace("\n", "\\n")
                    .replace("\r", "\\r") : "";
            return String.format(Locale.getDefault(),
                    "{\"success\":%b,\"message\":\"%s\",\"data\":%s}",
                    success, escapedMessage, jsonData != null ? jsonData : "null");
        }
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
    public interface ExerciseSolveActivityBridge {
        // 图片选择回调接口
        default void onImageSelected(String imageInfo) {
            // 默认实现，可以在具体的Activity中重写
        }

        default void onImageCaptured(String imageInfo) {
            // 默认实现，可以在具体的Activity中重写
            Log.e(TAG, "默认实现，可以在具体的Activity中重写");
        }

        // 老师消息回调接口
        void setTeacherMessageCallback(String callbackName);
    }

    // FindExercise桥接器接口
    public interface FindExerciseActivityBridge {
        void startExerciseSolveWebView();

        void finishActivity();

        void showToast(String message);
    }

    // Web应用就绪回调接口
    public interface WebAppReadyCallback {
        void onWebAppReady();
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

    // ========== 加入课堂相关接口 ==========

    /**
     * 加入课堂
     * 
     * @param studentId   学生ID
     * @param studentName 学生姓名
     * @param isGuest     是否为游客模式
     * @returns 操作结果
     */
    @JavascriptInterface
    public String joinClassroom(String studentId, String studentName, boolean isGuest) {
        final String traceId = "JC_" + System.currentTimeMillis();
        Log.i(TAG, "[Classroom][Native][Join] start traceId=" + traceId + " studentId=" + studentId + " isGuest=" + isGuest);
        sendLogToWeb("INFO", TAG, "========== 加入课堂流程开始 ==========");
        sendLogToWeb("INFO", TAG,
                "参数: studentId=" + studentId + ", studentName=" + studentName + ", isGuest=" + isGuest);

        try {
            // 检查是否已在课堂中
            sendLogToWeb("DEBUG", TAG, "步骤1: 检查是否已在课堂中");
            if (ScreenCastingManager.isHavingClass()) {
                sendLogToWeb("WARN", TAG, "步骤1结果: 已在课堂中，返回失败");
                Log.w(TAG, "[Classroom][Native][Join] end traceId=" + traceId + " ok=false reason=already_in_class");
                return createResponse(false, "已在课堂中", null);
            }
            sendLogToWeb("DEBUG", TAG, "步骤1结果: 未在课堂中，继续");

            // 获取用户ID
            sendLogToWeb("DEBUG", TAG, "步骤2: 获取用户ID");
            String userId = AppUtils.getUserId();
            if (userId == null || userId.isEmpty()) {
                sendLogToWeb("ERROR", TAG, "步骤2结果: 用户未登录");
                Log.w(TAG, "[Classroom][Native][Join] end traceId=" + traceId + " ok=false reason=user_not_login");
                return createResponse(false, "用户未登录", null);
            }
            sendLogToWeb("INFO", TAG, "步骤2结果: 用户ID=" + userId);

            // 游客模式处理
            if (isGuest || userId.equals("guest000")) {
                sendLogToWeb("INFO", TAG, "步骤3: 检测到游客模式");
                Log.i(TAG, "[Classroom][Native][Join] guest traceId=" + traceId + " userId=" + userId);
                sendLogToWeb("DEBUG", TAG, "步骤3.1: 设置fakeClassMode=true");
                ApplicationModelShared.getInstance().fakeClassMode = true;

                // ✅ 触发Vue层回调，通知游客模式加入课堂成功
                sendLogToWeb("DEBUG", TAG, "步骤3.2: 准备触发onClassroomJoined事件（游客模式）");
                try {
                    String statusJson = String.format(Locale.getDefault(),
                            "{\"isInClass\":true,\"isProjecting\":false,\"studentId\":\"%s\",\"studentName\":\"%s\",\"localIp\":\"\",\"tsStreamPort\":0,\"status\":\"ready\"}",
                            userId != null ? userId.replace("\"", "\\\"") : "",
                            studentName != null ? studentName.replace("\"", "\\\"").replace("'", "\\'") : "");
                    String js = "if(window.onClassroomJoined){window.onClassroomJoined(" + statusJson + ");}";
                    executeJavaScript(js);
                    sendLogToWeb("INFO", TAG, "步骤3.2结果: 已触发onClassroomJoined事件（游客模式）");
                } catch (Exception e) {
                    sendLogToWeb("ERROR", TAG, "步骤3.2结果: 触发onClassroomJoined失败（游客模式）: " + e.getMessage());
                }

                sendLogToWeb("INFO", TAG, "========== 游客模式加入课堂成功 ==========");
                Log.i(TAG, "[Classroom][Native][Join] end traceId=" + traceId + " ok=true mode=guest");
                // 流程：使用createResponseWithJsonData方法返回JSON对象（而非字符串）
                return createResponseWithJsonData(true, "游客模式加入课堂成功", "{\"mode\":\"guest\",\"isInClass\":true}");
            }

            // 正式用户模式 - 这里需要Activity上下文来初始化ScreenShareKit
            sendLogToWeb("INFO", TAG, "步骤3: 检测到正式用户模式");
            if (mContext instanceof androidx.fragment.app.FragmentActivity) {
                androidx.fragment.app.FragmentActivity activity = (androidx.fragment.app.FragmentActivity) mContext;
                sendLogToWeb("DEBUG", TAG, "步骤3.1: Context是FragmentActivity，可以初始化ScreenShareKit");
                Log.i(TAG, "[Classroom][Native][Join] formal traceId=" + traceId + " userId=" + userId + " ctx=FragmentActivity");

                // ✅ 获取H264转TS流实例
                sendLogToWeb("DEBUG", TAG, "步骤3.2: 获取H264转TS流实例");
                final FFmpegPipeStreamer h264ToTsStreamer = H264MpegTSStreamerManager.getInstance();
                sendLogToWeb("INFO", TAG, "步骤3.2结果: H264转TS流实例获取成功");

                // ✅ 保存userId和studentName到final变量，供lambda表达式使用
                final String finalUserId = userId;
                final String finalStudentName = studentName;

                sendLogToWeb("DEBUG", TAG, "步骤3.3: 切换到UI线程，准备初始化ScreenShareKit");
                activity.runOnUiThread(() -> {
                    try {
                        sendLogToWeb("INFO", TAG, "步骤3.4: 开始初始化ScreenShareKit");
                        Log.i(TAG, "[Classroom][Native][Join] uiThread init ScreenShareKit traceId=" + traceId);
                        sendLogToWeb("DEBUG", TAG, "步骤3.4.1: 配置参数: 1280x720, 帧率="
                                + H264MpegTSStreamerManager.ENCODE_FRAME_RATE + ", 码率=4000000");
                        // 初始化ScreenShareKit
                        ScreenShareKit.INSTANCE.init(activity)
                                .config(1280, 720, H264MpegTSStreamerManager.ENCODE_FRAME_RATE, 4000000,
                                        EncodeBuilder.SCREEN_DATA_TYPE.H264, false, 0, 0)
                                .onH264((buffer, isKeyFrame, width, height, ts) -> {
                                    try {
                                        // 编码后的数据
                                        byte[] bytes = new byte[buffer.remaining()];
                                        buffer.get(bytes);

                                        // ✅ 转发H264数据到TS流
                                        h264ToTsStreamer.onH264DataReceived(bytes, ts);

                                        // 缓存I帧
                                        if (isKeyFrame) {
                                            H264IFrameCache.getInstance().onH264Frame(bytes);
                                        }
                                    } catch (Exception e) {
                                        sendLogToWeb("ERROR", TAG, "H264回调错误: " + e.getMessage());
                                    }
                                })
                                .onError(errorInfo -> {
                                    String errorMsg = errorInfo.getMessage() != null ? errorInfo.getMessage() : "未知错误";
                                    sendLogToWeb("ERROR", TAG, "ScreenShareKit错误回调: " + errorMsg);
                                    Log.w(TAG, "[Classroom][Native][Join] onError traceId=" + traceId + " msg=" + errorMsg);

                                    // 兼容：部分机型/系统在仅投屏视频时仍可能尝试初始化 AudioRecord，失败不应打断课堂流程
                                    if (errorMsg.contains("AudioRecord") || errorMsg.contains("Failed to create a new AudioRecord instance")) {
                                        return;
                                    }
                                    // ✅ 发生错误时通知Vue层
                                    try {
                                        String safeErrorMsg = errorMsg.replace("'", "\\'").replace("\"", "\\\"");
                                        String js = "if(window.onClassroomError){window.onClassroomError('"
                                                + safeErrorMsg + "');}";
                                        executeJavaScript(js);
                                        sendLogToWeb("INFO", TAG, "已触发onClassroomError事件");
                                    } catch (Exception e) {
                                        sendLogToWeb("ERROR", TAG, "触发onClassroomError失败: " + e.getMessage());
                                    }
                                })
                                .onStart(() -> {
                                    try {
                                        sendLogToWeb("INFO", TAG, "步骤3.5: ScreenShareKit启动成功，进入onStart回调");
                                        Log.i(TAG, "[Classroom][Native][Join] onStart traceId=" + traceId + " userId=" + finalUserId);

                                        // ✅ 设置课堂模式并启动通信循环
                                        sendLogToWeb("DEBUG", TAG, "步骤3.5.1: 设置ScreenCastingManager课堂模式为true");
                                        ScreenCastingManager.setClassMode(true);
                                        sendLogToWeb("INFO", TAG, "步骤3.5.1结果: 课堂模式已设置");

                                        // ✅ 启动ScreenCastingManager通信循环（向老师端发送状态）
                                        sendLogToWeb("DEBUG", TAG, "步骤3.5.1.1: 启动ScreenCastingManager通信循环");
                                        ScreenCastingManager.startLoop(activity, finalUserId, finalStudentName, UdpForwarderManager.getInstance());
                                        sendLogToWeb("INFO", TAG, "步骤3.5.1.1结果: 通信循环已启动");

                                        // ✅ 启动TS流转换
                                        sendLogToWeb("DEBUG", TAG, "步骤3.5.2: 启动TS流转换");
                                        h264ToTsStreamer.start();
                                        sendLogToWeb("INFO", TAG, "步骤3.5.2结果: TS流已启动");

                                        // ✅ 触发Vue层回调，通知加入课堂成功
                                        sendLogToWeb("DEBUG", TAG, "步骤3.5.3: 准备触发onClassroomJoined事件");
                                        try {
                                            // 构建JSON对象，使用安全的字符串转义
                                            String safeUserId = finalUserId != null ? finalUserId.replace("\"", "\\\"")
                                                    : "";
                                            String safeStudentName = finalStudentName != null
                                                    ? finalStudentName.replace("\"", "\\\"").replace("'", "\\'")
                                                    : "";

                                            // 构建完整的JSON对象字符串
                                            String statusJson = String.format(Locale.getDefault(),
                                                    "{\"isInClass\":true,\"isProjecting\":false,\"studentId\":\"%s\",\"studentName\":\"%s\",\"localIp\":\"\",\"tsStreamPort\":0,\"status\":\"ready\"}",
                                                    safeUserId, safeStudentName);

                                            // 调用JavaScript函数，传递JSON对象
                                            String js = "if(window.onClassroomJoined){window.onClassroomJoined("
                                                    + statusJson + ");}";
                                            executeJavaScript(js);
                                            sendLogToWeb("INFO", TAG, "步骤3.5.3结果: 已触发onClassroomJoined事件");
                                            sendLogToWeb("INFO", TAG, "========== 正式用户模式加入课堂成功 ==========");
                                            Log.i(TAG, "[Classroom][Native][Join] end traceId=" + traceId + " ok=true mode=formal (onStart)");
                                        } catch (Exception e) {
                                            sendLogToWeb("ERROR", TAG,
                                                    "步骤3.5.3结果: 触发onClassroomJoined失败: " + e.getMessage());
                                            Log.w(TAG, "[Classroom][Native][Join] onStart callback js failed traceId=" + traceId + " msg=" + e.getMessage());
                                        }
                                    } catch (Exception e) {
                                        sendLogToWeb("ERROR", TAG, "onStart回调错误: " + e.getMessage());
                                        Log.e(TAG, "[Classroom][Native][Join] onStart exception traceId=" + traceId, e);
                                    }
                                })
                                .start();
                        sendLogToWeb("INFO", TAG, "步骤3.4结果: ScreenShareKit.start()调用成功");
                    } catch (Exception e) {
                        sendLogToWeb("ERROR", TAG, "步骤3.4结果: ScreenShareKit初始化失败: " + e.getMessage());
                        // ✅ 初始化失败时通知Vue层
                        try {
                            String errorMsg = e.getMessage() != null
                                    ? e.getMessage().replace("'", "\\'").replace("\"", "\\\"")
                                    : "未知错误";
                            String js = "if(window.onClassroomError){window.onClassroomError('ScreenShareKit初始化失败: "
                                    + errorMsg + "');}";
                            executeJavaScript(js);
                            sendLogToWeb("INFO", TAG, "已触发onClassroomError事件");
                        } catch (Exception ex) {
                            sendLogToWeb("ERROR", TAG, "触发onClassroomError失败: " + ex.getMessage());
                        }
                    }
                });

                sendLogToWeb("INFO", TAG, "步骤3结果: 已切换到UI线程执行初始化，返回'正在加入课堂'");
                Log.i(TAG, "[Classroom][Native][Join] end traceId=" + traceId + " ok=true mode=formal (joining)");
                // 流程：使用createResponseWithJsonData方法返回JSON对象（而非字符串）
                return createResponseWithJsonData(true, "正在加入课堂", "{\"mode\":\"formal\",\"isJoining\":true}");
            } else {
                sendLogToWeb("ERROR", TAG, "步骤3结果: Context不是FragmentActivity，无法初始化ScreenShareKit");
                Log.w(TAG, "[Classroom][Native][Join] end traceId=" + traceId + " ok=false reason=need_fragment_activity");
                return createResponse(false, "需要FragmentActivity上下文", null);
            }

        } catch (Exception e) {
            sendLogToWeb("ERROR", TAG, "========== 加入课堂流程异常 ==========");
            sendLogToWeb("ERROR", TAG, "异常信息: " + e.getMessage());
            Log.e(TAG, "[Classroom][Native][Join] end traceId=" + traceId + " ok=false reason=exception", e);
            return createResponse(false, "加入课堂失败: " + e.getMessage(), null);
        }
    }

    /**
     * 退出课堂
     * 
     * @returns 操作结果
     */
    @JavascriptInterface
    public String exitClassroom() {
        final String traceId = "EC_" + System.currentTimeMillis();
        Log.i(TAG, "[Classroom][Native][Exit] start traceId=" + traceId);
        sendLogToWeb("INFO", TAG, "========== 退出课堂流程开始 ==========");

        try {
            // 流程：检查游客模式状态 -> 检查正式用户课堂状态 -> 如果都不在课堂则返回失败
            sendLogToWeb("DEBUG", TAG, "步骤1: 检查课堂状态");
            boolean isFakeClassMode = ApplicationModelShared.getInstance().fakeClassMode;
            boolean isInFormalClass = ScreenCastingManager.isHavingClass();
            sendLogToWeb("DEBUG", TAG,
                    "步骤1结果: isFakeClassMode=" + isFakeClassMode + ", isInFormalClass=" + isInFormalClass);

            // 流程：如果既不在游客模式课堂，也不在正式课堂，则返回失败
            if (!isFakeClassMode && !isInFormalClass) {
                sendLogToWeb("WARN", TAG, "步骤1结果: 未在课堂中，返回失败");
                Log.w(TAG, "[Classroom][Native][Exit] end traceId=" + traceId + " ok=false reason=not_in_class");
                return createResponse(false, "未在课堂中", null);
            }

            // 流程：获取用户ID（用于日志记录）
            sendLogToWeb("DEBUG", TAG, "步骤2: 获取用户ID");
            String userId = AppUtils.getUserId();
            if (userId == null || userId.isEmpty()) {
                userId = "unknown";
            }
            sendLogToWeb("INFO", TAG, "步骤2结果: 用户ID=" + userId);

            // 流程：处理游客模式退出 -> 设置fakeClassMode为false并返回成功
            if (isFakeClassMode) {
                sendLogToWeb("INFO", TAG, "步骤3: 检测到游客模式，开始退出");
                Log.i(TAG, "[Classroom][Native][Exit] guest traceId=" + traceId + " userId=" + userId);
                sendLogToWeb("DEBUG", TAG, "步骤3.1: 设置fakeClassMode=false");
                ApplicationModelShared.getInstance().fakeClassMode = false;
                sendLogToWeb("INFO", TAG, "步骤3.1结果: fakeClassMode已设置为false");

                // ✅ 触发Vue层回调，通知游客模式退出课堂成功
                sendLogToWeb("DEBUG", TAG, "步骤3.2: 准备触发onClassroomExited事件（游客模式）");
                try {
                    String js = "if(window.onClassroomExited){window.onClassroomExited();}";
                    executeJavaScript(js);
                    sendLogToWeb("INFO", TAG, "步骤3.2结果: 已触发onClassroomExited事件（游客模式）");
                } catch (Exception e) {
                    sendLogToWeb("ERROR", TAG, "步骤3.2结果: 触发onClassroomExited失败（游客模式）: " + e.getMessage());
                }

                sendLogToWeb("INFO", TAG, "========== 游客模式退出课堂成功 ==========");
                Log.i(TAG, "[Classroom][Native][Exit] end traceId=" + traceId + " ok=true mode=guest");
                return createResponseWithJsonData(true, "游客模式退出课堂成功", "{\"mode\":\"guest\",\"isInClass\":false}");
            }

            // 流程：处理正式用户模式退出 -> 设置ScreenCastingManager状态并停止ScreenShareKit
            sendLogToWeb("INFO", TAG, "步骤3: 检测到正式用户模式，开始退出");

            // ✅ 停止TS流转换
            sendLogToWeb("DEBUG", TAG, "步骤3.1: 停止TS流转换");
            try {
                FFmpegPipeStreamer streamer = H264MpegTSStreamerManager.getInstance();
                if (streamer != null) {
                    streamer.stop();
                    sendLogToWeb("INFO", TAG, "步骤3.1结果: TS流已停止");
                } else {
                    sendLogToWeb("WARN", TAG, "步骤3.1结果: TS流实例为空，跳过停止");
                }
            } catch (Exception e) {
                sendLogToWeb("ERROR", TAG, "步骤3.1结果: 停止TS流失败: " + e.getMessage());
            }

            // ✅ 设置课堂模式为false
            sendLogToWeb("DEBUG", TAG, "步骤3.2: 设置ScreenCastingManager课堂模式为false");
            ScreenCastingManager.setClassMode(false);
            sendLogToWeb("INFO", TAG, "步骤3.2结果: 课堂模式已设置为false");

            // ✅ 停止ScreenShareKit
            sendLogToWeb("DEBUG", TAG, "步骤3.3: 停止ScreenShareKit");
            try {
                ScreenShareKit.INSTANCE.stop();
                sendLogToWeb("INFO", TAG, "步骤3.3结果: ScreenShareKit已停止");
            } catch (Exception e) {
                sendLogToWeb("ERROR", TAG, "步骤3.3结果: 停止ScreenShareKit失败: " + e.getMessage());
            }

            // ✅ 触发Vue层回调，通知退出课堂成功
            sendLogToWeb("DEBUG", TAG, "步骤3.4: 准备触发onClassroomExited事件");
            try {
                String js = "if(window.onClassroomExited){window.onClassroomExited();}";
                executeJavaScript(js);
                sendLogToWeb("INFO", TAG, "步骤3.4结果: 已触发onClassroomExited事件");
            } catch (Exception e) {
                sendLogToWeb("ERROR", TAG, "步骤3.4结果: 触发onClassroomExited失败: " + e.getMessage());
            }

            sendLogToWeb("INFO", TAG, "========== 正式用户模式退出课堂成功 ==========");
            Log.i(TAG, "[Classroom][Native][Exit] end traceId=" + traceId + " ok=true mode=formal");
            return createResponseWithJsonData(true, "退出课堂成功", "{\"mode\":\"formal\",\"isInClass\":false}");

        } catch (Exception e) {
            sendLogToWeb("ERROR", TAG, "========== 退出课堂流程异常 ==========");
            sendLogToWeb("ERROR", TAG, "异常信息: " + e.getMessage());
            Log.e(TAG, "[Classroom][Native][Exit] end traceId=" + traceId + " ok=false reason=exception", e);
            return createResponse(false, "退出课堂失败: " + e.getMessage(), null);
        }
    }

    /**
     * 获取教室树数据
     * 提供给Web端使用，不直接弹出原生教室选择对话框
     *
     * @return 包装后的响应JSON字符串，data字段为教室树JSON对象
     */
    @JavascriptInterface
    public String fetchClassroomTree() {
        final String traceId = "CT_" + System.currentTimeMillis();
        Log.i(TAG, "[Classroom][Native][Tree] start traceId=" + traceId);
        Log.d(TAG, "📡 WebAppInterface.fetchClassroomTree 被调用");
        try {
            // 使用学生角色创建设备客户端，仅用于获取教室树
            String userId = AppUtils.getUserId();
            if (userId == null || userId.isEmpty()) {
                userId = "guest000";
            }

            DeviceClientWrapper client = new DeviceClientWrapper(
                    mContext,
                    "www.imates.com.cn",
                    8889,
                    userId,
                    DeviceType.STUDENT
            );

            String classroomsJson = client.fetchAllClassroomsTreeJsonSync();
            if (classroomsJson == null) {
                Log.w(TAG, "fetchClassroomTree: 获取教室树数据失败，返回null");
                Log.w(TAG, "[Classroom][Native][Tree] end traceId=" + traceId + " ok=false reason=null");
                return createResponse(false, "获取教室列表失败", null);
            }

            Log.d(TAG, "fetchClassroomTree: 获取到教室树数据长度=" + classroomsJson.length());
            Log.i(TAG, "[Classroom][Native][Tree] end traceId=" + traceId + " ok=true len=" + classroomsJson.length());
            return createResponseWithJsonData(true, "获取教室列表成功", classroomsJson);
        } catch (Exception e) {
            Log.e(TAG, "fetchClassroomTree: 获取教室树数据异常", e);
            Log.e(TAG, "[Classroom][Native][Tree] end traceId=" + traceId + " ok=false reason=exception", e);
            return createResponse(false, "获取教室列表异常: " + e.getMessage(), null);
        }
    }

    /**
     * 获取课堂状态
     * 
     * @returns 课堂状态信息
     */
    @JavascriptInterface
    public String getClassroomStatus() {
        final String traceId = "CS_" + System.currentTimeMillis();
        Log.i(TAG, "[Classroom][Native][Status] start traceId=" + traceId);
        Log.d(TAG, "🔍 WebAppInterface获取课堂状态 - 开始");

        try {
            String userId = AppUtils.getUserId();
            boolean isInClass = ScreenCastingManager.isHavingClass();
            boolean isProjecting = ScreenCastingManager.isProjecting();
            boolean isGuest = userId != null && userId.equals("guest000");

            String status = String.format(Locale.getDefault(),
                    "{\"isInClass\":%b,\"isProjecting\":%b,\"isGuest\":%b,\"userId\":\"%s\"}",
                    isInClass, isProjecting, isGuest, userId != null ? userId : "");

            Log.d(TAG, "🔍 WebAppInterface获取课堂状态 - 状态: " + status);
            Log.i(TAG, "[Classroom][Native][Status] end traceId=" + traceId + " ok=true isInClass=" + isInClass + " isProjecting=" + isProjecting + " userId=" + (userId != null ? userId : ""));
            return createResponseWithJsonData(true, "获取课堂状态成功", status);

        } catch (Exception e) {
            Log.e(TAG, "🔍 WebAppInterface获取课堂状态 - 发生错误", e);
            Log.e(TAG, "[Classroom][Native][Status] end traceId=" + traceId + " ok=false reason=exception", e);
            return createResponse(false, "获取课堂状态失败: " + e.getMessage(), null);
        }
    }

    /**
     * 检查是否在课堂中
     * 
     * @returns 是否在课堂中
     */
    @JavascriptInterface
    public boolean isInClassroom() {
        boolean isInClass = ScreenCastingManager.isHavingClass();
        Log.d(TAG, "🔍 WebAppInterface检查课堂状态 - isInClass: " + isInClass);
        return isInClass;
    }

    /**
     * 检查是否正在投影
     * 
     * @returns 是否正在投影
     */
    @JavascriptInterface
    public boolean isProjecting() {
        boolean isProjecting = ScreenCastingManager.isProjecting();
        Log.d(TAG, "🔍 WebAppInterface检查投影状态 - isProjecting: " + isProjecting);
        return isProjecting;
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

            // 通过JavaScript设置所有输入元素的属性（禁用键盘弹出，但不禁用文字选择）
            String script = "document.querySelectorAll('input, textarea, [contenteditable], math-field').forEach(el => {"
                    +
                    "  el.setAttribute('inputmode', 'none');" +
                    "  el.setAttribute('readonly', 'true');" +
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
            String script = "document.querySelectorAll('input, textarea, [contenteditable], math-field').forEach(el => {"
                    +
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
    
    // MediaProjection 截图管理器
    private MediaProjectionScreenshotManager mScreenshotManager;

    /**
     * 设置WebView实例
     */
    public void setWebView(WebView webView) {
        this.webView = webView;

        try {
            ScreenCastingManager.setProjectionStateListener(isProjecting -> {
                try {
                    sendLogToWeb("INFO", TAG, "📺 Projection state changed by teacher command, isProjecting=" + isProjecting);

                    if (isProjecting) {
                        executeJavaScript("if(window.onScreenProjectionStarted){window.onScreenProjectionStarted();}");
                    } else {
                        executeJavaScript("if(window.onScreenProjectionStopped){window.onScreenProjectionStopped();}");
                    }

                    String statusJson = String.format(Locale.getDefault(),
                            "{\"isInClass\":%b,\"isProjecting\":%b,\"status\":\"%s\"}",
                            ScreenCastingManager.isHavingClass(),
                            ScreenCastingManager.isProjecting(),
                            ScreenCastingManager.isProjecting() ? "streaming" : "ready");
                    executeJavaScript("if(window.onClassroomStatusChanged){window.onClassroomStatusChanged(" + statusJson + ");}");
                } catch (Exception e) {
                    sendLogToWeb("ERROR", TAG, "❌ handle projection state change failed: " + e.getMessage());
                }
            });
            sendLogToWeb("INFO", TAG, "✅ ProjectionStateListener registered");
        } catch (Exception e) {
            Log.e(TAG, "注册ProjectionStateListener失败", e);
        }
    }

    @JavascriptInterface
    public String takeSnapshot(String commandId) {
        try {
            if (webView == null) {
                Log.e(TAG, "takeSnapshot: webView is null");
                return "false";
            }
            if (!(mContext instanceof Activity)) {
                Log.e(TAG, "takeSnapshot: context is not Activity");
                return "false";
            }
            
            // 检查是否有 MediaProjection 权限
            if (!mScreenshotManager.hasMediaProjectionPermission()) {
                Log.w(TAG, "MediaProjection 权限未授权，回退到 rootView.draw() 方案");
                return takeSnapshotFallback(commandId);
            }
            
            // 使用 MediaProjection 截图
            Log.d(TAG, "使用 MediaProjection 截图");
            mScreenshotManager.takeScreenshot(commandId, new MediaProjectionScreenshotManager.ScreenshotCallback() {
                @Override
                public void onSuccess(String dataUrl, int width, int height) {
                    try {
                        JSONObject payload = new JSONObject();
                        payload.put("commandId", commandId != null ? commandId : "");
                        payload.put("dataUrl", dataUrl);
                        payload.put("width", width);
                        payload.put("height", height);
                        payload.put("method", "MediaProjection");

                        String js = "if(window.onSnapshotTaken){window.onSnapshotTaken(" + payload.toString() + ");}";
                        executeJavaScript(js);
                        
                        Log.d(TAG, "MediaProjection 截图成功: " + width + "x" + height);
                    } catch (JSONException e) {
                        Log.e(TAG, "构建截图响应失败", e);
                        sendErrorToWeb(commandId, "构建响应失败: " + e.getMessage());
                    }
                }

                @Override
                public void onError(String error) {
                    Log.e(TAG, "MediaProjection 截图失败: " + error);
                    // 回退到 rootView.draw() 方案
                    takeSnapshotFallback(commandId);
                }
            });
            
            return "true";
            
        } catch (Exception e) {
            Log.e(TAG, "takeSnapshot: exception", e);
            return "false";
        }
    }
    
    /**
     * 回退方案：使用 rootView.draw() 截图
     */
    private String takeSnapshotFallback(String commandId) {
        try {
            final Activity activity = (Activity) mContext;
            activity.runOnUiThread(() -> {
                try {
                    View rootView = activity.getWindow().getDecorView().getRootView();
                    int width = rootView.getWidth();
                    int height = rootView.getHeight();
                    if (width <= 0 || height <= 0) {
                        width = webView.getWidth();
                        height = webView.getHeight();
                    }
                    if (width <= 0 || height <= 0) {
                        Log.e(TAG, "takeSnapshotFallback: invalid view size");
                        sendErrorToWeb(commandId, "invalid_size");
                        return;
                    }

                    Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
                    android.graphics.Canvas canvas = new android.graphics.Canvas(bitmap);
                    rootView.draw(canvas);

                    ByteArrayOutputStream baos = new ByteArrayOutputStream();
                    bitmap.compress(Bitmap.CompressFormat.PNG, 100, baos);
                    byte[] bytes = baos.toByteArray();
                    String b64 = Base64.encodeToString(bytes, Base64.NO_WRAP);
                    String dataUrl = "data:image/png;base64," + b64;

                    JSONObject payload = new JSONObject();
                    payload.put("commandId", commandId != null ? commandId : "");
                    payload.put("dataUrl", dataUrl);
                    payload.put("width", width);
                    payload.put("height", height);
                    payload.put("method", "RootViewDraw");

                    String js = "if(window.onSnapshotTaken){window.onSnapshotTaken(" + payload.toString() + ");}";
                    executeJavaScript(js);
                    
                    Log.d(TAG, "RootViewDraw 截图成功: " + width + "x" + height);
                } catch (Exception e) {
                    Log.e(TAG, "takeSnapshotFallback: failed", e);
                    sendErrorToWeb(commandId, e.getMessage());
                }
            });
            return "true";
        } catch (Exception e) {
            Log.e(TAG, "takeSnapshotFallback: exception", e);
            return "false";
        }
    }
    
    /**
     * 发送错误到 Web
     */
    private void sendErrorToWeb(String commandId, String error) {
        try {
            String safeCmd = commandId != null ? commandId.replace("'", "\\'") : "";
            String safeMsg = error != null ? error.replace("'", "\\'") : "unknown";
            executeJavaScript("if(window.onSnapshotTaken){window.onSnapshotTaken({commandId:'" + safeCmd + "',error:'" + safeMsg + "'});}");
        } catch (Exception ignore) {
        }
    }

    /**
     * 设置 MediaProjection（从 ActivityResult 获取）
     */
    public void setMediaProjection(MediaProjection mediaProjection) {
        try {
            if (mScreenshotManager != null) {
                mScreenshotManager.setMediaProjection(mediaProjection);
                Log.d(TAG, "MediaProjection 已设置到截图管理器");
            }
        } catch (Exception e) {
            Log.e(TAG, "setMediaProjection: exception", e);
        }
    }
    
    /**
     * 设置 MediaProjection（从 ActivityResult 获取）
     */
    @JavascriptInterface
    public String setMediaProjection(int resultCode, String resultData) {
        try {
            if (!(mContext instanceof Activity)) {
                Log.e(TAG, "setMediaProjection: context is not Activity");
                return "false";
            }
            
            Activity activity = (Activity) mContext;
            if (mScreenshotManager == null) {
                Log.e(TAG, "setMediaProjection: screenshot manager is null");
                return "false";
            }
            
            // 这里需要从 Intent 中获取 MediaProjection
            // 由于是通过 JS 调用，我们需要在 Activity 中处理这个逻辑
            // 暂时返回成功，实际实现需要在 Activity 中处理
            Log.d(TAG, "setMediaProjection 调用成功");
            return "true";
            
        } catch (Exception e) {
            Log.e(TAG, "setMediaProjection: exception", e);
            return "false";
        }
    }
    
    /**
     * 检查是否有 MediaProjection 权限
     */
    @JavascriptInterface
    public boolean hasMediaProjectionPermission() {
        try {
            return mScreenshotManager != null && mScreenshotManager.hasMediaProjectionPermission();
        } catch (Exception e) {
            Log.e(TAG, "hasMediaProjectionPermission: exception", e);
            return false;
        }
    }
    
    /**
     * 请求 MediaProjection 权限
     */
    @JavascriptInterface
    public String requestMediaProjectionPermission() {
        try {
            if (!(mContext instanceof Activity)) {
                Log.e(TAG, "requestMediaProjectionPermission: context is not Activity");
                return "false";
            }
            
            Activity activity = (Activity) mContext;
            if (mScreenshotManager == null) {
                Log.e(TAG, "requestMediaProjectionPermission: screenshot manager is null");
                return "false";
            }
            
            // 获取 MediaProjectionManager 并创建权限请求 Intent
            MediaProjectionManager mediaProjectionManager = 
                (MediaProjectionManager) activity.getSystemService(Context.MEDIA_PROJECTION_SERVICE);
            
            if (mediaProjectionManager != null) {
                Intent intent = mediaProjectionManager.createScreenCaptureIntent();
                
                // 启动权限请求
                activity.startActivityForResult(intent, 1001);
                
                Log.d(TAG, "MediaProjection 权限请求已发送");
                return "true";
            } else {
                Log.e(TAG, "MediaProjectionManager 不可用");
                return "false";
            }
            
        } catch (Exception e) {
            Log.e(TAG, "requestMediaProjectionPermission: exception", e);
            return "false";
        }
    }
    
    /**
     * 释放 MediaProjection 资源
     */
    @JavascriptInterface
    public String releaseMediaProjection() {
        try {
            if (mScreenshotManager != null) {
                mScreenshotManager.release();
                Log.d(TAG, "MediaProjection 资源已释放");
            }
            return "true";
        } catch (Exception e) {
            Log.e(TAG, "releaseMediaProjection: exception", e);
            return "false";
        }
    }
    
    /**
     * 发送日志到Web前端（公共方法，供其他Service调用）
     * 
     * @param level   日志级别: DEBUG, INFO, WARN, ERROR
     * @param tag     日志标签
     * @param message 日志消息
     */
    public void sendLogToWeb(String level, String tag, String message) {
        // 在Android Logcat中打印
        switch (level.toUpperCase()) {
            case "DEBUG":
                Log.d(tag, message);
                break;
            case "INFO":
                Log.i(tag, message);
                break;
            case "WARN":
                Log.w(tag, message);
                break;
            case "ERROR":
                Log.e(tag, message);
                break;
            default:
                Log.i(tag, message);
                break;
        }

        // 发送到Web前端
        try {
            String safeMessage = message != null ? message.replace("\\", "\\\\")
                    .replace("'", "\\'")
                    .replace("\"", "\\\"")
                    .replace("\n", "\\n")
                    .replace("\r", "\\r") : "";
            String safeTag = tag != null ? tag.replace("'", "\\'").replace("\"", "\\\"") : "Android";
            String js = String.format(Locale.getDefault(),
                    "if(window.onAndroidLog){window.onAndroidLog('%s','%s','%s');}",
                    level != null ? level : "INFO", safeTag, safeMessage);
            executeJavaScript(js);
        } catch (Exception e) {
            Log.e(TAG, "发送日志到Web失败", e);
        }
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
                });
            } else {
                Log.w(TAG, "🎯 [ANDROID] Context不是Activity，无法执行JavaScript");
            }
        } else {
            Log.w(TAG, "🎯 [ANDROID] WebView实例为空，无法执行JavaScript");
        }
    }

    // ========== 原生相机预览控制方法 ==========

    /**
     * 启动原生相机预览
     * 通过 JS 桥接调用，启动底层 PreviewView 显示相机画面
     */
    @JavascriptInterface
    public void startNativeCameraPreview() {
        Log.d(TAG, "收到启动原生相机预览请求");
        if (mContext instanceof com.cosinetech.imates.ui.webview.MainWebViewActivity) {
            ((Activity) mContext).runOnUiThread(() -> {
                ((com.cosinetech.imates.ui.webview.MainWebViewActivity) mContext).startCameraPreview();
            });
        } else {
            Log.w(TAG, "当前Activity不是MainWebViewActivity，无法启动相机预览");
        }
    }

    /**
     * 停止原生相机预览
     * 通过 JS 桥接调用，停止底层 PreviewView 的相机画面
     */
    @JavascriptInterface
    public void stopNativeCameraPreview() {
        Log.d(TAG, "收到停止原生相机预览请求");
        if (mContext instanceof com.cosinetech.imates.ui.webview.MainWebViewActivity) {
            ((Activity) mContext).runOnUiThread(() -> {
                ((com.cosinetech.imates.ui.webview.MainWebViewActivity) mContext).stopCameraPreview();
            });
        } else {
            Log.w(TAG, "当前Activity不是MainWebViewActivity，无法停止相机预览");
        }
    }

    /**
     * 使用原生相机拍照
     * 通过 JS 桥接调用，使用底层相机进行拍照
     * 
     * @param callbackId 回调ID，用于匹配Web端的回调函数
     */
    @JavascriptInterface
    public void capturePhotoFromNative(String callbackId) {
        Log.d(TAG, "收到原生相机拍照请求，callbackId: " + callbackId);
        if (mContext instanceof com.cosinetech.imates.ui.webview.MainWebViewActivity) {
            ((Activity) mContext).runOnUiThread(() -> {
                ((com.cosinetech.imates.ui.webview.MainWebViewActivity) mContext).capturePhoto(callbackId);
            });
        } else {
            Log.w(TAG, "当前Activity不是MainWebViewActivity，无法使用原生相机拍照");
            // 回调 Web 端：拍照失败
            String js = String.format(
                    "javascript:(function() {" +
                            "  try {" +
                            "    if (window.onNativeCameraCaptureFailed) {" +
                            "      window.onNativeCameraCaptureFailed('%s', '当前环境不支持原生相机');" +
                            "    }" +
                            "  } catch(e) {" +
                            "    console.error('拍照回调失败:', e);" +
                            "  }" +
                            "})();",
                    callbackId != null ? callbackId.replace("'", "\\'") : "unknown");
            executeJavaScript(js);
        }
    }

    /**
     * 使用MuPDF打开PDF文件
     * 通过JS桥接调用，从Web端跳转到Android原生MuPDF页面
     * 从WebView的IndexedDB获取PDF数据，而不是从Android存储
     * 
     * @param textbookId 教材ID
     * @param resourceId 资源文件ID
     * @param sectionName 章节名称（可选）
     */
    @JavascriptInterface
    public void openPdfWithMuPDF(String textbookId, String resourceId, String sectionName) {
        Log.d(TAG, "收到打开PDF请求 - textbookId: " + textbookId + ", resourceId: " + resourceId);
        
        if (mContext instanceof Activity) {
            ((Activity) mContext).runOnUiThread(() -> {
                if (webView == null) {
                    Log.e(TAG, "WebView为空，无法从IndexedDB获取PDF数据");
                    showToast("无法打开PDF：WebView未初始化");
                    return;
                }
                
                try {
                    // 使用JSONObject.quote()安全转义参数（自动处理所有特殊字符）
                    // JSONObject.quote()返回带双引号的字符串，我们在JavaScript中使用双引号字符串
                    String safeTextbookId = textbookId != null ? 
                        JSONObject.quote(textbookId) : "\"\"";
                    String safeResourceId = resourceId != null ? 
                        JSONObject.quote(resourceId) : "\"\"";
                    String safeSectionName = sectionName != null ? 
                        JSONObject.quote(sectionName) : "\"\"";
                    
                    // 构建JavaScript代码：从IndexedDB获取PDF数据
                    // 使用回调函数的方式，因为IndexedDB是异步的
                    String jsCode = String.format(Locale.getDefault(),
                        "(function() {" +
                        "  try {" +
                        "    // 首先尝试使用resourceManager（如果可用）" +
                        "    if (typeof window !== 'undefined' && window.__resourceManager) {" +
                        "      window.__resourceManager.getFileData(%s, %s).then(function(fileData) {" +
                        "        if (!fileData || fileData.length === 0) {" +
                        "          if (window.AndroidBridge && window.AndroidBridge.onPdfDataReceived) {" +
                        "            window.AndroidBridge.onPdfDataReceived(JSON.stringify({success: false, error: '文件不存在或未下载'}), %s);" +
                        "          }" +
                        "          return;" +
                        "        }" +
                        "        // 将Uint8Array转换为Base64" +
                        "        var binary = '';" +
                        "        var bytes = new Uint8Array(fileData);" +
                        "        var len = bytes.byteLength;" +
                        "        for (var i = 0; i < len; i++) {" +
                        "          binary += String.fromCharCode(bytes[i]);" +
                        "        }" +
                        "        var base64 = btoa(binary);" +
                        "        if (window.AndroidBridge && window.AndroidBridge.onPdfDataReceived) {" +
                        "          window.AndroidBridge.onPdfDataReceived(JSON.stringify({success: true, data: base64}), %s);" +
                        "        }" +
                        "      }).catch(function(error) {" +
                        "        if (window.AndroidBridge && window.AndroidBridge.onPdfDataReceived) {" +
                        "          window.AndroidBridge.onPdfDataReceived(JSON.stringify({success: false, error: error.toString()}), %s);" +
                        "        }" +
                        "      });" +
                        "      return;" +
                        "    }" +
                        "    " +
                        "    // 如果resourceManager不可用，直接访问IndexedDB" +
                        "    try {" +
                        "      // 获取当前用户ID（从localStorage或默认值）" +
                        "      var userId = localStorage.getItem('currentUserId') || 'default';" +
                        "      var dbName = 'TextbookStorage_' + userId;" +
                        "      " +
                        "      var request = indexedDB.open(dbName, 8);" +
                        "      request.onsuccess = function(event) {" +
                        "        var db = event.target.result;" +
                        "        var transaction = db.transaction(['textbook_files'], 'readonly');" +
                        "        var store = transaction.objectStore('textbook_files');" +
                        "        var getRequest = store.get(%s);" +
                        "        " +
                        "        getRequest.onsuccess = function() {" +
                        "          var fileRecord = getRequest.result;" +
                        "          if (!fileRecord || !fileRecord.fileData || fileRecord.fileData.length === 0) {" +
                        "            if (window.AndroidBridge && window.AndroidBridge.onPdfDataReceived) {" +
                        "              window.AndroidBridge.onPdfDataReceived(JSON.stringify({success: false, error: '文件不存在或未下载'}), %s);" +
                        "            }" +
                        "            return;" +
                        "          }" +
                        "          " +
                        "          // 将Uint8Array转换为Base64" +
                        "          var fileData = fileRecord.fileData;" +
                        "          var binary = '';" +
                        "          var bytes = new Uint8Array(fileData);" +
                        "          var len = bytes.byteLength;" +
                        "          for (var i = 0; i < len; i++) {" +
                        "            binary += String.fromCharCode(bytes[i]);" +
                        "          }" +
                        "          var base64 = btoa(binary);" +
                        "          if (window.AndroidBridge && window.AndroidBridge.onPdfDataReceived) {" +
                        "            window.AndroidBridge.onPdfDataReceived(JSON.stringify({success: true, data: base64}), %s);" +
                        "          }" +
                        "        };" +
                        "        " +
                        "        getRequest.onerror = function() {" +
                        "          if (window.AndroidBridge && window.AndroidBridge.onPdfDataReceived) {" +
                        "            window.AndroidBridge.onPdfDataReceived(JSON.stringify({success: false, error: '读取IndexedDB失败'}), %s);" +
                        "          }" +
                        "        };" +
                        "      };" +
                        "      " +
                        "      request.onerror = function() {" +
                        "        if (window.AndroidBridge && window.AndroidBridge.onPdfDataReceived) {" +
                        "          window.AndroidBridge.onPdfDataReceived(JSON.stringify({success: false, error: '打开IndexedDB失败'}), %s);" +
                        "        }" +
                        "      };" +
                        "    } catch(e) {" +
                        "      if (window.AndroidBridge && window.AndroidBridge.onPdfDataReceived) {" +
                        "        window.AndroidBridge.onPdfDataReceived(JSON.stringify({success: false, error: e.toString()}), %s);" +
                        "      }" +
                        "    }" +
                        "  } catch(e) {" +
                        "    if (window.AndroidBridge && window.AndroidBridge.onPdfDataReceived) {" +
                        "      window.AndroidBridge.onPdfDataReceived(JSON.stringify({success: false, error: e.toString()}), %s);" +
                        "    }" +
                        "  }" +
                        "})()",
                        safeTextbookId, safeResourceId, safeSectionName, safeSectionName, safeSectionName,
                        safeResourceId, safeSectionName, safeSectionName, safeSectionName, safeSectionName, safeSectionName, safeSectionName);
                    
                    // 调试：记录生成的JavaScript代码（仅前500字符，避免日志过长）
                    if (jsCode != null && jsCode.length() > 0) {
                        String preview = jsCode.length() > 500 ? jsCode.substring(0, 500) + "..." : jsCode;
                        Log.d(TAG, "生成的JavaScript代码预览: " + preview);
                        Log.d(TAG, "JavaScript代码长度: " + jsCode.length());
                    } else {
                        Log.e(TAG, "生成的JavaScript代码为空！");
                    }
                    
                    // 执行JavaScript代码（异步，通过回调接收结果）
                    webView.evaluateJavascript(jsCode, null);
                    
                } catch (Exception e) {
                    Log.e(TAG, "打开PDF失败", e);
                    showToast("打开PDF失败: " + e.getMessage());
                }
            });
        } else {
            Log.w(TAG, "当前Context不是Activity，无法打开PDF");
            showToast("无法打开PDF");
        }
    }
    
    /**
     * 接收从WebView IndexedDB获取的PDF数据
     * 由JavaScript回调调用
     * 
     * @param resultJson JSON字符串，包含success和data/error字段
     * @param sectionName 章节名称（可选）
     */
    @JavascriptInterface
    public void onPdfDataReceived(String resultJson, String sectionName) {
        Log.d(TAG, "收到PDF数据回调");
        
        if (mContext instanceof Activity) {
            ((Activity) mContext).runOnUiThread(() -> {
                try {
                    if (resultJson == null || resultJson.isEmpty()) {
                        Log.e(TAG, "PDF数据回调结果为空");
                        showToast("无法获取PDF数据");
                        return;
                    }
                    
                    // 解析JSON响应
                    JSONObject result = new JSONObject(resultJson);
                    boolean success = result.optBoolean("success", false);
                    
                    if (!success) {
                        String error = result.optString("error", "未知错误");
                        Log.e(TAG, "获取PDF数据失败: " + error);
                        showToast("获取PDF数据失败: " + error);
                        return;
                    }
                    
                    // 获取Base64数据
                    String base64Data = result.optString("data", "");
                    if (base64Data.isEmpty()) {
                        Log.e(TAG, "Base64数据为空");
                        showToast("PDF数据为空");
                        return;
                    }
                    
                    // 将Base64转换为字节数组并保存为临时文件
                    byte[] pdfBytes = android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT);
                    
                    // 创建临时文件
                    File tempDir = new File(mContext.getCacheDir(), "pdf_temp");
                    if (!tempDir.exists()) {
                        tempDir.mkdirs();
                    }
                    
                    // 生成临时文件名（使用时间戳避免冲突）
                    String tempFileName = "pdf_" + System.currentTimeMillis() + ".pdf";
                    File tempFile = new File(tempDir, tempFileName);
                    
                    // 写入文件
                    java.io.FileOutputStream fos = new java.io.FileOutputStream(tempFile);
                    fos.write(pdfBytes);
                    fos.close();
                    
                    Log.d(TAG, "PDF文件已保存到临时文件: " + tempFile.getAbsolutePath() + ", 大小: " + pdfBytes.length + " 字节");
                    
                    // 创建Intent启动MuPDFActivity
                    Intent intent = new Intent(mContext, MuPDFActivity.class);
                    intent.setAction(Intent.ACTION_VIEW);
                    intent.setData(Uri.fromFile(tempFile));
                    if (sectionName != null && !sectionName.isEmpty()) {
                        intent.putExtra(MuPDFActivity.KEY_SECTION_NAME, sectionName);
                    }
                    mContext.startActivity(intent);
                    
                    // 注意：临时文件会在应用清理缓存时自动删除
                    // 如果需要立即删除，可以在MuPDFActivity关闭后删除
                    
                } catch (Exception e) {
                    Log.e(TAG, "处理PDF数据失败", e);
                    showToast("处理PDF数据失败: " + e.getMessage());
                }
            });
        }
    }
    
    /**
     * 递归查找文件
     */
    private String findFileRecursively(File dir, String fileName) {
        if (dir == null || !dir.exists() || !dir.isDirectory()) {
            return null;
        }
        
        File[] files = dir.listFiles();
        if (files != null) {
            for (File file : files) {
                if (file.isFile() && file.getName().equals(fileName)) {
                    return file.getAbsolutePath();
                } else if (file.isDirectory()) {
                    String result = findFileRecursively(file, fileName);
                    if (result != null) {
                        return result;
                    }
                }
            }
        }
        return null;
    }
    
    /**
     * 清理文件名，移除非法字符
     */
    private String sanitizeFileName(String fileName) {
        if (fileName == null) {
            return "";
        }
        return fileName.replaceAll("[^a-zA-Z0-9\u4e00-\u9fa5._-]", "_");
    }
    
    // ========== 研伴 API 代理接口（测试环境走原生网络） ==========
    
    /**
     * 通过原生发起研伴 API 请求
     * 用于测试环境下绕过 Web 的 HTTPS 证书问题
     * 
     * @param path 接口路径，如 "/api/app/teacher-textbook"
     * @param jsonBody 请求体 JSON 字符串
     * @param method HTTP 方法，如 "POST"、"GET"
     * @param envType 环境类型，由 Web 传入，如 "INTERNAL_TEST" 或 "RELEASE"
     * @param token 认证 Token，由 Web 传入
     * @return JSON 字符串，格式为 { success, data, code, message }
     */
    @JavascriptInterface
    public String callYanbanApi(String path, String jsonBody, String method, String envType, String token) {
        Log.d(TAG, "callYanbanApi 请求: path=" + path + ", method=" + method + ", envType=" + envType + ", hasToken=" + (token != null && !token.isEmpty()));
        
        try {
            // 1. 根据 Web 传入的环境类型决定使用哪个 BaseUrl
            String actualEnvType = (envType != null && !envType.isEmpty()) ? envType : "RELEASE";
            
            String baseUrl;
            if ("INTERNAL_TEST".equals(actualEnvType)) {
                // 测试环境：走 HTTPS
                baseUrl = "https://43.138.16.5:50013/blw-edu-yb";
            } else {
                // 正式环境：同样走 HTTPS
                baseUrl = "https://www.imates.com.cn:9099/blw-edu-yb";
            }
            
            String url = baseUrl + path;
            Log.d(TAG, "callYanbanApi 环境=" + actualEnvType + ", 完整URL: " + url);
            
            // 2. 创建 OkHttpClient（测试环境信任所有证书）
            OkHttpClient client;
            if ("INTERNAL_TEST".equals(actualEnvType)) {
                // 测试环境：信任所有证书（仅用于自签名证书的测试服务器）
                try {
                    // 创建信任所有证书的 TrustManager
                    final javax.net.ssl.TrustManager[] trustAllCerts = new javax.net.ssl.TrustManager[]{
                        new javax.net.ssl.X509TrustManager() {
                            @Override
                            public void checkClientTrusted(java.security.cert.X509Certificate[] chain, String authType) {}
                            @Override
                            public void checkServerTrusted(java.security.cert.X509Certificate[] chain, String authType) {}
                            @Override
                            public java.security.cert.X509Certificate[] getAcceptedIssuers() {
                                return new java.security.cert.X509Certificate[]{};
                            }
                        }
                    };
                    
                    // 创建 SSLContext
                    final javax.net.ssl.SSLContext sslContext = javax.net.ssl.SSLContext.getInstance("SSL");
                    sslContext.init(null, trustAllCerts, new java.security.SecureRandom());
                    final javax.net.ssl.SSLSocketFactory sslSocketFactory = sslContext.getSocketFactory();
                    
                    // 创建忽略主机名验证的 HostnameVerifier
                    final javax.net.ssl.HostnameVerifier trustAllHostnames = (hostname, session) -> true;
                    
                    client = new OkHttpClient.Builder()
                            .sslSocketFactory(sslSocketFactory, (javax.net.ssl.X509TrustManager) trustAllCerts[0])
                            .hostnameVerifier(trustAllHostnames)
                            .connectTimeout(15, TimeUnit.SECONDS)
                            .readTimeout(30, TimeUnit.SECONDS)
                            .writeTimeout(30, TimeUnit.SECONDS)
                            .build();
                    
                    Log.d(TAG, "callYanbanApi 使用信任所有证书的 OkHttpClient（测试环境）");
                } catch (Exception e) {
                    Log.e(TAG, "callYanbanApi 创建信任所有证书的 OkHttpClient 失败，回退到默认", e);
                    client = new OkHttpClient.Builder()
                            .connectTimeout(15, TimeUnit.SECONDS)
                            .readTimeout(30, TimeUnit.SECONDS)
                            .writeTimeout(30, TimeUnit.SECONDS)
                            .build();
                }
            } else {
                // 正式环境：使用默认的证书校验
                client = new OkHttpClient.Builder()
                        .connectTimeout(15, TimeUnit.SECONDS)
                        .readTimeout(30, TimeUnit.SECONDS)
                        .writeTimeout(30, TimeUnit.SECONDS)
                        .build();
            }
            
            // 3. 构建请求体
            RequestBody body = null;
            if (!"GET".equalsIgnoreCase(method)) {
                MediaType jsonType = MediaType.parse("application/json; charset=utf-8");
                if (jsonBody != null && !jsonBody.isEmpty()) {
                    // 有明确的 JSON 字符串时，正常作为请求体发送
                    body = RequestBody.create(jsonType, jsonBody);
                } else {
                    // 与浏览器行为对齐：无请求体时发送 0 字节 Body
                    body = RequestBody.create(null, new byte[0]);
                }
            }
            
            // 4. 构建请求
            Request.Builder builder = new Request.Builder().url(url);
            
            // 设置 HTTP 方法
            if ("GET".equalsIgnoreCase(method)) {
                builder.get();
            } else if ("POST".equalsIgnoreCase(method)) {
                builder.post(body);
            } else if ("PUT".equalsIgnoreCase(method)) {
                builder.put(body);
            } else if ("DELETE".equalsIgnoreCase(method)) {
                if (body != null) {
                    builder.delete(body);
                } else {
                    builder.delete();
                }
            } else {
                return buildErrorResponse("不支持的 HTTP 方法: " + method);
            }
            
            // 5. 添加认证头（使用 Web 传入的 Token），Header 名称与 Web http-client 保持一致
            if (token != null && !token.isEmpty() && !"undefined".equals(token)) {
                builder.addHeader("Token", token);
                builder.addHeader("sa-token", token);
                builder.addHeader("authorization", token);
                Log.d(TAG, "callYanbanApi 添加 Token 头");
            } else {
                Log.w(TAG, "callYanbanApi 未找到 Token");
            }
            
            // 添加通用请求头
            builder.addHeader("Content-Type", "application/json");
            
            Request request = builder.build();

            // 6. 调试日志：打印请求体和 Header（Token 值脱敏）
            try {
                // 打印请求体（最多 500 字符）
                if (jsonBody != null) {
                    String bodyPreview = jsonBody.length() > 500 ? jsonBody.substring(0, 500) + "..." : jsonBody;
                    Log.d(TAG, "callYanbanApi 请求体(JSON 预览前500字): " + bodyPreview);
                } else {
                    Log.d(TAG, "callYanbanApi 请求体为空(jsonBody == null)");
                }

                // 打印 Header（不做脱敏，便于完整对比）
                okhttp3.Headers headers = request.headers();
                StringBuilder headerLog = new StringBuilder();
                for (String name : headers.names()) {
                    String value = headers.get(name);
                    if (value == null) {
                        continue;
                    }
                    headerLog.append(name).append(": ").append(value).append("\n");
                }
                Log.d(TAG, "callYanbanApi 请求头:\n" + headerLog.toString());
            } catch (Exception e) {
                Log.e(TAG, "callYanbanApi 打印请求日志时异常", e);
            }

            // 7. 同步执行请求
            Response response = client.newCall(request).execute();
            String respBody = response.body() != null ? response.body().string() : "";
            
            Log.d(TAG, "callYanbanApi 响应: code=" + response.code() + ", bodyLength=" + respBody.length());
            
            // 调试日志：login-student 成功时打印完整响应体（含 token）
            if (path.contains("login-student") && response.isSuccessful()) {
                Log.d(TAG, "callYanbanApi [login-student] 响应体: " + respBody);
            }
            
            // 8. 判断响应格式并返回
            if (isJsonObject(respBody)) {
                // 后端已经返回标准 JSON，直接透传
                return respBody;
            } else {
                // 包装成统一格式
                JSONObject result = new JSONObject();
                result.put("success", response.isSuccessful());
                result.put("code", response.code());
                result.put("message", response.message());
                result.put("data", respBody);
                return result.toString();
            }
            
        } catch (Exception e) {
            Log.e(TAG, "callYanbanApi 异常", e);
            return buildErrorResponse("原生请求异常: " + e.getMessage());
        }
    }
    
    /**
     * 判断字符串是否为有效的 JSON 对象
     */
    private boolean isJsonObject(String text) {
        if (text == null || text.isEmpty()) {
            return false;
        }
        try {
            new JSONObject(text);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
    
    /**
     * 构建错误响应 JSON
     */
    private String buildErrorResponse(String message) {
        try {
            JSONObject error = new JSONObject();
            error.put("success", false);
            error.put("code", 0);
            error.put("message", message);
            return error.toString();
        } catch (JSONException e) {
            return "{\"success\":false,\"code\":0,\"message\":\"构建错误响应失败\"}";
        }
    }
}
