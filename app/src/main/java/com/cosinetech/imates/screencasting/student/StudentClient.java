package com.cosinetech.imates.screencasting.student;
import android.content.Context;

import com.cosinetech.imates.screencasting.base.BaseClient;
import com.cosinetech.imates.screencasting.polling.PollingManager;
import com.cosinetech.imates.screencasting.listener.StudentListener;
import com.cosinetech.imates.screencasting.model.ClassroomInfo;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.cosinetech.imates.screencasting.base.DeviceApi;

import java.util.ArrayList;
import java.util.List;

public class StudentClient extends BaseClient {
    private StudentListener listener;
    private final PollingManager polling;

    public StudentClient(Context context, String serverUrl) {
        super(context, serverUrl);
        this.polling = new PollingManager(this.api, this.storage);
        this.polling.setListener(new PollingManager.PollingListener() {
            @Override
            public void onPolled(JsonObject resp) {
                ClassroomInfo info = parseClassroomInfo(resp);
                storage.setMyClassroomInfo(info);
                if (listener != null) listener.onClassroomInfoUpdated(info);
            }

            @Override
            public void onPollError(int code, String body, Throwable t) {
                if (listener != null) listener.onPollingError(body);
            }
        });
    }

    public void setListener(StudentListener l) { this.listener = l; }

    public void init(String city, String school) {
        this.myCity = city;
        this.mySchool = school;
    }

    public void getClassroomList() {
        api.getClassrooms(myCity, mySchool, new DeviceApi.ApiCallback<JsonObject>() {
            @Override
            public void onSuccess(JsonObject result) {
                List<String> list = new ArrayList<>();
                if (result.has("classrooms")) {
                    JsonArray arr = result.getAsJsonArray("classrooms");
                    for (JsonElement e : arr) list.add(e.getAsString());
                }
                if (listener != null) listener.onClassroomList(list);
            }

            @Override
            public void onFailure(int httpCode, String errorBody, Throwable t) {
                storage.setLastHttpError(httpCode);
                storage.setLastServerError(errorBody);
                if (listener != null) listener.onError(errorBody, t);
            }
        });
    }

    public void selectClassroom(String classroom) {
        this.myClassroom = classroom;
        queryClassroomInfoOnce();
    }

    public void queryClassroomInfoOnce() {
        api.getClassroom(myCity, mySchool, myClassroom, new DeviceApi.ApiCallback<JsonObject>() {
            @Override
            public void onSuccess(JsonObject result) {
                ClassroomInfo info = parseClassroomInfo(result);
                storage.setMyClassroomInfo(info);
                if (listener != null) listener.onClassroomInfoUpdated(info);
            }

            @Override
            public void onFailure(int httpCode, String errorBody, Throwable t) {
                storage.setLastHttpError(httpCode);
                storage.setLastServerError(errorBody);
                if (listener != null) listener.onError(errorBody, t);
            }
        });
    }

    public void startPolling(long intervalSeconds) {
        polling.start(myCity, mySchool, myClassroom, intervalSeconds);
    }

    public void stopPolling() {
        polling.stop();
    }

    public ClassroomInfo getCurrentClassroomInfo() {
        return storage.getMyClassroomInfo();
    }
}