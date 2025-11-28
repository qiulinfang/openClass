package com.cosinetech.imates.screencasting.base;

import android.content.Context;

import com.cosinetech.imates.screencasting.model.ClassroomInfo;
import com.cosinetech.imates.screencasting.model.ServerStatus;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.Gson;
import com.cosinetech.imates.screencasting.model.DeviceInfo;

public abstract class BaseClient {
    protected final Context context;
    protected final String serverUrl;
    protected final DeviceApi api;
    protected final CommonStateStorage storage;
    protected final Gson gson = new Gson();

    protected String myCity;
    protected String mySchool;
    protected String myClassroom;

    public BaseClient(Context context, String serverUrl) {
        this.context = context.getApplicationContext();
        this.serverUrl = serverUrl;
        this.api = new DeviceApi(serverUrl);
        this.storage = new CommonStateStorage();
    }

    // Query the server for my classroom and update storage
    public void queryMyClassroomInfo() {
        if (myCity == null || mySchool == null || myClassroom == null) return;
        api.getClassroom(myCity, mySchool, myClassroom, new DeviceApi.ApiCallback<JsonObject>() {
            @Override
            public void onSuccess(JsonObject result) {
                ClassroomInfo info = parseClassroomInfo(result);
                storage.setMyClassroomInfo(info);
            }

            @Override
            public void onFailure(int httpCode, String errorBody, Throwable t) {
                storage.setLastHttpError(httpCode);
                storage.setLastServerError(errorBody);
            }
        });
    }

    public ClassroomInfo getMyClassroomInfo() {
        return storage.getMyClassroomInfo();
    }

    public void queryServerStatus() {
        api.getStatus(new DeviceApi.ApiCallback<JsonObject>() {
            @Override
            public void onSuccess(JsonObject result) {
                ServerStatus s = parseServerStatus(result);
                storage.setServerStatus(s);
            }

            @Override
            public void onFailure(int httpCode, String errorBody, Throwable t) {
                storage.setLastHttpError(httpCode);
                storage.setLastServerError(errorBody);
            }
        });
    }

    public ServerStatus getServerStatus() {
        return storage.getServerStatus();
    }

    public String getLastServerError() { return storage.getLastServerError(); }
    public int getLastHttpError() { return storage.getLastHttpError(); }

    protected ClassroomInfo parseClassroomInfo(JsonObject obj) {
        ClassroomInfo info = new ClassroomInfo();
        // Server's classroom response contains 'classroom' object with teachers/screens
        try {
            if (obj.has("classroom")) {
                JsonObject classroom = obj.getAsJsonObject("classroom");
                if (classroom.has("teachers")) {
                    JsonArray arr = classroom.getAsJsonArray("teachers");
                    for (JsonElement e : arr) {
                        JsonObject d = e.getAsJsonObject();
                        DeviceInfo di = new DeviceInfo();
                        di.ip = d.has("ip") ? d.get("ip").getAsString() : null;
                        di.name = d.has("name") ? d.get("name").getAsString() : null;
                        // lastActive could be numeric
                        info.teachers.add(di);
                    }
                }
                if (classroom.has("screens")) {
                    JsonArray arr = classroom.getAsJsonArray("screens");
                    for (JsonElement e : arr) {
                        JsonObject d = e.getAsJsonObject();
                        DeviceInfo di = new DeviceInfo();
                        di.ip = d.has("ip") ? d.get("ip").getAsString() : null;
                        di.name = d.has("name") ? d.get("name").getAsString() : null;
                        info.screens.add(di);
                    }
                }
                info.teacherCount = classroom.has("teacher_count") ? classroom.get("teacher_count").getAsInt() : info.teachers.size();
                info.screenCount = classroom.has("screen_count") ? classroom.get("screen_count").getAsInt() : info.screens.size();
            }
        } catch (Exception ex) {
            // ignore, return partial
        }
        return info;
    }

    protected ServerStatus parseServerStatus(JsonObject obj) {
        ServerStatus s = new ServerStatus();
        try {
            if (obj.has("total_devices")) s.totalDevices = obj.get("total_devices").getAsInt();
            if (obj.has("group_count")) s.groupCount = obj.get("group_count").getAsInt();
            if (obj.has("groups")) {
                JsonArray arr = obj.getAsJsonArray("groups");
                for (JsonElement e : arr) {
                    s.groupDescriptions.add(e.getAsString());
                }
            }
        } catch (Exception ex) {
            // ignore
        }
        return s;
    }
}
