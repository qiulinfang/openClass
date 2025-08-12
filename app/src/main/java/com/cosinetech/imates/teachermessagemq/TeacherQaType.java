package com.cosinetech.imates.teachermessagemq;

public class TeacherQaType {
    public final static String SCHOOL_SUBJECT_BIOLOGY = "6";
    public final static String SCHOOL_SUBJECT_MATH = "2";

    public final static int QA_MSG_TYPE_TEXT = 0;
    public final static int QA_MSG_TYPE_PICTURE = 1;

    // 语音类型的消息, amr-nb 8khz 12.2, base64
    public final static int QA_MSG_TYPE_VOICE = 2;

}
