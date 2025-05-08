package com.cosinetech.imates.screencasting;

public class UdpForwarderManager {
    private static UdpForwarder instance;
    public static final int STREAMING_LOCAL_PORT = 20250;

    public static synchronized UdpForwarder getInstance() {
        if (instance == null) {
            instance = new UdpForwarder(STREAMING_LOCAL_PORT);
        }
        return instance;
    }

    public static void release() {
        if (instance != null) {
            instance.stop();
            instance = null;
        }
    }
}