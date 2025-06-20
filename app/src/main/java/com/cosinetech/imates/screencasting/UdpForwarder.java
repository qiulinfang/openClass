package com.cosinetech.imates.screencasting;

import android.util.Log;

import java.io.IOException;
import java.net.*;

public class UdpForwarder {

    private static final String TAG = "UdpForwarder";

    private final int listenPort;
    private volatile boolean running = false;
    private volatile boolean shouldForward = false;

    private volatile String targetHost = null;
    private volatile int targetPort = -1;

    private Thread receiveThread;

    public UdpForwarder(int listenPort) {
        this.listenPort = listenPort;
    }

    public void start() {
        if (running) return;

        running = true;
        receiveThread = new Thread(this::runForwarder, "UdpForwarder-Thread");
        receiveThread.start();
    }

    public void stop() {
        running = false;
        if (receiveThread != null) {
            receiveThread.interrupt();
        }
    }

    public void setForwardingEnabled(boolean enabled) {
        this.shouldForward = enabled;
    }

    public void setTarget(String host, int port) {
        this.targetHost = host;
        this.targetPort = port;
    }

    private void runForwarder() {
        byte[] buffer = new byte[2048];
        try (DatagramSocket socket = new DatagramSocket(listenPort)) {
            socket.setReceiveBufferSize(10 * 1024 * 1024);
            Log.e("UDP", "实际接收缓冲大小: " + socket.getReceiveBufferSize());
            socket.setReuseAddress(true);
            Log.i(TAG, "UDP forwarder listening on 127.0.0.1:" + listenPort);

//            FileOutputStream fos = null;
//            try {
//                fos = new FileOutputStream(ApplicationModelShared.getInstance().getExternalFilesDir(null).getAbsolutePath() + "/debug.ts");
//            } catch (Exception e) {
//            }
            while (running) {
                DatagramPacket packet = new DatagramPacket(buffer, buffer.length);
                try {
                    socket.receive(packet);
//                    if(fos != null) {
//                        fos.write(packet.getData(), packet.getOffset(), packet.getLength());
//                    }
                    if (shouldForward && targetHost != null && targetPort > 0) {
                        try {
                            DatagramPacket forwardPacket = new DatagramPacket(
                                    packet.getData(), packet.getLength(),
                                    InetAddress.getByName(targetHost), targetPort
                            );
                            socket.send(forwardPacket);
                        } catch (Exception e) {
                            //Log.e(TAG, "Failed to forward packet: " + e.getMessage(), e);
                            Thread.sleep(10);
                        }
                    }

                } catch (IOException | InterruptedException e) {
                    if (running) {
                        Log.e(TAG, "Receive error: " + e.getMessage(), e);
                    }
                }
            }

        } catch (SocketException e) {
            Log.e(TAG, "Failed to bind UDP port: " + e.getMessage(), e);
        }
    }
}

