package com.cosinetech.imates.decoder;

import android.media.MediaCodec;
import android.media.MediaCodecInfo;
import android.media.MediaFormat;
import android.graphics.Bitmap;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

/**
 * H264 I 帧解码器
 * 专门用于解码 H264 的 I 帧，并通过回调返回解码后的 Bitmap
 */
public class H264IFrameDecoder {
    private static final String TAG = "H264IFrameDecoder";
    private static final String MIME_TYPE = MediaFormat.MIMETYPE_VIDEO_AVC; // H.264/AVC
    private static final long TIMEOUT_US = 10000; // 10ms 超时

    private MediaCodec decoder;
    private MediaFormat mediaFormat;
    private int width;
    private int height;
    private boolean isRunning = false;
    private Thread decoderThread;
    private final LinkedBlockingQueue<byte[]> frameQueue = new LinkedBlockingQueue<>();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    // YUV 到 RGB 转换器
    private YUVtoRGBConverter yuvConverter;

    // Bitmap 池，用于重用 Bitmap 对象
    private Bitmap outputBitmap;

    /**
     * 回调接口，用于接收解码后的 Bitmap
     */
    public interface BitmapCallback {
        void onBitmapDecoded(Bitmap bitmap);
        void onError(Exception e);
    }

    private BitmapCallback callback;

    /**
     * 构造函数
     * @param width 视频帧宽度
     * @param height 视频帧高度
     * @param callback 回调接口
     */
    public H264IFrameDecoder(int width, int height, BitmapCallback callback) {
        this.width = width;
        this.height = height;
        this.callback = callback;

        // 初始化 YUV 转换器
        yuvConverter = new YUVtoRGBConverter();
        yuvConverter.init();

        // 创建输出 Bitmap
        outputBitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);

        // 创建媒体格式
        mediaFormat = MediaFormat.createVideoFormat(MIME_TYPE, width, height);

        // 设置必要的格式参数
        mediaFormat.setInteger(MediaFormat.KEY_COLOR_FORMAT,
                MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Flexible);
        mediaFormat.setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, width * height);

        // 可选：设置帧率和比特率
        mediaFormat.setInteger(MediaFormat.KEY_FRAME_RATE, 30);
        mediaFormat.setInteger(MediaFormat.KEY_BIT_RATE, width * height * 4);
    }

    /**
     * 初始化解码器
     * @throws IOException 如果无法创建解码器
     */
    public void init() throws IOException {
        try {
            // 创建解码器
            decoder = MediaCodec.createDecoderByType(MIME_TYPE);
            decoder.configure(mediaFormat, null, null, 0);
            decoder.start();
            isRunning = true;

            // 启动解码线程
            startDecoderThread();

            Log.d(TAG, "解码器初始化成功");
        } catch (IOException e) {
            Log.e(TAG, "无法初始化解码器", e);
            throw e;
        }
    }

    /**
     * 解码 H264 I 帧
     * @param frameData H264 编码的 I 帧数据
     */
    public void decodeIFrame(byte[] frameData) {
        if (!isRunning) {
            Log.e(TAG, "解码器未运行");
            return;
        }

        // 将帧添加到队列中进行处理
        frameQueue.offer(frameData);
    }

    /**
     * 启动解码线程
     */
    private void startDecoderThread() {
        decoderThread = new Thread(() -> {
            try {
                while (isRunning) {
                    // 从队列中获取帧
                    byte[] frameData = frameQueue.poll(100, TimeUnit.MILLISECONDS);
                    if (frameData == null) continue;

                    // 处理帧
                    decodeFrameData(frameData);
                }
            } catch (InterruptedException e) {
                Log.d(TAG, "解码线程被中断");
            } catch (Exception e) {
                Log.e(TAG, "解码线程错误", e);
                notifyError(e);
            }
        });
        decoderThread.start();
    }

    /**
     * 解码帧数据
     * @param frameData H264 编码的帧数据
     */
    private void decodeFrameData(byte[] frameData) {
        try {
            // 获取输入缓冲区索引（带超时）
            int inputBufferIndex = decoder.dequeueInputBuffer(TIMEOUT_US);
            if (inputBufferIndex >= 0) {
                // 用数据填充输入缓冲区
                ByteBuffer inputBuffer = decoder.getInputBuffer(inputBufferIndex);
                if (inputBuffer != null) {
                    inputBuffer.clear();
                    inputBuffer.put(frameData);

                    // 将缓冲区排队等待解码
                    decoder.queueInputBuffer(inputBufferIndex, 0, frameData.length,
                            System.currentTimeMillis(), 0);
                }
            }

            // 获取解码后的输出
            MediaCodec.BufferInfo bufferInfo = new MediaCodec.BufferInfo();
            int outputBufferIndex = decoder.dequeueOutputBuffer(bufferInfo, TIMEOUT_US);

            if (outputBufferIndex >= 0) {
                // 有可用的输出数据
                ByteBuffer outputBuffer = decoder.getOutputBuffer(outputBufferIndex);
                if (outputBuffer != null) {
                    // 将 YUV 数据转换为 Bitmap
                    createBitmapFromDecodedData(outputBuffer, bufferInfo);

                    // 通过主线程通知回调
                    notifyBitmapDecoded(outputBitmap);

                    // 释放缓冲区
                    decoder.releaseOutputBuffer(outputBufferIndex, false);
                }
            } else if (outputBufferIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                // 格式已更改，如果需要，进行更新
                MediaFormat newFormat = decoder.getOutputFormat();
                Log.d(TAG, "输出格式已更改为 " + newFormat);
            }
        } catch (Exception e) {
            Log.e(TAG, "解码帧时出错", e);
            notifyError(e);
        }
    }

    /**
     * 从解码后的数据创建 Bitmap
     * @param buffer 包含 YUV 数据的缓冲区
     * @param bufferInfo 缓冲区信息
     */
    private void createBitmapFromDecodedData(ByteBuffer buffer, MediaCodec.BufferInfo bufferInfo) {
        // 提取 YUV 数据
        byte[] data = new byte[buffer.remaining()];
        buffer.get(data);

        // 将 YUV 转换为 RGB 并填充位图
        convertYUVtoRGB(data, outputBitmap);
    }

    /**
     * 使用 OpenGL ES 将 YUV 数据转换为 RGB 并填充位图
     * @param yuvData YUV 数据
     * @param bitmap 输出位图
     */
    private void convertYUVtoRGB(byte[] yuvData, Bitmap bitmap) {
        // 获取 MediaFormat 中的颜色格式
        int colorFormat = MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Flexible;
        try {
            MediaFormat format = decoder.getOutputFormat();
            if (format.containsKey(MediaFormat.KEY_COLOR_FORMAT)) {
                colorFormat = format.getInteger(MediaFormat.KEY_COLOR_FORMAT);
            }
        } catch (Exception e) {
            Log.w(TAG, "无法从解码器获取颜色格式，使用默认值", e);
        }

        // 设置 YUV 转换器参数
        yuvConverter.setParameters(width, height, colorFormat);

        // 使用 OpenGL ES 转换 YUV 到 RGB
        yuvConverter.convert(yuvData, bitmap);
    }

    /**
     * 通知 Bitmap 已解码
     * @param bitmap 解码后的 Bitmap
     */
    private void notifyBitmapDecoded(final Bitmap bitmap) {
        if (callback != null) {
            mainHandler.post(() -> callback.onBitmapDecoded(bitmap));
        }
    }

    /**
     * 通知错误
     * @param e 异常
     */
    private void notifyError(final Exception e) {
        if (callback != null) {
            mainHandler.post(() -> callback.onError(e));
        }
    }

    /**
     * 释放所有资源
     */
    public void release() {
        isRunning = false;

        if (decoderThread != null) {
            decoderThread.interrupt();
            try {
                decoderThread.join(500);
            } catch (InterruptedException e) {
                Log.w(TAG, "等待解码线程加入时被中断");
            }
            decoderThread = null;
        }

        if (decoder != null) {
            try {
                decoder.stop();
                decoder.release();
            } catch (Exception e) {
                Log.e(TAG, "释放解码器时出错", e);
            }
            decoder = null;
        }

        // 释放 YUV 转换器
        if (yuvConverter != null) {
            yuvConverter.release();
            yuvConverter = null;
        }

        // 释放 Bitmap
        if (outputBitmap != null && !outputBitmap.isRecycled()) {
            outputBitmap.recycle();
            outputBitmap = null;
        }

        frameQueue.clear();
        Log.d(TAG, "解码器已释放");
    }
}
