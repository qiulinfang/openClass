package com.cosinetech.imates;

import android.os.Bundle;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.lifecycle.ViewModelProvider;
import androidx.lifecycle.ViewModelStoreOwner;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.RadioGroup;
import android.widget.Toast;

import com.cosinetech.imates.model.UserInfoViewModel;
import com.cosinetech.imates.webservice.ApiGateWayService;
import com.cosinetech.imates.webservice.ApiUrl;
import com.cosinetech.imates.webservice.MessageVO;
import com.cosinetech.imates.webservice.Question;

import java.util.ArrayList;
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
    private AdapterExerciseList adapterExerciseList;
    private MessageVO messageVO = new MessageVO("", "", "", "", "", "", "start", "");
    private Question mCurrentQuestion = null;

    private FragmentChatAi fragmentChatAi;

    private final List<Question> mQuestions = new ArrayList<>();


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
        fragmentChatAi = FragmentChatAi.newInstance(chatBotUrl, false);
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

        RecyclerView recyclerView = view.findViewById(R.id.exerciseList);
        recyclerView.setLayoutManager(new LinearLayoutManager(getContext()));
        adapterExerciseList = new AdapterExerciseList(mQuestions, new AdapterExerciseList.ExerciseListChangedListener() {
            @Override
            public void onExerciseDelete(int position) {
                String url;
                Question q = mQuestions.get(position);
                if(subject == EnumSubject.SUBJECT_BIOLOGY) {
                    url = ApiUrl.URL_DELETE_EXERCISE_BASE + "/" + q.id + "/biology";
                } else if(subject == EnumSubject.SUBJECT_MATH) {
                    url = ApiUrl.URL_DELETE_EXERCISE_BASE + "/" + q.id + "/math";
                } else {
                    return;
                }
                ApiGateWayService.deleteExercise(url, userInfoViewModel.token.getValue(), new ApiGateWayService.ExerciseDeleteLister() {
                    @Override
                    public void onDeleteSuccess() {
                        requireActivity().runOnUiThread(() -> {
                            Question q = mQuestions.remove(position);
                            adapterExerciseList.notifyItemRemoved(position);
                        });

                    }

                    @Override
                    public void onDeleteFailed(String msg) {
                    }
                });
            }

            @Override
            public void onExerciseToTop(int position) {
                Question q = mQuestions.remove(position);
                mQuestions.add(0, q);
//                adapterExerciseList.notifyItemRemoved(position);
//                adapterExerciseList.notifyItemInserted(0);
                adapterExerciseList.notifyDataSetChanged();
                recyclerView.smoothScrollToPosition(0);
            }

            @Override
            public void onSelectExerciseChange(int previous, int pos) {
                mCurrentQuestion = mQuestions.get(pos);
                MarkdownTextView answer = view.findViewById(R.id.answerView);
                answer.setContent(mCurrentQuestion.answer + mCurrentQuestion.explanation);

                messageVO.setName(userInfoViewModel.userInfo.getValue().getName());
                messageVO.setNewValue("1");
                messageVO.setSessionId(String.valueOf(System.currentTimeMillis()));
                messageVO.setQuestion(mCurrentQuestion.title);
                messageVO.setAnswer(mCurrentQuestion.DAJX + mCurrentQuestion.explanation);
                messageVO.setCoversation("请开始引导");
                messageVO.setReason("start");
                fragmentChatAi.setChatEnable(false);
            }

            @Override
            public void onBeginGuideToSolveQuestion(int pos) {
                String url;
                requireActivity().runOnUiThread(() -> {
                    fragmentChatAi.sendDirectly(messageVO);
                    fragmentChatAi.setChatEnable(true);
                });
            }
        }) ;

        recyclerView.setAdapter(adapterExerciseList);

        if(!url.isEmpty()) {
            ApiGateWayService.queryExerciseList(url, userInfoViewModel.token.getValue(), new ApiGateWayService.QueryExerciseListCallback() {
                @Override
                public void onSuccess(List<Question> q) {
                    requireActivity().runOnUiThread(() -> {
                        mQuestions.clear();
                        mQuestions.addAll(q);
                        adapterExerciseList.notifyItemInserted(0);
                    });
                }

                @Override
                public void onFailure(String msg, int code) {
                    requireActivity().runOnUiThread(() -> {
                        Toast.makeText(requireContext(), msg, Toast.LENGTH_SHORT).show();
                    });
                }
            });
        }

        RadioGroup radioGroup = view.findViewById(R.id.radioGroup);
        radioGroup.setOnCheckedChangeListener((group, checkedId) -> {
            if(checkedId == R.id.optChatAi) {
                view.findViewById(R.id.similarExerciseView).setVisibility(View.INVISIBLE);
                view.findViewById(R.id.answerView).setVisibility(View.INVISIBLE);
                view.findViewById(R.id.fragmentChatAiContainer).setVisibility(View.VISIBLE);
            } else if(checkedId == R.id.optAnswer) {
                view.findViewById(R.id.similarExerciseView).setVisibility(View.INVISIBLE);
                view.findViewById(R.id.answerView).setVisibility(View.VISIBLE);
                view.findViewById(R.id.fragmentChatAiContainer).setVisibility(View.INVISIBLE);
            } else if(checkedId == R.id.optSimilar) {
                view.findViewById(R.id.similarExerciseView).setVisibility(View.VISIBLE);
                view.findViewById(R.id.answerView).setVisibility(View.INVISIBLE);
                view.findViewById(R.id.fragmentChatAiContainer).setVisibility(View.INVISIBLE);
            }
        });
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
    }

}