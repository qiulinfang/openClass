package com.cosinetech.imates.screencasting.ui;

import android.app.AlertDialog;
import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import com.cosinetech.imates.screencasting.core.ClassroomManager;
import com.cosinetech.imates.screencasting.model.ClassroomInfo;

import java.util.ArrayList;
import java.util.List;

/**
 * 教室选择Dialog - 原生Android Dialog
 * 提供三级级联选择：城市 -> 学校 -> 教室
 */
public class ClassroomSelectionDialog {
    private final Context context;
    private final ClassroomManager classroomManager;
    private AlertDialog dialog;
    private OnSelectionListener listener;

    private Spinner citySpinner;
    private Spinner schoolSpinner;
    private Spinner classroomSpinner;
    private TextView selectedInfoTextView;
    private Button confirmButton;
    private Button cancelButton;

    private ArrayAdapter<String> cityAdapter;
    private ArrayAdapter<String> schoolAdapter;
    private ArrayAdapter<String> classroomAdapter;

    /**
     * 选择完成监听器
     */
    public interface OnSelectionListener {
        void onSelected(String city, String school, ClassroomInfo classroom);
        void onCancelled();
    }

    /**
     * 构造函数
     */
    public ClassroomSelectionDialog(Context context, ClassroomManager classroomManager) {
        this.context = context;
        this.classroomManager = classroomManager;
    }

    /**
     * 设置选择完成监听器
     */
    public void setOnSelectionListener(OnSelectionListener listener) {
        this.listener = listener;
    }

    /**
     * 显示Dialog
     */
    public void show() {
        // 创建Dialog布局
        LinearLayout rootLayout = new LinearLayout(context);
        rootLayout.setOrientation(LinearLayout.VERTICAL);
        rootLayout.setPadding(20, 20, 20, 20);

        // 城市选择
        LinearLayout cityLayout = createSpinnerLayout("城市:", citySpinner = new Spinner(context));
        rootLayout.addView(cityLayout);

        // 学校选择
        LinearLayout schoolLayout = createSpinnerLayout("学校:", schoolSpinner = new Spinner(context));
        rootLayout.addView(schoolLayout);

        // 教室选择
        LinearLayout classroomLayout = createSpinnerLayout("教室:", classroomSpinner = new Spinner(context));
        rootLayout.addView(classroomLayout);

        // 选择信息展示
        selectedInfoTextView = new TextView(context);
        selectedInfoTextView.setTextSize(12);
        LinearLayout.LayoutParams infoParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        infoParams.topMargin = 16;
        infoParams.bottomMargin = 16;
        selectedInfoTextView.setLayoutParams(infoParams);
        selectedInfoTextView.setText("请选择教室信息");
        rootLayout.addView(selectedInfoTextView);

        // 按钮布局
        LinearLayout buttonLayout = new LinearLayout(context);
        buttonLayout.setOrientation(LinearLayout.HORIZONTAL);
        buttonLayout.setLayoutParams(new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        ));

        confirmButton = new Button(context);
        confirmButton.setText("确认");
        confirmButton.setLayoutParams(new LinearLayout.LayoutParams(
                0,
                LinearLayout.LayoutParams.WRAP_CONTENT,
                1
        ));
        confirmButton.setOnClickListener(v -> onConfirmClicked());

        cancelButton = new Button(context);
        cancelButton.setText("取消");
        cancelButton.setLayoutParams(new LinearLayout.LayoutParams(
                0,
                LinearLayout.LayoutParams.WRAP_CONTENT,
                1
        ));
        cancelButton.setOnClickListener(v -> onCancelClicked());

        LinearLayout.LayoutParams btnParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        btnParams.leftMargin = 8;
        btnParams.rightMargin = 8;

        buttonLayout.addView(confirmButton);
        buttonLayout.addView(cancelButton);
        rootLayout.addView(buttonLayout);

        // 初始化Adapter
        initAdapters();

        // 创建Dialog
        AlertDialog.Builder builder = new AlertDialog.Builder(context);
        builder.setTitle("选择教室");
        builder.setView(rootLayout);
        builder.setCancelable(false);
        dialog = builder.create();

        dialog.show();
    }

    /**
     * 创建Spinner布局
     */
    private LinearLayout createSpinnerLayout(String label, Spinner spinner) {
        LinearLayout layout = new LinearLayout(context);
        layout.setOrientation(LinearLayout.HORIZONTAL);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        params.bottomMargin = 16;
        layout.setLayoutParams(params);

        TextView textView = new TextView(context);
        textView.setText(label);
        textView.setTextSize(14);
        LinearLayout.LayoutParams labelParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        labelParams.rightMargin = 16;
        textView.setLayoutParams(labelParams);
        layout.addView(textView);

        LinearLayout.LayoutParams spinnerParams = new LinearLayout.LayoutParams(
                0,
                LinearLayout.LayoutParams.WRAP_CONTENT,
                1
        );
        spinner.setLayoutParams(spinnerParams);
        layout.addView(spinner);

        return layout;
    }

    /**
     * 初始化Adapter
     */
    private void initAdapters() {
        // 城市Adapter
        List<String> cities = classroomManager.getCities();
        cityAdapter = new ArrayAdapter<>(context, android.R.layout.simple_spinner_item, cities);
        cityAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        citySpinner.setAdapter(cityAdapter);
        citySpinner.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(android.widget.AdapterView<?> parent, View view, int position, long id) {
                String selectedCity = (String) parent.getItemAtPosition(position);
                classroomManager.selectCity(selectedCity);
                updateSchoolSpinner();
                updateClassroomSpinner();
                updateInfoDisplay();
            }

            @Override
            public void onNothingSelected(android.widget.AdapterView<?> parent) {}
        });

        // 学校Adapter
        schoolAdapter = new ArrayAdapter<>(context, android.R.layout.simple_spinner_item, new ArrayList<>());
        schoolAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        schoolSpinner.setAdapter(schoolAdapter);
        schoolSpinner.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(android.widget.AdapterView<?> parent, View view, int position, long id) {
                String selectedSchool = (String) parent.getItemAtPosition(position);
                classroomManager.selectSchool(selectedSchool);
                updateClassroomSpinner();
                updateInfoDisplay();
            }

            @Override
            public void onNothingSelected(android.widget.AdapterView<?> parent) {}
        });

        // 教室Adapter
        classroomAdapter = new ArrayAdapter<>(context, android.R.layout.simple_spinner_item, new ArrayList<>());
        classroomAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        classroomSpinner.setAdapter(classroomAdapter);
        classroomSpinner.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(android.widget.AdapterView<?> parent, View view, int position, long id) {
                List<ClassroomInfo> classrooms = classroomManager.getClassrooms();
                if (position < classrooms.size()) {
                    ClassroomInfo classroom = classrooms.get(position);
                    classroomManager.selectClassroom(classroom.getName());
                    updateInfoDisplay();
                }
            }

            @Override
            public void onNothingSelected(android.widget.AdapterView<?> parent) {}
        });

        // 初始化学校和教室列表
        updateSchoolSpinner();
        updateClassroomSpinner();
    }

    /**
     * 更新学校Spinner
     */
    private void updateSchoolSpinner() {
        schoolSpinner.setAdapter(null);
        List<String> schools = classroomManager.getSchools();
        schoolAdapter.clear();
        schoolAdapter.addAll(schools);
        schoolSpinner.setAdapter(schoolAdapter);
        schoolAdapter.notifyDataSetChanged();
    }

    /**
     * 更新教室Spinner
     */
    private void updateClassroomSpinner() {
        classroomSpinner.setAdapter(null);
        List<ClassroomInfo> classrooms = classroomManager.getClassrooms();
        List<String> classroomNames = new ArrayList<>();
        for (ClassroomInfo classroom : classrooms) {
            classroomNames.add(classroom.getName());
        }
        classroomAdapter.clear();
        classroomAdapter.addAll(classroomNames);
        classroomSpinner.setAdapter(classroomAdapter);
        classroomAdapter.notifyDataSetChanged();
    }

    /**
     * 更新信息显示
     */
    private void updateInfoDisplay() {
        String city = classroomManager.getSelectedCity();
        String school = classroomManager.getSelectedSchool();
        ClassroomInfo classroom = classroomManager.getSelectedClassroom();

        if (city != null && school != null && classroom != null) {
            String info = city + " / " + school + " / " + classroom.getName();
            selectedInfoTextView.setText("已选择: " + info);
        } else {
            selectedInfoTextView.setText("请选择教室信息");
        }
    }

    /**
     * 确认按钮点击
     */
    private void onConfirmClicked() {
        if (!classroomManager.isLocationSelected()) {
            Toast.makeText(context, "请完整选择城市、学校和教室", Toast.LENGTH_SHORT).show();
            return;
        }

        if (listener != null) {
            listener.onSelected(
                    classroomManager.getSelectedCity(),
                    classroomManager.getSelectedSchool(),
                    classroomManager.getSelectedClassroom()
            );
        }

        dismiss();
    }

    /**
     * 取消按钮点击
     */
    private void onCancelClicked() {
        if (listener != null) {
            listener.onCancelled();
        }
        dismiss();
    }

    /**
     * 关闭Dialog
     */
    public void dismiss() {
        if (dialog != null && dialog.isShowing()) {
            dialog.dismiss();
        }
    }

    /**
     * Dialog是否显示中
     */
    public boolean isShowing() {
        return dialog != null && dialog.isShowing();
    }
}
