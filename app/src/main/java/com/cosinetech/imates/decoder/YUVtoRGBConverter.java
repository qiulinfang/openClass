package com.cosinetech.imates.decoder;

import android.graphics.Bitmap;
import android.opengl.GLES20;
import android.util.Log;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;
import java.nio.IntBuffer;

/**
 * 使用 OpenGL ES 实现的 YUV 到 RGB 转换器
 * 支持 I420(YUV420P) 和 NV12/NV21(YUV420SP) 格式
 */
public class YUVtoRGBConverter {
    private static final String TAG = "YUVtoRGBConverter";

    // 顶点着色器
    private static final String VERTEX_SHADER =
            "attribute vec4 aPosition;\n" +
                    "attribute vec2 aTextureCoord;\n" +
                    "varying vec2 vTextureCoord;\n" +
                    "void main() {\n" +
                    "  gl_Position = aPosition;\n" +
                    "  vTextureCoord = aTextureCoord;\n" +
                    "}";

    // I420(YUV420P) 片段着色器
    private static final String FRAGMENT_SHADER_I420 =
            "precision mediump float;\n" +
                    "varying vec2 vTextureCoord;\n" +
                    "uniform sampler2D yTexture;\n" +
                    "uniform sampler2D uTexture;\n" +
                    "uniform sampler2D vTexture;\n" +
                    "void main() {\n" +
                    "  float y = texture2D(yTexture, vTextureCoord).r;\n" +
                    "  float u = texture2D(uTexture, vTextureCoord).r - 0.5;\n" +
                    "  float v = texture2D(vTexture, vTextureCoord).r - 0.5;\n" +
                    "  float r = y + 1.402 * v;\n" +
                    "  float g = y - 0.344 * u - 0.714 * v;\n" +
                    "  float b = y + 1.772 * u;\n" +
                    "  gl_FragColor = vec4(r, g, b, 1.0);\n" +
                    "}";

    // NV12/NV21(YUV420SP) 片段着色器
    private static final String FRAGMENT_SHADER_NV12 =
            "precision mediump float;\n" +
                    "varying vec2 vTextureCoord;\n" +
                    "uniform sampler2D yTexture;\n" +
                    "uniform sampler2D uvTexture;\n" +
                    "uniform bool isNV12;\n" + // true for NV12, false for NV21
                    "void main() {\n" +
                    "  float y = texture2D(yTexture, vTextureCoord).r;\n" +
                    "  vec4 uv = texture2D(uvTexture, vTextureCoord);\n" +
                    "  float u, v;\n" +
                    "  if (isNV12) {\n" +
                    "    u = uv.r - 0.5;\n" +
                    "    v = uv.g - 0.5;\n" +
                    "  } else {\n" +
                    "    v = uv.r - 0.5;\n" +
                    "    u = uv.g - 0.5;\n" +
                    "  }\n" +
                    "  float r = y + 1.402 * v;\n" +
                    "  float g = y - 0.344 * u - 0.714 * v;\n" +
                    "  float b = y + 1.772 * u;\n" +
                    "  gl_FragColor = vec4(r, g, b, 1.0);\n" +
                    "}";

    // 顶点坐标
    private static final float[] VERTICES = {
            -1.0f, -1.0f,  // 左下
            -1.0f,  1.0f,  // 左上
            1.0f, -1.0f,  // 右下
            1.0f,  1.0f   // 右上
    };

    // 纹理坐标
    private static final float[] TEXTURE_COORDS = {
            0.0f, 1.0f,  // 左下
            0.0f, 0.0f,  // 左上
            1.0f, 1.0f,  // 右下
            1.0f, 0.0f   // 右上
    };

    // 常量
    private static final int COLOR_FORMAT_I420 = 1;
    private static final int COLOR_FORMAT_NV12 = 2;
    private static final int COLOR_FORMAT_NV21 = 3;

    // OpenGL ES 相关变量
    private int programI420 = 0;
    private int programNV12 = 0;
    private int[] frameBuffers = new int[1];
    private int[] renderTextures = new int[1];
    private int[] yuvTextures = new int[3]; // Y, U, V 或 Y, UV

    // 缓冲区
    private FloatBuffer vertexBuffer;
    private FloatBuffer textureBuffer;

    // 状态变量
    private boolean initialized = false;
    private int width = 0;
    private int height = 0;
    private int colorFormat = COLOR_FORMAT_I420;

    // EGL 辅助类
    private EGLHelper eglHelper;

    /**
     * 初始化 OpenGL ES 资源
     */
    public void init() {
        if (initialized) {
            return;
        }

        // 初始化 EGL
        eglHelper = new EGLHelper();
        if (!eglHelper.init()) {
            Log.e(TAG, "EGL 初始化失败");
            return;
        }

        // 初始化顶点缓冲区
        vertexBuffer = ByteBuffer.allocateDirect(VERTICES.length * 4)
                .order(ByteOrder.nativeOrder())
                .asFloatBuffer();
        vertexBuffer.put(VERTICES).position(0);

        // 初始化纹理缓冲区
        textureBuffer = ByteBuffer.allocateDirect(TEXTURE_COORDS.length * 4)
                .order(ByteOrder.nativeOrder())
                .asFloatBuffer();
        textureBuffer.put(TEXTURE_COORDS).position(0);

        // 创建着色器程序
        programI420 = createProgram(VERTEX_SHADER, FRAGMENT_SHADER_I420);
        programNV12 = createProgram(VERTEX_SHADER, FRAGMENT_SHADER_NV12);

        // 生成纹理
        GLES20.glGenTextures(3, yuvTextures, 0);
        for (int i = 0; i < 3; i++) {
            GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, yuvTextures[i]);
            GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR);
            GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR);
            GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE);
            GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE);
        }

        // 生成帧缓冲区和渲染纹理
        GLES20.glGenFramebuffers(1, frameBuffers, 0);
        GLES20.glGenTextures(1, renderTextures, 0);

        initialized = true;
    }

    /**
     * 设置图像尺寸和颜色格式
     * @param width 图像宽度
     * @param height 图像高度
     * @param colorFormat 颜色格式 (MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420*)
     */
    public void setParameters(int width, int height, int colorFormat) {
        if (!initialized) {
            init();
        }

        this.width = width;
        this.height = height;

        // 根据 MediaCodec 颜色格式确定内部格式
        if (colorFormat == android.media.MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Planar ||
                colorFormat == 19) { // COLOR_FormatYUV420Planar
            this.colorFormat = COLOR_FORMAT_I420;
        } else if (colorFormat == android.media.MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420SemiPlanar ||
                colorFormat == 21) { // COLOR_FormatYUV420SemiPlanar
            this.colorFormat = COLOR_FORMAT_NV12;
        } else {
            // 默认使用 NV21 (大多数 Android 设备)
            this.colorFormat = COLOR_FORMAT_NV21;
        }

        // 设置渲染纹理
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, renderTextures[0]);
        GLES20.glTexImage2D(GLES20.GL_TEXTURE_2D, 0, GLES20.GL_RGBA, width, height, 0,
                GLES20.GL_RGBA, GLES20.GL_UNSIGNED_BYTE, null);
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR);
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR);
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE);
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE);
    }

    /**
     * 将 YUV 数据转换为 RGB 并渲染到 Bitmap
     * @param yuvData YUV 数据
     * @param bitmap 输出 Bitmap (ARGB_8888)
     */
    public void convert(byte[] yuvData, Bitmap bitmap) {
        if (!initialized || width == 0 || height == 0) {
            Log.e(TAG, "Converter not properly initialized");
            return;
        }

        // 设置视口
        GLES20.glViewport(0, 0, width, height);

        // 绑定帧缓冲区
        GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, frameBuffers[0]);
        GLES20.glFramebufferTexture2D(GLES20.GL_FRAMEBUFFER, GLES20.GL_COLOR_ATTACHMENT0,
                GLES20.GL_TEXTURE_2D, renderTextures[0], 0);

        // 检查帧缓冲区状态
        int status = GLES20.glCheckFramebufferStatus(GLES20.GL_FRAMEBUFFER);
        if (status != GLES20.GL_FRAMEBUFFER_COMPLETE) {
            Log.e(TAG, "Framebuffer not complete, status: " + status);
            return;
        }

        // 清除缓冲区
        GLES20.glClearColor(0.0f, 0.0f, 0.0f, 1.0f);
        GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT);

        // 根据颜色格式选择不同的渲染方法
        if (colorFormat == COLOR_FORMAT_I420) {
            renderI420(yuvData);
        } else {
            renderNV12orNV21(yuvData, colorFormat == COLOR_FORMAT_NV12);
        }

        // 读取渲染结果到 Bitmap
        IntBuffer pixels = IntBuffer.allocate(width * height);
        GLES20.glReadPixels(0, 0, width, height, GLES20.GL_RGBA, GLES20.GL_UNSIGNED_BYTE, pixels);

        // 将像素数据复制到 Bitmap
        bitmap.copyPixelsFromBuffer(pixels);

        // 解绑帧缓冲区
        GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, 0);
    }

    /**
     * 渲染 I420 (YUV420P) 格式的数据
     * @param yuvData I420 格式的 YUV 数据
     */
    private void renderI420(byte[] yuvData) {
        int ySize = width * height;
        int uSize = ySize / 4;
        int vSize = uSize;

        // 使用 I420 着色器程序
        GLES20.glUseProgram(programI420);

        // 设置顶点和纹理坐标
        int positionHandle = GLES20.glGetAttribLocation(programI420, "aPosition");
        int textureCoordHandle = GLES20.glGetAttribLocation(programI420, "aTextureCoord");

        GLES20.glEnableVertexAttribArray(positionHandle);
        GLES20.glEnableVertexAttribArray(textureCoordHandle);

        GLES20.glVertexAttribPointer(positionHandle, 2, GLES20.GL_FLOAT, false, 0, vertexBuffer);
        GLES20.glVertexAttribPointer(textureCoordHandle, 2, GLES20.GL_FLOAT, false, 0, textureBuffer);

        // 更新 Y 纹理
        GLES20.glActiveTexture(GLES20.GL_TEXTURE0);
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, yuvTextures[0]);
        ByteBuffer yBuffer = ByteBuffer.wrap(yuvData, 0, ySize);
        GLES20.glTexImage2D(GLES20.GL_TEXTURE_2D, 0, GLES20.GL_LUMINANCE, width, height, 0,
                GLES20.GL_LUMINANCE, GLES20.GL_UNSIGNED_BYTE, yBuffer);

        // 更新 U 纹理
        GLES20.glActiveTexture(GLES20.GL_TEXTURE1);
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, yuvTextures[1]);
        ByteBuffer uBuffer = ByteBuffer.wrap(yuvData, ySize, uSize);
        GLES20.glTexImage2D(GLES20.GL_TEXTURE_2D, 0, GLES20.GL_LUMINANCE, width / 2, height / 2, 0,
                GLES20.GL_LUMINANCE, GLES20.GL_UNSIGNED_BYTE, uBuffer);

        // 更新 V 纹理
        GLES20.glActiveTexture(GLES20.GL_TEXTURE2);
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, yuvTextures[2]);
        ByteBuffer vBuffer = ByteBuffer.wrap(yuvData, ySize + uSize, vSize);
        GLES20.glTexImage2D(GLES20.GL_TEXTURE_2D, 0, GLES20.GL_LUMINANCE, width / 2, height / 2, 0,
                GLES20.GL_LUMINANCE, GLES20.GL_UNSIGNED_BYTE, vBuffer);

        // 设置纹理采样器
        int yTextureHandle = GLES20.glGetUniformLocation(programI420, "yTexture");
        int uTextureHandle = GLES20.glGetUniformLocation(programI420, "uTexture");
        int vTextureHandle = GLES20.glGetUniformLocation(programI420, "vTexture");

        GLES20.glUniform1i(yTextureHandle, 0);
        GLES20.glUniform1i(uTextureHandle, 1);
        GLES20.glUniform1i(vTextureHandle, 2);

        // 绘制
        GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4);

        // 清理
        GLES20.glDisableVertexAttribArray(positionHandle);
        GLES20.glDisableVertexAttribArray(textureCoordHandle);
    }

    /**
     * 渲染 NV12/NV21 (YUV420SP) 格式的数据
     * @param yuvData NV12/NV21 格式的 YUV 数据
     * @param isNV12 是否为 NV12 格式 (true: NV12, false: NV21)
     */
    private void renderNV12orNV21(byte[] yuvData, boolean isNV12) {
        int ySize = width * height;
        int uvSize = ySize / 2;

        // 使用 NV12/NV21 着色器程序
        GLES20.glUseProgram(programNV12);

        // 设置顶点和纹理坐标
        int positionHandle = GLES20.glGetAttribLocation(programNV12, "aPosition");
        int textureCoordHandle = GLES20.glGetAttribLocation(programNV12, "aTextureCoord");

        GLES20.glEnableVertexAttribArray(positionHandle);
        GLES20.glEnableVertexAttribArray(textureCoordHandle);

        GLES20.glVertexAttribPointer(positionHandle, 2, GLES20.GL_FLOAT, false, 0, vertexBuffer);
        GLES20.glVertexAttribPointer(textureCoordHandle, 2, GLES20.GL_FLOAT, false, 0, textureBuffer);

        // 更新 Y 纹理
        GLES20.glActiveTexture(GLES20.GL_TEXTURE0);
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, yuvTextures[0]);
        ByteBuffer yBuffer = ByteBuffer.wrap(yuvData, 0, ySize);
        GLES20.glTexImage2D(GLES20.GL_TEXTURE_2D, 0, GLES20.GL_LUMINANCE, width, height, 0,
                GLES20.GL_LUMINANCE, GLES20.GL_UNSIGNED_BYTE, yBuffer);

        // 更新 UV 纹理
        GLES20.glActiveTexture(GLES20.GL_TEXTURE1);
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, yuvTextures[1]);
        ByteBuffer uvBuffer = ByteBuffer.wrap(yuvData, ySize, uvSize);
        GLES20.glTexImage2D(GLES20.GL_TEXTURE_2D, 0, GLES20.GL_LUMINANCE_ALPHA, width / 2, height / 2, 0,
                GLES20.GL_LUMINANCE_ALPHA, GLES20.GL_UNSIGNED_BYTE, uvBuffer);

        // 设置纹理采样器
        int yTextureHandle = GLES20.glGetUniformLocation(programNV12, "yTexture");
        int uvTextureHandle = GLES20.glGetUniformLocation(programNV12, "uvTexture");
        int isNV12Handle = GLES20.glGetUniformLocation(programNV12, "isNV12");

        GLES20.glUniform1i(yTextureHandle, 0);
        GLES20.glUniform1i(uvTextureHandle, 1);
        GLES20.glUniform1i(isNV12Handle, isNV12 ? 1 : 0);

        // 绘制
        GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4);

        // 清理
        GLES20.glDisableVertexAttribArray(positionHandle);
        GLES20.glDisableVertexAttribArray(textureCoordHandle);
    }

    /**
     * 创建 OpenGL ES 着色器程序
     * @param vertexShaderCode 顶点着色器代码
     * @param fragmentShaderCode 片段着色器代码
     * @return 程序 ID
     */
    private int createProgram(String vertexShaderCode, String fragmentShaderCode) {
        // 编译顶点着色器
        int vertexShader = GLES20.glCreateShader(GLES20.GL_VERTEX_SHADER);
        GLES20.glShaderSource(vertexShader, vertexShaderCode);
        GLES20.glCompileShader(vertexShader);

        // 检查顶点着色器编译状态
        int[] compiled = new int[1];
        GLES20.glGetShaderiv(vertexShader, GLES20.GL_COMPILE_STATUS, compiled, 0);
        if (compiled[0] == 0) {
            Log.e(TAG, "Vertex shader compilation failed: " + GLES20.glGetShaderInfoLog(vertexShader));
            GLES20.glDeleteShader(vertexShader);
            return 0;
        }

        // 编译片段着色器
        int fragmentShader = GLES20.glCreateShader(GLES20.GL_FRAGMENT_SHADER);
        GLES20.glShaderSource(fragmentShader, fragmentShaderCode);
        GLES20.glCompileShader(fragmentShader);

        // 检查片段着色器编译状态
        GLES20.glGetShaderiv(fragmentShader, GLES20.GL_COMPILE_STATUS, compiled, 0);
        if (compiled[0] == 0) {
            Log.e(TAG, "Fragment shader compilation failed: " + GLES20.glGetShaderInfoLog(fragmentShader));
            GLES20.glDeleteShader(vertexShader);
            GLES20.glDeleteShader(fragmentShader);
            return 0;
        }

        // 创建程序并链接着色器
        int program = GLES20.glCreateProgram();
        GLES20.glAttachShader(program, vertexShader);
        GLES20.glAttachShader(program, fragmentShader);
        GLES20.glLinkProgram(program);

        // 检查链接状态
        int[] linked = new int[1];
        GLES20.glGetProgramiv(program, GLES20.GL_LINK_STATUS, linked, 0);
        if (linked[0] == 0) {
            Log.e(TAG, "Program linking failed: " + GLES20.glGetProgramInfoLog(program));
            GLES20.glDeleteProgram(program);
            GLES20.glDeleteShader(vertexShader);
            GLES20.glDeleteShader(fragmentShader);
            return 0;
        }

        // 删除着色器，它们已经链接到程序中
        GLES20.glDeleteShader(vertexShader);
        GLES20.glDeleteShader(fragmentShader);

        return program;
    }

    /**
     * 释放 OpenGL ES 资源
     */
    public void release() {
        if (!initialized) {
            return;
        }

        // 删除纹理
        GLES20.glDeleteTextures(3, yuvTextures, 0);
        GLES20.glDeleteTextures(1, renderTextures, 0);

        // 删除帧缓冲区
        GLES20.glDeleteFramebuffers(1, frameBuffers, 0);

        // 删除程序
        if (programI420 != 0) {
            GLES20.glDeleteProgram(programI420);
            programI420 = 0;
        }

        if (programNV12 != 0) {
            GLES20.glDeleteProgram(programNV12);
            programNV12 = 0;
        }

        // 释放 EGL 资源
        if (eglHelper != null) {
            eglHelper.release();
            eglHelper = null;
        }

        initialized = false;
    }

    /**
     * 检测 YUV 数据的格式
     * @param yuvData YUV 数据
     * @param width 图像宽度
     * @param height 图像高度
     * @return 颜色格式 (COLOR_FORMAT_I420, COLOR_FORMAT_NV12, COLOR_FORMAT_NV21)
     */
    public static int detectYUVFormat(byte[] yuvData, int width, int height) {
        int ySize = width * height;

        // 检查数据长度
        if (yuvData.length == ySize * 3 / 2) {
            // 可能是 I420 或 NV12/NV21

            // 采样 UV 平面的一些点
            int uSumI420 = 0;
            int vSumI420 = 0;
            int uSumNV12 = 0;
            int vSumNV12 = 0;

            for (int i = 0; i < 10; i++) {
                // I420: U 在 Y 之后，V 在 U 之后
                int uOffsetI420 = ySize + i;
                int vOffsetI420 = ySize + ySize/4 + i;

                // NV12: UV 交错排列
                int uvOffsetNV = ySize + i * 2;

                if (uOffsetI420 < yuvData.length && vOffsetI420 < yuvData.length) {
                    uSumI420 += yuvData[uOffsetI420] & 0xff;
                    vSumI420 += yuvData[vOffsetI420] & 0xff;
                }

                if (uvOffsetNV + 1 < yuvData.length) {
                    // 假设 NV12 (UVUVUV)
                    uSumNV12 += yuvData[uvOffsetNV] & 0xff;
                    vSumNV12 += yuvData[uvOffsetNV + 1] & 0xff;
                }
            }

            // 比较 I420 和 NV12/NV21 的可能性
            int diffI420 = Math.abs(uSumI420 - vSumI420);
            int diffNV = Math.abs(uSumNV12 - vSumNV12);

            if (diffI420 < diffNV) {
                return COLOR_FORMAT_I420;
            } else {
                // 区分 NV12 和 NV21
                // 对于典型图像，NV21 (VUVUVU) 的第一个值 (V) 通常更高
                return (vSumNV12 > uSumNV12) ? COLOR_FORMAT_NV21 : COLOR_FORMAT_NV12;
            }
        }

        // 默认返回 NV21 (最常见的 Android 格式)
        return COLOR_FORMAT_NV21;
    }
}
