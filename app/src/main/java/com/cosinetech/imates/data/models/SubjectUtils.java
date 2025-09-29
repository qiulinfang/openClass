package com.cosinetech.imates.data.models;

import static com.cosinetech.imates.data.models.Subject.*;

import androidx.annotation.NonNull;

public class SubjectUtils {
    public static String getSubjectDisplayName(String subject) {
        if(subject.equals(SUBJECT_BIOLOGY.name())) {
            return "生物";
        }
        if(subject.equals(SUBJECT_MATH.name())) {
            return "数学";
        }
        if(subject.equals(SUBJECT_CHINESE.name())) {
            return "语文";
        }
        if(subject.equals(SUBJECT_ENGLISH.name())) {
            return "英语";
        }
        if(subject.equals(SUBJECT_PHYSICS.name())) {
            return "物理";
        }
        if(subject.equals(SUBJECT_CHEMISTRY.name())) {
            return "化学";
        }

        return "其他";
    }
    
    public static String getSubjectNormalizedName(Subject subject) {
        return switch (subject) {
            case SUBJECT_BIOLOGY -> "biology";
            case SUBJECT_MATH -> "math";
            case SUBJECT_CHINESE -> "chinese";
            case SUBJECT_ENGLISH -> "english";
            case SUBJECT_CHEMISTRY -> "chemistry";
            case SUBJECT_PHYSICS -> "physics";
            case SUBJECT_ALL -> "all";
        };
    }
}
