package com.cosinetech.imates.screencasting;

import android.util.Log;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.SocketException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

/**
 * 相机流HTTP服务器
 * 将UDP TS流转换为HTTP流，供WebView使用
 */
public class CameraStreamHttpServer {
    private static final String TAG = "CameraStreamHttpServer";
    private static final int HTTP_PORT = 20252; // 相机流HTTP端口
    
    private ServerSocket serverSocket;
    private ExecutorService executor;
    private AtomicBoolean isRunning = new AtomicBoolean(false);
    
    // 当前UDP流数据缓存
    private final AtomicReference<byte[]> latestTsData = new AtomicReference<>();
    private final Object dataLock = new Object();
    
    private Thread udpReceiverThread;
    private int udpPort;
    
    public CameraStreamHttpServer(int udpPort) {
        this.udpPort = udpPort;
        this.executor = Executors.newCachedThreadPool();
    }
    
    /**
     * 启动HTTP服务器
     */
    public void start() {
        if (isRunning.getAndSet(true)) {
            Log.w(TAG, "HTTP server already running");
            return;
        }
        
        try {
            serverSocket = new ServerSocket(HTTP_PORT);
            Log.d(TAG, "Camera stream HTTP server started on port " + HTTP_PORT);
            
            // 启动UDP接收线程
            startUdpReceiver();
            
            // 启动HTTP服务器线程
            executor.execute(this::runHttpServer);
        } catch (IOException e) {
            Log.e(TAG, "Failed to start HTTP server", e);
            isRunning.set(false);
        }
    }
    
    /**
     * 停止HTTP服务器
     */
    public void stop() {
        if (!isRunning.getAndSet(false)) {
            return;
        }
        
        try {
            // 停止UDP接收
            if (udpReceiverThread != null) {
                udpReceiverThread.interrupt();
                udpReceiverThread = null;
            }
            
            // 关闭HTTP服务器
            if (serverSocket != null) {
                serverSocket.close();
                serverSocket = null;
            }
            
            executor.shutdown();
            Log.d(TAG, "Camera stream HTTP server stopped");
        } catch (IOException e) {
            Log.e(TAG, "Error stopping HTTP server", e);
        }
    }
    
    /**
     * 启动UDP接收线程
     */
    private void startUdpReceiver() {
        udpReceiverThread = new Thread(() -> {
            try {
                java.net.DatagramSocket udpSocket = new java.net.DatagramSocket(udpPort);
                udpSocket.setReceiveBufferSize(10 * 1024 * 1024);
                byte[] buffer = new byte[2048];
                
                Log.d(TAG, "UDP receiver started on port " + udpPort);
                
                while (isRunning.get() && !Thread.currentThread().isInterrupted()) {
                    try {
                        java.net.DatagramPacket packet = new java.net.DatagramPacket(buffer, buffer.length);
                        udpSocket.receive(packet);
                        
                        // 缓存最新的TS数据
                        byte[] data = new byte[packet.getLength()];
                        System.arraycopy(packet.getData(), packet.getOffset(), data, 0, packet.getLength());
                        
                        synchronized (dataLock) {
                            latestTsData.set(data);
                        }
                    } catch (SocketException e) {
                        if (isRunning.get()) {
                            Log.e(TAG, "UDP receive error", e);
                        }
                        break;
                    } catch (IOException e) {
                        if (isRunning.get()) {
                            Log.e(TAG, "UDP receive error", e);
                        }
                    }
                }
                
                udpSocket.close();
            } catch (Exception e) {
                Log.e(TAG, "UDP receiver error", e);
            }
        }, "CameraStreamUdpReceiver");
        
        udpReceiverThread.start();
    }
    
    /**
     * 运行HTTP服务器
     */
    private void runHttpServer() {
        while (isRunning.get() && serverSocket != null && !serverSocket.isClosed()) {
            try {
                Socket clientSocket = serverSocket.accept();
                executor.execute(() -> handleClient(clientSocket));
            } catch (IOException e) {
                if (isRunning.get()) {
                    Log.e(TAG, "HTTP server accept error", e);
                }
            }
        }
    }
    
    /**
     * 处理HTTP客户端请求
     */
    private void handleClient(Socket clientSocket) {
        try {
            // 读取HTTP请求
            java.io.BufferedReader reader = new java.io.BufferedReader(
                new java.io.InputStreamReader(clientSocket.getInputStream())
            );
            
            String requestLine = reader.readLine();
            if (requestLine == null) {
                clientSocket.close();
                return;
            }
            
            Log.d(TAG, "HTTP request: " + requestLine);
            
            // 发送HTTP响应头
            OutputStream out = clientSocket.getOutputStream();
            String responseHeaders = 
                "HTTP/1.1 200 OK\r\n" +
                "Content-Type: video/mp2t\r\n" +
                "Access-Control-Allow-Origin: *\r\n" +
                "Cache-Control: no-cache\r\n" +
                "Connection: keep-alive\r\n" +
                "\r\n";
            
            out.write(responseHeaders.getBytes());
            out.flush();
            
            // 持续发送TS流数据
            while (isRunning.get() && !clientSocket.isClosed()) {
                byte[] data;
                synchronized (dataLock) {
                    data = latestTsData.get();
                }
                
                if (data != null) {
                    out.write(data);
                    out.flush();
                } else {
                    // 没有数据时等待
                    Thread.sleep(10);
                }
            }
            
            clientSocket.close();
        } catch (Exception e) {
            Log.e(TAG, "Error handling client", e);
            try {
                clientSocket.close();
            } catch (IOException ignored) {}
        }
    }
    
    /**
     * 获取HTTP端口
     */
    public int getHttpPort() {
        return HTTP_PORT;
    }
}

