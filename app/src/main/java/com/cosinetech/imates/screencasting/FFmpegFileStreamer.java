package com.cosinetech.imates.screencasting;

import android.annotation.SuppressLint;
import android.util.Log;

import com.arthenica.ffmpegkit.FFmpegKit;
import com.arthenica.ffmpegkit.FFmpegSession;
import com.arthenica.ffmpegkit.SessionState;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

public class FFmpegFileStreamer {
    private static final String TAG = "FFmpegFileStreamer";
    private static final int TS_PACKET_SIZE = 188;
    private static final int PACKETS_PER_UDP = 7;
    private static final int UDP_PACKET_SIZE = TS_PACKET_SIZE * PACKETS_PER_UDP; // 1316 bytes

    private final String destinationIp;
    private final int destinationPort;
    private final int frameRate;
    private final File cacheDir;

    private final ExecutorService executor;
    private final ScheduledExecutorService maintenanceExecutor;
    private final AtomicBoolean isRunning = new AtomicBoolean(false);
    private final AtomicBoolean isFFmpegRunning = new AtomicBoolean(false);

    // 文件相关
    private File h264File;
    private FileOutputStream fileOutputStream;
    private FFmpegSession currentSession;

    private String outDir;

    // 文件大小控制
    private static final long MAX_FILE_SIZE = 1000 * 1024 * 1024;

    public FFmpegFileStreamer(String destinationIp, int destinationPort, int frameRate, File cacheDir, String outDir) {
        this.destinationIp = destinationIp;
        this.destinationPort = destinationPort;
        this.frameRate = frameRate;
        this.cacheDir = cacheDir;
        this.executor = Executors.newFixedThreadPool(2);
        this.maintenanceExecutor = Executors.newSingleThreadScheduledExecutor();
        this.outDir = outDir;
    }

    public void start() {
        try {
            if (isRunning.getAndSet(true)) {
                Log.w(TAG, "Streamer already running");
                return;
            }

            // 创建临时文件
            h264File = new File(cacheDir, "streaming.h264");
            if (h264File.exists()) {
                h264File.delete();
            }
            h264File.createNewFile();

            // 打开文件输出流
            fileOutputStream = new FileOutputStream(h264File);

            // 启动FFmpeg处理
            startFFmpegProcess();

            // 启动维护任务
            startMaintenanceTasks();

            Log.d(TAG, "FFmpegFileStreamer started");
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
            // 停止维护任务
            maintenanceExecutor.shutdown();

            // 停止FFmpeg进程
            if (currentSession != null && isFFmpegRunning.get()) {
                FFmpegKit.cancel(currentSession.getSessionId());
                isFFmpegRunning.set(false);
            }

            // 关闭文件输出流
            if (fileOutputStream != null) {
                try {
                    fileOutputStream.close();
                    fileOutputStream = null;
                } catch (IOException e) {
                    Log.e(TAG, "Error closing file output stream", e);
                }
            }

            // 删除临时文件
            if (h264File != null && h264File.exists()) {
                h264File.delete();
            }

            // 关闭线程池
            executor.shutdown();

            Log.d(TAG, "FFmpegFileStreamer stopped");
        } catch (Exception e) {
            Log.e(TAG, "Error stopping streamer", e);
        }
    }

    /**
     * 启动维护任务
     */
    private void startMaintenanceTasks() {
        maintenanceExecutor.scheduleWithFixedDelay(() -> {
            if (!isRunning.get()) {
                return;
            }

            try {
                // 文件大小检查
                if (h264File != null && h264File.exists() && h264File.length() > MAX_FILE_SIZE) {
                    resetFile();
                }
            } catch (Exception e) {
                Log.e(TAG, "Error in maintenance task", e);
            }
        }, 1000, 1000, TimeUnit.MILLISECONDS);
    }

    /**
     * 重置文件（当文件过大时）
     */
    private void resetFile() {
        try {
            Log.d(TAG, "Resetting file due to size limit");

            // 关闭当前输出流
            if (fileOutputStream != null) {
                fileOutputStream.close();
                fileOutputStream = null;
            }

            // 删除并重新创建文件
            if (h264File != null) {
                h264File.delete();
                h264File.createNewFile();
            }

            // 重新打开输出流
            fileOutputStream = new FileOutputStream(h264File);

            // 重启FFmpeg进程
            if (isFFmpegRunning.getAndSet(false)) {
                if (currentSession != null) {
                    FFmpegKit.cancel(currentSession.getSessionId());
                }
                startFFmpegProcess();
            }
        } catch (IOException e) {
            Log.e(TAG, "Error resetting file", e);
        }
    }

    /**
     * 启动FFmpeg进程，将H.264数据转换为TS流并发送
     */
    private void startFFmpegProcess() {
        executor.execute(() -> {
            try {
                // 构建FFmpeg命令
                // 使用-stream_loop -1使FFmpeg无限循环读取输入文件
                // 使用-re以实时速率读取
                @SuppressLint("DefaultLocale")
                String ffmpegCommand = String.format(
                        "-stream_loop -1 -fflags +genpts+nobuffer+flush_packets " +
                                "-f h264 -r %d -i %s " +
                                "-c copy -bsf:v h264_mp4toannexb -f mpegts " +
                                "%s",
                        frameRate, h264File.getAbsolutePath(), outDir);
                        //destinationIp, destinationPort, UDP_PACKET_SIZE);

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
     * 接收H.264数据并写入文件
     */
    public void onH264DataReceived(byte[] h264Data, long presentationTimeUs) {
        if (!isRunning.get() || fileOutputStream == null) {
            return;
        }

        executor.execute(() -> {
            try {
                // 写入H.264数据到文件
                fileOutputStream.write(h264Data);
                fileOutputStream.flush();
            } catch (IOException e) {
                Log.e(TAG, "Error writing H.264 data to file", e);

                // 尝试重新创建文件和输出流
                try {
                    if (fileOutputStream != null) {
                        fileOutputStream.close();
                        fileOutputStream = null;
                    }

                    if (h264File != null) {
                        h264File.delete();
                        h264File.createNewFile();
                    }

                    fileOutputStream = new FileOutputStream(h264File);
                } catch (IOException ex) {
                    Log.e(TAG, "Failed to recreate file", ex);
                }
            }
        });
    }
}
