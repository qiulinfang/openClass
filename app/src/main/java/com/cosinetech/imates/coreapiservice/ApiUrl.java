package com.cosinetech.imates.coreapiservice;

import com.cosinetech.imates.appenv.AppEnvConfig;

public class ApiUrl {
    private static String baseUrl;
    public static String MQ_HOST_BASE ;
    public static int MQ_HOST_PORT;

    public static String ZAMMAD_URL;
    public static String URL_RESOURCE_BASE;
    public static String URL_APP_UPDATE;

    // URLs
    public static String URL_LOGIN;
    public static String URL_USER_INFO;
    public static String URL_QUESTION_IMAGE_RECOGNISE_BIOLOGY;
    public static String URL_QUESTION_IMAGE_RECOGNISE_MATH;
    public static String URL_QUESTION_TEXT_SEARCH_BIOLOGY;
    public static String URL_QUESTION_TEXT_SEARCH_MATH ;
    public static String URL_CHAT_GENERAL;
    public static String URL_CHAT_PREVIEW_PICTURE;

    //生物引导解题
    public static String URL_CHAT_BIOLOGY;

    //数学引导解题
    public static String URL_CHAT_MATH;

    //上传生物 数学练习
    public static String URL_ADD_EXERCISE_TO_LIST;

    // 查询生物习题列表
    public static String URL_GET_EXERCISE_BIOLOGY;

    //查询数学习题列表
    public static String URL_GET_EXERCISE_MATH;

    public static String URL_DELETE_EXERCISE_BASE;

    public static String URL_QUERY_SIMILAR_EXERCISE;

    public static  String URL_QUERY_SIMILAR_EXERCISE_BY_KNOWLEDGE;

    public static String URL_QUERY_KNOWLEDGE_ID_BY_CHAPTER_ID;

    public static void switchEnv(AppEnvConfig.AppEnvType envType) {
        if(envType == AppEnvConfig.AppEnvType.RELEASE) {
            baseUrl = "http://www.imates.com.cn:8222/blw-edu-service-alc";
            URL_RESOURCE_BASE = "https://www.imates.com.cn";
            URL_APP_UPDATE = "https://www.imates.com.cn/appupdate.json";
            MQ_HOST_BASE = "www.imates.com.cn";
            MQ_HOST_PORT = 5673;
            ZAMMAD_URL = "http://app.imates.com.cn:8080/api/v1";
        } else if(envType == AppEnvConfig.AppEnvType.INTERNAL_TEST) {
            baseUrl = "https://api.showcode.xyz/blw-edu-service-alc";
            URL_RESOURCE_BASE = "https://www.showcode.xyz";
            URL_APP_UPDATE = "https://www.imates.com.cn/appupdate_test.json";
            MQ_HOST_BASE = "www.imates.com.cn";
            MQ_HOST_PORT = 5673;
            ZAMMAD_URL = "http://app.imates.com.cn:8080/api/v1";
        }

        updateAllUrl();
    }

    private static void updateAllUrl() {
        // 用户登录
        URL_LOGIN = baseUrl + "/admin/login";
        //获取用户信息
        URL_USER_INFO = baseUrl + "/admin/info";
        // 生物拍题
        URL_QUESTION_IMAGE_RECOGNISE_BIOLOGY = baseUrl + "/permission/img";
        // 数学拍题
        URL_QUESTION_IMAGE_RECOGNISE_MATH = baseUrl + "/permission/imgMath";
        // 生物文本搜题
        URL_QUESTION_TEXT_SEARCH_BIOLOGY = baseUrl + "/permission/textSearch";
        // 数学文本搜题
        URL_QUESTION_TEXT_SEARCH_MATH = baseUrl + "/permission/textSearchMath";
        // 通用AI对话
        URL_CHAT_GENERAL = baseUrl + "/permission/chats";
        // 截图问答AI对话
        URL_CHAT_PREVIEW_PICTURE = baseUrl + "/permission/previewPictureQA";

        //生物引导解题
        URL_CHAT_BIOLOGY = baseUrl + "/permission/chat";

        //数学引导解题
        URL_CHAT_MATH = baseUrl + "/permission/chatMath";

        //上传生物 数学练习
        URL_ADD_EXERCISE_TO_LIST = baseUrl + "/permission/exercises";

        // 查询生物习题列表
        URL_GET_EXERCISE_BIOLOGY = baseUrl + "/permission/selectExercises/biology";

        //查询数学习题列表
        URL_GET_EXERCISE_MATH = baseUrl + "/permission/selectExercises/math";

        // 删除习题
        URL_DELETE_EXERCISE_BASE = baseUrl + "/permission/deleteExercises";

        // 查询相似题(举一反三)
        URL_QUERY_SIMILAR_EXERCISE = baseUrl + "/permission/topicAndAck";

        // 根据知识点查题
        URL_QUERY_SIMILAR_EXERCISE_BY_KNOWLEDGE = baseUrl + "/biologyTopicKnowledge/knowledgeTopicAndAck";

        URL_QUERY_KNOWLEDGE_ID_BY_CHAPTER_ID = "http://www.imates.com.cn:8090/knowledge";
    }
}
