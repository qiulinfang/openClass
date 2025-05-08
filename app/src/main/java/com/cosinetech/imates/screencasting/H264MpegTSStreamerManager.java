package com.cosinetech.imates.screencasting;

import androidx.compose.foundation.interaction.PressInteraction;

public class H264MpegTSStreamerManager {
    private static FFmpegPipeStreamer instance = null;
    public static final int ENCODE_FRAME_RATE = 60;

    public static synchronized FFmpegPipeStreamer  getInstance() {
        if (instance == null) {
            instance = new FFmpegPipeStreamer("127.0.0.1",
                    UdpForwarderManager.STREAMING_LOCAL_PORT,
                    ENCODE_FRAME_RATE
                    , null);
        }
        return instance;
    }

    public synchronized void Release() {
        if (instance != null) {
            instance.stop();
            instance = null;
        }
    }
}
