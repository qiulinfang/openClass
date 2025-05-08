package com.cosinetech.imates.screencasting;
import android.annotation.SuppressLint;
import android.util.Log;

import com.arthenica.ffmpegkit.FFmpegKit;
import com.arthenica.ffmpegkit.FFmpegSession;
import com.arthenica.ffmpegkit.SessionState;

import java.io.IOException;
import java.io.OutputStream;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

public class FFmpegSocketStreamer {
    private static final String TAG = "FFmpegSocketStreamer";
    private static final int TS_PACKET_SIZE = 188;
    private static final int PACKETS_PER_UDP = 7;
    private static final int UDP_PACKET_SIZE = TS_PACKET_SIZE * PACKETS_PER_UDP; // 1316 bytes

    private final String destinationIp;
    private final int destinationPort;
    private final int frameRate;

    private final ExecutorService executor;
    private final AtomicBoolean isRunning = new AtomicBoolean(false);
    private final AtomicBoolean isFFmpegRunning = new AtomicBoolean(false);

    // Socket相关
    private ServerSocket serverSocket;
    private Socket clientSocket;
    private OutputStream socketOutputStream;
    private int localPort;
    private FFmpegSession currentSession;

    public FFmpegSocketStreamer(String destinationIp, int destinationPort, int frameRate) {
        this.destinationIp = destinationIp;
        this.destinationPort = destinationPort;
        this.frameRate = frameRate;
        this.executor = Executors.newFixedThreadPool(3);
    }

    public void start() {
        try {
            if (isRunning.getAndSet(true)) {
                Log.w(TAG, "Streamer already running");
                return;
            }

            // 创建本地TCP服务器
            serverSocket = new ServerSocket(0); // 0表示自动分配端口
            localPort = serverSocket.getLocalPort();
            Log.d(TAG, "Created local TCP server on port " + localPort);

            // 启动接受连接的线程
            executor.execute(this::acceptConnections);

            // 启动FFmpeg处理
            startFFmpegProcess();

            Log.d(TAG, "FFmpegSocketStreamer started");
        } catch (Exception e) {
            Log.e(TAG, "Failed to start streamer", e);
            stop();
        }
    }

    /**
     * 接受TCP连接
     */
    private void acceptConnections() {
        try {
            while (isRunning.get() && !serverSocket.isClosed()) {
                Log.d(TAG, "Waiting for FFmpeg to connect...");

                // 接受连接
                Socket socket = serverSocket.accept();
                Log.d(TAG, "FFmpeg connected from " + socket.getInetAddress());

                // 关闭旧连接
                if (clientSocket != null) {
                    try {
                        clientSocket.close();
                    } catch (IOException e) {
                        Log.e(TAG, "Error closing old client socket", e);
                    }
                }

                // 保存新连接
                clientSocket = socket;
                socketOutputStream = clientSocket.getOutputStream();
            }
        } catch (IOException e) {
            if (isRunning.get()) {
                Log.e(TAG, "Error accepting connections", e);
            }
        }
    }

    public void stop() {
        if (!isRunning.getAndSet(false)) {
            return;
        }

        try {
            // 停止FFmpeg进程
            if (currentSession != null && isFFmpegRunning.get()) {
                FFmpegKit.cancel(currentSession.getSessionId());
                isFFmpegRunning.set(false);
            }

            // 关闭客户端连接
            if (clientSocket != null) {
                try {
                    clientSocket.close();
                    clientSocket = null;
                } catch (IOException e) {
                    Log.e(TAG, "Error closing client socket", e);
                }
            }

            // 关闭服务器
            if (serverSocket != null) {
                try {
                    serverSocket.close();
                    serverSocket = null;
                } catch (IOException e) {
                    Log.e(TAG, "Error closing server socket", e);
                }
            }

            // 关闭线程池
            executor.shutdown();

            Log.d(TAG, "FFmpegSocketStreamer stopped");
        } catch (Exception e) {
            Log.e(TAG, "Error stopping streamer", e);
        }
    }

    /**
     * 启动FFmpeg进程，将H.264数据转换为TS流并发送
     */
    private void startFFmpegProcess() {
        executor.execute(() -> {
            try {
                // 构建FFmpeg命令
                // 使用TCP协议从本地服务器读取数据
                @SuppressLint("DefaultLocale")
                String ffmpegCommand = String.format(
                        "-fflags +genpts+nobuffer+flush_packets -r %d " +
                                "-f h264 -i tcp://127.0.0.1:%d " +
                                "-c copy -bsf:v h264_mp4toannexb -f mpegts " +
                                "udp://%s:%d?pkt_size=%d",
                        frameRate, localPort,
                        destinationIp, destinationPort, UDP_PACKET_SIZE);

                Log.d(TAG, "Starting FFmpeg with command: " + ffmpegCommand);

                isFFmpegRunning.set(true);

                // 执行FFmpeg命令
                currentSession = FFmpegKit.executeAsync(ffmpegCommand,
                        session -> {
                            if (session.getState() == SessionState.COMPLETED) {
                                Log.d(TAG, "FFmpeg process completed successfully");
                                isFFmpegRunning.set(false);

                                // 如果流还在运行，重启FFmpeg进程
                                if (isRunning.get()) {
                                    Log.d(TAG, "Restarting FFmpeg process");
                                    startFFmpegProcess();
                                }
                            } else if (session.getState() == SessionState.FAILED) {
                                Log.e(TAG, "FFmpeg process failed with state: " + session.getState());
                                if (session.getReturnCode() != null) {
                                    Log.e(TAG, "Return code: " + session.getReturnCode().getValue());
                                }
                                if (session.getFailStackTrace() != null) {
                                    Log.e(TAG, "Fail stack trace: " + session.getFailStackTrace());
                                }
                                isFFmpegRunning.set(false);

                                // 如果流还在运行，重启FFmpeg进程
                                if (isRunning.get()) {
                                    Log.d(TAG, "Restarting FFmpeg process after failure");
                                    startFFmpegProcess();
                                }
                            }
                        },
                        log -> {
                            Log.d(TAG, "FFmpeg log: " + log.getMessage());
                        },
                        statistics -> {
                            // 可以在这里处理进度统计信息
                        });

            } catch (Exception e) {
                Log.e(TAG, "Error in FFmpeg process", e);
                isFFmpegRunning.set(false);

                // 如果流还在运行，重启FFmpeg进程
                if (isRunning.get()) {
                    Log.d(TAG, "Restarting FFmpeg process after exception");
                    startFFmpegProcess();
                }
            }
        });
    }

    /**
     * 接收H.264数据并写入Socket
     */
    public void onH264DataReceived(byte[] h264Data, long presentationTimeUs) {
        if (!isRunning.get() || socketOutputStream == null) {
            return;
        }

        executor.execute(() -> {
            try {
                // 写入H.264数据到Socket
                socketOutputStream.write(h264Data);
                socketOutputStream.flush();
            } catch (IOException e) {
                Log.e(TAG, "Error writing H.264 data to socket", e);

                // 如果Socket已关闭或出错，等待新连接
                socketOutputStream = null;
            }
        });
    }
}