package com.cosinetech.imates;

import android.content.Context;
import android.media.MediaPlayer;
import android.net.Uri;
import android.util.Log;

public class SingleAudioPlayer {

    private static MediaPlayer mediaPlayer;
    private static Context context;
    private static final String TAG = "AudioPlayer";

    public static SingleAudioPlayer  instance = null;

    public static SingleAudioPlayer getInstance(Context ctx) {
        return new SingleAudioPlayer(ctx);
    }

    private SingleAudioPlayer(Context context) {
        this.context = context;
    }

    private void load(Uri uri) {
        release(); // 释放之前的 MediaPlayer 资源
        mediaPlayer = MediaPlayer.create(context, uri);

        if (mediaPlayer == null) {
            Log.e(TAG, "音频加载失败！");
            return;
        }

        Log.i(TAG, "音频加载成功！");
    }

    /**
     * 播放音频
     */
    public void play(Uri uri) {
        load(uri);
        if (mediaPlayer == null) {
            Log.e(TAG, "MediaPlayer 未加载音频！");
            return;
        }

        if (!mediaPlayer.isPlaying()) {
            mediaPlayer.start();
            Log.i(TAG, "音频播放中...");
        } else {
            Log.i(TAG, "音频已在播放中！");
        }
    }

    /**
     * 暂停音频
     */
    public  void pause() {
        if (mediaPlayer != null && mediaPlayer.isPlaying()) {
            mediaPlayer.pause();
            Log.i(TAG, "音频已暂停！");
        }
    }

    /**
     * 停止音频播放
     */
    public void stop() {
        if (mediaPlayer != null) {
            mediaPlayer.stop();
            Log.i(TAG, "音频播放已停止！");
            release();
        }
    }

    /**
     * 释放资源
     */
    private void release() {
        if (mediaPlayer != null) {
            mediaPlayer.release();
            mediaPlayer = null;
            Log.i(TAG, "MediaPlayer 资源已释放！");
        }
    }

    /**
     * 检查是否正在播放
     *
     * @return true 如果正在播放，false 否则
     */
    public boolean isPlaying() {
        return mediaPlayer != null && mediaPlayer.isPlaying();
    }
}

