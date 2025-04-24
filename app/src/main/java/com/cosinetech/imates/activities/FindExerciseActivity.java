package com.cosinetech.imates.activities;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.KeyEvent;
import android.view.View;
import android.widget.Button;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.lifecycle.ViewModelProvider;
import androidx.lifecycle.ViewModelStoreOwner;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.cosinetech.imates.R;
import com.cosinetech.imates.adapters.AdapterMultiSelectSimilarQuestionList;
import com.cosinetech.imates.models.AddQuestionRequest;
import com.cosinetech.imates.models.FindSimilarQuestionRequest;
import com.cosinetech.imates.models.Subject;
import com.cosinetech.imates.models.UserInfoViewModel;
import com.cosinetech.imates.util.WindowUtils;
import com.cosinetech.imates.webservice.ApiGateWayService;
import com.cosinetech.imates.webservice.ApiUrl;
import com.cosinetech.imates.webservice.Question;
import com.scwang.smart.refresh.layout.SmartRefreshLayout;

import java.util.ArrayList;
import java.util.List;

public class FindExerciseActivity extends AppCompatActivity {
    public final static String KEY_PARAM_SUBJECT = "SUBJECT";
    public final static String KEY_KNOWLEDGE_LIST = "KNOWLEDGE_LIST";
    public static final String KEY_CHATBOT_URL = "KEY_CHAT_BOT_URL";
    private static final int QUESTION_PAGE_SIZE = 5;
    private String mChatBotUrl;
    private Subject mSubject;
    private RecyclerView mRecyclerViewSimilarQuestion;
    private SmartRefreshLayout mRefreshLayout;
    private View mProgressView;
    private String mKnowledgeList;
    private final List<Question> mSimilarQuestion = new ArrayList<>();
    private final ArrayList<String> mQuestionIdsInFavor = new ArrayList<>();

    private AdapterMultiSelectSimilarQuestionList adapterMultiSelectSimilarQuestionList;
    private UserInfoViewModel mUserInfoViewModel;
    private final List<Question> mQuestionsInFavor = new ArrayList<>();

    private final FindSimilarQuestionRequest mFindSimilarQuestionRequest = new FindSimilarQuestionRequest();

    private ApiGateWayService.QueryExerciseListCallback mSimilarQuestionsCallback;


    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowUtils.hideSystemUI(this);
        WindowUtils.setFullScreenMode(this);
        setContentView(R.layout.activity_find_exercise);
        initData();
        initView();
        fetchQuestionList();
    }

    private void initData() {
        mSubject = Subject.valueOf(getIntent().getStringExtra(KEY_PARAM_SUBJECT));
        mKnowledgeList = getIntent().getStringExtra(KEY_KNOWLEDGE_LIST);
        mChatBotUrl = getIntent().getStringExtra(KEY_CHATBOT_URL);

        ViewModelStoreOwner owner = (ViewModelStoreOwner) this.getApplication();
        mUserInfoViewModel = new ViewModelProvider(
                owner,
                new ViewModelProvider.AndroidViewModelFactory(this.getApplication())
        ).get(com.cosinetech.imates.models.UserInfoViewModel.class);

        mFindSimilarQuestionRequest.setCurrentPage(0);

        mSimilarQuestionsCallback = new ApiGateWayService.QueryExerciseListCallback() {
            @Override
            public void onSuccess(List<Question> questions, long totalCount, long pageSize, long currentPageNo) {
                runOnUiThread(() -> {
                    for (Question q: questions) {
                        q.atUserList = mQuestionIdsInFavor.contains(q.bmNo);
                    }
                    mSimilarQuestion.addAll(questions);
                    adapterMultiSelectSimilarQuestionList.resetSelection();
                    adapterMultiSelectSimilarQuestionList.notifyDataSetChanged();
                    mFindSimilarQuestionRequest.setTotalCount(totalCount);
                    if(!mSimilarQuestion.isEmpty()) {
                        mRecyclerViewSimilarQuestion.smoothScrollToPosition(mSimilarQuestion.size() - 1);
                    }
                    mRefreshLayout.finishLoadMore(1000);// 加载完成后等待的时间
                });
            }

            @Override
            public void onFailure(String msg, int code) {
                runOnUiThread(() -> {
                    adapterMultiSelectSimilarQuestionList.resetSelection();
                    adapterMultiSelectSimilarQuestionList.notifyDataSetChanged();
                    if(mFindSimilarQuestionRequest.getCurrentPage() > 1) {
                        mFindSimilarQuestionRequest.setCurrentPage(mFindSimilarQuestionRequest.getCurrentPage() - 1);
                    }
                    mRefreshLayout.finishLoadMore();// 加载完成后等待的时间
                    Toast.makeText(FindExerciseActivity.this, "没有查到对应的题目", Toast.LENGTH_SHORT).show();
                });
            }
        };
    }
    private void initView() {
        mRecyclerViewSimilarQuestion = findViewById(R.id.question_list);
        mRecyclerViewSimilarQuestion.setLayoutManager(new LinearLayoutManager(this));
        adapterMultiSelectSimilarQuestionList = new AdapterMultiSelectSimilarQuestionList(mSimilarQuestion);
        mRecyclerViewSimilarQuestion.setAdapter(adapterMultiSelectSimilarQuestionList);

        mProgressView = findViewById(R.id.progress_layout);

        mRefreshLayout = findViewById(R.id.refreshLayout);
        mRefreshLayout.setEnableAutoLoadMore(false);
        //下拉刷新
        mRefreshLayout.setOnRefreshListener(refreshlayout -> {
            mRefreshLayout.finishRefresh();
        });

        //上拉加载更多
        mRefreshLayout.setOnLoadMoreListener(refreshlayout -> {
            if(mSimilarQuestion.size() < mFindSimilarQuestionRequest.getTotalCount()) {
                fetchQuestionList();
            } else {
                Toast.makeText(this, "没有更多的题目了", Toast.LENGTH_SHORT).show();
                mRefreshLayout.finishLoadMore();
            }
        });

        Button btnOk = findViewById(R.id.btn_ok);
        btnOk.setOnClickListener(v -> {
            addSelectedQuestionToList();
        });

        Button btnExit = findViewById(R.id.btn_back);
        btnExit.setOnClickListener(v -> finish());

        Button btnRefresh = findViewById(R.id.btn_unselect);
        btnRefresh.setOnClickListener( v-> {
            for (Question q: mSimilarQuestion
            ) {
                if(!q.atUserList) {
                    q.userSelect = false;
                }
            }
            adapterMultiSelectSimilarQuestionList.notifyDataSetChanged();
        });
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
                runOnUiThread(() -> {
                    Toast.makeText(FindExerciseActivity.this, msg, Toast.LENGTH_SHORT).show();
                });
                findSimilarKnowledgeQuestion();
            }
        });
    }


    public void addSelectedQuestionToList() {
        AddQuestionRequest item = new AddQuestionRequest();

        StringBuilder ids = new StringBuilder();
        for (Question qq : mSimilarQuestion) {
            if(qq.userSelect) {
                ids.append(qq.bmNo).append(",");
            }
        }
        if(ids.toString().isEmpty()) {
            Toast.makeText(FindExerciseActivity.this, "请勾选要添加的习题", Toast.LENGTH_SHORT).show();
            return;
        }
        item.setBmNo(ids.toString());

        if (mSubject == Subject.SUBJECT_BIOLOGY) {
            item.setType("biology");
        } else if (mSubject == Subject.SUBJECT_MATH) {
            item.setType("math");
        }

        mProgressView.setVisibility(View.VISIBLE);

        ApiGateWayService.addExerciseToList(item, ApiUrl.URL_ADD_EXERCISE_TO_LIST, mUserInfoViewModel.token.getValue(), new ApiGateWayService.AddExerciseCallback() {
            @Override
            public void onSuccess() {
                new Handler(Looper.getMainLooper()).post(() -> {
                    startQuestionSolveActivity();
                    finish();
                });
            }

            @Override
            public void onFailure(String msg, int code) {
                new Handler(Looper.getMainLooper()).post(() -> {
                    mProgressView.setVisibility(View.GONE);
                    Toast.makeText(FindExerciseActivity.this, "添加到列表失败:" + msg, Toast.LENGTH_SHORT).show();
                });
            }
        });
    }

    public void startQuestionSolveActivity() {
        Intent intent = new Intent(this, QuestionSolveActivity.class);
        intent.putExtra(QuestionSolveActivity.KEY_CHATBOT_URL, mChatBotUrl);
        intent.putExtra(QuestionSolveActivity.KEY_SUBJECT, mSubject.name());
        startActivity(intent);
    }


    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if(keyCode == KeyEvent.KEYCODE_BACK || keyCode == KeyEvent.KEYCODE_HOME){
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    public boolean onKeyUp(int keyCode, KeyEvent event) {
        if(keyCode == KeyEvent.KEYCODE_BACK || keyCode == KeyEvent.KEYCODE_HOME){
            return true;
        }
        return super.onKeyUp(keyCode, event);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            WindowUtils.hideSystemUI(this);
        }
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if(event.getKeyCode() == KeyEvent.KEYCODE_BACK
                || event.getKeyCode() == KeyEvent.KEYCODE_HOME
                || event.getKeyCode() == KeyEvent.KEYCODE_MENU){
            return true;
        }
        return super.dispatchKeyEvent(event);
    }

    @Override
    public void onResume() {
        super.onResume();
    }

    @Override
    public void onPause() {
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
    }
}