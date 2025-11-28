package com.cosinetech.imates.screencasting.heartbeat;

import com.cosinetech.imates.screencasting.base.DeviceApi;
import com.cosinetech.imates.screencasting.model.DeviceInfo;
import com.cosinetech.imates.screencasting.base.CommonStateStorage;
import com.google.gson.JsonObject;

import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

/**
 * Heartbeat Manager posts device info periodically using DeviceApi.postHeartbeat.
 */
public class HeartbeatManager {
    private static final String TAG = "HeartbeatManager";
    private final DeviceApi api;
    private final CommonStateStorage storage;
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
    private ScheduledFuture<?> future;
    private DeviceInfo deviceInfo;
    private long intervalSeconds = 10;

    public interface HeartbeatListener {
        void onHeartbeatSuccess(JsonObject resp);
        void onHeartbeatFailure(int httpCode, String body, Throwable t);
    }

    private HeartbeatListener listener;

    public HeartbeatManager(DeviceApi api, CommonStateStorage storage) {
        this.api = api;
        this.storage = storage;
    }

    public void setListener(HeartbeatListener l) { this.listener = l; }

    public void start(DeviceInfo info) {
        start(info, 10);
    }

    public void start(DeviceInfo info, long intervalSeconds) {
        stop();
        this.deviceInfo = info;
        this.intervalSeconds = intervalSeconds;
        future = scheduler.scheduleAtFixedRate(new Runnable() {
            @Override
            public void run() {
                api.postHeartbeat(deviceInfo, new DeviceApi.ApiCallback<JsonObject>() {
                    @Override
                    public void onSuccess(JsonObject result) {
                        // update storage: parse classroom if present
                        try {
                            // Base parsing is left to caller; here we just notify
                            if (listener != null) listener.onHeartbeatSuccess(result);
                        } catch (Exception e) { }
                    }

                    @Override
                    public void onFailure(int httpCode, String errorBody, Throwable t) {
                        storage.setLastHttpError(httpCode);
                        storage.setLastServerError(errorBody);
                        if (listener != null) listener.onHeartbeatFailure(httpCode, errorBody, t);
                    }
                });
            }
        }, 0, intervalSeconds, TimeUnit.SECONDS);
    }

    public void stop() {
        if (future != null && !future.isCancelled()) {
            future.cancel(true);
            future = null;
        }
    }
}