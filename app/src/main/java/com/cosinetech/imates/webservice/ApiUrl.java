package com.cosinetech.imates.webservice;

public class ApiUrl {
    // ========test local
//     private static final String baseUrl = "http://192.168.40.10:8222/blw-edu-service-alc";
//     public static final String URL_RESOURCE_BASE = "https://192.168.40.10";

    // =========imates
    private static final String baseUrl = "http://www.imates.com.cn:8222/blw-edu-service-alc";
    public static final String URL_RESOURCE_BASE = "https://www.imates.com.cn";

    // public static final String URL_APP_UPDATE = URL_RESOURCE_BASE + "/appupdate.json";
    public static final String URL_APP_UPDATE = "https://www.imates.com.cn/appupdate.json";
    public static final String URL_LOGIN = baseUrl + "/admin/login";
    public static final String URL_USER_INFO = baseUrl + "/admin/info";
    public static final String URL_QUESTION_IMAGE_RECOGNISE_BIOLOGY = baseUrl + "/permission/img";
    public static final String URL_QUESTION_IMAGE_RECOGNISE_MATH = baseUrl + "/permission/imgMath";
    public static final String URL_QUESTION_TEXT_SEARCH_BIOLOGY = baseUrl + "/permission/textSearch";
    public static final String URL_QUESTION_TEXT_SEARCH_MATH = baseUrl + "/permission/textSearchMath";
    public static final String URL_CHAT_GENERAL = baseUrl + "/permission/chats";
    public static final String URL_CHAT_PREVIEW_PICTURE = baseUrl + "/permission/previewPictureQA";

    //生物引导解题
    public static final String URL_CHAT_BIOLOGY = baseUrl + "/permission/chat";

    //数学引导解题
    public static final String URL_CHAT_MATH = baseUrl + "/permission/chatMath";

    //上传生物 数学练习
    public static final String URL_ADD_EXERCISE_TO_LIST = baseUrl + "/permission/exercises";

    // 查询生物习题列表
    public static final String URL_GET_EXERCISE_BIOLOGY = baseUrl + "/permission/selectExercises/biology";

    //查询数学习题列表
    public static final String URL_GET_EXERCISE_MATH = baseUrl + "/permission/selectExercises/math";

    public static final String URL_DELETE_EXERCISE_BASE = baseUrl + "/permission/deleteExercises";

    public static final String URL_QUERY_SIMILAR_EXERCISE = baseUrl + "/permission/topicAndAck";

    public static final  String URL_QUERY_SIMILAR_EXERCISE_BY_KNOWLEDGE = baseUrl + "/biologyTopicKnowledge/knowledgeTopicAndAck";
}
