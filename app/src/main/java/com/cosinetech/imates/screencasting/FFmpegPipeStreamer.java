package com.cosinetech.imates.screencasting;

import android.annotation.SuppressLint;
import android.util.Log;

import com.arthenica.ffmpegkit.FFmpegKit;
import com.arthenica.ffmpegkit.FFmpegSession;
import com.arthenica.ffmpegkit.Level;
import com.arthenica.ffmpegkit.SessionState;

import java.io.IOException;
import java.net.DatagramSocket;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

public class FFmpegPipeStreamer {
    private static final String TAG = "FFmpegPipeStreamer";
    private static final int TS_PACKET_SIZE = 188;
    private static final int PACKETS_PER_UDP = 7;
    private static final int UDP_PACKET_SIZE = TS_PACKET_SIZE * PACKETS_PER_UDP; // 1316 bytes

    private final String destinationIp;
    private final int destinationPort;
    private final int frameRate;

    private DatagramSocket socket;
    private final ExecutorService executor;
    private final ScheduledExecutorService heartbeatExecutor;
    private final AtomicBoolean isRunning = new AtomicBoolean(false);
    private final AtomicBoolean isFFmpegRunning = new AtomicBoolean(false);

    // 管道相关
    private int readFd = -1;
    private int writeFd = -1;
    private String pipePath;

    private long lastDataTime = 0;
    private long dataTimeout = 5000; // 5秒超时
    private FFmpegSession currentSession;

    // 用于生成空帧的数据
    private byte[] nullFrame;

    public FFmpegPipeStreamer(String destinationIp, int destinationPort, int frameRate) {
        this.destinationIp = destinationIp;
        this.destinationPort = destinationPort;
        this.frameRate = frameRate;
        this.executor = Executors.newFixedThreadPool(2);
        this.heartbeatExecutor = Executors.newSingleThreadScheduledExecutor();

        // 创建一个简单的空帧（NAL单元类型为12 - 填充）
        this.nullFrame = new byte[] {
                0x00, 0x00, 0x00, 0x01, // 起始码
                0x0C, // NAL单元类型 = 12 (填充)
                0x00  // 填充数据
        };
    }

    public void start() {
        try {
            if (isRunning.getAndSet(true)) {
                Log.w(TAG, "Streamer already running");
                return;
            }

            // 创建UDP socket
            socket = new DatagramSocket();

            // 创建管道
            int[] fds = PipeHelper.createPipe();
            if (fds == null || fds.length != 2) {
                throw new IOException("Failed to create pipe");
            }

            readFd = fds[0];
            writeFd = fds[1];
            pipePath = PipeHelper.getFdPath(readFd);

            Log.d(TAG, "Created pipe: read_fd=" + readFd + ", write_fd=" + writeFd + ", path=" + pipePath);

            // 启动FFmpeg处理
            startFFmpegProcess();

            // 启动心跳检测，确保数据流不会中断
            startHeartbeatMonitor();

            Log.d(TAG, "FFmpegPipeStreamer started");
        } catch (Exception e) {
            Log.e(TAG, "Failed to start streamer", e);
            stop();
        }
    }

    public void stop() {
        if (!isRunning.getAndSet(false)) {
            return;
        }

        try {
            // 停止心跳检测
            heartbeatExecutor.shutdown();

            // 停止FFmpeg进程
            if (currentSession != null && isFFmpegRunning.get()) {
                FFmpegKit.cancel(currentSession.getSessionId());
                isFFmpegRunning.set(false);
            }

            // 关闭管道
            if (readFd >= 0) {
                PipeHelper.closeFd(readFd);
                readFd = -1;
            }
            if (writeFd >= 0) {
                PipeHelper.closeFd(writeFd);
                writeFd = -1;
            }

            // 关闭socket
            if (socket != null) {
                socket.close();
                socket = null;
            }

            // 关闭线程池
            executor.shutdown();

            Log.d(TAG, "FFmpegPipeStreamer stopped");
        } catch (Exception e) {
            Log.e(TAG, "Error stopping streamer", e);
        }
    }

    /**
     * 启动心跳监控，确保数据流不会因为输入延迟而中断
     */
    private void startHeartbeatMonitor() {
        heartbeatExecutor.scheduleWithFixedDelay(() -> {
            if (!isRunning.get()) {
                return;
            }

            long now = System.currentTimeMillis();
            if (lastDataTime > 0 && now - lastDataTime > dataTimeout) {
                Log.d(TAG, "No data received for " + dataTimeout + "ms, sending null frame");
                // 发送空帧保持流活跃
                onH264DataReceived(nullFrame, System.nanoTime() / 1000);
            }
        }, 1000, 1000, TimeUnit.MILLISECONDS);
    }

    /**
     * 启动FFmpeg进程，将H.264数据转换为TS流并发送
     */
    private void startFFmpegProcess() {
        executor.execute(() -> {
            try {
                // 构建FFmpeg命令
                // 使用-i pipe:<fd>从管道读取数据
                @SuppressLint("DefaultLocale")
                String ffmpegCommand = String.format(
                        "-fflags nobuffer+flush_packets+discardcorrupt -f h264 -r %d -i %s " +
                                "-c copy -bsf:v h264_mp4toannexb -f mpegts " +
                                "udp://%s:%d?pkt_size=%d",
                        frameRate, pipePath,
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
                            if (log.getLevel().getValue() <= Level.AV_LOG_WARNING.getValue()) { // AV_LOG_WARNING及以上级别
                                Log.d(TAG, "FFmpeg log: " + log.getMessage());
                            }
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
     * 接收H.264数据并写入管道
     */
    public void onH264DataReceived(byte[] h264Data, long presentationTimeUs) {
        if (!isRunning.get() || writeFd < 0) {
            return;
        }

        executor.execute(() -> {
            try {
                // 更新最后接收数据的时间
                lastDataTime = System.currentTimeMillis();

                // 写入H.264数据到管道
                int bytesWritten = PipeHelper.write(writeFd, h264Data, 0, h264Data.length);

                if (bytesWritten < 0) {
                    Log.e(TAG, "Failed to write data to pipe: " + bytesWritten);

                    // 如果管道已关闭或出错，尝试重新创建
                    if (isRunning.get()) {
                        recreatePipe();
                    }
                } else if (bytesWritten < h264Data.length) {
                    Log.w(TAG, "Partial write to pipe: " + bytesWritten + "/" + h264Data.length);
                    // 可以选择重试写入剩余数据，或者简单地丢弃
                }
            } catch (Exception e) {
                Log.e(TAG, "Error writing H.264 data to pipe", e);

                // 如果出错，尝试重新创建管道
                if (isRunning.get()) {
                    recreatePipe();
                }
            }
        });
    }

    /**
     * 重新创建管道
     */
    private void recreatePipe() {
        try {
            Log.d(TAG, "Recreating pipe");

            // 关闭旧管道
            if (readFd >= 0) {
                PipeHelper.closeFd(readFd);
                readFd = -1;
            }
            if (writeFd >= 0) {
                PipeHelper.closeFd(writeFd);
                writeFd = -1;
            }

            // 创建新管道
            int[] fds = PipeHelper.createPipe();
            if (fds == null || fds.length != 2) {
                throw new IOException("Failed to create pipe");
            }

            readFd = fds[0];
            writeFd = fds[1];
            pipePath = PipeHelper.getFdPath(readFd);

            Log.d(TAG, "Created new pipe: read_fd=" + readFd + ", write_fd=" + writeFd + ", path=" + pipePath);

            // 重启FFmpeg进程
            if (isFFmpegRunning.getAndSet(false)) {
                if (currentSession != null) {
                    FFmpegKit.cancel(currentSession.getSessionId());
                }
                startFFmpegProcess();
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to recreate pipe", e);
        }
    }

    /**
     * 设置数据超时时间（毫秒）
     * 如果超过这个时间没有收到新数据，将发送空帧保持流活跃
     */
    public void setDataTimeout(long timeoutMs) {
        this.dataTimeout = timeoutMs;
    }
}
