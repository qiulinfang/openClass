package com.cosinetech.imates.fragments;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;

import androidx.appcompat.content.res.AppCompatResources;
import androidx.fragment.app.Fragment;
import androidx.lifecycle.ViewModelProvider;
import androidx.lifecycle.ViewModelStoreOwner;

import android.util.Log;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

import com.cosinetech.imates.ApplicationModelShared;
import com.cosinetech.imates.R;
import com.cosinetech.imates.activities.ChatAiActivity;
import com.cosinetech.imates.activities.LoginActivity;
import com.cosinetech.imates.models.ChatAiParam;
import com.cosinetech.imates.models.UserInfo;
import com.cosinetech.imates.models.UserInfoViewModel;
import com.cosinetech.imates.screencasting.FFmpegPipeStreamer;
import com.cosinetech.imates.screencasting.H264IFrameCache;
import com.cosinetech.imates.screencasting.H264MpegTSStreamerManager;
import com.cosinetech.imates.screencasting.ScreenCastingManager;
import com.cosinetech.imates.screencasting.UdpForwarderManager;
import com.cosinetech.imates.util.AppUtils;
import com.cosinetech.imates.views.ChatAiView;
import com.cosinetech.imates.webservice.ApiUrl;
import com.github.dhaval2404.imagepicker.ImagePicker;
import com.jjoe64.graphview.GraphView;
import com.jjoe64.graphview.helper.StaticLabelsFormatter;
import com.jjoe64.graphview.series.BarGraphSeries;
import com.jjoe64.graphview.series.DataPoint;

import org.jetbrains.annotations.NotNull;
import org.loka.screensharekit.EncodeBuilder;
import org.loka.screensharekit.ScreenShareKit;

import java.util.List;
import java.util.UUID;

//import gun0912.tedimagepicker.builder.TedImagePicker;
//import gun0912.tedimagepicker.builder.listener.OnMultiSelectedListener;

/**
 * A simple {@link Fragment} subclass.
 * Use the {@link FragmentMyStatus#newInstance} factory method to
 * create an instance of this fragment.
 */

public class FragmentMyStatus extends Fragment {
    private UserInfoViewModel userInfoViewModel;
    // the fragment initialization parameters, e.g. ARG_ITEM_NUMBER
    private static final String ARG_PARAM1 = "param1";
    private static final String ARG_PARAM2 = "param2";
    private FFmpegPipeStreamer h264ToTsStreamer = null;
    private static final String STREAMING_IP_ADDRESS = "239.255.255.250";

//    private String mParam1;
//    private String mParam2;

    public FragmentMyStatus() {
        // Required empty public constructor
    }
    public static FragmentMyStatus newInstance(String param1, String param2) {
        FragmentMyStatus fragment = new FragmentMyStatus();
        Bundle args = new Bundle();
        args.putString(ARG_PARAM1, param1);
        args.putString(ARG_PARAM2, param2);
        fragment.setArguments(args);
        return fragment;
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
//        if (getArguments() != null) {
//            mParam1 = getArguments().getString(ARG_PARAM1);
//            mParam2 = getArguments().getString(ARG_PARAM2);
//        }
    }

    @Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container,
                             Bundle savedInstanceState) {
        // Inflate the layout for this fragment
        View v=  inflater.inflate(R.layout.fragment_student_status, container, false);
        setupGraph(v);
        TextView textView = v.findViewById(R.id.ai_summarize);
        // Required empty public constructor
        ViewModelStoreOwner owner = (ViewModelStoreOwner) requireActivity().getApplication();
        userInfoViewModel = new ViewModelProvider(
                owner,
                new ViewModelProvider.AndroidViewModelFactory(requireActivity().getApplication())
        ).get(UserInfoViewModel.class);
        String tip = "嘿," + userInfoViewModel.userInfo.getValue().getName() + "同学！ 我是你的智能学习小伙伴，超开心能陪你一起学习、一起嗨皮！ 不管是脑洞大开的问题，还是小菜一碟的疑惑，随时戳我，我立马变身你的专属解题小能手！ 让我们一起快乐学习，天天向上吧！";
        textView.setText(tip);
        ScreenCastingManager.startLoop(getContext(),
                userInfoViewModel.userId.getValue(),
                userInfoViewModel.userInfo.getValue().getName(),
                UdpForwarderManager.getInstance());
        h264ToTsStreamer = H264MpegTSStreamerManager.getInstance();

        Button btnExit = v.findViewById(R.id.btn_exit);
        btnExit.setOnClickListener(v1 -> {
            userInfoViewModel.token.postValue("");
            userInfoViewModel.userId.postValue("");
            userInfoViewModel.userInfo.postValue(new UserInfo());
            Intent intent = new Intent(requireActivity(), LoginActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            startActivity(intent);
            requireActivity().finish();
        });

        Button submitButton = v.findViewById(R.id.submit_homework);
        submitButton.setOnClickListener(v3 -> takePictureToTeacher());

        Button switchButton = v.findViewById(R.id.switch_button);
        if(ScreenCastingManager.isHavingClass()) {
            switchButton.setCompoundDrawablesWithIntrinsicBounds(null, AppCompatResources.getDrawable(getContext(), R.drawable.app_switch_on), null, null);
        } else {
            switchButton.setCompoundDrawablesWithIntrinsicBounds(null, AppCompatResources.getDrawable(getContext(), R.drawable.app_switch_off), null, null);
        }

        switchButton.setOnClickListener(v2 -> {
            switchButton.setEnabled(false);
            if(ScreenCastingManager.isHavingClass()) {
                new AlertDialog.Builder(getContext())
                        .setTitle("提示")
                        .setMessage("退出课堂后将不能和老师互动, 确认退出吗?")
                        .setPositiveButton("确认", (dialog, which) -> {
                            ScreenCastingManager.setClassMode(false);
                            switchButton.setCompoundDrawablesWithIntrinsicBounds(null, AppCompatResources.getDrawable(getContext(), R.drawable.app_switch_off), null, null);
                            ScreenShareKit.INSTANCE.stop();
                            switchButton.postDelayed(() -> switchButton.setEnabled(true), 2000);
                            submitButton.post(() -> submitButton.setVisibility(View.INVISIBLE));
                        })
                        .setNegativeButton("取消", (dialog, which) -> {
                        })
                        .create()
                        .show();
            } else {
                ScreenShareKit.INSTANCE.init(this)
                        .config(1920, 1080, H264MpegTSStreamerManager.ENCODE_FRAME_RATE, 8000000, EncodeBuilder.SCREEN_DATA_TYPE.H264, false, 44100, 2)
                        .onH264((buffer, isKeyFrame, width, height, ts) -> {
                            try {
                                // 编码后的数据
                                byte[] bytes = new byte[buffer.remaining()];
                                buffer.get(bytes);

                                h264ToTsStreamer.onH264DataReceived(bytes, ts);
                                if(isKeyFrame) {
                                    H264IFrameCache.getInstance().onH264Frame(bytes);
                                }
                            } catch (Exception e) {
                                Log.e("ScreenShareKit", "H264 callback error:" + e.getMessage());
                            }
                        })
                        .onError(errorInfo -> Log.e("ScreenShareKitERROR", errorInfo.getMessage()))
                        .onStart(() -> {
                            ScreenCastingManager.setClassMode(true);
                            h264ToTsStreamer.start();
                            switchButton.post(() -> switchButton.setCompoundDrawablesWithIntrinsicBounds(null, AppCompatResources.getDrawable(getContext(), R.drawable.app_switch_on), null, null));
                            submitButton.post(() -> submitButton.setVisibility(View.VISIBLE));
                        }).start();
            }

            switchButton.postDelayed(() -> switchButton.setEnabled(true), 2000);
        });

        return v;
    }

    private void setupGraph(View v) {
        GraphView graph = v.findViewById(R.id.stat_graph);

        // Create data series for each subject
        BarGraphSeries<DataPoint> chineseSeries = new BarGraphSeries<>(new DataPoint[] {
                new DataPoint(0, 0.8),
                new DataPoint(1, 0.8),
                new DataPoint(2, 0.8),
                new DataPoint(3, 0.2),
                new DataPoint(4, 1.0),
                new DataPoint(5, 0.6),
                new DataPoint(6, 0.2)
        });
        chineseSeries.setColor(Color.rgb(255, 182, 193));

        BarGraphSeries<DataPoint> mathSeries = new BarGraphSeries<>(new DataPoint[] {
                new DataPoint(0, 0.7),
                new DataPoint(1, 0.8),
                new DataPoint(2, 0.8),
                new DataPoint(3, 0.2),
                new DataPoint(4, 0.8),
                new DataPoint(5, 0.4),
                new DataPoint(6, 0.3)
        });
        mathSeries.setColor(Color.rgb(173, 216, 230));

        // Add more series for other subjects...

        // Customize the graph
        graph.getGridLabelRenderer().setHorizontalAxisTitle("\n星期");
        graph.getGridLabelRenderer().setVerticalAxisTitle("学习时间(小时)");

        // Set custom X axis labels
        StaticLabelsFormatter labelsFormatter = new StaticLabelsFormatter(graph);
        labelsFormatter.setHorizontalLabels(new String[]{"一", "二", "三", "四", "五", "六", "日"});
        graph.getGridLabelRenderer().setLabelFormatter(labelsFormatter);

        // Add series to graph
        graph.addSeries(chineseSeries);
        graph.addSeries(mathSeries);
        // Add other series...

        // Set Y axis bounds
        graph.getViewport().setMinY(0);
        graph.getViewport().setMaxY(6);
        graph.getViewport().setYAxisBoundsManual(true);

        // Enable scaling
        graph.getViewport().setScalable(true);
    }

    @SuppressLint("CheckResult")
    private void takePictureToTeacher() {
        ImagePicker.with(this)
                //.crop()	    			//Crop image(Optional), Check Customization for more option
                .compress(1024)			//Final image size will be less than 1 MB(Optional)
                .maxResultSize(1920, 1080)	//Final image resolution will be less than 1080 x 1080(Optional)
                .start();
//        TedImagePicker.with(getContext())
//                .startMultiImage(uriList -> {
//                    String paths = "";
//                    for(Uri uri : uriList) {
//                        if(uri != null) {
//                            // 复制图片到外部存储
//                            String filePath = AppUtils.getUserFilePath().getAbsolutePath() + "/" + UUID.randomUUID().toString() + ".png";
//                            boolean success = AppUtils.copyImageToExternalFilesDir(getContext(), uri, filePath);
//                            if (success) {
//                                paths += filePath + ",";
//                            } else {
//                                Log.e("PhotoPicker", "Failed to copy image.");
//                                Toast.makeText(getContext(), "照片读取失败", Toast.LENGTH_SHORT).show();
//                            }
//                        } else {
//                            Toast.makeText(getContext(), "没有选择相片", Toast.LENGTH_SHORT).show();
//                        }
//                    }
//
//                    String finalPaths = paths;
//                    if(!finalPaths.isEmpty()) {
//                        getActivity().runOnUiThread(() -> {
//                            ChatAiParam param = new ChatAiParam();
//                            //param.sessionId = tag;
//                            param.chatBotUrl = ApiUrl.URL_CHAT_GENERAL;
//                            param.showHeader = true;
//                            param.streamDisplay = true;
//                            param.showHistory = true;
//                            param.initialSendEnable = true;
//
//                            Intent intent = new Intent(getContext(), ChatAiActivity.class);
//                            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK); // 启动新任务栈
//                            intent.putExtra(ChatAiActivity.KEY_CHAT_AI_PARAM, param);
//                            intent.putExtra(ChatAiActivity.KEY_SUBMIT_PICTURE_PATH, finalPaths);
//                            startActivity(intent);
//
//                            ApplicationModelShared.getInstance().getFloatingWindowService().hideRobot();
//                        });
//                    }
//                });
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (resultCode == Activity.RESULT_OK) {
            //Image Uri will not be null for RESULT_OK
            Uri uri = data.getData();
            String paths = "";
            if (uri != null) {
                // 复制图片到外部存储
                String filePath = AppUtils.getUserFilePath().getAbsolutePath() + "/" + UUID.randomUUID().toString() + ".png";
                boolean success = AppUtils.copyImageToExternalFilesDir(getContext(), uri, filePath);
                if (success) {
                    paths += filePath + ",";
                } else {
                    Log.e("PhotoPicker", "Failed to copy image.");
                    Toast.makeText(getContext(), "照片读取失败", Toast.LENGTH_SHORT).show();
                }
            } else {
                Toast.makeText(getContext(), "没有选择相片", Toast.LENGTH_SHORT).show();
            }
            String finalPaths = paths;
            if(!finalPaths.isEmpty()) {
                getActivity().runOnUiThread(() -> {
                    ChatAiParam param = new ChatAiParam();
                    //param.sessionId = tag;
                    param.chatBotUrl = ApiUrl.URL_CHAT_GENERAL;
                    param.showHeader = true;
                    param.streamDisplay = true;
                    param.showHistory = true;
                    param.initialSendEnable = true;

                    Intent intent = new Intent(getContext(), ChatAiActivity.class);
                    intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK); // 启动新任务栈
                    intent.putExtra(ChatAiActivity.KEY_CHAT_AI_PARAM, param);
                    intent.putExtra(ChatAiActivity.KEY_SUBMIT_PICTURE_PATH, finalPaths);
                    startActivity(intent);

                    ApplicationModelShared.getInstance().getFloatingWindowService().hideRobot();
                });
            }
        } else if (resultCode == ImagePicker.RESULT_ERROR) {
            Toast.makeText(getContext(), ImagePicker.getError(data), Toast.LENGTH_SHORT).show();
        } else {
            Toast.makeText(getContext(), "Task Cancelled", Toast.LENGTH_SHORT).show();
        }
    }
}