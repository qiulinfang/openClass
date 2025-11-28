package com.cosinetech.imates.screencasting.listener;

import com.cosinetech.imates.screencasting.model.ClassroomInfo;

import java.util.List;

public interface StudentListener {
    void onClassroomList(List<String> list);
    void onClassroomInfoUpdated(ClassroomInfo info);
    void onPollingError(String msg);
    void onError(String msg, Throwable t);
}
