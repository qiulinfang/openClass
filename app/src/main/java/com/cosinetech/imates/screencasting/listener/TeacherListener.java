package com.cosinetech.imates.screencasting.listener;

import com.cosinetech.imates.screencasting.model.ClassroomDeviceStatus;
import java.util.List;

public interface TeacherListener {
    void onClassroomList(List<String> classrooms);
    void onRegisterSuccess(ClassroomDeviceStatus status);
    void onHeartbeatUpdate(ClassroomDeviceStatus status);
    void onError(String msg, Throwable t);
}
