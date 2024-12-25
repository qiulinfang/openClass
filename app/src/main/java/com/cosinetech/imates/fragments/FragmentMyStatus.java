package com.cosinetech.imates.fragments;

import android.graphics.Color;
import android.os.Bundle;

import androidx.fragment.app.Fragment;
import androidx.lifecycle.ViewModelProvider;
import androidx.lifecycle.ViewModelStoreOwner;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import com.cosinetech.imates.R;
import com.cosinetech.imates.models.UserInfoViewModel;
import com.jjoe64.graphview.GraphView;
import com.jjoe64.graphview.helper.StaticLabelsFormatter;
import com.jjoe64.graphview.series.BarGraphSeries;
import com.jjoe64.graphview.series.DataPoint;

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
}