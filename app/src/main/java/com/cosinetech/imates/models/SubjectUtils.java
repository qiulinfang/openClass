package com.cosinetech.imates.models;

import static com.cosinetech.imates.models.Subject.*;

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
}
