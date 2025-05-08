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
            socket.setReuseAddress(true);
            Log.i(TAG, "UDP forwarder listening on 127.0.0.1:" + listenPort);

            while (running) {
                DatagramPacket packet = new DatagramPacket(buffer, buffer.length);
                try {
                    socket.receive(packet);

                    if (shouldForward && targetHost != null && targetPort > 0) {
                        try {
                            DatagramPacket forwardPacket = new DatagramPacket(
                                    packet.getData(), packet.getLength(),
                                    InetAddress.getByName(targetHost), targetPort
                            );
                            socket.send(forwardPacket);
                        } catch (Exception e) {
                            Log.e(TAG, "Failed to forward packet: " + e.getMessage(), e);
                        }
                    }

                } catch (IOException e) {
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

