package com.cosinetech.imates;

import android.os.Bundle;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.cardview.widget.CardView;
import androidx.fragment.app.Fragment;
import androidx.lifecycle.ViewModelProvider;

import android.os.Handler;
import android.os.Looper;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

/**
 * A simple {@link Fragment} subclass.
 * Use the {@link FragmentSubjectBiology#newInstance} factory method to
 * create an instance of this fragment.
 */
public class FragmentSubjectBiology extends Fragment implements CaptureQuestionResultListener {

    private CaptureResultViewModel captureResultViewModel;
    private static final String ARG_PARAM1 = "param1";
    private static final String ARG_PARAM2 = "param2";

    // TODO: Rename and change types of parameters
    private String mParam1;
    private String mParam2;

    public FragmentSubjectBiology() {
        // Required empty public constructor
    }

    public static FragmentSubjectBiology newInstance(String param1, String param2) {
        FragmentSubjectBiology fragment = new FragmentSubjectBiology();
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
        return inflater.inflate(R.layout.fragment_subject_biology, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        CardView button = view.findViewById(R.id.photo_to_solve);
        button.setOnClickListener(v -> loadCameraFragment());

        CardView btnExercise = view.findViewById(R.id.exercise);
        btnExercise.setOnClickListener(v-> loadExerciseListFragment());

        captureResultViewModel = new ViewModelProvider(requireActivity()).get(CaptureResultViewModel.class);
        captureResultViewModel.result.observe(getViewLifecycleOwner(), result -> {
            if (result != null) {
                if (result.equals("ACCEPT")) {
                    // 处理 "ACCEPT" 逻辑
                    loadExerciseListFragment();
                } else if (result.equals("REJECT")) {
                    // 处理 "REJECT" 逻辑
                    getChildFragmentManager().popBackStack();
                }
            }
            //new Handler(Looper.getMainLooper()).post(() -> loadExerciseListFragment());
        });

        // 监听 subject 的变化
        captureResultViewModel.subject.observe(getViewLifecycleOwner(), subject -> {
            if (subject != null) {
                // 处理 subject 逻辑
                System.out.println("Subject changed: " + subject);
            }
        });

        // 监听 url 的变化
        captureResultViewModel.url.observe(getViewLifecycleOwner(), url -> {
            if (url != null) {
                // 处理 url 逻辑
                System.out.println("URL changed: " + url);
            }
        });
    }

    public void loadCameraFragment() {
        final FragmentCamera childFragment = FragmentCamera.newInstance(EnumSubject.SUBJECT_BIOLOGY);
        getChildFragmentManager().beginTransaction()
                .replace(R.id.container, childFragment)
                .addToBackStack(null)
                .commit();
    }

    public void loadExerciseListFragment() {
        final FragmentExerciseList fragmentExerciseList = FragmentExerciseList.newInstance(EnumApiUrl.URL_CHAT_BIOLOGY, EnumSubject.SUBJECT_BIOLOGY);
        getChildFragmentManager().beginTransaction()
                .replace(R.id.container, fragmentExerciseList)
                .addToBackStack(null)
                .commit();
    }

    @Override
    public void onCaptureAccepted() {
        loadExerciseListFragment();
    }

    @Override
    public void onCaptureRejected() {
        getChildFragmentManager().popBackStack();
    }
}

