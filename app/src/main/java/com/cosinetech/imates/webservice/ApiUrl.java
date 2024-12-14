package com.cosinetech.imates.webservice;

public class ApiUrl {
    // private static final String baseUrl = "http://192.168.40.10:8222/blw-edu-service-alc/permission";
    // public static final String URL_LOGIN = "http://192.168.40.10:8222/blw-edu-service-alc/admin/login";
    // public static final String URL_USER_INFO = "http://192.168.40.10:8222/blw-edu-service-alc/admin/info";
    // public static final String baseUrl = "https://imates.com.cn/blw-edu-service-alc/permission";
    public static final String URL_RESOURCE_BASE = "https://study.showcode.xyz";
    public static final String URL_LOGIN = "https://api.showcode.xyz/blw-edu-service-alc/admin/login";
    public static final String URL_USER_INFO = "https://api.showcode.xyz/blw-edu-service-alc/admin/info";
    private static final String baseUrl = "https://api.showcode.xyz/blw-edu-service-alc/permission";
    public static final String URL_QUESTION_IMAGE_RECOGNISE = baseUrl + "/img";
    public static final String URL_CHAT_GENERAL = baseUrl + "/chats";
    public static final String URL_CHAT_BIOLOGY = baseUrl + "/chat";

    //上传生物 数学练习
    public static final String URL_UPLOAD_EXERCISE = baseUrl + "/exercises";

    // 查询生物习题列表
    public static final String URL_QUERY_EXERCISE_BIOLOGY = baseUrl + "/selectExercises/biology";

    //查询数学习题列表
    public static final String URL_QUERY_EXERCISE_MATH = baseUrl + "/selectExercises/math";
}
