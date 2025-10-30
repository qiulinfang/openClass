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
import com.cosinetech.imates.data.models.UserInfoViewModel;
import com.cosinetech.imates.teachermessagemq.MessagingManager;
import com.cosinetech.imates.teachermessagemq.StudentMessage;
import com.cosinetech.imates.utils.ImageUtils;
import com.cosinetech.imates.utils.VoiceDbUtil;
import com.cosinetech.imates.screencasting.ScreenCastingManager;
import com.cosinetech.imates.ApplicationModelShared;
import androidx.lifecycle.ViewModelProvider;
import org.loka.screensharekit.ScreenShareKit;
import org.loka.screensharekit.EncodeBuilder;
import com.cosinetech.imates.screencasting.H264MpegTSStreamerManager;
import com.cosinetech.imates.screencasting.H264IFrameCache;

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
    private FindExerciseActivityBridge findExerciseBridge;

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

    // 设置FindExercise桥接器
    public void setFindExerciseBridge(FindExerciseActivityBridge bridge) {
        this.findExerciseBridge = bridge;
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

    /**
     * 同步Web端用户信息到Android原生ViewModel
     * 用于Web登录后同步状态
     * 
     * @param userId 用户ID
     * @param token 用户Token
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
                    new ViewModelProvider.AndroidViewModelFactory(ApplicationModelShared.getInstance())
            ).get(UserInfoViewModel.class);
            
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

    @JavascriptInterface
    public void startPhotoSearch(String subject) {
        if (exerciseBridge != null) {
            exerciseBridge.startPhotoSearch(subject);
        }
    }

    /**
     * 发送文本消息给老师（简化版：不保存到本地数据库）
     * 第1步：验证用户登录
     * 第2步：构建StudentMessage
     * 第3步：通过RabbitMQ发送
     * 第4步：返回结果
     */
    @JavascriptInterface
    public String sendTextMessageToTeacher(String content, String sessionId, String subject) {
        try {
            // 第1步：验证用户登录
            String userId = AppUtils.getUserId();
            if (userId == null || userId.isEmpty()) {
                return createResponse(false, "用户未登录", null);
            }

            // 第2步：确定学科类型
            String teacherSubject;
            if ("biology".equals(subject)) {
                teacherSubject = "6"; // SCHOOL_SUBJECT_BIOLOGY
            } else if ("math".equals(subject)) {
                teacherSubject = "2"; // SCHOOL_SUBJECT_MATH
            } else {
                return createResponse(false, "不支持的学科类型", null);
            }

            // 第3步：创建StudentMessage
            String messageId = UUID.randomUUID().toString();
            long timestamp = System.currentTimeMillis();
            
            StudentMessage studentMsg = new StudentMessage(
                    userId, sessionId, teacherSubject, 0, content); // 0 = QA_MSG_TYPE_TEXT
            studentMsg.setMessageId(messageId);

            // 第4步：通过RabbitMQ发送（不保存到本地数据库）
            MessagingManager.getInstance().sendMessageToTeacher(studentMsg, null);

            // 第5步：构建返回数据
            String messageData = String.format(Locale.getDefault(),
                    "{\"messageId\":\"%s\",\"userId\":\"%s\",\"sessionId\":\"%s\",\"subject\":\"%s\",\"messageType\":\"TEXT\",\"content\":\"%s\",\"timestamp\":%d}",
                    messageId, userId, sessionId, teacherSubject, content, timestamp);

            return createResponseWithJsonData(true, "消息发送成功", messageData);

        } catch (Exception e) {
            return createResponse(false, "发送消息失败: " + e.getMessage(), null);
        }
    }

    /**
     * 发送语音消息给老师（简化版：不保存到本地数据库）
     * 第1步：验证用户登录
     * 第2步：检查语音文件
     * 第3步：读取并转Base64
     * 第4步：通过RabbitMQ发送
     * 第5步：返回结果
     */
    @JavascriptInterface
    public String sendVoiceMessageToTeacher(String voicePath, String duration, String sessionId, String subject) {
        try {
            // 第1步：验证用户登录
            String userId = AppUtils.getUserId();
            if (userId == null || userId.isEmpty()) {
                return createResponse(false, "用户未登录", null);
            }

            // 第2步：检查语音文件是否存在
            File voiceFile = new File(voicePath);
            if (!voiceFile.exists()) {
                return createResponse(false, "语音文件不存在: " + voicePath, null);
            }

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

            // 第5步：读取语音文件并转换为Base64
            String voiceBase64Content = VoiceDbUtil.getRawVoiceBase64(voicePath);
            if (voiceBase64Content == null || voiceBase64Content.equals("null")) {
                return createResponse(false, "语音文件读取失败", null);
            }

            StudentMessage studentMsg = new StudentMessage(
                    userId, sessionId, teacherSubject, 2, voiceBase64Content); // 2 = QA_MSG_TYPE_VOICE
            studentMsg.setMessageId(messageId);

            // 第6步：通过RabbitMQ发送（不保存到本地数据库）
            MessagingManager.getInstance().sendMessageToTeacher(studentMsg, null);

            // 第7步：构建返回数据
            String messageData = String.format(Locale.getDefault(),
                    "{\"messageId\":\"%s\",\"userId\":\"%s\",\"sessionId\":\"%s\",\"subject\":\"%s\",\"messageType\":\"VOICE\",\"voicePath\":\"%s\",\"duration\":%s,\"timestamp\":%d}",
                    messageId, userId, sessionId, teacherSubject, voicePath, duration, timestamp);

            return createResponseWithJsonData(true, "语音消息发送成功", messageData);

        } catch (Exception e) {
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
        try {
            // 第1步：验证用户登录
            String userId = AppUtils.getUserId();
            if (userId == null || userId.isEmpty()) {
                return createResponse(false, "用户未登录", null);
            }

            // 第2步：检查图片文件是否存在
            File imageFile = new File(imagePath);
            if (!imageFile.exists()) {
                return createResponse(false, "图片文件不存在: " + imagePath, null);
            }

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

            // 第5步：读取图片文件并转换为Base64
            String imageBase64Content = ImageUtils.loadImageFileToBase64(imagePath);
            if (imageBase64Content == null || imageBase64Content.trim().isEmpty()) {
                return createResponse(false, "图片文件读取失败", null);
            }

            StudentMessage studentMsg = new StudentMessage(
                    userId, sessionId, teacherSubject, 1, imageBase64Content); // 1 = QA_MSG_TYPE_PICTURE
            studentMsg.setMessageId(messageId);

            // 第6步：通过RabbitMQ发送（不保存到本地数据库）
            MessagingManager.getInstance().sendMessageToTeacher(studentMsg, null);

            // 第7步：构建返回数据
            String messageData = String.format(Locale.getDefault(),
                    "{\"messageId\":\"%s\",\"userId\":\"%s\",\"sessionId\":\"%s\",\"subject\":\"%s\",\"messageType\":\"IMAGE\",\"imagePath\":\"%s\",\"timestamp\":%d}",
                    messageId, userId, sessionId, teacherSubject, imagePath, timestamp);

            return createResponseWithJsonData(true, "图片消息发送成功", messageData);

        } catch (Exception e) {
            return createResponse(false, "发送图片消息失败: " + e.getMessage(), null);
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

                    // 第2步：调用JavaScript回调（前端负责保存）
                    String script = String.format(Locale.getDefault(),
                            "if (window.onTeacherMessageReceived) { window.onTeacherMessageReceived(%s); }",
                            messageJson.toString());

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
    public interface ExerciseSolveActivityBridge {
        void startPhotoSearch(String subject);

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

        void onTeacherMessageReceived(String messageData);
    }

    // FindExercise桥接器接口
    public interface FindExerciseActivityBridge {
        void startExerciseSolveWebView();
        void finishActivity();
        void showToast(String message);
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
     * @param studentId 学生ID
     * @param studentName 学生姓名
     * @param isGuest 是否为游客模式
     * @returns 操作结果
     */
    @JavascriptInterface
    public String joinClassroom(String studentId, String studentName, boolean isGuest) {
        Log.d(TAG, "🔍 WebAppInterface加入课堂 - 开始: studentId=" + studentId + ", studentName=" + studentName + ", isGuest=" + isGuest);
        
        try {
            // 检查是否已在课堂中
            if (ScreenCastingManager.isHavingClass()) {
                Log.d(TAG, "🔍 WebAppInterface加入课堂 - 已在课堂中");
                return createResponse(false, "已在课堂中", null);
            }
            
            // 获取用户ID
            String userId = AppUtils.getUserId();
            if (userId == null || userId.isEmpty()) {
                return createResponse(false, "用户未登录", null);
            }
            
            // 游客模式处理
            if (isGuest || userId.equals("guest000")) {
                Log.d(TAG, "🔍 WebAppInterface加入课堂 - 游客模式");
                ApplicationModelShared.getInstance().fakeClassMode = true;
                // 流程：使用createResponseWithJsonData方法返回JSON对象（而非字符串）
                return createResponseWithJsonData(true, "游客模式加入课堂成功", "{\"mode\":\"guest\",\"isInClass\":true}");
            }
            
            // 正式用户模式 - 这里需要Activity上下文来初始化ScreenShareKit
            if (mContext instanceof androidx.fragment.app.FragmentActivity) {
                androidx.fragment.app.FragmentActivity activity = (androidx.fragment.app.FragmentActivity) mContext;
                activity.runOnUiThread(() -> {
                    try {
                        // 初始化ScreenShareKit
                        ScreenShareKit.INSTANCE.init(activity)
                            .config(1920, 1080, H264MpegTSStreamerManager.ENCODE_FRAME_RATE, 8000000, 
                                   EncodeBuilder.SCREEN_DATA_TYPE.H264, false, 44100, 2)
                            .onH264((buffer, isKeyFrame, width, height, ts) -> {
                                try {
                                    // 编码后的数据
                                    byte[] bytes = new byte[buffer.remaining()];
                                    buffer.get(bytes);
                                    
                                    // 这里需要H264MpegTSStreamerManager实例，暂时跳过
                                    Log.d(TAG, "🔍 WebAppInterface加入课堂 - H264数据接收");
                                    if (isKeyFrame) {
                                        H264IFrameCache.getInstance().onH264Frame(bytes);
                                    }
                                } catch (Exception e) {
                                    Log.e(TAG, "🔍 WebAppInterface加入课堂 - H264回调错误", e);
                                }
                            })
                            .onError(errorInfo -> Log.e(TAG, "🔍 WebAppInterface加入课堂 - ScreenShareKit错误: " + errorInfo.getMessage()))
                            .onStart(() -> {
                                ScreenCastingManager.setClassMode(true);
                                Log.d(TAG, "🔍 WebAppInterface加入课堂 - ScreenShareKit启动成功");
                            })
                            .start();
                    } catch (Exception e) {
                        Log.e(TAG, "🔍 WebAppInterface加入课堂 - ScreenShareKit初始化失败", e);
                    }
                });
                
                // 流程：使用createResponseWithJsonData方法返回JSON对象（而非字符串）
                return createResponseWithJsonData(true, "正在加入课堂", "{\"mode\":\"formal\",\"isJoining\":true}");
            } else {
                return createResponse(false, "需要FragmentActivity上下文", null);
            }
            
        } catch (Exception e) {
            Log.e(TAG, "🔍 WebAppInterface加入课堂 - 发生错误", e);
            return createResponse(false, "加入课堂失败: " + e.getMessage(), null);
        }
    }
    
    /**
     * 退出课堂
     * @returns 操作结果
     */
    @JavascriptInterface
    public String exitClassroom() {
        Log.d(TAG, "🔍 WebAppInterface退出课堂 - 开始");
        
        try {
            // 检查是否在课堂中
            if (!ScreenCastingManager.isHavingClass()) {
                Log.d(TAG, "🔍 WebAppInterface退出课堂 - 未在课堂中");
                return createResponse(false, "未在课堂中", null);
            }
            
            // 获取用户ID
            String userId = AppUtils.getUserId();
            if (userId == null || userId.isEmpty()) {
                return createResponse(false, "用户未登录", null);
            }
            
            // 游客模式处理
            if (userId.equals("guest000")) {
                Log.d(TAG, "🔍 WebAppInterface退出课堂 - 游客模式");
                ApplicationModelShared.getInstance().fakeClassMode = false;
                return createResponse(true, "游客模式退出课堂成功", "{\"mode\":\"guest\",\"isInClass\":false}");
            }
            
            // 正式用户模式
            Log.d(TAG, "🔍 WebAppInterface退出课堂 - 正式用户模式");
            ScreenCastingManager.setClassMode(false);
            ScreenShareKit.INSTANCE.stop();
            
            return createResponse(true, "退出课堂成功", "{\"mode\":\"formal\",\"isInClass\":false}");
            
        } catch (Exception e) {
            Log.e(TAG, "🔍 WebAppInterface退出课堂 - 发生错误", e);
            return createResponse(false, "退出课堂失败: " + e.getMessage(), null);
        }
    }
    
    /**
     * 获取课堂状态
     * @returns 课堂状态信息
     */
    @JavascriptInterface
    public String getClassroomStatus() {
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
            return createResponseWithJsonData(true, "获取课堂状态成功", status);
            
        } catch (Exception e) {
            Log.e(TAG, "🔍 WebAppInterface获取课堂状态 - 发生错误", e);
            return createResponse(false, "获取课堂状态失败: " + e.getMessage(), null);
        }
    }
    
    /**
     * 检查是否在课堂中
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
