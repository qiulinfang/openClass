package com.cosinetech.imates.screencasting;

import android.content.Context;
import android.util.Log;

import androidx.fragment.app.FragmentActivity;

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

    private static FragmentActivity context;
    private static String currentUserId;
    private static String currentUserName;
    private static UdpForwarder udpForwarder;
    private static final String STREAM_ADDRESS = "239.255.100.2";
    private static volatile String pcDeviceIp = "1.1.1.1";
    private static volatile String teacherPadDeviceIp = "1.1.1.1";

    private static volatile String selectedCity;
    private static volatile String selectedSchool;
    private static volatile String selectedClassroom;

    public interface ProjectionStateListener {
        void onProjectionStateChanged(boolean isProjecting);
    }

    private static volatile ProjectionStateListener projectionStateListener;

    public static void setProjectionStateListener(ProjectionStateListener listener) {
        projectionStateListener = listener;
    }

    private static void notifyProjectionStateChanged(boolean isProjecting) {
        ProjectionStateListener listener = projectionStateListener;
        if (listener != null) {
            try {
                listener.onProjectionStateChanged(isProjecting);
            } catch (Exception e) {
                Log.e(TAG, "ProjectionStateListener error", e);
            }
        }
    }

    public static synchronized void startLoop(FragmentActivity ctx, String userId, String userName, UdpForwarder forwarder) {
        context = ctx;

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
                                context, currentUserId, currentUserName);

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
                                udpForwarder.setTarget(pcDeviceIp, udpCommunicator.getTsStreamPort());
                            }
                        });

                        udpCommunicator.setCommandHandler(new ScreenCastingCommunicator.CommandHandler() {
                            @Override
                            public void onStartProjection() {
                                Log.i(TAG, "Received command: StartProjection");
                                bShouldProjection = true;
                                udpForwarder.setForwardingEnabled(true);
                                notifyProjectionStateChanged(true);
                            }

                            @Override
                            public void onStopProjection() {
                                Log.i(TAG, "Received command: StopProjection");
                                bShouldProjection = false;
                                udpForwarder.setForwardingEnabled(false);
                                notifyProjectionStateChanged(false);
                            }

                            @Override
                            public void onTakeSnapshot(String commandId) {
                                Log.i(TAG, "Received command: TakeSnapshot - " + commandId);
                                // 调用截图逻辑（可扩展）
                            }

                            @Override
                            public void onReceivePcIpAddress(String ip) {
                                if(!pcDeviceIp.equals(ip)) {
                                    udpForwarder.setTarget(ip, udpCommunicator.getTsStreamPort());
                                    pcDeviceIp = ip;
                                }
                            }

                            @Override
                            public void onReceiveTeacherPadIpAddress(String ip) {
                                if(!teacherPadDeviceIp.equals(ip)) {
                                    teacherPadDeviceIp = ip;
                                }
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
//            executor = null;
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

    public static void setSelectedClassroomLocation(String city, String school, String classroom) {
        selectedCity = city;
        selectedSchool = school;
        selectedClassroom = classroom;
    }

    public static String getSelectedCity() {
        return selectedCity;
    }

    public static String getSelectedSchool() {
        return selectedSchool;
    }

    public static String getSelectedClassroom() {
        return selectedClassroom;
    }
}

