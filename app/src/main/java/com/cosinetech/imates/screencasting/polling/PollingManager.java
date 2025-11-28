package com.cosinetech.imates.screencasting.polling;

import com.cosinetech.imates.screencasting.base.DeviceApi;
import com.cosinetech.imates.screencasting.base.CommonStateStorage;
import com.google.gson.JsonObject;

import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

public class PollingManager {
    private final DeviceApi api;
    private final CommonStateStorage storage;
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
    private ScheduledFuture<?> future;
    private String city, school, classroom;
    private long intervalSeconds = 5;

    public interface PollingListener {
        void onPolled(JsonObject resp);
        void onPollError(int code, String body, Throwable t);
    }

    private PollingListener listener;

    public PollingManager(DeviceApi api, CommonStateStorage storage) {
        this.api = api;
        this.storage = storage;
    }

    public void setListener(PollingListener l) { this.listener = l; }

    public void start(String city, String school, String classroom, long intervalSeconds) {
        stop();
        this.city = city;
        this.school = school;
        this.classroom = classroom;
        this.intervalSeconds = intervalSeconds;
        future = scheduler.scheduleWithFixedDelay(() -> api.getClassroom(city, school, classroom,
                new DeviceApi.ApiCallback<JsonObject>() {
            @Override
            public void onSuccess(JsonObject result) {
                if (listener != null) listener.onPolled(result);
            }

            @Override
            public void onFailure(int httpCode, String errorBody, Throwable t) {
                storage.setLastHttpError(httpCode);
                storage.setLastServerError(errorBody);
                if (listener != null) listener.onPollError(httpCode, errorBody, t);
            }
        }), 0, intervalSeconds, TimeUnit.SECONDS);
    }

    public void stop() {
        if (future != null && !future.isCancelled()) {
            future.cancel(true);
            future = null;
        }
    }
}