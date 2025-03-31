package com.cosinetech.imates.views;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.Button;
import android.widget.PopupWindow;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.lifecycle.ViewModelProvider;
import androidx.lifecycle.ViewModelStoreOwner;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.cosinetech.imates.R;
import com.cosinetech.imates.adapters.AdapterMultiSelectSimilarQuestionList;
import com.cosinetech.imates.models.Subject;
import com.cosinetech.imates.models.AddQuestionRequest;
import com.cosinetech.imates.models.FindSimilarQuestionRequest;
import com.cosinetech.imates.models.UserInfoViewModel;
import com.cosinetech.imates.util.ScreenUtils;
import com.cosinetech.imates.webservice.ApiGateWayService;
import com.cosinetech.imates.webservice.ApiUrl;
import com.cosinetech.imates.webservice.Question;
import com.scwang.smart.refresh.layout.SmartRefreshLayout;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Iterator;
import java.util.List;
import java.util.ListIterator;

public class FindKnowledgeQuestionPopupWindow {
    public interface OnSimilarQuestionSelectionListener {
        void onQuestionSelected();
    }
    private static final int QUESTION_PAGE_SIZE = 8;
    private Subject mSubject;
    private Activity mContext;
    private PopupWindow mPopupWindow;
    private RecyclerView mRecyclerViewSimilarQuestion;
    private OnSimilarQuestionSelectionListener mListener;
    private String mKnowledgeList;
    private List<Question> mSimilarQuestion = new ArrayList<>();
    private ArrayList<String> mQuestionIdsInFavor = new ArrayList<>();

    private AdapterMultiSelectSimilarQuestionList adapterMultiSelectSimilarQuestionList;
    private UserInfoViewModel mUserInfoViewModel;
    private final List<Question> mQuestionsInFavor = new ArrayList<>();

    private final FindSimilarQuestionRequest mFindSimilarQuestionRequest = new FindSimilarQuestionRequest();

    private ApiGateWayService.QueryExerciseListCallback mSimilarQuestionsCallback = null;

    private View mView;
    public FindKnowledgeQuestionPopupWindow(Activity context, Subject subject, String knowledgeList, OnSimilarQuestionSelectionListener listener) {
        this.mSubject = subject;
        this.mContext = context;
        this.mListener = listener;
        this.mKnowledgeList = knowledgeList;

        ViewModelStoreOwner owner = (ViewModelStoreOwner) context.getApplication();
        mUserInfoViewModel = new ViewModelProvider(
                owner,
                new ViewModelProvider.AndroidViewModelFactory(context.getApplication())
        ).get(com.cosinetech.imates.models.UserInfoViewModel.class);

        mFindSimilarQuestionRequest.setCurrentPage(0);

        mSimilarQuestionsCallback = new ApiGateWayService.QueryExerciseListCallback() {
            @Override
            public void onSuccess(List<Question> questions, long totalCount, long pageSize, long currentPageNo) {
                mView.post(() -> {
//                    mSimilarQuestion.clear();
                    for (Question q: questions) {
                        if(mQuestionIdsInFavor.contains(q.bmNo)) {
                            q.atUserList = true;
                        }
                    }
                    mSimilarQuestion.addAll(questions);
                    adapterMultiSelectSimilarQuestionList.resetSelection();
                    adapterMultiSelectSimilarQuestionList.notifyDataSetChanged();
                    mFindSimilarQuestionRequest.setTotalCount(totalCount);
                    if(!mSimilarQuestion.isEmpty()) {
                        mRecyclerViewSimilarQuestion.smoothScrollToPosition(mSimilarQuestion.size() - 1);
                    }
                });
            }

            @Override
            public void onFailure(String msg, int code) {
                mView.post(() -> {
                    //mSimilarQuestion.clear();
                    adapterMultiSelectSimilarQuestionList.resetSelection();
                    adapterMultiSelectSimilarQuestionList.notifyDataSetChanged();
                    if(mFindSimilarQuestionRequest.getCurrentPage() > 1) {
                        mFindSimilarQuestionRequest.setCurrentPage(mFindSimilarQuestionRequest.getCurrentPage() - 1);
                    }
                    Toast.makeText(mContext, "没有查到对应的题目", Toast.LENGTH_SHORT).show();
                });
            }
        };
    }

    private void findSimilarKnowledgeQuestion() {
        StringBuilder ids = new StringBuilder();
        for (Question qq: mQuestionsInFavor) {
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

        mFindSimilarQuestionRequest.setKnowledgeNo(mKnowledgeList);
        mFindSimilarQuestionRequest.setExercisesId(ids.toString());
        mFindSimilarQuestionRequest.setType(subjectName);
        mFindSimilarQuestionRequest.setPageSize(QUESTION_PAGE_SIZE);
        mFindSimilarQuestionRequest.setCurrentPage(mFindSimilarQuestionRequest.getCurrentPage() + 1);

        //FindSimilarQuestionRequest request = FindSimilarQuestionRequest.fromKnowledgeId(mKnowledgeList, ids.toString(), subjectName);
        ApiGateWayService.querySimilarExerciseList(mFindSimilarQuestionRequest, url, mUserInfoViewModel.token.getValue(), mSimilarQuestionsCallback);
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

        ApiGateWayService.queryExerciseList(url, mUserInfoViewModel.token.getValue(), new ApiGateWayService.QueryExerciseListCallback() {
            @Override
            public void onSuccess(List<Question> questions, long totalCount, long pageSize, long currentPageNo) {
                mQuestionsInFavor.clear();
                mQuestionIdsInFavor.clear();
                mQuestionsInFavor.addAll(questions);
                for(Question q: questions) {
                    mQuestionIdsInFavor.add(q.bmNo);
                }
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
        mRecyclerViewSimilarQuestion = view.findViewById(R.id.question_list);
        mRecyclerViewSimilarQuestion.setLayoutManager(new LinearLayoutManager(mContext));
        adapterMultiSelectSimilarQuestionList = new AdapterMultiSelectSimilarQuestionList(mSimilarQuestion);
        mRecyclerViewSimilarQuestion.setAdapter(adapterMultiSelectSimilarQuestionList);
    }

    public void addSelectedQuestionToList() {
        AddQuestionRequest item = new AddQuestionRequest();

        StringBuilder ids = new StringBuilder();
        for (Question qq : mSimilarQuestion) {
            ids.append(qq.bmNo).append(",");
        }
        item.setBmNo(ids.toString());

        if (mSubject == Subject.SUBJECT_BIOLOGY) {
            item.setType("biology");
        } else if (mSubject == Subject.SUBJECT_MATH) {
            item.setType("math");
        }
        ApiGateWayService.addExerciseToList(item, ApiUrl.URL_ADD_EXERCISE_TO_LIST, mUserInfoViewModel.token.getValue(), new ApiGateWayService.AddExerciseCallback() {
            @Override
            public void onSuccess() {
                new Handler(Looper.getMainLooper()).post(() -> {
                    mPopupWindow.dismiss();
                    if (mListener != null) {
                        mListener.onQuestionSelected();
                    }
                });
            }

            @Override
            public void onFailure(String msg, int code) {
                new Handler(Looper.getMainLooper()).post(() -> {
                    Toast.makeText(mContext, "添加到列表失败:" + msg, Toast.LENGTH_SHORT).show();
                });
            }
        });


    }

    public void show() {
        mView = LayoutInflater.from(mContext).inflate(
                R.layout.popup_windows_similar_questions, null);
        // 初始化 PopupWindow
        int screenWidth = ScreenUtils.getScreenWidth(mContext);
        int screenHeight = ScreenUtils.getScreenHeight(mContext);
        mPopupWindow = new PopupWindow(mView,
                screenWidth, // 宽度
                screenHeight); // 高度
        setQuestionListView(mView);

        Button btnOk = mView.findViewById(R.id.btn_ok);
        btnOk.setOnClickListener(v -> {
            addSelectedQuestionToList();
        });

        Button btnExit = mView.findViewById(R.id.btn_back);
        btnExit.setOnClickListener(v -> mPopupWindow.dismiss());

        Button btnRefresh = mView.findViewById(R.id.btn_unselect);
        btnRefresh.setOnClickListener( v-> {
            for (Question q: mSimilarQuestion
                 ) {
                q.userSelect = false;
            }
            adapterMultiSelectSimilarQuestionList.notifyDataSetChanged();
        });

        SmartRefreshLayout mRefreshLayout = mView.findViewById(R.id.refreshLayout);
        //下拉刷新
        mRefreshLayout.setOnRefreshListener(refreshlayout -> {
            mRefreshLayout.finishRefresh(1000);// 刷新完成后等待的时间
        });

        //上拉加载更多
        mRefreshLayout.setOnLoadMoreListener(refreshlayout -> {
            if(mFindSimilarQuestionRequest.getTotalCount() < mSimilarQuestion.size()) {
                mRefreshLayout.finishLoadMore(1000);// 加载完成后等待的时间
                new Handler(Looper.getMainLooper()).postDelayed(this::fetchQuestionList, 1000);

            } else {
                Toast.makeText(mContext, "没有更多的题目了", Toast.LENGTH_SHORT).show();
            }
        });


        // 设置背景
        //popupWindow.setBackgroundDrawable(new ColorDrawable(android.R.color.white));

        // 设置点击外部区域关闭
        mPopupWindow.setOutsideTouchable(true);
        mPopupWindow.setFocusable(true);

        // 显示 PopupWindow
        mPopupWindow.showAtLocation(mView, Gravity.CENTER, 0, 0);
        fetchQuestionList();
    }
}
