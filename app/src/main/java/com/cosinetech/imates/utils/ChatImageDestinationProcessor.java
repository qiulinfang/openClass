package com.cosinetech.imates.utils;

import android.net.Uri;
import android.text.TextUtils;

import io.noties.markwon.image.destination.ImageDestinationProcessor;
import io.noties.markwon.image.destination.ImageDestinationProcessorRelativeToAbsolute;

public class ChatImageDestinationProcessor extends ImageDestinationProcessor {

    private final ImageDestinationProcessorRelativeToAbsolute processor;

    public ChatImageDestinationProcessor() {
        this("https://raw.githubusercontent.com");
    }

    public ChatImageDestinationProcessor(String baseUrl) {
        this.processor = new ImageDestinationProcessorRelativeToAbsolute(baseUrl);
    }

    @Override
    public String process(String destination) {
        // 处理没有协议信息的图片
        Uri uri = Uri.parse(destination);
        if (TextUtils.isEmpty(uri.getScheme())) {
            return processor.process(destination);
        } else {
            return destination;
        }
    }
} 