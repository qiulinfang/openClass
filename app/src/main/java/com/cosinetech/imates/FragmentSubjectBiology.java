package com.cosinetech.imates;

import android.os.Bundle;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.cardview.widget.CardView;
import androidx.fragment.app.Fragment;
import androidx.lifecycle.ViewModelProvider;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Toast;

/**
 * A simple {@link Fragment} subclass.
 * Use the {@link FragmentSubjectBiology#newInstance} factory method to
 * create an instance of this fragment.
 */
public class FragmentSubjectBiology extends Fragment {
    private SharedViewModel viewModel;

    // the fragment initialization parameters, e.g. ARG_ITEM_NUMBER
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

        viewModel = new ViewModelProvider(requireActivity()).get(SharedViewModel.class);

        CardView button = view.findViewById(R.id.photo_to_solve);
        button.setOnClickListener(v -> loadChildFragment());

        // 监听来自ChildFragment的消息
        viewModel.getSharedObject().observe(getViewLifecycleOwner(), object -> {
            if (object != null) {
                // 处理从子Fragment传来的对象
                Toast.makeText(getContext(), "Received object from ChildFragment", Toast.LENGTH_SHORT).show();
                // 销毁ParentFragment
//                getParentFragmentManager().beginTransaction()
//                        .remove(this)
//                        .commit();
            }
        });
    }

    private void loadChildFragment() {
        FragmentCamera childFragment = new FragmentCamera();
        getChildFragmentManager().beginTransaction()
                .replace(R.id.camera_container, childFragment)
                .addToBackStack(null) // 添加到回退栈以便用户可以返回
                .commit();
    }
}