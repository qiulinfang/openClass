package com.cosinetech.imates.screencasting.teacher;

import android.content.Context;

import com.cosinetech.imates.screencasting.base.BaseClient;
import com.cosinetech.imates.screencasting.base.DeviceApi;
import com.cosinetech.imates.screencasting.heartbeat.HeartbeatManager;
import com.cosinetech.imates.screencasting.listener.TeacherListener;
import com.cosinetech.imates.screencasting.model.ClassroomDeviceStatus;
import com.cosinetech.imates.screencasting.model.DeviceInfo;
import com.google.gson.JsonObject;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;

import java.util.ArrayList;
import java.util.List;

public class TeacherClient extends BaseClient {
    private static final String TAG = "TeacherClient";
    private TeacherListener listener;
    private HeartbeatManager heartbeat;

    public enum State { IDLE, WAITING_CLASSROOM_SELECTION, REGISTERED }
    private State state = State.IDLE;
    private DeviceInfo localInfo;

    public TeacherClient(Context context, String serverUrl) {
        super(context, serverUrl);
        this.heartbeat = new HeartbeatManager(this.api, this.storage);
        this.heartbeat.setListener(new HeartbeatManager.HeartbeatListener() {
            @Override
            public void onHeartbeatSuccess(JsonObject resp) {
                // parse into ClassroomInfo and ClassroomDeviceStatus
                ClassroomDeviceStatus s = parseStatusFromJson(resp);
                updateStorageFromStatus(resp);
                if (listener != null) listener.onHeartbeatUpdate(s);
            }

            @Override
            public void onHeartbeatFailure(int httpCode, String body, Throwable t) {
                if (listener != null) listener.onError(body, t);
            }
        });
    }

    public void setListener(TeacherListener l) { this.listener = l; }

    // initial register (classroom may be null or empty). If server returns classroom_list -> callback
    public void initialRegister(DeviceInfo info) {
        this.localInfo = info;
        this.myCity = info.city; this.mySchool = info.school; this.myClassroom = info.classroom;
        api.postRegister(info, new DeviceApi.ApiCallback<JsonObject>() {
            @Override
            public void onSuccess(JsonObject result) {
                if (result.has("status") && result.get("status").getAsString().equals("classroom_list")) {
                    List<String> list = new ArrayList<>();
                    if (result.has("classrooms")) {
                        JsonArray arr = result.getAsJsonArray("classrooms");
                        for (JsonElement e : arr) list.add(e.getAsString());
                    }
                    state = State.WAITING_CLASSROOM_SELECTION;
                    if (listener != null) listener.onClassroomList(list);
                } else {
                    // direct success
                    ClassroomDeviceStatus s = parseStatusFromJson(result);
                    updateStorageFromStatus(result);
                    state = State.REGISTERED;
                    if (listener != null) listener.onRegisterSuccess(s);
                }
            }

            @Override
            public void onFailure(int httpCode, String errorBody, Throwable t) {
                storage.setLastHttpError(httpCode);
                storage.setLastServerError(errorBody);
                if (listener != null) listener.onError(errorBody, t);
            }
        });
    }

    public void selectClassroomAndRegister(String classroom) {
        if (state != State.WAITING_CLASSROOM_SELECTION && state != State.IDLE) {
            // allow re-register
        }
        if (localInfo == null) return;
        localInfo.classroom = classroom;
        this.myClassroom = classroom;
        api.postRegister(localInfo, new DeviceApi.ApiCallback<JsonObject>() {
            @Override
            public void onSuccess(JsonObject result) {
                ClassroomDeviceStatus s = parseStatusFromJson(result);
                updateStorageFromStatus(result);
                state = State.REGISTERED;
                if (listener != null) listener.onRegisterSuccess(s);
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

    public void stopHeartbeat() {
        heartbeat.stop();
    }

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
        ClassroomInfo info = parseClassroomInfo(json);
        storage.setMyClassroomInfo(info);
    }

    public ClassroomDeviceStatus getCurrentStatus() {
        ClassroomDeviceStatus s = new ClassroomDeviceStatus();
        ClassroomInfo ci = storage.getMyClassroomInfo();
        if (ci != null) {
            s.teacherCount = ci.teacherCount;
            s.screenCount = ci.screenCount;
            s.teacherIp = ci.getFirstTeacherIp();
            s.screenIp = ci.getFirstScreenIp();
        }
        return s;
    }

    public DeviceInfo getLocalDeviceInfo() { return localInfo; }
}
