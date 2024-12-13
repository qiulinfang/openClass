package com.cosinetech.imates;

import android.os.Bundle;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

/**
 * A simple {@link Fragment} subclass.
 * Use the {@link FragmentExerciseList#newInstance} factory method to
 * create an instance of this fragment.
 */
public class FragmentExerciseList extends Fragment {
    private static final String KEY_CHATBOT_URL = "KEY_CHAT_BOT_URL";
    private static final String KEY_SUBJECT = "KEY_SUBJECT";
    private String chatBotUrl;
    private EnumSubject subject;

    public FragmentExerciseList() {
        // Required empty public constructor
    }

    public static FragmentExerciseList newInstance(String chatBotUrl, Enum subject) {
        FragmentExerciseList fragment = new FragmentExerciseList();
        Bundle args = new Bundle();
        args.putString(KEY_CHATBOT_URL,  chatBotUrl);
        args.putString(KEY_SUBJECT, subject.name());
        fragment.setArguments(args);
        return fragment;
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (getArguments() != null) {
            chatBotUrl = getArguments().getString(KEY_CHATBOT_URL);
            subject = EnumSubject.valueOf(getArguments().getString(KEY_SUBJECT));
        }
    }

    @Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container,
                             Bundle savedInstanceState) {
        // Inflate the layout for this fragment
        return inflater.inflate(R.layout.fragment_exercise_list, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        FragmentChatAi fragmentChatAi = FragmentChatAi.newInstance(chatBotUrl, false);
        getChildFragmentManager().beginTransaction()
                .replace(R.id.fragmentChatAiContainer, fragmentChatAi)
                .addToBackStack(null) // 添加到回退栈以便用户可以返回
                .commit();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        getChildFragmentManager().popBackStack();
    }
}