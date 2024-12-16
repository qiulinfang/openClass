package com.cosinetech.imates.fragments;

import android.os.Bundle;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import com.cosinetech.imates.R;

/**
 * A simple {@link Fragment} subclass.
 * Use the {@link FragmentPreviewLesson#newInstance} factory method to
 * create an instance of this fragment.
 */
public class FragmentPreviewLesson extends Fragment {

    // TODO: Rename parameter arguments, choose names that match
    // the fragment initialization parameters, e.g. ARG_ITEM_NUMBER
    private static final String KEY_PREVIEW_SECTION_NAME = "PREVIEW_SECTION_NAME";
    private static final String ARG_PARAM2 = "param2";

    // TODO: Rename and change types of parameters
    private String mPreviewSectionName;
    private String mParam2;

    public FragmentPreviewLesson() {
        // Required empty public constructor
    }

    /**
     * Use this factory method to create a new instance of
     * this fragment using the provided parameters.
     *
     * @param param1 Parameter 1.
     * @param param2 Parameter 2.
     * @return A new instance of fragment FragmentPreviewLesson.
     */
    // TODO: Rename and change types and number of parameters
    public static FragmentPreviewLesson newInstance(String param1, String param2) {
        FragmentPreviewLesson fragment = new FragmentPreviewLesson();
        Bundle args = new Bundle();
        args.putString(KEY_PREVIEW_SECTION_NAME, param1);
        args.putString(ARG_PARAM2, param2);
        fragment.setArguments(args);
        return fragment;
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (getArguments() != null) {
            mPreviewSectionName = getArguments().getString(KEY_PREVIEW_SECTION_NAME);
            mParam2 = getArguments().getString(ARG_PARAM2);
        }
    }

    @Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container,
                             Bundle savedInstanceState) {
        // Inflate the layout for this fragment
        return inflater.inflate(R.layout.fragment_preview_lession, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        TextView textPreview = view.findViewById(R.id.label);
        textPreview.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                getParentFragmentManager().popBackStack();
            }
        });

        TextView textPreviewSectionName = view.findViewById(R.id.preview_section_name);
        textPreviewSectionName.setText(mPreviewSectionName);
    }
}