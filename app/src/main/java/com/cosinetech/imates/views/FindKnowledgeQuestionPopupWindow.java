package com.cosinetech.imates.views;

import android.app.Activity;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.PopupWindow;
import android.widget.Toast;

import androidx.lifecycle.ViewModelProvider;
import androidx.lifecycle.ViewModelStoreOwner;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.cosinetech.imates.R;
import com.cosinetech.imates.models.Subject;
import com.cosinetech.imates.adapters.AdapterSimilarQuestionList;
import com.cosinetech.imates.models.AddQuestionRequest;
import com.cosinetech.imates.models.FindSimilarQuestionRequest;
import com.cosinetech.imates.models.UserInfoViewModel;
import com.cosinetech.imates.webservice.ApiGateWayService;
import com.cosinetech.imates.webservice.ApiUrl;
import com.cosinetech.imates.webservice.Question;

import java.util.ArrayList;
import java.util.List;

public class FindKnowledgeQuestionPopupWindow {
    public interface OnSimilarQuestionSelectionListener {
        void onQuestionSelected();
    }
    private Subject mSubject;
    private Activity mContext;
    private OnSimilarQuestionSelectionListener mListener;
    private String mKnowledgeList;
    private List<Question> mSimilarQuestion = new ArrayList<>();
    private AdapterSimilarQuestionList adapterSimilarQuestionList;
    private UserInfoViewModel userInfoViewModel;
    private final List<Question> mQuestions = new ArrayList<>();

    private View mView;
    public FindKnowledgeQuestionPopupWindow(Activity context, Subject subject, String knowledgeList, OnSimilarQuestionSelectionListener listener) {
        this.mSubject = subject;
        this.mContext = context;
        this.mListener = listener;
        this.mKnowledgeList = knowledgeList;

        ViewModelStoreOwner owner = (ViewModelStoreOwner) context.getApplication();
        userInfoViewModel = new ViewModelProvider(
                owner,
                new ViewModelProvider.AndroidViewModelFactory(context.getApplication())
        ).get(com.cosinetech.imates.models.UserInfoViewModel.class);

    }

    private void findSimilarKnowledgeQuestion() {
        StringBuilder ids = new StringBuilder();
        for (Question qq:mQuestions) {
            ids.append(qq.bmNo).append(",");
        }
        String url = ApiUrl.URL_QUERY_SIMILAR_EXERCISE_BY_KNOWLEDGE;
        String subjectName;
        if(mSubject == Subject.SUBJECT_BIOLOGY) {
            subjectName = "biology";
        } else if(mSubject == Subject.SUBJECT_MATH){
            subjectName = "math";
        } else {
            return;
        }

        FindSimilarQuestionRequest item = FindSimilarQuestionRequest.fromKnowledgeId(mKnowledgeList, ids.toString(), subjectName);
        ApiGateWayService.querySimilarExerciseList(item, url, userInfoViewModel.token.getValue(), new ApiGateWayService.QueryExerciseListCallback() {
            @Override
            public void onSuccess(List<Question> q) {
                mView.post(() -> {
                    mSimilarQuestion.clear();
                    mSimilarQuestion.addAll(q);
                    adapterSimilarQuestionList.resetSelection();
                    adapterSimilarQuestionList.notifyDataSetChanged();
                });
            }

            @Override
            public void onFailure(String msg, int code) {
                mView.post(() -> {
                    mSimilarQuestion.clear();
                    adapterSimilarQuestionList.resetSelection();
                    adapterSimilarQuestionList.notifyDataSetChanged();
                    Toast.makeText(mContext, "没有查到对应的题目", Toast.LENGTH_SHORT).show();
                });
            }
        });
    }

    private void fetchQuestionList() {
        String url;
        if(mSubject == Subject.SUBJECT_BIOLOGY) {
            url = ApiUrl.URL_GET_EXERCISE_BIOLOGY;
        } else if (mSubject == Subject.SUBJECT_MATH) {
            url = ApiUrl.URL_GET_EXERCISE_MATH;
        } else {
            return;
        }

        ApiGateWayService.queryExerciseList(url, userInfoViewModel.token.getValue(), new ApiGateWayService.QueryExerciseListCallback() {
            @Override
            public void onSuccess(List<Question> q) {
                mQuestions.clear();
                mQuestions.addAll(q);
                findSimilarKnowledgeQuestion();
            }

            @Override
            public void onFailure(String msg, int code) {
                mContext.runOnUiThread(() -> {
                    Toast.makeText(mContext, msg, Toast.LENGTH_SHORT).show();
                });
                findSimilarKnowledgeQuestion();
            }
        });
    }

    public void setQuestionListView(View view) {
        RecyclerView recyclerViewSimilarQuestion = view.findViewById(R.id.question_list);
        recyclerViewSimilarQuestion.setLayoutManager(new LinearLayoutManager(mContext));
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

                if(mSubject == Subject.SUBJECT_BIOLOGY) {
                    item.setType("biology");
                } else if(mSubject == Subject.SUBJECT_MATH) {
                    item.setType("math");
                }
                ApiGateWayService.addExerciseToList(item, ApiUrl.URL_ADD_EXERCISE_TO_LIST, userInfoViewModel.token.getValue());

                mSimilarQuestion.get(pos).atUserList = true;
                adapterSimilarQuestionList.notifyDataSetChanged();
            }

            @Override
            public void onExerciseAddToMyFavor(int pos, Question q) {

            }
        });
        recyclerViewSimilarQuestion.setAdapter(adapterSimilarQuestionList);
    }

    public void show() {
        mView = LayoutInflater.from(mContext).inflate(
                R.layout.popup_windows_similar_questions, null);
        // 初始化 PopupWindow
        PopupWindow popupWindow = new PopupWindow(mView,
                ViewGroup.LayoutParams.MATCH_PARENT, // 宽度
                ViewGroup.LayoutParams.MATCH_PARENT); // 高度
        setQuestionListView(mView);

        Button btnOk = mView.findViewById(R.id.btn_ok);
        btnOk.setOnClickListener(v -> {
            popupWindow.dismiss();
            if(mListener != null) {
                mListener.onQuestionSelected();
            }
        });

        Button btnExit = mView.findViewById(R.id.btn_back);
        btnExit.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                popupWindow.dismiss();
            }
        });

        Button btnRefresh = mView.findViewById(R.id.btn_refresh);
        btnRefresh.setOnClickListener( v-> {
            fetchQuestionList();
        });

        // 设置背景
        //popupWindow.setBackgroundDrawable(new ColorDrawable(android.R.color.white));

        // 设置点击外部区域关闭
        popupWindow.setOutsideTouchable(true);
        popupWindow.setFocusable(true);

        // 显示 PopupWindow
        popupWindow.showAtLocation(mView, Gravity.CENTER, 0, 0);
        fetchQuestionList();
    }
}
