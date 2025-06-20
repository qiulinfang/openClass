package com.cosinetech.imates.screencasting;

import java.util.Arrays;
import java.util.concurrent.atomic.AtomicReference;

public class H264IFrameCache {
    // 单例实例（使用volatile保证可见性）
    private static volatile H264IFrameCache instance;

    // 存储最新I帧的原子引用
    private final AtomicReference<byte[]> latestIFrame = new AtomicReference<>();

    // 私有构造函数防止外部实例化
    private H264IFrameCache() {}

    // 双重检查锁定单例实现
    public static H264IFrameCache getInstance() {
        if (instance == null) {
            synchronized (H264IFrameCache.class) {
                if (instance == null) {
                    instance = new H264IFrameCache();
                }
            }
        }
        return instance;
    }

    // 保存I帧（线程安全）
    public void onH264Frame(byte[] frameData) {
        if (frameData == null || frameData.length == 0) return;

        byte[] copy = Arrays.copyOf(frameData, frameData.length);
        latestIFrame.set(copy);
    }

    // 获取最新I帧（返回副本）
    public byte[] getLatestIFrame() {
        byte[] current = latestIFrame.get();
        return (current != null) ? Arrays.copyOf(current, current.length) : null;
    }

    // 防止反序列化破坏单例
    private Object readResolve() {
        return getInstance();
    }
}
