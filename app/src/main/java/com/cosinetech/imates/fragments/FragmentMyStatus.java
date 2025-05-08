package com.cosinetech.imates.fragments;

import android.content.Intent;
import android.graphics.Color;
import android.media.MediaCodecInfo;
import android.media.MediaCodecList;
import android.os.Bundle;

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

import com.cosinetech.imates.R;
import com.cosinetech.imates.activities.LoginActivity;
import com.cosinetech.imates.models.UserInfo;
import com.cosinetech.imates.models.UserInfoViewModel;
import com.cosinetech.imates.screencasting.FFmpegPipeStreamer;
import com.cosinetech.imates.screencasting.ScreenCastingCommunicator;
import com.cosinetech.imates.screencasting.UdpForwarder;
import com.jjoe64.graphview.GraphView;
import com.jjoe64.graphview.helper.StaticLabelsFormatter;
import com.jjoe64.graphview.series.BarGraphSeries;
import com.jjoe64.graphview.series.DataPoint;

import org.loka.screensharekit.EncodeBuilder;
import org.loka.screensharekit.ScreenShareKit;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

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
    private ScreenCastingCommunicator  udpCommunicator;
    private boolean bHavingClassMode = false;
    private boolean bShouldProjection = true;

    private FFmpegPipeStreamer h264ToTsStreamer = null;
    private UdpForwarder udpForwarder = null;
    private static final String STREAMING_IP_ADDRESS = "239.255.255.250";
    private static final int STREAMING_LOCAL_PORT = 20250;
    private static final int ENCODE_FRAME_RATE = 60;

    private final ExecutorService executor = Executors.newFixedThreadPool(1);

    private String mParam1;
    private String mParam2;

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
        if (getArguments() != null) {
            mParam1 = getArguments().getString(ARG_PARAM1);
            mParam2 = getArguments().getString(ARG_PARAM2);
        }
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
        udpForwarder = new UdpForwarder(STREAMING_LOCAL_PORT);
        udpForwarder.start();

        h264ToTsStreamer = new FFmpegPipeStreamer("127.0.0.1",
                STREAMING_LOCAL_PORT,
                ENCODE_FRAME_RATE
                , null);

        Button switchButton = v.findViewById(R.id.switch_button);
        switchButton.setOnClickListener(v2 -> {
            switchButton.setEnabled(false);
            if(bHavingClassMode) {
                bHavingClassMode = false;
                switchButton.setCompoundDrawablesWithIntrinsicBounds(null, getContext().getDrawable(R.drawable.app_switch_off), null, null);
                ScreenShareKit.INSTANCE.stop();
                switchButton.postDelayed(() -> {
                    switchButton.setEnabled(true);
                }, 2000);
            } else {
                ScreenShareKit.INSTANCE.init(this)
                        .config(1920, 1080, ENCODE_FRAME_RATE, 8000000, EncodeBuilder.SCREEN_DATA_TYPE.H264, false, 44100, 2)
                        .onH264((buffer, isKeyFrame, width, height, ts) -> {
                            try {
                                // 编码后的数据
                                byte[] bytes = new byte[buffer.remaining()];
                                buffer.get(bytes);

                                h264ToTsStreamer.onH264DataReceived(bytes, ts);
                            } catch (Exception e) {
                                Log.e("ScreenShareKit", "H264 callback error:" + e.getMessage());
                            }
                        })
                        .onError(errorInfo -> {
                            Log.e("ScreenShareKitERROR", errorInfo.getMessage());
                        })
                        .onStart(() -> {
                            bHavingClassMode = true;
                            h264ToTsStreamer.start();
                            switchButton.post(() -> {
                                switchButton.setCompoundDrawablesWithIntrinsicBounds(null, getContext().getDrawable(R.drawable.app_switch_on), null, null);
                            });
                        }).start();
            }

            switchButton.postDelayed(() -> {
                switchButton.setEnabled(true);
            }, 2000);
        });

        executor.execute(() -> {
            final boolean[] bCommunicationHasError = {false};
            while(!executor.isShutdown()) {
                try {
                    Thread.sleep(500);
                    if (bCommunicationHasError[0] && udpCommunicator != null) {
                        udpCommunicator.stop();
                        udpCommunicator = null;
                        bCommunicationHasError[0] = false;
                    }

                    if (bHavingClassMode && udpCommunicator == null) {
                        udpCommunicator = new ScreenCastingCommunicator(
                                getContext(),
                                userInfoViewModel.userId.getValue(),
                                userInfoViewModel.userInfo.getValue().getName());

                        // 设置网络状态监听器
                        udpCommunicator.setNetworkStateListener(new ScreenCastingCommunicator.NetworkStateListener() {
                            @Override
                            public void onNetworkError(String errorMessage) {
                                bCommunicationHasError[0] = true;
                                getActivity().runOnUiThread(() -> Toast.makeText(
                                        getContext(),
                                        "网络错误: " + errorMessage,
                                        Toast.LENGTH_LONG).show());
                            }

                            @Override
                            public void onJoinGroupSuccess() {
                            }

                            @Override
                            public void onNetworkPrepared() {
                                udpForwarder.setTarget("192.168.31.206", udpCommunicator.getTsStreamPort());
                                udpForwarder.setForwardingEnabled(true);
                            }
                        });

                        // 设置命令处理器
                        udpCommunicator.setCommandHandler(new ScreenCastingCommunicator.CommandHandler() {
                            @Override
                            public void onStartProjection() {
                                getActivity().runOnUiThread(() -> {
                                    Toast.makeText(getContext(), "开始投屏", Toast.LENGTH_SHORT).show();
                                    bShouldProjection = true;
                                    udpForwarder.setForwardingEnabled(true);
                                });
                            }

                            @Override
                            public void onStopProjection() {
                                getActivity().runOnUiThread(() -> {
                                    Toast.makeText(getContext(), "停止投屏", Toast.LENGTH_SHORT).show();
                                    bShouldProjection = false;
                                    udpForwarder.setForwardingEnabled(false);
                                });
                            }

                            @Override
                            public void onTakeSnapshot(String commandId) {
                                getActivity().runOnUiThread(() -> {
                                    Toast.makeText(getContext(), "收到截图命令", Toast.LENGTH_SHORT).show();
                                    // 调用截图逻辑
                                    //takeScreenSnapshot(commandId);
                                });
                            }
                        });

                        // 启动通信
                        udpCommunicator.start();
                    }

                    if (!bHavingClassMode && udpCommunicator != null) {
                        udpCommunicator.stop();
                        udpCommunicator = null;
                        bCommunicationHasError[0] = false;
                    }
                } catch (Exception e) {
                }
            }
        });
        return v;
    }

    private MediaCodecInfo findEncoderForMimeType(String mimeType) {
        int codecCount = MediaCodecList.getCodecCount();
        for (int i = 0; i < codecCount; i++) {
            MediaCodecInfo codecInfo = MediaCodecList.getCodecInfoAt(i);
            if (!codecInfo.isEncoder()) {
                continue;
            }

            String[] types = codecInfo.getSupportedTypes();
            for (String type : types) {
                if (type.equalsIgnoreCase(mimeType)) {
                    return codecInfo;
                }
            }
        }
        return null;
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
}