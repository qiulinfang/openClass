package com.cosinetech.imates.ui.activities;

import android.app.AlertDialog;
import android.content.Intent;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.camera.core.processing.SurfaceProcessorNode;
import androidx.lifecycle.ViewModelProvider;
import androidx.lifecycle.ViewModelStoreOwner;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.cosinetech.imates.ApplicationModelShared;
import com.cosinetech.imates.R;
import com.cosinetech.imates.data.models.SubjectUtils;
import com.cosinetech.imates.ui.adapters.AdapterQuestionList;
import com.cosinetech.imates.ui.adapters.AdapterSingleSelectSimilarQuestionList;
import com.cosinetech.imates.audio.AudioPlayManager;
import com.cosinetech.imates.data.models.AddQuestionRequest;
import com.cosinetech.imates.data.models.ChatAiParam;
import com.cosinetech.imates.data.models.ChatMessage;
import com.cosinetech.imates.data.models.ChatMessageCatalogue;
import com.cosinetech.imates.data.models.ChatMessageHistoryDB;
import com.cosinetech.imates.data.models.ChatMessageSession;
import com.cosinetech.imates.data.models.FindSimilarQuestionRequest;
import com.cosinetech.imates.data.models.Subject;
import com.cosinetech.imates.data.models.UserInfoViewModel;
import com.cosinetech.imates.teachermessagemq.MessagingManager;
import com.cosinetech.imates.utils.AppUtils;
import com.cosinetech.imates.utils.WindowUtils;
import com.cosinetech.imates.ui.views.ChatAiView;
import com.cosinetech.imates.ui.views.MarkdownTextView;
import com.cosinetech.imates.ui.views.RecyclerViewOverscrollDecoration;
import com.cosinetech.imates.coreapiservice.AiChatMessageRequest;
import com.cosinetech.imates.coreapiservice.ApiGateWayService;
import com.cosinetech.imates.coreapiservice.ApiUrl;
import com.cosinetech.imates.coreapiservice.Question;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public class ExerciseSolveActivity extends AppCompatActivity implements MessagingManager.MessageListener {
    public static final String KEY_CHATBOT_URL = "KEY_CHAT_BOT_URL";
    public static final String KEY_SUBJECT = "KEY_SUBJECT";
    public static final String KEY_SHOW_LAST_QUESTION = "KEY_SHOW_LAST";
    private int chatResponseTimes = 0;
    private static final int VIEW_ANSWER_CHAT_TIMES = 3;
    private String chatBotUrl;
    private Subject subject;
    private UserInfoViewModel userInfoViewModel;
    private AdapterQuestionList adapterQuestionList;
    private AdapterSingleSelectSimilarQuestionList adapterSingleSelectSimilarQuestionList;
    private final AiChatMessageRequest aiChatMessageRequest = new AiChatMessageRequest("", "", "", "", "", "", "start", "", false, "all");
    private int mCurrentQuestionIndex = -1;

    private RadioButton mRdoChatAi;
    private RadioButton mRdoAskTeacher;
    private RadioButton mRdoViewAnswer;
    private RadioButton mRdoSimilarQuestion;
    private TextView mTextEmptyQuestionTip;

    private ChatAiView mChatView;
    private RecyclerView myExercisesView;

    private ChatMessageHistoryDB mChatDb;

    private final List<Question> mQuestions = new ArrayList<>();

    private final List<Question> mSimilarQuestion = new ArrayList<>();

    private ChatMessageCatalogue mChatAiCatalogue;

    //每个题目对应的老师对话
    private ChatMessageSession mAskTeacherChatSession;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_question_solve);
        chatBotUrl = getIntent().getStringExtra(KEY_CHATBOT_URL);
        subject = Subject.valueOf(getIntent().getStringExtra(KEY_SUBJECT));
        mChatDb = ChatMessageHistoryDB.getInstance(this, AppUtils.getUserId());
        initView();
        setChatCatalogue();
        MessagingManager.getInstance().addMessageListener(this);
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
        outState.putString(KEY_CHATBOT_URL, chatBotUrl);
        outState.putString(KEY_SUBJECT, subject.name());
    }

    @Override
    protected void onRestoreInstanceState(Bundle savedState) {
        chatBotUrl = savedState.getString(KEY_CHATBOT_URL);
        subject = Subject.valueOf(savedState.getString(KEY_SUBJECT));
    }

    private void initView() {
        mChatView = findViewById(R.id.chat_view);
        myExercisesView = findViewById(R.id.exerciseList);
        mChatView.setSendTeacherListener(() -> {
            if(!mRdoAskTeacher.isEnabled()) {
                mRdoAskTeacher.setEnabled(true);
            }

            if(!mRdoAskTeacher.isChecked()) {
                mRdoAskTeacher.setChecked(true);
            }
        });
        ChatAiParam param = new ChatAiParam();
        param.showHeader = false;
        param.chatBotUrl = chatBotUrl;
        param.streamDisplay = true;
        param.showHistory = false;
        mChatView.setChatResponseListener( success -> {
            if(mCurrentQuestionIndex >= 0 && mCurrentQuestionIndex < mQuestions.size()) {
                mQuestions.get(mCurrentQuestionIndex).isAiGuiding = false;
                adapterQuestionList.notifyItemChanged(mCurrentQuestionIndex);
            }
            chatResponseTimes++;
            if(chatResponseTimes >= VIEW_ANSWER_CHAT_TIMES) {
                setViewAnswer(true);
            }
        });

        mChatView.setChatAiParam(param);
        mChatView.registerScreenShotForActivityResult(this);
        mChatView.registerPickImageForActivityResult(this);
        mChatView.registerRichInputBoardForActivityResult(this);
        // Set listener to be notified when screenshot is captured
        mChatView.setOnPictureSelectedListener(mChatView::sendPicture);
        mChatView.setRichInputFinishListener(resultString -> mChatView.sendTextContent(resultString));

        findViewById(R.id.btn_exit).setOnClickListener(v->{
            finish();
        });

        findViewById(R.id.btn_capture).setOnClickListener(v-> {
            Intent intent = new Intent(this, PhotoSearchActivity.class);
            intent.putExtra(PhotoSearchActivity.KEY_PARAM_SUBJECT, subject.name());
            startActivity(intent);
        });

        mRdoChatAi = findViewById(R.id.optChatAi);
        mRdoAskTeacher = findViewById(R.id.optChatTeacher);
        mRdoViewAnswer = findViewById(R.id.optAnswer);
        mRdoSimilarQuestion = findViewById(R.id.optSimilar);
        mTextEmptyQuestionTip = findViewById(R.id.txt_empty_question);

        ViewModelStoreOwner owner = (ViewModelStoreOwner) getApplication();
        userInfoViewModel = new ViewModelProvider(
                owner,
                new ViewModelProvider.AndroidViewModelFactory(getApplication())
        ).get(UserInfoViewModel.class);

        myExercisesView.setLayoutManager(new LinearLayoutManager(this, LinearLayoutManager.VERTICAL, false));
        myExercisesView.addItemDecoration(new RecyclerViewOverscrollDecoration());
        adapterQuestionList = new AdapterQuestionList(mQuestions, new AdapterQuestionList.ExerciseListChangedListener() {
            @Override
            public void onExerciseDelete(int position) {
                if(position < 0 || position >= mQuestions.size()) {
                    return;
                }
                new AlertDialog.Builder(ExerciseSolveActivity.this)
                        .setTitle("提示")
                        .setMessage("确认删除习题吗?")
                        .setPositiveButton("确认", (dialog, which) -> {
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
                                    runOnUiThread(() -> {
                                        Question q = mQuestions.remove(position);
                                        adapterQuestionList.notifyItemRemoved(position);
                                    });

                                }

                                @Override
                                public void onDeleteFailed(String msg) {
                                    runOnUiThread(() -> Toast.makeText(ExerciseSolveActivity.this, "删除失败, 稍后重试", Toast.LENGTH_SHORT).show());
                                }
                            });
                        })
                        .setNegativeButton("取消", (dialog, which) -> {
                        })
                        .create()
                        .show();
                }

            @Override
            public void onExerciseToTop(int position) {
                Question q = mQuestions.remove(position);
                mQuestions.add(0, q);
//                adapterQuestionList.notifyItemRemoved(position);
//                adapterQuestionList.notifyItemInserted(0);
                adapterQuestionList.notifyDataSetChanged();
                myExercisesView.smoothScrollToPosition(0);
            }

            @Override
            public void onSelectExerciseChange(int previous, int pos) {
                if(!mRdoChatAi.isChecked()) {
                    mRdoChatAi.setChecked(true);
                }

                if(pos < 0 || pos >= mQuestions.size()) {
                    return;
                }

                mCurrentQuestionIndex = pos;
                Question mCurrentQuestion = mQuestions.get(pos);
                mCurrentQuestion.getQuestion();
                mCurrentQuestion.isAiGuiding = false;
                adapterQuestionList.notifyItemChanged(pos);

                MarkdownTextView answer = findViewById(R.id.answerView);
                answer.setContent(mCurrentQuestion.getAnswer() + "   \n" + mCurrentQuestion.getAnswerAnalysis());

//                if(mCurrentQuestion.beginGuideToSolve) {
//                    mChatView.setChatEnable(true);
//                    if(chatResponseTimes >= VIEW_ANSWER_CHAT_TIMES) {
//                        setViewAnswer(true);
//                    }
//                } else {
//                    mChatView.setChatEnable(false);
//                    chatResponseTimes = 0;
//                    setViewAnswer(false);
//                }

                //先生成ai的session
                ChatMessageSession session = onChatQuestionSessionChange(false);
                //再根据ai的session生成老师的session
                if(session != null) {
                    onChatTeacherSessionChange(session.sessionId, session.sessionName);
                }

                int msgCount = mChatView.getCurrentSessionMsgCount();
                mChatView.setChatEnable(msgCount > 0);
                setViewAnswer(msgCount >= VIEW_ANSWER_CHAT_TIMES * 2);
            }

            @Override
            public void onBeginGuideToSolveQuestion(int pos) {
                if(mCurrentQuestionIndex >= 0 && mCurrentQuestionIndex < mQuestions.size()) {
                    mQuestions.get(mCurrentQuestionIndex).isAiGuiding = true;
                    adapterQuestionList.notifyItemChanged(mCurrentQuestionIndex);
                    for(Question q : mQuestions) {
                        q.beginGuideToSolve = false;
                    }
                    mQuestions.get(mCurrentQuestionIndex).beginGuideToSolve = true;
                }
                onChatQuestionSessionChange(true);
                runOnUiThread(() -> {
                    mChatView.sendMessageToAi(aiChatMessageRequest, false);
                    mChatView.setChatEnable(true);
                });
            }
        });
        myExercisesView.setAdapter(adapterQuestionList);

        RecyclerView recyclerViewSimilarQuestion = findViewById(R.id.similarExerciseView);
        recyclerViewSimilarQuestion.setLayoutManager(new LinearLayoutManager(this));
        adapterSingleSelectSimilarQuestionList = new AdapterSingleSelectSimilarQuestionList(mSimilarQuestion, new AdapterSingleSelectSimilarQuestionList.SimilarQuestionListChangedListener() {
            @Override
            public void onExerciseAddToMyList(int pos, Question q) {
                AddQuestionRequest item = new AddQuestionRequest();

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
                ApiGateWayService.addExerciseToList(item, ApiUrl.URL_ADD_EXERCISE_TO_LIST, userInfoViewModel.token.getValue(), new ApiGateWayService.AddExerciseCallback() {
                    @Override
                    public void onSuccess() {

                    }

                    @Override
                    public void onFailure(String msg, int code) {

                    }
                });

                mQuestions.add(q);
                //adapterQuestionList.notifyItemInserted(mQuestions.size() - 1);
                adapterQuestionList.notifyDataSetChanged();
                myExercisesView.smoothScrollToPosition(mQuestions.size() - 1);

                mSimilarQuestion.remove(pos);
                adapterSingleSelectSimilarQuestionList.notifyDataSetChanged();
            }

            @Override
            public void onExerciseAddToMyFavor(int pos, Question q) {

            }
        });
        recyclerViewSimilarQuestion.setAdapter(adapterSingleSelectSimilarQuestionList);

        fetchQuestionList();

        RadioGroup radioGroup = findViewById(R.id.radioGroup);
        radioGroup.setOnCheckedChangeListener((group, checkedId) -> {
            if(checkedId == R.id.optChatAi) {
                findViewById(R.id.similarExerciseView).setVisibility(View.INVISIBLE);
                findViewById(R.id.answerView).setVisibility(View.INVISIBLE);
                findViewById(R.id.chat_view).setVisibility(View.VISIBLE);
                onChatQuestionSessionChange(false);
            } else if(checkedId == R.id.optAnswer) {
                findViewById(R.id.similarExerciseView).setVisibility(View.INVISIBLE);
                findViewById(R.id.answerView).setVisibility(View.VISIBLE);
                findViewById(R.id.chat_view).setVisibility(View.INVISIBLE);
            } else if(checkedId == R.id.optSimilar) {
                findViewById(R.id.similarExerciseView).setVisibility(View.VISIBLE);
                findViewById(R.id.answerView).setVisibility(View.INVISIBLE);
                findViewById(R.id.chat_view).setVisibility(View.INVISIBLE);
                findSimilarQuestion();
            } else if(checkedId == R.id.optChatTeacher) {
                findViewById(R.id.similarExerciseView).setVisibility(View.INVISIBLE);
                findViewById(R.id.answerView).setVisibility(View.INVISIBLE);
                findViewById(R.id.chat_view).setVisibility(View.VISIBLE);
                mChatView.resetCurrentSession(ChatMessageCatalogue.CATEGORY_TEACHER_QA, mAskTeacherChatSession);
            }
        });

        findViewById(R.id.btn_mini_class).setOnClickListener(v -> {
            String url = getMiniClassUrl();
            if(url != null && !url.isEmpty()) {
                Intent intent = new Intent(this, MiniClassActivity.class);
                intent.putExtra(MiniClassActivity.KEY_MINI_CLASS_URL, getMiniClassUrl());
                startActivity(intent);
            }
        });
    }

    private String getMiniClassUrl() {
        String prefix = SubjectUtils.getSubjectNormalizedName(subject);
        try {
            if(mCurrentQuestionIndex >= 0 && mCurrentQuestionIndex < mQuestions.size()){
                String id =  mQuestions.get(mCurrentQuestionIndex).bmNo;
                return "https://www.imates.com.cn:9099/wk/" + prefix + "/" + id + "/" + id + ".html";
            } else {
                return "";
            }
        } catch (Exception e) {
            return "";
        }
    }

    public static ChatMessageSession createChatTeacherSession(String chatAiSessionId, String chatAiSessionName, ChatMessageSession.SessionType type) {
        String askTeacherSessionId =  UUID.nameUUIDFromBytes(chatAiSessionId.getBytes()).toString();
        return new ChatMessageSession(askTeacherSessionId,
                ChatMessageCatalogue.CATEGORY_TEACHER_QA.catalogId,
                chatAiSessionName,
                type,
                0,
                System.currentTimeMillis(),
                System.currentTimeMillis());
    }

    private void onChatTeacherSessionChange(String chatAiSessionId, String chatAiSessionName) {
        ChatMessageSession.SessionType type;
        if(subject == Subject.SUBJECT_BIOLOGY) {
            type = ChatMessageSession.SessionType.USER_TALK_TEACHER_BIOLOGY;
        } else {
            type = ChatMessageSession.SessionType.USER_TALK_TEACHER_MATH;
        }
        mAskTeacherChatSession = createChatTeacherSession(chatAiSessionId, chatAiSessionName, type);

        if(mChatDb.getMessageSessionBySessionId(mAskTeacherChatSession.sessionId) == null) {
            mRdoAskTeacher.setEnabled(false);
        } else {
            mRdoAskTeacher.setEnabled(true);
        }
        mChatView.setChatTeacherSession(mAskTeacherChatSession);
    }

    private ChatMessageSession onChatQuestionSessionChange(boolean saveToDb) {
        if(mCurrentQuestionIndex < 0) return null;

        String questionString = mQuestions.get(mCurrentQuestionIndex).getQuestion();
        long tick = System.currentTimeMillis();
        ChatMessageSession session = new ChatMessageSession(
                UUID.nameUUIDFromBytes((questionString + userInfoViewModel.userId.getValue()).getBytes()).toString(),
                mChatAiCatalogue.catalogId,
                (questionString.length() > ChatMessageSession.MAX_SESSION_NAME_LENGTH ?
                        questionString.substring(0, ChatMessageSession.MAX_SESSION_NAME_LENGTH) + "..." :
                        questionString),
                ChatMessageSession.SessionType.USER_TALK_AI,
                tick,
                tick,
                0);
        if(saveToDb) {
            mChatDb.addMessageSession(session);
        }
        mChatView.resetCurrentSession(mChatAiCatalogue, session);

        aiChatMessageRequest.setName(userInfoViewModel.userInfo.getValue().getName());
        aiChatMessageRequest.setNewValue("1");
        aiChatMessageRequest.setSessionId(session.sessionId);
        aiChatMessageRequest.setQuestion(questionString);
        aiChatMessageRequest.setAnswer(mQuestions.get(mCurrentQuestionIndex).getAiExplanation());
        aiChatMessageRequest.setCoversation("我们开始吧");
        aiChatMessageRequest.setReason("start");
        aiChatMessageRequest.setBmNo(mQuestions.get(mCurrentQuestionIndex).bmNo);

        return session;
    }

    private String getCatalogueName() {
        switch(subject) {
            case SUBJECT_BIOLOGY:
                return getString(R.string.subject_name_biology);
            case SUBJECT_CHEMISTRY:
                return getString(R.string.subject_name_chemistry);
            case SUBJECT_CHINESE:
                return getString(R.string.subject_name_chinese);
            case SUBJECT_ENGLISH:
                return getString(R.string.subject_name_english);
            case SUBJECT_MATH:
                return getString(R.string.subject_name_math);
            case SUBJECT_PHYSICS:
                return getString(R.string.subject_name_physics);
            default:
                return getString(R.string.subject_name_all);
        }
    }

    private void setChatCatalogue() {
        long tick = System.currentTimeMillis();
        mChatAiCatalogue = new ChatMessageCatalogue(UUID.nameUUIDFromBytes(subject.name().getBytes()).toString(),
                getCatalogueName(),
                subject == Subject.SUBJECT_BIOLOGY ? ChatMessageCatalogue.CatalogueType.USER_BIOLOGY : ChatMessageCatalogue.CatalogueType.USER_MATH,
                tick,
                tick);
        mChatDb.addMessageCatalogue(mChatAiCatalogue);
        mChatView.resetCurrentCatalog(mChatAiCatalogue);
    }

    private void findSimilarQuestion() {
        if(mCurrentQuestionIndex < 0 || mCurrentQuestionIndex >= mQuestions.size()) {
            return;
        }
        StringBuilder ids = new StringBuilder();
        for (Question qq:mQuestions) {
            ids.append(qq.bmNo).append(",");
        }
        String subjectName = SubjectUtils.getSubjectNormalizedName(subject);

        FindSimilarQuestionRequest item = FindSimilarQuestionRequest.fromQuestion(mQuestions.get(mCurrentQuestionIndex), ids.toString(), subjectName);
        ApiGateWayService.querySimilarExerciseList(item, ApiUrl.URL_QUERY_SIMILAR_EXERCISE, userInfoViewModel.token.getValue(), new ApiGateWayService.QueryExerciseListCallback() {
            @Override
            public void onSuccess(List<Question> q, long totalCount, long pageSize, long currentPageNo) {
                runOnUiThread(() -> {
                    mSimilarQuestion.clear();
                    mSimilarQuestion.addAll(q);
                    adapterSingleSelectSimilarQuestionList.resetSelection();
                    adapterSingleSelectSimilarQuestionList.notifyDataSetChanged();
                });
            }

            @Override
            public void onFailure(String msg, int code) {
                runOnUiThread(() -> {
                    Toast.makeText(ExerciseSolveActivity.this, msg, Toast.LENGTH_SHORT).show();
                });
            }
        });
    }

    private void fetchQuestionList() {
        String url;
        if(subject == Subject.SUBJECT_BIOLOGY) {
            url = ApiUrl.URL_GET_EXERCISE_BIOLOGY;
        } else if (subject == Subject.SUBJECT_MATH) {
            url = ApiUrl.URL_GET_EXERCISE_MATH;
        } else {
            return;
        }

        ApiGateWayService.queryExerciseList(url, userInfoViewModel.token.getValue(), new ApiGateWayService.QueryExerciseListCallback() {
            @Override
            public void onSuccess(List<Question> q, long totalCount, long pageSize, long currentPageNo) {
                runOnUiThread(() -> {
                    boolean scrollToLast =  getIntent().getBooleanExtra(KEY_SHOW_LAST_QUESTION, false);
                    mQuestions.clear();
                    mQuestions.addAll(q);
                    adapterQuestionList.resetSelection();
                    adapterQuestionList.notifyDataSetChanged();
                    updateQuestionListTip();
                    if(scrollToLast && !mQuestions.isEmpty()) {
                        myExercisesView.scrollToPosition(mQuestions.size() - 1);
                    }
                });
            }

            @Override
            public void onFailure(String msg, int code) {
                runOnUiThread(() -> {
                    updateQuestionListTip();
                    Toast.makeText(ExerciseSolveActivity.this, msg, Toast.LENGTH_SHORT).show();
                });
            }
        });
    }

    private void updateQuestionListTip() {
        if(mQuestions.isEmpty()) {
            mTextEmptyQuestionTip.setVisibility(View.VISIBLE);
        } else {
            mTextEmptyQuestionTip.setVisibility(View.GONE);
        }
    }

    public void setViewAnswer(boolean b) {
        mRdoViewAnswer.setEnabled(b);
        mRdoSimilarQuestion.setEnabled(b);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onTeacherMessageReceived(ChatMessage message) {
        mChatView.onReceivedTeacherMessage(message);
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
        ApplicationModelShared app = (ApplicationModelShared) getApplication();
        if(app.getFloatingWindowService() != null) {
            app.getFloatingWindowService().hideRobot();
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        ApplicationModelShared app = (ApplicationModelShared) getApplication();
        if(app.getFloatingWindowService() != null) {
            app.getFloatingWindowService().showRobot();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        AudioPlayManager.getInstance().stopPlay();
        MessagingManager.getInstance().removeMessageListener(this);
    }
}