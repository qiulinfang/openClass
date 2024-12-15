package com.cosinetech.imates.fragments;

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

import com.cosinetech.imates.adapters.AdapterQuestionList;
import com.cosinetech.imates.adapters.AdapterSimilarQuestionList;
import com.cosinetech.imates.Subject;
import com.cosinetech.imates.models.AddQuestionRequest;
import com.cosinetech.imates.widgets.MarkdownTextView;
import com.cosinetech.imates.R;
import com.cosinetech.imates.models.FindSimilarQuestionRequest;
import com.cosinetech.imates.models.UserInfoViewModel;
import com.cosinetech.imates.webservice.ApiGateWayService;
import com.cosinetech.imates.webservice.ApiUrl;
import com.cosinetech.imates.webservice.AiChatMessageRequest;
import com.cosinetech.imates.webservice.Question;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * A simple {@link Fragment} subclass.
 * Use the {@link FragmentQuestionList#newInstance} factory method to
 * create an instance of this fragment.
 */
public class FragmentQuestionList extends Fragment {
    private static final String KEY_CHATBOT_URL = "KEY_CHAT_BOT_URL";
    private static final String KEY_SUBJECT = "KEY_SUBJECT";
    private String chatBotUrl;
    private Subject subject;
    private UserInfoViewModel userInfoViewModel;
    private AdapterQuestionList adapterQuestionList;
    private AdapterSimilarQuestionList adapterSimilarQuestionList;
    private final AiChatMessageRequest aiChatMessageRequest = new AiChatMessageRequest("", "", "", "", "", "", "start");
    private Question mCurrentQuestion = null;

    private FragmentChatAi fragmentChatAi;

    private final List<Question> mQuestions = new ArrayList<>();

    private final List<Question> mSimilarQuestion = new ArrayList<>();


    public FragmentQuestionList() {
        // Required empty public constructor
    }

    public static FragmentQuestionList newInstance(String chatBotUrl, Subject subject) {
        FragmentQuestionList fragment = new FragmentQuestionList();
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
            subject = Subject.valueOf(getArguments().getString(KEY_SUBJECT));
        }
    }

    @Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container,
                             Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_question_list, container, false);
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
        view.findViewById(R.id.btn_exit).setOnClickListener(v->{
            getChildFragmentManager().popBackStack();
            getParentFragmentManager().popBackStack();
        });

        view.findViewById(R.id.btn_capture).setOnClickListener(v-> {
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
        ).get(com.cosinetech.imates.models.UserInfoViewModel.class);

        String url;
        if(subject == Subject.SUBJECT_BIOLOGY) {
            url = ApiUrl.URL_GET_EXERCISE_BIOLOGY;
        } else if (subject == Subject.SUBJECT_MATH) {
            url = ApiUrl.URL_GET_EXERCISE_MATH;
        } else {
            url = "";
        }

        RecyclerView recyclerView = view.findViewById(R.id.exerciseList);
        recyclerView.setLayoutManager(new LinearLayoutManager(getContext()));
        adapterQuestionList = new AdapterQuestionList(mQuestions, new AdapterQuestionList.ExerciseListChangedListener() {
            @Override
            public void onExerciseDelete(int position) {
                String url;
                Question q = mQuestions.get(position);
                if(subject == Subject.SUBJECT_BIOLOGY) {
                    url = ApiUrl.URL_DELETE_EXERCISE_BASE + "/" + q.id + "/biology";
                } else if(subject == Subject.SUBJECT_MATH) {
                    url = ApiUrl.URL_DELETE_EXERCISE_BASE + "/" + q.id + "/math";
                } else {
                    return;
                }
                ApiGateWayService.deleteExercise(url, userInfoViewModel.token.getValue(), new ApiGateWayService.ExerciseDeleteLister() {
                    @Override
                    public void onDeleteSuccess() {
                        requireActivity().runOnUiThread(() -> {
                            Question q = mQuestions.remove(position);
                            adapterQuestionList.notifyItemRemoved(position);
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
//                adapterQuestionList.notifyItemRemoved(position);
//                adapterQuestionList.notifyItemInserted(0);
                adapterQuestionList.notifyDataSetChanged();
                recyclerView.smoothScrollToPosition(0);
            }

            @Override
            public void onSelectExerciseChange(int previous, int pos) {
                mCurrentQuestion = mQuestions.get(pos);
                MarkdownTextView answer = view.findViewById(R.id.answerView);
                answer.setContent(mCurrentQuestion.answer + mCurrentQuestion.explanation);

                aiChatMessageRequest.setName(userInfoViewModel.userInfo.getValue().getName());
                aiChatMessageRequest.setNewValue("1");
                aiChatMessageRequest.setSessionId(String.valueOf(System.currentTimeMillis()));
                aiChatMessageRequest.setQuestion(mCurrentQuestion.title);
                aiChatMessageRequest.setAnswer(mCurrentQuestion.DAJX + mCurrentQuestion.explanation);
                aiChatMessageRequest.setCoversation("请开始引导");
                aiChatMessageRequest.setReason("start");
                fragmentChatAi.setChatEnable(false);
            }

            @Override
            public void onBeginGuideToSolveQuestion(int pos) {
                String url;
                requireActivity().runOnUiThread(() -> {
                    fragmentChatAi.sendMessageDirectly(aiChatMessageRequest);
                    fragmentChatAi.setChatEnable(true);
                });
            }
        }) ;
        recyclerView.setAdapter(adapterQuestionList);

        RecyclerView recyclerViewSimilarQuestion = view.findViewById(R.id.similarExerciseView);
        recyclerViewSimilarQuestion.setLayoutManager(new LinearLayoutManager(getContext()));
        adapterSimilarQuestionList = new AdapterSimilarQuestionList(mSimilarQuestion, new AdapterSimilarQuestionList.SimilarQuestionListChangedListener() {
            @Override
            public void onExerciseAddToMyList(int pos, Question q) {
                AddQuestionRequest item = new AddQuestionRequest();

                item.setTitle(q.title);
                item.setImgName(q.titleImg);
                item.setImgTitleUrl(q.titleImg);

                final List<String> optImgs = q.optionsImg.isEmpty() ? q.imgUrl : q.optionsImg;
                StringBuilder optionImgs = new StringBuilder();

                for(int i = 0; i< optImgs.size(); i++) {
                    if(i == 0) {
                        optionImgs.append("[");
                    }

                    optionImgs.append("\"").append(optImgs.get(i)).append("\"");
                    if(i != optImgs.size() - 1) {
                        optionImgs.append(",");
                    } else {
                        optionImgs.append("]");
                    }
                }

                item.setImgUrl(optionImgs.toString());

                StringBuilder opts = new StringBuilder();
                for(int i = 0; i < q.options.size(); i++) {
                    if(i == 0) {
                        opts.append("[");
                    }

                    opts.append("\"").append(q.options.get(i)).append("\"");
                    if(i != q.options.size() - 1) {
                        opts.append(",");
                    } else {
                        opts.append("]");
                    }
                }
                item.setOptions(opts.toString());
                item.setAnswer(q.answer);
                item.setExplanation(q.explanation);

                StringBuilder ids = new StringBuilder();
                for (Question qq:mQuestions) {
                    ids.append(qq.bmNo).append(",");
                }
                item.setExercisesId(ids.toString());
                item.setBmNo(q.bmNo);

                if(subject == Subject.SUBJECT_BIOLOGY) {
                    item.setType("biology");
                } else if(subject == Subject.SUBJECT_MATH) {
                    item.setType("math");
                }
                ApiGateWayService.addExerciseToList(item, ApiUrl.URL_ADD_EXERCISE_TO_LIST, userInfoViewModel.token.getValue());

                mQuestions.add(q);
                adapterQuestionList.notifyItemInserted(mQuestions.size() - 1);

                mSimilarQuestion.remove(pos);
                adapterSimilarQuestionList.notifyDataSetChanged();
            }

            @Override
            public void onExerciseAddToMyFavor(int pos, Question q) {

            }
        });
        recyclerViewSimilarQuestion.setAdapter(adapterSimilarQuestionList);

        if(!url.isEmpty()) {
            ApiGateWayService.queryExerciseList(url, userInfoViewModel.token.getValue(), new ApiGateWayService.QueryExerciseListCallback() {
                @Override
                public void onSuccess(List<Question> q) {
                    requireActivity().runOnUiThread(() -> {
                        mQuestions.clear();
                        mQuestions.addAll(q);
                        adapterQuestionList.notifyItemInserted(0);
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

                if(mCurrentQuestion != null) {
                    FindSimilarQuestionRequest item = new FindSimilarQuestionRequest();
                    Question q = mCurrentQuestion;
                    item.setTitle(q.title);
                    item.setImgName(q.titleImg);
                    item.setImgTitleUrl(q.titleImg);
                    item.setOptions(q.title);
                    item.setSelect("");
                    item.setImgUrl("");
                    item.setAnswer(q.answer);
                    item.setExplanation(q.explanation);
                    StringBuilder ids = new StringBuilder();
                    for (Question qq:mQuestions) {
                        ids.append(qq.bmNo).append(",");
                    }
                    item.setExercisesId(ids.toString());
                    item.setBmNo(q.bmNo);

                    if(subject == Subject.SUBJECT_BIOLOGY) {
                        item.setType("biology");
                    } else if(subject == Subject.SUBJECT_MATH) {
                        item.setType("math");
                    }
                    ApiGateWayService.querySimilarExerciseList(item, ApiUrl.URL_QUERY_SIMILAR_EXERCISE, userInfoViewModel.token.getValue(), new ApiGateWayService.QueryExerciseListCallback() {
                        @Override
                        public void onSuccess(List<Question> q) {
                            requireActivity().runOnUiThread(() -> {
                                mSimilarQuestion.clear();
                                mSimilarQuestion.addAll(q);
                                adapterSimilarQuestionList.notifyItemInserted(0);
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
            }
        });
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
    }

}