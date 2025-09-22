package com.cosinetech.imates.utils;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

public class TimeUtils {
    public static String timestampToDateString(long ts) {
        // 将时间戳转换为Instant
        Instant instant = null;
        instant = Instant.ofEpochMilli(ts);
        LocalDateTime dateTime = LocalDateTime.ofInstant(instant, ZoneId.systemDefault());
        // 创建一个DateTimeFormatter实例
        //DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");
        // 使用format方法和DateTimeFormatter将LocalDateTime转换为字符串
        return dateTime.format(formatter);
    }
}
