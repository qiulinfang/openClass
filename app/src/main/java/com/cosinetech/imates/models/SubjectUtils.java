package com.cosinetech.imates.models;

public class SubjectUtils {
    public static String getSubjectDisplayName(Subject subject) {
        switch (subject) {
            case SUBJECT_BIOLOGY:
                return "生物";
            case SUBJECT_MATH:
                return "数学";
            case SUBJECT_CHINESE:
                return "语文";
            case SUBJECT_ENGLISH:
                return "英语";
            case SUBJECT_PHYSICS:
                return "物理";
            case SUBJECT_CHEMISTRY:
                return "化学";
            default:
                return "其他";
        }
    }
}
