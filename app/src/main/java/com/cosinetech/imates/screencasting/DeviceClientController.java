package com.cosinetech.imates.screencasting;

import android.app.AlertDialog;
import android.content.Context;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.ListView;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.LinearLayout;

import com.cosinetech.imates.screencasting.listener.StudentListener;
import com.cosinetech.imates.screencasting.listener.TeacherListener;
import com.cosinetech.imates.screencasting.model.ClassroomDeviceStatus;
import com.cosinetech.imates.screencasting.model.ClassroomInfo;
import com.cosinetech.imates.screencasting.student.StudentClient;
import com.cosinetech.imates.screencasting.teacher.TeacherClient;

import java.util.ArrayList;
import java.util.List;

/**
 * DeviceClientController
 * 封装 TeacherClient / StudentClient 的完整启动流程
 * 无需修改原有 Client 任何代码
 */
public class DeviceClientController {

    public interface ClientReadyListener {
        void onReady(ClassroomInfo info);
        void onError(String msg);
    }

    private final Context context;
    private final String serverUrl;
    private final String city;
    private final String school;

    private TeacherClient teacherClient;
    private StudentClient studentClient;

    public DeviceClientController(Context ctx, String server, String city, String school) {
        this.context = ctx;
        this.serverUrl = server;
        this.city = city;
        this.school = school;
    }

    // ---------------------- TEACHER ----------------------
    public void startTeacher(ClientReadyListener listener) {
        teacherClient = new TeacherClient(context, serverUrl);

        teacherClient.setListener(new TeacherListener() {
            @Override
            public void onClassroomList(List<String> list) {
                // handled by controller
            }

            @Override
            public void onRegisterSuccess(ClassroomDeviceStatus status) {

            }

            @Override
            public void onHeartbeatUpdate(ClassroomDeviceStatus status) {

            }

            @Override
            public void onError(String msg, Throwable t) {
                listener.onError(msg);
            }
        });

        showClassroomDialog(city, school, selected -> {
//            teacherClient.myCity = city;
//            teacherClient.mySchool = school;
//            teacherClient.myClassroom = selected;
            teacherClient.getLocalDeviceInfo().classroom = selected;
            teacherClient.initialRegister(teacherClient.getLocalDeviceInfo());
            teacherClient.startHeartbeat();
        });
    }

    // ---------------------- STUDENT ----------------------
    public void startStudent(ClientReadyListener listener) {
        studentClient = new StudentClient(context, serverUrl);

        studentClient.setListener(new StudentListener() {
            @Override
            public void onClassroomList(List<String> list) {
                // handled by controller
            }

            @Override
            public void onClassroomInfoUpdated(ClassroomInfo info) {
                listener.onReady(info);
            }

            @Override
            public void onPollingError(String msg) {
                listener.onError(msg);
            }

            @Override
            public void onError(String msg, Throwable t) {
                listener.onError(msg);
            }
        });

        showClassroomDialog(city, school, selected -> {
            studentClient.init(city, school);
            studentClient.selectClassroom(selected);
            studentClient.startPolling(5);
        });
    }

    // ---------------------- UI Dialog ----------------------
    private interface ClassroomSelectCallback {
        void onSelected(String classroom);
    }

    private void showClassroomDialog(String city, String school, ClassroomSelectCallback callback) {
        AlertDialog.Builder builder = new AlertDialog.Builder(context);
        builder.setTitle("请选择教室");

        LinearLayout layout = new LinearLayout(context);
        layout.setOrientation(LinearLayout.VERTICAL);

        ProgressBar progress = new ProgressBar(context);
        TextView statusText = new TextView(context);
        ListView listView = new ListView(context);

        layout.addView(progress);
        layout.addView(statusText);
        layout.addView(listView);

        builder.setView(layout);
        AlertDialog dialog = builder.create();
        dialog.show();

        statusText.setText("正在加载...");
        progress.setVisibility(View.VISIBLE);

        // 临时 StudentClient 用于获取列表
        StudentClient temp = new StudentClient(context, serverUrl);
        temp.init(city, school);
        temp.setListener(new StudentListener() {
            @Override
            public void onClassroomList(List<String> list) {
                progress.setVisibility(View.GONE);
                statusText.setText("请选择教室");

                ArrayAdapter<String> adapter = new ArrayAdapter<>(context,
                        android.R.layout.simple_list_item_1, list);
                listView.setAdapter(adapter);

                listView.setOnItemClickListener((parent, view, position, id) -> {
                    String selected = list.get(position);
                    dialog.dismiss();
                    callback.onSelected(selected);
                });
            }

            @Override
            public void onClassroomInfoUpdated(ClassroomInfo info) { }

            @Override
            public void onPollingError(String msg) {
                statusText.setText("获取失败: " + msg);
            }

            @Override
            public void onError(String msg, Throwable t) {
                statusText.setText("错误: " + msg);
            }
        });

        temp.getClassroomList();
    }
}

