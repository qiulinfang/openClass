package com.cosinetech.imates.screencasting;

import android.content.Context;
import android.util.Log;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class ScreenCastingManager {
    private static final String TAG = "ScreenCastingManager";
    private static ExecutorService executor;
    private static boolean started = false;

    private static ScreenCastingCommunicator udpCommunicator;
    private static volatile boolean bCommunicationHasError = false;
    private static volatile boolean bHavingClassMode = false;
    private static volatile boolean bShouldProjection = false;

    private static Context appContext;
    private static String currentUserId;
    private static String currentUserName;
    private static UdpForwarder udpForwarder;

    private static final String STREAM_ADDRESS = "239.255.100.2";

    public static synchronized void startLoop(Context context, String userId, String userName, UdpForwarder forwarder) {
        appContext = context.getApplicationContext();

        if (started) {
            Log.i(TAG, "Loop already started, reinitializing communicator with new params");
            if(!currentUserId.equals(userId)) {
                currentUserId = userId;
                currentUserName = userName;
                resetCommunicator();
            }
            return;
        }

        currentUserId = userId;
        currentUserName = userName;
        udpForwarder = forwarder;

        executor = Executors.newSingleThreadExecutor();
        started = true;

        executor.execute(() -> {
            while (!executor.isShutdown()) {
                try {
                    Thread.sleep(500);

                    if (bCommunicationHasError && udpCommunicator != null) {
                        udpCommunicator.stop();
                        udpCommunicator = null;
                        bCommunicationHasError = false;
                        Log.w(TAG, "udpCommunicator reset due to error");
                    }

                    if (bHavingClassMode && udpCommunicator == null) {
                        udpCommunicator = new ScreenCastingCommunicator(
                                appContext, currentUserId, currentUserName);

                        udpCommunicator.setNetworkStateListener(new ScreenCastingCommunicator.NetworkStateListener() {
                            @Override
                            public void onNetworkError(String errorMessage) {
                                bCommunicationHasError = true;
                                Log.e(TAG, "Network error: " + errorMessage);
                            }

                            @Override
                            public void onJoinGroupSuccess() {
                                Log.i(TAG, "Joined group successfully");
                            }

                            @Override
                            public void onNetworkPrepared() {
                                Log.i(TAG, "Network prepared, setting forward target");
                                udpForwarder.setTarget(STREAM_ADDRESS, udpCommunicator.getTsStreamPort());
                                udpForwarder.setForwardingEnabled(true);
                            }
                        });

                        udpCommunicator.setCommandHandler(new ScreenCastingCommunicator.CommandHandler() {
                            @Override
                            public void onStartProjection() {
                                Log.i(TAG, "Received command: StartProjection");
                                bShouldProjection = true;
                                udpForwarder.setForwardingEnabled(true);
                            }

                            @Override
                            public void onStopProjection() {
                                Log.i(TAG, "Received command: StopProjection");
                                bShouldProjection = false;
                                udpForwarder.setForwardingEnabled(false);
                            }

                            @Override
                            public void onTakeSnapshot(String commandId) {
                                Log.i(TAG, "Received command: TakeSnapshot - " + commandId);
                                // 调用截图逻辑（可扩展）
                            }
                        });

                        udpCommunicator.start();
                    }

                    if (!bHavingClassMode && udpCommunicator != null) {
                        Log.i(TAG, "Class mode off, stopping communicator");
                        udpCommunicator.stop();
                        udpCommunicator = null;
                        bCommunicationHasError = false;
                    }

                } catch (Exception e) {
                    Log.e(TAG, "Exception in loop", e);
                }
            }
        });
    }

    public static synchronized void stopLoop() {
        Log.i(TAG, "Stopping projection control loop");
        if (udpCommunicator != null) {
            udpCommunicator.stop();
            udpCommunicator = null;
        }

        if (executor != null && !executor.isShutdown()) {
            executor.shutdownNow();
            executor = null;
        }

        started = false;
    }

    private static void resetCommunicator() {
        try {
            if (udpCommunicator != null) {
                udpCommunicator.stop();
                udpCommunicator = null;
            }
        }catch (Exception ignore){}
    }

    // 可选设置接口
    public static void setClassMode(boolean enabled) {
        bHavingClassMode = enabled;
    }

    public static boolean isHavingClass() {
        return bHavingClassMode;
    }

    public static boolean isProjecting() {
        return bShouldProjection;
    }
}

