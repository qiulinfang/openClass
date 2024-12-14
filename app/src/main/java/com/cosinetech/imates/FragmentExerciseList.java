package com.cosinetech.imates;

import android.os.Bundle;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.lifecycle.ViewModelProvider;
import androidx.lifecycle.ViewModelStoreOwner;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

import com.cosinetech.imates.model.UserInfoViewModel;
import com.cosinetech.imates.webservice.ApiGateWayService;
import com.cosinetech.imates.webservice.ApiUrl;
import com.cosinetech.imates.webservice.Question;

import java.util.List;

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
    private UserInfoViewModel userInfoViewModel;


    public FragmentExerciseList() {
        // Required empty public constructor
    }

    public static FragmentExerciseList newInstance(String chatBotUrl, EnumSubject subject) {
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
        return inflater.inflate(R.layout.fragment_exercise_list, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        FragmentChatAi fragmentChatAi = FragmentChatAi.newInstance(chatBotUrl, false);
        fragmentChatAi.setAiName("AI解题助手");
        getChildFragmentManager().beginTransaction()
                .replace(R.id.fragmentChatAiContainer, fragmentChatAi)
                .addToBackStack(null) // 添加到回退栈以便用户可以返回
                .commit();
        view.findViewById(R.id.back_exit).setOnClickListener(v->{
            getChildFragmentManager().popBackStack();
            getParentFragmentManager().popBackStack();
        });

        view.findViewById(R.id.btnCapture).setOnClickListener(v-> {
            getParentFragmentManager().popBackStack();
            final FragmentCamera fragment = FragmentCamera.newInstance(subject);
            getParentFragmentManager().beginTransaction()
                    .addToBackStack(null)
                    .replace(R.id.container, fragment)
                    .commit();
        });

        ViewModelStoreOwner owner = (ViewModelStoreOwner) requireActivity().getApplication();
        userInfoViewModel = new ViewModelProvider(
                owner,
                new ViewModelProvider.AndroidViewModelFactory(requireActivity().getApplication())
        ).get(com.cosinetech.imates.model.UserInfoViewModel.class);

        String url;
        if(subject == EnumSubject.SUBJECT_BIOLOGY) {
            url = ApiUrl.URL_GET_EXERCISE_BIOLOGY;
        } else if (subject == EnumSubject.SUBJECT_MATH) {
            url = ApiUrl.URL_GET_EXERCISE_MATH;
        } else {
            url = "";
        }

        if(!url.isEmpty()) {
            ApiGateWayService.queryExerciseList(url, userInfoViewModel.token.getValue(), new ApiGateWayService.QueryExerciseListCallback() {
                @Override
                public void onSuccess(List<Question> questions) {

                }

                @Override
                public void onFailure(String msg, int code) {

                }
            });
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
    }

}