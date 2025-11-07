package com.cosinetech.imates.screencasting;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.graphics.SurfaceTexture;
import android.hardware.camera2.CameraAccessException;
import android.hardware.camera2.CameraCaptureSession;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraDevice;
import android.hardware.camera2.CameraManager;
import android.hardware.camera2.CaptureRequest;
import android.hardware.camera2.CaptureResult;
import android.hardware.camera2.TotalCaptureResult;
import android.media.MediaCodec;
import android.media.MediaCodecInfo;
import android.media.MediaFormat;
import android.os.Handler;
import android.os.HandlerThread;
import android.util.Log;
import android.view.Surface;

import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.util.Arrays;

/**
 * 相机流管理器
 * 使用Camera2 API获取相机预览流，编码为H264并传输
 */
public class CameraStreamManager {
    private static final String TAG = "CameraStreamManager";
    private static CameraStreamManager instance;

    private Context context;
    private CameraDevice cameraDevice;
    private CameraCaptureSession captureSession;
    private MediaCodec encoder;
    private Surface encoderSurface;
    private HandlerThread backgroundThread;
    private Handler backgroundHandler;
    
    private String cameraId;
    private int width = 1920;
    private int height = 1080;
    private int frameRate = 30;
    private int bitrate = 4000000; // 4Mbps
    
    private FFmpegPipeStreamer streamer;
    private CameraStreamHttpServer httpServer;
    private boolean isStreaming = false;
    
    // H264编码回调
    private MediaCodec.Callback encoderCallback = new MediaCodec.Callback() {
        @Override
        public void onInputBufferAvailable(@NonNull MediaCodec codec, int index) {
            // 输入缓冲区可用，由相机自动填充
        }

        @Override
        public void onOutputBufferAvailable(@NonNull MediaCodec codec, int index, @NonNull MediaCodec.BufferInfo info) {
            try {
                if (info.size > 0 && streamer != null && isStreaming) {
                    ByteBuffer outputBuffer = codec.getOutputBuffer(index);
                    if (outputBuffer != null) {
                        byte[] h264Data = new byte[info.size];
                        outputBuffer.get(h264Data);
                        
                        // 计算时间戳（微秒）
                        long presentationTimeUs = info.presentationTimeUs;
                        
                        // 转发到TS流
                        streamer.onH264DataReceived(h264Data, presentationTimeUs);
                        
                        // 检查是否为关键帧
                        boolean isKeyFrame = (info.flags & MediaCodec.BUFFER_FLAG_KEY_FRAME) != 0;
                        if (isKeyFrame) {
                            Log.d(TAG, "Key frame sent, size: " + info.size);
                        }
                    }
                }
                
                // 释放输出缓冲区
                codec.releaseOutputBuffer(index, false);
            } catch (Exception e) {
                Log.e(TAG, "Error processing encoder output", e);
            }
        }

        @Override
        public void onError(@NonNull MediaCodec codec, @NonNull MediaCodec.CodecException e) {
            Log.e(TAG, "Encoder error", e);
        }

        @Override
        public void onOutputFormatChanged(@NonNull MediaCodec codec, @NonNull MediaFormat format) {
            Log.d(TAG, "Output format changed: " + format);
        }
    };
    
    // 相机设备状态回调
    private CameraDevice.StateCallback cameraStateCallback = new CameraDevice.StateCallback() {
        @Override
        public void onOpened(@NonNull CameraDevice camera) {
            cameraDevice = camera;
            Log.d(TAG, "Camera opened: " + camera.getId());
            startPreview();
        }

        @Override
        public void onDisconnected(@NonNull CameraDevice camera) {
            Log.d(TAG, "Camera disconnected");
            closeCamera();
        }

        @Override
        public void onError(@NonNull CameraDevice camera, int error) {
            Log.e(TAG, "Camera error: " + error);
            closeCamera();
        }
    };
    
    private CameraStreamManager(Context context) {
        this.context = context.getApplicationContext();
    }
    
    public static synchronized CameraStreamManager getInstance(Context context) {
        if (instance == null) {
            instance = new CameraStreamManager(context);
        }
        return instance;
    }
    
    /**
     * 启动相机流
     */
    public void startStream(int width, int height, int frameRate, int bitrate) {
        if (isStreaming) {
            Log.w(TAG, "Camera stream already running");
            return;
        }
        
        this.width = width;
        this.height = height;
        this.frameRate = frameRate;
        this.bitrate = bitrate;
        
        // 检查权限
        if (ActivityCompat.checkSelfPermission(context, Manifest.permission.CAMERA) 
                != PackageManager.PERMISSION_GRANTED) {
            Log.e(TAG, "Camera permission not granted");
            return;
        }
        
        // 启动后台线程
        startBackgroundThread();
        
        // 初始化编码器
        if (!initEncoder()) {
            Log.e(TAG, "Failed to initialize encoder");
            return;
        }
        
        // 初始化TS流传输器
        int udpPort = UdpForwarderManager.STREAMING_LOCAL_PORT + 1;
        streamer = new FFmpegPipeStreamer(
            "127.0.0.1",
            udpPort,
            frameRate,
            null
        );
        streamer.start();
        
        // 启动HTTP服务器（将UDP流转换为HTTP流）
        httpServer = new CameraStreamHttpServer(udpPort);
        httpServer.start();
        
        // 打开相机
        openCamera();
        
        isStreaming = true;
        Log.d(TAG, "Camera stream started");
    }
    
    /**
     * 停止相机流
     */
    public void stopStream() {
        if (!isStreaming) {
            return;
        }
        
        isStreaming = false;
        
        // 停止HTTP服务器
        if (httpServer != null) {
            httpServer.stop();
            httpServer = null;
        }
        
        // 停止TS流传输器
        if (streamer != null) {
            streamer.stop();
            streamer = null;
        }
        
        // 关闭相机
        closeCamera();
        
        // 释放编码器
        releaseEncoder();
        
        // 停止后台线程
        stopBackgroundThread();
        
        Log.d(TAG, "Camera stream stopped");
    }
    
    /**
     * 初始化H264编码器
     */
    private boolean initEncoder() {
        try {
            MediaFormat format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, width, height);
            format.setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface);
            format.setInteger(MediaFormat.KEY_BIT_RATE, bitrate);
            format.setInteger(MediaFormat.KEY_FRAME_RATE, frameRate);
            format.setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1); // 每秒一个I帧
            
            encoder = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC);
            encoder.setCallback(encoderCallback, backgroundHandler);
            encoder.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE);
            
            encoderSurface = encoder.createInputSurface();
            encoder.start();
            
            Log.d(TAG, "Encoder initialized: " + width + "x" + height + "@" + frameRate + "fps");
            return true;
        } catch (IOException e) {
            Log.e(TAG, "Failed to initialize encoder", e);
            return false;
        }
    }
    
    /**
     * 释放编码器
     */
    private void releaseEncoder() {
        if (encoder != null) {
            try {
                encoder.stop();
                encoder.release();
            } catch (Exception e) {
                Log.e(TAG, "Error releasing encoder", e);
            }
            encoder = null;
        }
    }
    
    /**
     * 打开相机
     */
    private void openCamera() {
        try {
            CameraManager cameraManager = (CameraManager) context.getSystemService(Context.CAMERA_SERVICE);
            if (cameraManager == null) {
                Log.e(TAG, "CameraManager is null");
                return;
            }
            
            // 查找后置摄像头
            for (String id : cameraManager.getCameraIdList()) {
                CameraCharacteristics characteristics = cameraManager.getCameraCharacteristics(id);
                Integer facing = characteristics.get(CameraCharacteristics.LENS_FACING);
                if (facing != null && facing == CameraCharacteristics.LENS_FACING_BACK) {
                    cameraId = id;
                    break;
                }
            }
            
            if (cameraId == null) {
                Log.e(TAG, "No back camera found");
                return;
            }
            
            if (ActivityCompat.checkSelfPermission(context, Manifest.permission.CAMERA) 
                    != PackageManager.PERMISSION_GRANTED) {
                Log.e(TAG, "Camera permission not granted");
                return;
            }
            
            cameraManager.openCamera(cameraId, cameraStateCallback, backgroundHandler);
            Log.d(TAG, "Opening camera: " + cameraId);
        } catch (CameraAccessException e) {
            Log.e(TAG, "Failed to open camera", e);
        }
    }
    
    /**
     * 启动预览
     */
    private void startPreview() {
        if (cameraDevice == null || encoder == null || encoderSurface == null) {
            return;
        }
        
        try {
            CaptureRequest.Builder previewRequestBuilder = cameraDevice.createCaptureRequest(CameraDevice.TEMPLATE_RECORD);
            previewRequestBuilder.addTarget(encoderSurface);
            previewRequestBuilder.set(CaptureRequest.CONTROL_MODE, CaptureRequest.CONTROL_MODE_AUTO);
            previewRequestBuilder.set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE);
            
            cameraDevice.createCaptureSession(
                Arrays.asList(encoderSurface),
                new CameraCaptureSession.StateCallback() {
                    @Override
                    public void onConfigured(@NonNull CameraCaptureSession session) {
                        captureSession = session;
                        try {
                            session.setRepeatingRequest(previewRequestBuilder.build(), null, backgroundHandler);
                            Log.d(TAG, "Preview started");
                        } catch (CameraAccessException e) {
                            Log.e(TAG, "Failed to start preview", e);
                        }
                    }

                    @Override
                    public void onConfigureFailed(@NonNull CameraCaptureSession session) {
                        Log.e(TAG, "Failed to configure capture session");
                    }
                },
                backgroundHandler
            );
        } catch (CameraAccessException e) {
            Log.e(TAG, "Failed to start preview", e);
        }
    }
    
    /**
     * 关闭相机
     */
    private void closeCamera() {
        if (captureSession != null) {
            try {
                captureSession.close();
            } catch (Exception e) {
                Log.e(TAG, "Error closing capture session", e);
            }
            captureSession = null;
        }
        
        if (cameraDevice != null) {
            try {
                cameraDevice.close();
            } catch (Exception e) {
                Log.e(TAG, "Error closing camera", e);
            }
            cameraDevice = null;
        }
    }
    
    /**
     * 启动后台线程
     */
    private void startBackgroundThread() {
        backgroundThread = new HandlerThread("CameraBackground");
        backgroundThread.start();
        backgroundHandler = new Handler(backgroundThread.getLooper());
    }
    
    /**
     * 停止后台线程
     */
    private void stopBackgroundThread() {
        if (backgroundThread != null) {
            backgroundThread.quitSafely();
            try {
                backgroundThread.join();
            } catch (InterruptedException e) {
                Log.e(TAG, "Error stopping background thread", e);
            }
            backgroundThread = null;
            backgroundHandler = null;
        }
    }
    
    /**
     * 检查是否正在流式传输
     */
    public boolean isStreaming() {
        return isStreaming;
    }
}

