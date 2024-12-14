package com.cosinetech.imates.fragments;

import android.os.Bundle;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.cardview.widget.CardView;
import androidx.fragment.app.Fragment;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

import com.cosinetech.imates.Subject;
import com.cosinetech.imates.R;
import com.cosinetech.imates.webservice.ApiUrl;

/**
 * A simple {@link Fragment} subclass.
 * Use the {@link FragmentSubjectBiology#newInstance} factory method to
 * create an instance of this fragment.
 */
public class FragmentSubjectBiology extends Fragment {
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
        return inflater.inflate(R.layout.fragment_subject_biology, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        CardView button = view.findViewById(R.id.photo_to_solve);
        button.setOnClickListener(v -> loadCameraFragment());

        CardView btnExercise = view.findViewById(R.id.exercise);
        btnExercise.setOnClickListener(v-> loadExerciseListFragment());
    }

    public void loadCameraFragment() {
        final FragmentCamera childFragment = FragmentCamera.newInstance(Subject.SUBJECT_BIOLOGY);
        getChildFragmentManager().beginTransaction()
                .replace(R.id.container, childFragment)
                .addToBackStack(null)
                .commit();
    }

    public void loadExerciseListFragment() {
        final FragmentExerciseList fragmentExerciseList = FragmentExerciseList.newInstance(ApiUrl.URL_CHAT_BIOLOGY, Subject.SUBJECT_BIOLOGY);
        getChildFragmentManager().beginTransaction()
                .replace(R.id.container, fragmentExerciseList)
                .addToBackStack(null)
                .commit();
    }
}

