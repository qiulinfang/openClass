package com.cosinetech.imates;

import android.content.Context;
import android.util.Log;

import com.alibaba.dashscope.audio.ttsv2.SpeechSynthesisAudioFormat;
import com.alibaba.dashscope.audio.ttsv2.SpeechSynthesisParam;
import com.alibaba.dashscope.audio.ttsv2.SpeechSynthesizer;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.util.UUID;

public class Tts2File {
    /**
     * 将your-dashscope-api-key替换成您自己的API-KEY
     */
    private static String apikey = "sk-4264dd2363e1478f849a8184f45c111b";
    private static String model = "cosyvoice-v1";
    private static String voice = "longhua";

    public static String StreamAuidoDataToSpeaker(Context context, String content) {
        SpeechSynthesisParam param =
                SpeechSynthesisParam.builder()
                        .apiKey(apikey)
                        .model(model)
                        .voice(voice)
                        .build();
        SpeechSynthesizer synthesizer = new SpeechSynthesizer(param, null);
        ByteBuffer audio = synthesizer.call(content);

        String guid = UUID.randomUUID().toString();
        String fileName = guid + ".mp3";
        File file = new File(context.getCacheDir(), fileName);
        //System.out.print("requestId: " + synthesizer.getLastRequestId());
        try (FileOutputStream fos = new FileOutputStream(file)) {
            fos.write(audio.array());
        } catch (IOException e) {
            Log.e("TTS", e.getMessage());
            return "";
        }

        return file.getAbsolutePath();
    }
}
