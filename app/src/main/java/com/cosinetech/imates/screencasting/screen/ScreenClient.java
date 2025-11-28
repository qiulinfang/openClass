package com.cosinetech.imates.screencasting.screen;

import android.content.Context;

import com.cosinetech.imates.screencasting.base.BaseClient;
import com.cosinetech.imates.screencasting.heartbeat.HeartbeatManager;
import com.cosinetech.imates.screencasting.listener.ScreenListener;
import com.cosinetech.imates.screencasting.model.ClassroomDeviceStatus;
import com.cosinetech.imates.screencasting.model.DeviceInfo;
import com.google.gson.JsonObject;

public class ScreenClient extends BaseClient {
    private ScreenListener listener;
    private HeartbeatManager heartbeat;
    private DeviceInfo localInfo;

    public enum State { IDLE, REGISTERED }
    private State state = State.IDLE;

    public ScreenClient(Context context, String serverUrl) {
        super(context, serverUrl);
        this.heartbeat = new HeartbeatManager(this.api, this.storage);
        this.heartbeat.setListener(new HeartbeatManager.HeartbeatListener() {
            @Override
            public void onHeartbeatSuccess(JsonObject resp) {
                updateStorageFromStatus(resp);
                if (listener != null) listener.onHeartbeatUpdate(parseStatusFromJson(resp));
            }

            @Override
            public void onHeartbeatFailure(int httpCode, String body, Throwable t) {
                if (listener != null) listener.onError(body, t);
            }
        });
    }

    public void setListener(ScreenListener l) { this.listener = l; }

    public void register(DeviceInfo info) {
        this.localInfo = info;
        this.myCity = info.city; this.mySchool = info.school; this.myClassroom = info.classroom;
        api.postRegister(info, new DeviceApi.ApiCallback<JsonObject>() {
            @Override
            public void onSuccess(JsonObject result) {
                state = State.REGISTERED;
                updateStorageFromStatus(result);
                if (listener != null) listener.onRegisterSuccess(parseStatusFromJson(result));
            }

            @Override
            public void onFailure(int httpCode, String errorBody, Throwable t) {
                storage.setLastHttpError(httpCode);
                storage.setLastServerError(errorBody);
                if (listener != null) listener.onError(errorBody, t);
            }
        });
    }

    public void startHeartbeat() {
        if (localInfo == null) return;
        heartbeat.start(localInfo, 10);
    }

    public void stopHeartbeat() { heartbeat.stop(); }

    private ClassroomDeviceStatus parseStatusFromJson(JsonObject json) {
        ClassroomDeviceStatus s = new ClassroomDeviceStatus();
        try {
            if (json.has("teacher_ip")) s.teacherIp = json.get("teacher_ip").getAsString();
            if (json.has("screen_ip")) s.screenIp = json.get("screen_ip").getAsString();
            if (json.has("teacher_count")) s.teacherCount = json.get("teacher_count").getAsInt();
            if (json.has("screen_count")) s.screenCount = json.get("screen_count").getAsInt();
            if (json.has("message")) s.message = json.get("message").getAsString();
        } catch (Exception e) { }
        return s;
    }

    private void updateStorageFromStatus(JsonObject json) {
        storage.setMyClassroomInfo(parseClassroomInfo(json));
    }

    public ClassroomDeviceStatus getCurrentStatus() {
        ClassroomDeviceStatus s = new ClassroomDeviceStatus();
        if (storage.getMyClassroomInfo() != null) {
            s.teacherCount = storage.getMyClassroomInfo().teacherCount;
            s.screenCount = storage.getMyClassroomInfo().screenCount;
            s.teacherIp = storage.getMyClassroomInfo().getFirstTeacherIp();
            s.screenIp = storage.getMyClassroomInfo().getFirstScreenIp();
        }
        return s;
    }

    public DeviceInfo getLocalDeviceInfo() { return localInfo; }
}
