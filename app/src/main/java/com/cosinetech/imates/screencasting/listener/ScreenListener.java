package com.cosinetech.imates.screencasting.listener;

import com.cosinetech.imates.screencasting.model.ClassroomDeviceStatus;

public interface ScreenListener {
    void onRegisterSuccess(ClassroomDeviceStatus status);
    void onHeartbeatUpdate(ClassroomDeviceStatus status);
    void onError(String msg, Throwable t);
}
