package com.cosinetech.imates.screencasting.listener;

import com.cosinetech.imates.screencasting.model.ClassroomInfo;

public interface StudentListener {
    void onClassroomInfoUpdated(ClassroomInfo info);
    void onPollingError(String msg);
    void onError(String msg, Throwable t);
}
