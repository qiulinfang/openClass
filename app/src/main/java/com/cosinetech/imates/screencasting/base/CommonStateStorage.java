package com.cosinetech.imates.screencasting.base;

import com.cosinetech.imates.screencasting.model.ClassroomInfo;
import com.cosinetech.imates.screencasting.model.ServerStatus;

public class CommonStateStorage {
    private volatile ClassroomInfo myClassroomInfo;
    private volatile ServerStatus serverStatus;
    private volatile String lastServerError;
    private volatile int lastHttpError;

    public synchronized ClassroomInfo getMyClassroomInfo() {
        return myClassroomInfo;
    }

    public synchronized void setMyClassroomInfo(ClassroomInfo info) {
        this.myClassroomInfo = info;
    }

    public synchronized ServerStatus getServerStatus() {
        return serverStatus;
    }

    public synchronized void setServerStatus(ServerStatus status) {
        this.serverStatus = status;
    }

    public synchronized String getLastServerError() {
        return lastServerError;
    }

    public synchronized void setLastServerError(String err) {
        this.lastServerError = err;
    }

    public synchronized int getLastHttpError() {
        return lastHttpError;
    }

    public synchronized void setLastHttpError(int code) {
        this.lastHttpError = code;
    }
}