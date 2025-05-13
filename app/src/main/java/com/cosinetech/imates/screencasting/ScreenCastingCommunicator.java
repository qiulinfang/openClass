package com.cosinetech.imates.screencasting;

import android.annotation.SuppressLint;
import android.content.Context;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import java.io.IOException;
import java.io.OutputStream;
import java.net.DatagramPacket;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.MulticastSocket;
import java.net.NetworkInterface;
import java.net.Socket;
import java.net.SocketException;
import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Enumeration;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

public class ScreenCastingCommunicator {
    private static final String TAG = "StudentUdpComm";

    // 组播地址和端口
    private static final String CONTROL_MULTICAST_ADDRESS = "239.255.100.1";
    private static final int CONTROL_MULTICAST_PORT = 5000;

    // 消息类型
    private static final String MSG_TYPE_STATUS = "status";
    private static final String MSG_TYPE_PROJECTION_PAD = "projection_pad";
    private static final String MSG_TYPE_SNAPSHOT_PAD = "snapshot_pad";
    private static final String MSG_TYPE_PROJECTION_PC = "projection_pc";
    private static final String MSG_TYPE_PICTURE = "picture";

    // 角色
    private static final String ROLE_STUDENT = "student";
    private static final String ROLE_TEACHER = "teacher";
    private static final String ROLE_PC = "pc";
    private static final String RECEIVER_ALL = "all";

    // 状态
    private static final String STATUS_READY = "ready";
    private static final String STATUS_STREAMING = "streaming";

    private final Context context;
    private final String studentId;
    private final String studentName;
    private int tsStreamPort;

    private MulticastSocket controlSocket;
    private InetAddress controlGroup;
    private final ExecutorService executor = Executors.newFixedThreadPool(3);
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    // 网络状态监听器
    private NetworkStateListener networkStateListener;
    // 命令处理器
    private CommandHandler commandHandler;

    // 已处理的命令编号缓存（防止重复处理）
    private String astSnapshotCmdId = "";
    private boolean isStreaming = false;
    private static final int TS_STREAM_PORT_BASE = 10000;

    public ScreenCastingCommunicator(Context ctx, String studentId, String studentName) {
        this.context = ctx.getApplicationContext();
        this.studentId = studentId;
        this.studentName = studentName;
        this.tsStreamPort = TS_STREAM_PORT_BASE;
    }

    public int getTsStreamPort() {
        return this.tsStreamPort;
    }

    public interface NetworkStateListener {
        void onNetworkPrepared();
        void onNetworkError(String errorMessage);
        void onJoinGroupSuccess();
    }

    public interface CommandHandler {
        void onStartProjection();
        void onStopProjection();
        void onTakeSnapshot(String commandId);
    }

    public void setNetworkStateListener(NetworkStateListener listener) {
        this.networkStateListener = listener;
    }

    public void setCommandHandler(CommandHandler handler) {
        this.commandHandler = handler;
    }

    /**
     * 初始化并加入组播组
     */
    public void start() {
        try {
            // 获取本地IP地址
            String localIp = getLocalIpAddress();
            if (localIp == null) {
                notifyNetworkError("无法获取本地IP地址");
                return;
            }
            String[] parts = localIp.split("\\.");
            this.tsStreamPort = TS_STREAM_PORT_BASE + Integer.parseInt(parts[3]);

            // 创建控制信道socket
            controlSocket = new MulticastSocket(CONTROL_MULTICAST_PORT);
            controlSocket.setTimeToLive(64);

            controlGroup = InetAddress.getByName(CONTROL_MULTICAST_ADDRESS);

            // 设置网络接口（解决某些设备无法接收组播的问题）
            NetworkInterface networkInterface = getMulticastNetworkInterface();
            if (networkInterface != null) {
                controlSocket.setNetworkInterface(networkInterface);
            }

            controlSocket.joinGroup(controlGroup);

            // 通知监听器
            if (networkStateListener != null) {
                mainHandler.post(networkStateListener::onJoinGroupSuccess);
            }

            if (networkStateListener != null) {
                mainHandler.post(() -> networkStateListener.onNetworkPrepared());
            }

            // 开始状态上报
            startStatusReporting();

            // 开始接收消息
            startReceivingMessages();

            Log.d(TAG, "学生端通信已启动，本地IP: " + localIp);
        } catch (IOException e) {
            Log.e(TAG, "启动通信失败", e);
            notifyNetworkError("启动通信失败: " + e.getMessage());
        }
    }

    /**
     * 停止通信
     */
    public void stop() {
        executor.shutdown();
        try {
            executor.awaitTermination(3, TimeUnit.SECONDS);
        } catch (Exception ignored) {
        }
        if (controlSocket != null && controlGroup != null) {
            try {
                controlSocket.leaveGroup(controlGroup);
            } catch (Exception ignore) {}
            finally {
                controlSocket.close();
                controlSocket = null;
            }
        }
    }

    /**
     * 开始周期性上报状态
     */
    private void startStatusReporting() {
        executor.execute(() -> {
            while (!executor.isShutdown()) {
                try {
                    if(controlSocket.isClosed()) {
                        break;
                    }
                    sendStatusMessage();
                    Thread.sleep(1000); // 1秒发送一次
                } catch (InterruptedException e) {
                    Log.d(TAG, "状态上报线程被中断");
                    break;
                } catch (Exception e) {
                    Log.e(TAG, "发送状态消息失败", e);
                    notifyNetworkError("发送状态消息失败: " + e.getMessage());
                    break;
                }
            }
        });
    }

    /**
     * 发送状态消息
     */
    private void sendStatusMessage() throws IOException {
        String status = isStreaming ? STATUS_STREAMING : STATUS_READY;
        String localIp = getLocalIpAddress();

        @SuppressLint("DefaultLocale")
        String message = String.format("%s,%s,%s,%s,%s,%s,%d,%s",
                MSG_TYPE_STATUS,
                ROLE_STUDENT,
                RECEIVER_ALL,
                studentId,
                studentName,
                localIp,
                tsStreamPort,
                status);

        byte[] buffer = message.getBytes(StandardCharsets.UTF_8);
        DatagramPacket packet = new DatagramPacket(
                buffer,
                buffer.length,
                controlGroup,
                CONTROL_MULTICAST_PORT);

        controlSocket.send(packet);
        Log.d(TAG, "发送状态消息: " + message);
    }

    /**
     * 开始接收消息
     */
    private void startReceivingMessages() {
        executor.execute(() -> {
            byte[] buffer = new byte[4096];
            DatagramPacket packet = new DatagramPacket(buffer, buffer.length);

            while (!executor.isShutdown()) {
                try {
                    if(controlSocket.isClosed()) {
                        break;
                    }
                    controlSocket.receive(packet);
                    String receivedMessage = new String(
                            packet.getData(),
                            packet.getOffset(),
                            packet.getLength(),
                            StandardCharsets.UTF_8);

                    Log.d(TAG, "收到消息: " + receivedMessage);
                    processReceivedMessage(receivedMessage);

                } catch (Exception e) {
                    Log.e(TAG, "接收消息时出错", e);
                    notifyNetworkError("接收消息时出错: " + e.getMessage());
                }
            }
        });
    }

    /**
     * 处理接收到的消息
     */
    private void processReceivedMessage(String message) {
        String[] parts = message.split(",");
        if (parts.length < 3) {
            Log.w(TAG, "无效消息格式: " + message);
            return;
        }

        String msgType = parts[0];
        String sender = parts[1];
        String receiver = parts[2];

        // 检查消息是否针对本设备
        if (!receiver.equals(RECEIVER_ALL)) {
            if (!receiver.equals(studentId)) {
                Log.d(TAG, "消息不是发给本设备的，忽略");
                return;
            }
        }

        switch (msgType) {
            case MSG_TYPE_PROJECTION_PAD:
                if (parts.length >= 4 && sender.equals(ROLE_TEACHER)) {
                    processProjectionCommand(parts);
                }
                break;

            case MSG_TYPE_SNAPSHOT_PAD:
                if (parts.length >= 5 && sender.equals(ROLE_TEACHER)) {
                    processSnapshotCommand(parts);
                }
                break;

            case MSG_TYPE_PICTURE:
                // 图片分包处理（这里只是示例，实际需要更复杂的处理）
                //Log.d(TAG, "收到图片分包: " + message);
                break;

            default:
                Log.d(TAG, "未知消息类型: " + msgType);
        }
    }

    /**
     * 处理投屏命令
     */
    private void processProjectionCommand(String[] parts) {
        // 检查是否包含本学生ID
        boolean shouldProject = false;
        for (int i = 4; i < parts.length; i++) {
            if (studentId.equals(parts[i])) {
                shouldProject = true;
                break;
            }
        }

        if (shouldProject && !isStreaming) {
            isStreaming = true;
            if (commandHandler != null) {
                mainHandler.post(commandHandler::onStartProjection);
            }
            // 立即发送状态更新
            executor.execute(() -> {
                try {
                    sendStatusMessage();
                } catch (IOException e) {
                    Log.e(TAG, "发送状态更新失败", e);
                }
            });
        } else if (!shouldProject && isStreaming) {
            isStreaming = false;
            if (commandHandler != null) {
                mainHandler.post(commandHandler::onStopProjection);
            }
            // 立即发送状态更新
            executor.execute(() -> {
                try {
                    sendStatusMessage();
                } catch (IOException e) {
                    Log.e(TAG, "发送状态更新失败", e);
                }
            });
        }
    }

    /**
     * 处理截图命令
     */
    private void processSnapshotCommand(String[] parts) {
        String deviceIp = parts[3];
        String commandId = parts[4];
        String targetStudent = parts[5];

        // 检查命令是否已经处理过
        if (astSnapshotCmdId.equals(commandId)) {
            Log.e(TAG, "命令已处理过，忽略: " + commandId);
            return;
        }

        // 检查是否针对本设备或所有设备
        if (targetStudent.equals(RECEIVER_ALL) || targetStudent.equals(studentId)) {
            astSnapshotCmdId = commandId;
            byte [] lastIFrame = H264IFrameCache.getInstance().getLatestIFrame();
            if(lastIFrame != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    String base64 = Base64.getEncoder().encodeToString(lastIFrame);
                    //sendImageInPacketsByUdp(base64);
                    sendImageInPacketsByTcp(deviceIp, base64);
                }
            }
            if (commandHandler != null) {
                mainHandler.post(() -> commandHandler.onTakeSnapshot(commandId));
            }
        }
    }

    public void sendImageInPacketsByUdp(String imageBase64) {
        // 日志记录
        Log.d(TAG, "开始发送图片，学生ID: " + studentId + ", base64长度: " + imageBase64.length());

        // 计算需要分成多少包
        int contentMaxSize = 1472 - 100;
        int totalPackets = (int) Math.ceil((double) imageBase64.length() / contentMaxSize);

        Log.d(TAG, "图片将分为 " + totalPackets + " 个包发送");

        // 分包发送
        for (int packetIndex = 0; packetIndex < totalPackets; packetIndex++) {
            // 计算当前包的base64片段
            int startPos = packetIndex * contentMaxSize;
            int endPos = Math.min(startPos + contentMaxSize, imageBase64.length());
            String base64Segment = imageBase64.substring(startPos, endPos);

            // 构建消息

            String message = "picture" + "," +
                    studentId + "," +
                    totalPackets + "," +
                    packetIndex + "," +
                    base64Segment;

            // 发送消息
            byte[] buffer = message.getBytes(StandardCharsets.UTF_8);
            DatagramPacket packet = new DatagramPacket(
                    buffer, buffer.length, controlGroup,
                    CONTROL_MULTICAST_PORT);

            try {
                controlSocket.send(packet);
            } catch (Exception e) {
                Log.e(TAG, "发送图片包异常 " + (packetIndex + 1) + "/" + totalPackets +
                    "," + buffer.length + " " + e.getMessage());
            }
//            Log.d(TAG, "已发送图片包 " + (packetIndex + 1) + "/" + totalPackets +
//                    ", 大小: " + buffer.length + " 字节");

            // 短暂延迟，避免网络拥塞
            try {
                Thread.sleep(10);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                Log.e(TAG, "发送过程被中断", e);
                break;
            }
        }

        Log.d(TAG, "图片发送完成，学生ID: " + studentId);
    }

    public void sendImageInPacketsByTcp(String serverIp, String imageBase64) {
        Log.d(TAG, "开始通过TCP发送图片，学生ID: " + studentId + ", base64长度: " + imageBase64.length());
        int serverPort = 5002;

        // 计算包大小
        int contentMaxSize = 1024; // TCP不受UDP限制，可以更大，但也不宜过大，保持一致性

        int totalPackets = (int) Math.ceil((double) imageBase64.length() / contentMaxSize);
        Log.d(TAG, "图片将分为 " + totalPackets + " 个包发送（TCP）");

        Socket socket = null;
        OutputStream outputStream = null;

        try {
            socket = new Socket();
            socket.connect(new InetSocketAddress(serverIp, serverPort), 3000);

            outputStream = socket.getOutputStream();

            for (int packetIndex = 0; packetIndex < totalPackets; packetIndex++) {
                int startPos = packetIndex * contentMaxSize;
                int endPos = Math.min(startPos + contentMaxSize, imageBase64.length());
                String base64Segment = imageBase64.substring(startPos, endPos);

                // 构建消息格式
                String message = "picture" + "," +
                        studentId + "," +
                        totalPackets + "," +
                        packetIndex + "," +
                        base64Segment + "\n";

                byte[] data = message.getBytes(StandardCharsets.UTF_8);
                outputStream.write(data);
                outputStream.flush();
            }

            Log.d(TAG, "TCP图片发送完成，学生ID: " + studentId);

        } catch (SocketTimeoutException e) {
            Log.e(TAG, "连接超时 " + e.getMessage());
        } catch (IOException e) {
            Log.e(TAG, "TCP发送异常: " + e.getMessage(), e);
            Thread.currentThread().interrupt(); // 中断状态恢复
        } finally {
            try {
                if (outputStream != null) outputStream.close();
                if (socket != null && !socket.isClosed()) socket.close();
            } catch (IOException e) {
                Log.e(TAG, "关闭TCP连接失败", e);
            }
        }
    }

    /**
     * 获取本地IP地址
     */
    private String getLocalIpAddress() {
        try {
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            while (interfaces.hasMoreElements()) {
                NetworkInterface networkInterface = interfaces.nextElement();
                Enumeration<InetAddress> addresses = networkInterface.getInetAddresses();
                while (addresses.hasMoreElements()) {
                    InetAddress address = addresses.nextElement();
                    if (!address.isLoopbackAddress() && address.getHostAddress().indexOf(':') < 0) {
                        return address.getHostAddress();
                    }
                }
            }
        } catch (SocketException e) {
            Log.e(TAG, "获取本地IP地址失败", e);
        }
        return null;
    }

    /**
     * 获取适合组播的网络接口
     */
    private NetworkInterface getMulticastNetworkInterface() {
        try {
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            while (interfaces.hasMoreElements()) {
                NetworkInterface networkInterface = interfaces.nextElement();
                if (networkInterface.supportsMulticast() && !networkInterface.isLoopback()) {
                    return networkInterface;
                }
            }
        } catch (SocketException e) {
            Log.e(TAG, "获取网络接口失败", e);
        }
        return null;
    }

    /**
     * 通知网络错误
     */
    private void notifyNetworkError(String errorMessage) {
        if (networkStateListener != null) {
            mainHandler.post(() -> networkStateListener.onNetworkError(errorMessage));
        }
    }

    /**
     * 设置投屏状态
     */
    public void setStreamingState(boolean streaming) {
        if (this.isStreaming != streaming) {
            this.isStreaming = streaming;
            // 立即发送状态更新
            executor.execute(() -> {
                try {
                    sendStatusMessage();
                } catch (IOException e) {
                    Log.e(TAG, "发送状态更新失败", e);
                }
            });
        }
    }
}
