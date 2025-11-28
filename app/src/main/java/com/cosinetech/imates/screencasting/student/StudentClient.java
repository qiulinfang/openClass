package com.cosinetech.imates.screencasting.student;

import android.content.Context;

import com.cosinetech.imates.screencasting.base.BaseClient;
import com.cosinetech.imates.screencasting.polling.PollingManager;
import com.cosinetech.imates.screencasting.listener.StudentListener;
import com.cosinetech.imates.screencasting.model.ClassroomInfo;
import com.google.gson.JsonObject;

public class StudentClient extends BaseClient {
    private StudentListener listener;
    private PollingManager polling;

    public StudentClient(Context context, String serverUrl) {
        super(context, serverUrl);
        this.polling = new PollingManager(this.api, this.storage);
        this.polling.setListener(new PollingManager.PollingListener() {
            @Override
            public void onPolled(JsonObject resp) {
                ClassroomInfo info = parseClassroomInfo(resp);
                ClassroomInfo old = storage.getMyClassroomInfo();
                boolean changed = false;
                if (old == null) changed = true;
                else {
                    String oldTeacher = old.getFirstTeacherIp();
                    String newTeacher = info.getFirstTeacherIp();
                    String oldScreen = old.getFirstScreenIp();
                    String newScreen = info.getFirstScreenIp();
                    if ((oldTeacher == null && newTeacher != null) || (oldTeacher != null && !oldTeacher.equals(newTeacher))) changed = true;
                    if ((oldScreen == null && newScreen != null) || (oldScreen != null && !oldScreen.equals(newScreen))) changed = true;
                }
                storage.setMyClassroomInfo(info);
                if (changed && listener != null) listener.onClassroomInfoUpdated(info);
            }

            @Override
            public void onPollError(int code, String body, Throwable t) {
                if (listener != null) listener.onPollingError(body);
            }
        });
    }

    public void setListener(StudentListener l) { this.listener = l; }

    public void init(String city, String school, String classroom) {
        this.myCity = city; this.mySchool = school; this.myClassroom = classroom;
    }

    public void startPolling(long intervalSeconds) {
        if (myCity == null || mySchool == null || myClassroom == null) return;
        polling.start(myCity, mySchool, myClassroom, intervalSeconds);
    }

    public void stopPolling() {
        polling.stop();
    }

    public ClassroomInfo getCurrentClassroomInfo() {
        return storage.getMyClassroomInfo();
    }
}