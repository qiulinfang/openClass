package com.cosinetech.imates.webservice;

public class ApiUrl {
    // ========test local
//     private static final String baseUrl = "http://192.168.1.153:8222/blw-edu-service-alc";
//     public static final String URL_RESOURCE_BASE = "https://192.168.1.153";
//     public static final String URL_LOGIN = "http://192.168.1.153:8222/blw-edu-service-alc/admin/login";
//     public static final String URL_USER_INFO = "http://192.168.1.153:8222/blw-edu-service-alc/admin/info";
//     public static final  String URL_QUERY_SIMILAR_EXERCISE_BY_KNOWLEDGE = "http://192.168.1.153:8222/blw-edu-service-alc/biologyTopicKnowledge/knowledgeTopicAndAck";

    // ========test shocode
//    private static final String baseUrl = "https://api.showcode.xyz/blw-edu-service-alc/permission";
//    public static final String URL_RESOURCE_BASE = "https://study.showcode.xyz";
//    public static final String URL_LOGIN = "https://api.showcode.xyz/blw-edu-service-alc/admin/login";
//    public static final String URL_USER_INFO = "https://api.showcode.xyz/blw-edu-service-alc/admin/info";

    // =========imates
    private static final String baseUrl = "http://www.imates.com.cn:8222/blw-edu-service-alc";
    public static final String URL_RESOURCE_BASE = "https://www.imates.com.cn";
    public static final String URL_LOGIN = "http://www.imates.com.cn:8222/blw-edu-service-alc/admin/login";
    public static final String URL_USER_INFO = "http://www.imates.com.cn:8222/blw-edu-service-alc/admin/info";

    public static final String URL_QUESTION_IMAGE_RECOGNISE_BIOLOGY = baseUrl + "/permission/img";
    public static final String URL_QUESTION_IMAGE_RECOGNISE_MATH = baseUrl + "/permission/imgMath";
    public static final String URL_CHAT_GENERAL = baseUrl + "/permission/chats";
    public static final String URL_CHAT_PREVIEW_PICTURE = baseUrl + "/permission/previewPictureQA";
    public static final String URL_CHAT_BIOLOGY = baseUrl + "/permission/chat";

    //上传生物 数学练习
    public static final String URL_ADD_EXERCISE_TO_LIST = baseUrl + "/permission/exercises";

    // 查询生物习题列表
    public static final String URL_GET_EXERCISE_BIOLOGY = baseUrl + "/permission/selectExercises/biology";

    //查询数学习题列表
    public static final String URL_GET_EXERCISE_MATH = baseUrl + "/permission/selectExercises/math";

    public static final String URL_DELETE_EXERCISE_BASE = baseUrl + "/permission/deleteExercises";

    public static final String URL_QUERY_SIMILAR_EXERCISE = baseUrl + "/permission/topicAndAck";

    public static final  String URL_QUERY_SIMILAR_EXERCISE_BY_KNOWLEDGE = baseUrl + "/biologyTopicKnowledge/knowledgeTopicAndAck";

    public static final String URL_APP_UPDATE = URL_RESOURCE_BASE + "/appupdate.json";
}
