package com.cosinetech.imates.screencasting;

public class TSMuxer {
    static {
        System.loadLibrary("tsmuxer");
    }

    public static native int init(String dstAddress, int dstPort);
    public static native void setDestination(String dstIp, int dstPort);
    public static native void setSendEnable(int enable);
    public static native long usTo90k(long microsecondTimestamp);
    public static native void addH264(byte[] h264Frame, long pts, boolean isKeyFrame);
    public static native void addAAC(byte[] aacFrame, long pts);
    public static native void sendStream();
    public static native void uninit();
}