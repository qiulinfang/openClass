package com.cosinetech.imates.activities;

import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.view.KeyEvent;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.EdgeToEdge;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.lifecycle.ViewModelProvider;
import androidx.lifecycle.ViewModelStoreOwner;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.cosinetech.imates.ApplicationModelShared;
import com.cosinetech.imates.R;
import com.cosinetech.imates.adapters.AdapterQuestionList;
import com.cosinetech.imates.adapters.AdapterSimilarQuestionList;
import com.cosinetech.imates.models.AddQuestionRequest;
import com.cosinetech.imates.models.ChatMessageCatalogue;
import com.cosinetech.imates.models.ChatMessageHistoryDB;
import com.cosinetech.imates.models.ChatMessageSession;
import com.cosinetech.imates.models.FindSimilarQuestionRequest;
import com.cosinetech.imates.models.Subject;
import com.cosinetech.imates.models.UserInfoViewModel;
import com.cosinetech.imates.util.AppUtils;
import com.cosinetech.imates.util.WindowUtils;
import com.cosinetech.imates.views.ChatAiView;
import com.cosinetech.imates.views.MarkdownTextView;
import com.cosinetech.imates.webservice.AiChatMessageRequest;
import com.cosinetech.imates.webservice.ApiGateWayService;
import com.cosinetech.imates.webservice.ApiUrl;
import com.cosinetech.imates.webservice.HttpFileUploader;
import com.cosinetech.imates.webservice.Question;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class QuestionSolveActivity extends AppCompatActivity {
    public static final String KEY_CHATBOT_URL = "KEY_CHAT_BOT_URL";
    public static final String KEY_SUBJECT = "KEY_SUBJECT";

    private int chatResponceTimes = 0;
    private String chatBotUrl;
    private Subject subject;
    private UserInfoViewModel userInfoViewModel;
    private AdapterQuestionList adapterQuestionList;
    private AdapterSimilarQuestionList adapterSimilarQuestionList;
    private final AiChatMessageRequest aiChatMessageRequest = new AiChatMessageRequest("", "", "", "", "", "", "start", "");
    private int mCurrentQuestionIndex = -1;

    private RadioButton mRdoChatAi;
    private RadioButton mRdoViewAnswer;
    private RadioButton mRdoSimilarQuestion;
    private TextView mTextEmptyQuestionTip;

    private ChatAiView mChatView;

    private ChatMessageHistoryDB mChatDb;

    private final List<Question> mQuestions = new ArrayList<>();

    private final List<Question> mSimilarQuestion = new ArrayList<>();

    private ChatMessageCatalogue mChatCatalogue;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowUtils.hideSystemUI(this);
        WindowUtils.setFullScreenMode(this);
        EdgeToEdge.enable(this);
        setContentView(R.layout.activity_question_solve);
        chatBotUrl = getIntent().getStringExtra(KEY_CHATBOT_URL);
        subject = Subject.valueOf(getIntent().getStringExtra(KEY_SUBJECT));
        mChatDb = ChatMessageHistoryDB.getInstance(this, AppUtils.getUserId());
        initView();
        setChatCatalogue();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
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
        ChatAiView.ChatAiParam param = new ChatAiView.ChatAiParam();
        //param.sessionId = subject.name();
        param.showHeader = false;
        param.chatBotUrl = chatBotUrl;
        param.streamDisplay = subject == Subject.SUBJECT_BIOLOGY;
        param.showHistory = false;
        param.listener = success -> {
            if(mCurrentQuestionIndex >= 0 && mCurrentQuestionIndex < mQuestions.size()) {
                mQuestions.get(mCurrentQuestionIndex).isAiGuiding = false;
                adapterQuestionList.notifyItemChanged(mCurrentQuestionIndex);
            }
            chatResponceTimes++;
            if(chatResponceTimes >= 2) {
                setViewAnswer(true);
            }
        };

        mChatView.setChatAiParam(param);
        //mChatView.setAiName("AI解题助手");
        findViewById(R.id.btn_exit).setOnClickListener(v->{
            finish();
        });

        findViewById(R.id.btn_capture).setOnClickListener(v-> {
            Intent intent = new Intent(this, PhotoQuestionLookupActivity.class);
            intent.putExtra(PhotoQuestionLookupActivity.KEY_PARAM_SUBJECT, subject.name());
            startActivity(intent);
        });

        mRdoChatAi = findViewById(R.id.optChatAi);
        mRdoViewAnswer = findViewById(R.id.optAnswer);
        mRdoSimilarQuestion = findViewById(R.id.optSimilar);
        mTextEmptyQuestionTip = findViewById(R.id.txt_empty_question);

        ViewModelStoreOwner owner = (ViewModelStoreOwner) getApplication();
        userInfoViewModel = new ViewModelProvider(
                owner,
                new ViewModelProvider.AndroidViewModelFactory(getApplication())
        ).get(com.cosinetech.imates.models.UserInfoViewModel.class);

        RecyclerView recyclerView = findViewById(R.id.exerciseList);
        recyclerView.setLayoutManager(new LinearLayoutManager(this));
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
                        runOnUiThread(() -> {
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
                mCurrentQuestionIndex = pos;
                Question mCurrentQuestion = mQuestions.get(pos);
                mCurrentQuestion.getQuestion();
                mCurrentQuestion.isAiGuiding = false;
                adapterQuestionList.notifyItemChanged(pos);

                MarkdownTextView answer = findViewById(R.id.answerView);
                answer.setContent(mCurrentQuestion.answer + mCurrentQuestion.explanation);

                mChatView.setChatEnable(false);
                chatResponceTimes = 0;
                setViewAnswer(false);
                mChatView.clearChatHistory();

                if(subject == Subject.SUBJECT_BIOLOGY) {
                    View essay_view = findViewById(R.id.essay_question);
                    if (pos == mQuestions.size() - 1) {
                        mCurrentQuestion.isAiGuiding = true;
                        adapterQuestionList.notifyItemChanged(pos);
                        essay_view.setVisibility(View.VISIBLE);
                    } else {
                        essay_view.setVisibility(View.GONE);
                    }
                }
            }

            @Override
            public void onBeginGuideToSolveQuestion(int pos) {
                if(!mRdoChatAi.isChecked()) {
                    mRdoChatAi.setChecked(true);
                }

                if(mCurrentQuestionIndex >= 0 && mCurrentQuestionIndex < mQuestions.size()) {
                    mQuestions.get(mCurrentQuestionIndex).isAiGuiding = true;
                    adapterQuestionList.notifyItemChanged(mCurrentQuestionIndex);
                }

                String questionString = mQuestions.get(mCurrentQuestionIndex).getQuestion();
                long tick = System.currentTimeMillis();
                ChatMessageSession session = new ChatMessageSession(
                        UUID.nameUUIDFromBytes(questionString.getBytes()).toString(),
                        mChatCatalogue.catalogId,
                        (questionString.length() > ChatMessageSession.MAX_SESSION_NAME_LENGTH ?
                                questionString.substring(0, ChatMessageSession.MAX_SESSION_NAME_LENGTH) + "..." :
                                questionString),
                        ChatMessageSession.SessionType.USER_TALK_AI,
                        tick,
                        tick,
                        0);
                mChatDb.addMessageSession(session);
                mChatView.resetCurrentSession(session);

                aiChatMessageRequest.setName(userInfoViewModel.userInfo.getValue().getName());
                aiChatMessageRequest.setNewValue("1");
                aiChatMessageRequest.setSessionId(session.sessionId);
                aiChatMessageRequest.setQuestion(questionString);
                aiChatMessageRequest.setAnswer(mQuestions.get(mCurrentQuestionIndex).DAJX + mQuestions.get(mCurrentQuestionIndex).explanation);
                aiChatMessageRequest.setCoversation("我们开始吧");
                aiChatMessageRequest.setReason("start");
                aiChatMessageRequest.setBmNo(mQuestions.get(mCurrentQuestionIndex).bmNo);

                runOnUiThread(() -> {
                    mChatView.sendTextMessage(aiChatMessageRequest);
                    mChatView.setChatEnable(true);
                });
            }
        }) ;
        recyclerView.setAdapter(adapterQuestionList);

        RecyclerView recyclerViewSimilarQuestion = findViewById(R.id.similarExerciseView);
        recyclerViewSimilarQuestion.setLayoutManager(new LinearLayoutManager(this));
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

        initEssayQuestion();
        fetchQuestionList();

        RadioGroup radioGroup = findViewById(R.id.radioGroup);
        radioGroup.setOnCheckedChangeListener((group, checkedId) -> {
            if(checkedId == R.id.optChatAi) {
                findViewById(R.id.similarExerciseView).setVisibility(View.INVISIBLE);
                findViewById(R.id.answerView).setVisibility(View.INVISIBLE);
                findViewById(R.id.chat_view).setVisibility(View.VISIBLE);
            } else if(checkedId == R.id.optAnswer) {
                findViewById(R.id.similarExerciseView).setVisibility(View.INVISIBLE);
                findViewById(R.id.answerView).setVisibility(View.VISIBLE);
                findViewById(R.id.chat_view).setVisibility(View.INVISIBLE);
            } else if(checkedId == R.id.optSimilar) {
                findViewById(R.id.similarExerciseView).setVisibility(View.VISIBLE);
                findViewById(R.id.answerView).setVisibility(View.INVISIBLE);
                findViewById(R.id.chat_view).setVisibility(View.INVISIBLE);
                findSimilarQuestion();
            }
        });

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
        mChatCatalogue = new ChatMessageCatalogue(UUID.nameUUIDFromBytes(subject.name().getBytes()).toString(),
                getCatalogueName(),
                ChatMessageCatalogue.CatalogueType.USER,
                tick,
                tick);
        mChatDb.addMessageCatalogue(mChatCatalogue);
        mChatView.resetCurrentCatalog(mChatCatalogue);
    }

    private void findSimilarQuestion() {
        if(mCurrentQuestionIndex < 0 || mCurrentQuestionIndex >= mQuestions.size()) {
            return;
        }
        StringBuilder ids = new StringBuilder();
        for (Question qq:mQuestions) {
            ids.append(qq.bmNo).append(",");
        }
        String subjectName = "";
        if(subject == Subject.SUBJECT_BIOLOGY) {
            subjectName = "biology";
        } else if(subject == Subject.SUBJECT_MATH) {
            subjectName = "math";
        }

        FindSimilarQuestionRequest item = FindSimilarQuestionRequest.fromQuestion(mQuestions.get(mCurrentQuestionIndex), ids.toString(), subjectName);
        ApiGateWayService.querySimilarExerciseList(item, ApiUrl.URL_QUERY_SIMILAR_EXERCISE, userInfoViewModel.token.getValue(), new ApiGateWayService.QueryExerciseListCallback() {
            @Override
            public void onSuccess(List<Question> q) {
                runOnUiThread(() -> {
                    mSimilarQuestion.clear();
                    mSimilarQuestion.addAll(q);
                    adapterSimilarQuestionList.resetSelection();
                    adapterSimilarQuestionList.notifyDataSetChanged();
                });
            }

            @Override
            public void onFailure(String msg, int code) {
                runOnUiThread(() -> {
                    Toast.makeText(QuestionSolveActivity.this, msg, Toast.LENGTH_SHORT).show();
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
            public void onSuccess(List<Question> q) {
                runOnUiThread(() -> {
                    mQuestions.clear();
                    mQuestions.addAll(q);
                    if(subject == Subject.SUBJECT_BIOLOGY) {
                        mQuestions.add(getEssayQuestion());
                    }
                    adapterQuestionList.resetSelection();
                    adapterQuestionList.notifyDataSetChanged();
                    updateQuestionListTip();
                });
            }

            @Override
            public void onFailure(String msg, int code) {
                runOnUiThread(() -> {
                    updateQuestionListTip();
                    Toast.makeText(QuestionSolveActivity.this, msg, Toast.LENGTH_SHORT).show();
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


    List<String []> episodes = new ArrayList<>();
    String essayQuestionTrunk = "  植物通过调节激素水平协调自身生长和逆境响应（应对不良环境的系列反应）的关系，研究者对其分子机制进行了探索。";
    private void initEssayQuestion() {
        // 题\答案\解析
        String [] episode1 = new String[] {
            "  （1）生长素（IAA）具有促进生长的作用，脱落酸（ABA）可提高抗逆性并抑制茎叶生长，两种激素均作为(a)____分子，调节植物生长及逆境响应。",
                "答案：信息  \n解析：两种植物激素均作为信息分子，参与调节植物生长及逆境响应。",
                "### 第（1）问答案和解析步骤      \n"
                        + "信息分子引导植物进行生长调节,因此答案是“信息”。"
        };

        String [] episode2 = new String[] {
            "  （2）TS基因编码的蛋白（TS）促进IAA的合成。研究发现，拟南芥受到干旱胁迫时，TS基因表达下降，生长减缓。"
                    + "研究者用野生型（WT）和TS基因功能缺失突变株（ts）进行实验，结果如图甲。  <br />"
                    + "![图甲](https://www.imates.com.cn/essays/essay_q_2_0.png)  <br />"
                    + "图甲结果显示，TS 基因功能缺失导致(b)________________________。",
            "答案:IAA含量下降，在干早条件下ts的生存率高于WT  \n解析:由图甲可知，TS 基因缺失会导致 IAA 含量降低，植株生长减缓，同时在干旱条件下，TS 基因功能缺失突变株(ts)生存率比正常植株生存率更高。",
            "### 第（2）问答案和解析步骤    \n"
                    + "1- 由图甲左图可知，TS 基因缺失会导致 IAA 含量降低，植株生长减缓。    \n"
                    + "2- 由图甲右图可知，在干旱条件下，TS 基因功能缺失突变株(ts)生存率比正常植株生存率更高。    \n"
                    + "3- 因此答案为：IAA 含量下降，在干早条件下ts的生存率高于 WT。    \n"
                    + "### 第（2）问图片内容    \n"
                    + "图中描述了两种植物（WT和ts）在正常条件和干旱处理下的IAA含量和生存率。    \n"
                    + "左侧的柱状图显示了WT和ts在正常条件下的IAA含量，其中WT的IAA含量约为40 ng·g^-1鲜重，而ts的IAA含量约为30 ng·g^-1鲜重。    \n"
                    + "右侧的柱状图显示了WT和ts在正常条件和干旱处理下的生存率，在正常条件下，WT和ts的生存率均为100%，而在干旱处理下，WT的生存率下降至约20%，而ts的生存率保持在约80%。"
        };

        String [] episode3 = new String[] {
                "  （3）为了探究TS影响抗旱性的机制，研究者通过实验，鉴定出一种可与TS结合的酶BG。已知BG催化"
                        + "ABA-葡萄糖苷水解力ABA。提取纯化 TS 和 BG，进行体外酶活性测定，结果如图乙。"
                        + "由实验结果可知 TS 具有抑制 BG 活性的作用，判断依据是：(c)________________________。  \n"
                        + "![图乙](https://www.imates.com.cn/essays/essay_q_3_0.png)",
                "答案:随着TS量的增加，BG活性降低    \n解析：由图乙可知，在 0~2μg 的浓度范围内，随着 TS 浓度的升高， BG 活性逐渐降低，证明 TS 具有抑制 BG 活性的作用。",
                "### 第（3）问答案和解析步骤     \n"
                       + "1- 由图乙可知，在 0~2μg 的浓度范围内，随着 TS 浓度的升高， BG 活性逐渐降低，证明 TS 具有抑制 BG 活性的作用。   \n"
                       + "2- 因此答案为：随着TS 量的增加，BG 活性降低   \n"
                       + "### 第（3）问图片内容   \n"
                       + "图乙展示了不同浓度的TS对BG活性的影响。从图中可以看出，随着TS浓度的增加（0、0.5、1、2 μg），BG的活性逐渐降低。具体来说：   \n"
                       + "   \n"
                       + "- 当TS浓度为0 μg时，BG活性约为6 ng ABA·min⁻¹。   \n"
                       + "- 当TS浓度为0.5 μg时，BG活性降至约4 ng ABA·min⁻¹。   \n"
                       + "- 当TS浓度为1 μg时，BG活性进一步降至约3 ng ABA·min⁻¹。   \n"
                       + "- 当TS浓度为2 μg时，BG活性降至约2 ng ABA·min⁻¹。   \n"
                       + "   \n"
                       + "此外，当TS和BG都不存在（即0 μg TS和0 μg BG）时，BG活性几乎为0。   \n"
                       + "   \n"
                       + "根据这些结果，可以判断TS具有抑制BG活性的作用。这是因为随着TS浓度的增加，BG的活性显著下降，说明TS能够与BG结合并抑制其催化ABA-葡萄糖苷水解的能力。"
        };

        String [] episode4 = new String[] {
                "  （4）为了证明 TS通过抑制BG活性降低 ABA 水平，可检测野生型和三种突变株中的ABA 含量。"
                        + "请在图丙“(d)（_____）”处补充第三种突变株的类型，并在图中相应位置绘出能证明上述结论的结果 (e)_____。  "
                        + "![图丙](https://www.imates.com.cn/essays/essay_q_4_0.png)",
                "答案:  \n![答案](https://www.imates.com.cn/essays/essay_a_4_0.png)  \n解析:根据图可知，还需要在图丙中补充 TS、BG 功能缺失突变株(ts+ bg)实验组，因为 TS 是通过 BG 发挥调节功能，所以如果 BG 无法发挥功能，是否存在 TS 对实验结果几乎没有影响，该组与bg组结果相同，相应的图如下：  \n![答案](https://www.imates.com.cn/essays/essay_a_4_1.png)",
                "### 第（4）问答案和解析步骤    \n"
                        + "1- 确认学生了解实验目的**为了证明 TS通过抑制BG活性降低 ABA 水平**是要证实A通过B影响C的实验，我们将这类问题统称为**上下游问题**。   \n"
                        + "2- 上下游实验具体步骤如下:若想验证变量B是否在变量A对变量C的影响中起到中介作用，即B是下游A是上游，需检验：当B存在时，A对C有显著影响；当B缺失时，A对C无显著影响；则说明A对C的显著影响需要通过B作为介质，即A在B的条件下与C具有相关性。   \n"
                        + "3- 可以设计以下几组实验：即给A(ts)，给B(bg)；不给A，给B；给A，不给B；不给A，不给B，因此结合图中已给的三根柱子，分别对应以上前三组，因此最后一组的突变型应为两个都不给的双突变体，可以写成（ts, bg）。    \n"
                        + "4- 确定图丙（ts, bg）组对应的柱状图高度，即ABA含量浓度，依据上下游问题，如果不给处于下游的B条件，那么上游有没有A，结果是一致的。因此下游不给与都不给的结果一致，即第四根柱子结果与第三根相同。    \n"
                        + "### 第（4）问图片内容    \n"
                        + "图丙显示了不同类型的植物突变株中ABA（脱落酸）的含量。图中的柱状图表示三种不同类型的植物样本：野生型（WT）、TS功能缺失突变株（ts）和BG功能缺失突变株（bg）。每个柱子的高度代表了每种类型植物中ABA的含量，单位为ng/g鲜重。    \n"
                        + "    \n"
                        + "- WT（野生型）：ABA含量约为7 ng/g鲜重。    \n"
                        + "- ts（TS功能缺失突变株）：ABA含量显著增加，约为15 ng/g鲜重。    \n"
                        + "- bg（BG功能缺失突变株）：ABA含量较低，约为3 ng/g鲜重。    \n"
                        + "    \n"
                        + "根据题目信息，为了证明TS通过抑制BG活性降低ABA水平，需要补充第三种突变株的类型，并在图中相应位置绘出能证明上述结论的结果。"
        };

        String [] episode5 = new String[] {
                "  （5）综合上述信息可知，TS 能精细协调生长和逆境响应之间的平衡，使植物适应复杂多变的环境。"
                        + "请完善 TS 调节机制模型（从正常和干旱两种条件任选其一，以未选择的条件为对照，在方框中以文字和箭头的形式作答）",
                "答案:![答案](https://www.imates.com.cn/essays/essay_a_5_0.png)",
                "### 第（5）问答案和解析步骤    \n"
                        + "1- 获得框内的应该包含的要素，结合题意，机制类题型应找准逻辑起点TS，逻辑终点是抑制生长，那么结合题意应该考虑TS如何去调节两种激素IAA和ABA，因此要填这两个要素。再结合题意TS对ABA的影响是通过BG，故而确定要素有TS，BG，IAA，ABA。    \n"
                        + "2- 找到各个元素之间的关系，根据第（2）题干“TS基因编码的蛋白（TS）促进IAA的合成。”很容易确定两者的关系。根据第（3）确定TS可与BG结合，从而抑制BG的活性，而BG是催化ABA合成的酶。    \n"
                        + "3- 再结合第（1）“生长素（IAA）具有促进生长的作用，脱落酸（ABA）可提高抗逆性并抑制茎叶生长”，可梳理清楚答案。    \n"
                        + "### 第（5）问图片内容    \n"
                        + "根据图片内容，图中描述了在正常环境和干旱环境下植物的生长状态。具体来说：    \n"
                        + "    \n"
                        + "- 在正常环境中，植物生长正常。    \n"
                        + "- 在干旱环境中，植物生长缓慢但抗逆性强。    \n"
                        + "    \n"
                        + "题目要求完善TS调节机制模型，从正常和干旱两种条件任选其一，以未选择的条件为对照，在方框中以文字和箭头的形式作答。    \n"
                        + "    \n"
                        + "为了完成这个任务，你需要在方框中填写文字和箭头，描述TS如何调节植物在正常或干旱环境下的生长状态。"
        };
        episodes.add(episode1);
        episodes.add(episode2);
        episodes.add(episode3);
        episodes.add(episode4);
        episodes.add(episode5);

        Button btnHide = findViewById(R.id.btn_exit_question);
        btnHide.setOnClickListener(v->{
            if(mCurrentQuestionIndex >= 0 && mCurrentQuestionIndex < mQuestions.size()) {
                mQuestions.get(mCurrentQuestionIndex).isAiGuiding = true;
                adapterQuestionList.notifyItemChanged(mCurrentQuestionIndex);
            }
            findViewById(R.id.essay_question).setVisibility(View.GONE);
        });

        MarkdownTextView viewEssayTrunk = findViewById(R.id.essay_trunk);
        viewEssayTrunk.setContent(essayQuestionTrunk);

        MarkdownTextView viewEpisode1 = findViewById(R.id.essay_episode1);
        viewEpisode1.setContent(episode1[0]);

        MarkdownTextView viewEpisode2 = findViewById(R.id.essay_episode2);
        viewEpisode2.setContent(episode2[0]);

        MarkdownTextView viewEpisode3 = findViewById(R.id.essay_episode3);
        viewEpisode3.setContent(episode3[0]);

        MarkdownTextView viewEpisode4 = findViewById(R.id.essay_episode4);
        viewEpisode4.setContent(episode4[0]);

        MarkdownTextView viewEpisode5 = findViewById(R.id.essay_episode5);
        viewEpisode5.setContent(episode5[0]);

        ImageView imageView4 = findViewById(R.id.answer_episode4_1);
        imageView4.setOnClickListener(v->{
            openImagePicker(PICK_IMAGE_REQUEST_T4);
        });

        ImageView imageView5 = findViewById(R.id.answer_episode5);
        imageView5.setOnClickListener(v->{
            openImagePicker(PICK_IMAGE_REQUEST_T5);
        });

        int [] guideBtnIds = new int[] {R.id.btn_answer_episode1, R.id.btn_answer_episode2, R.id.btn_answer_episode3, R.id.btn_answer_episode4, R.id.btn_answer_episode5};
        int [] submitBtnIds = new int []{R.id.btn_submit_episode1, R.id.btn_submit_episode2, R.id.btn_submit_episode3, R.id.btn_submit_episode4, R.id.btn_submit_episode5};
        for(int idx = 0; idx < guideBtnIds.length; idx++) {
            Button btnChat = findViewById(guideBtnIds[idx]);
            int finalIdx = idx;
            btnChat.setOnClickListener(v-> {
                initEpisodeChat(finalIdx);
                aiChatMessageRequest.setCoversation("我们开始吧");
                mChatView.sendTextMessage(aiChatMessageRequest);
                mChatView.setChatEnable(true);
            });
        }

        for(int idx = 0; idx < submitBtnIds.length; idx++) {
            Button btnSubmit = findViewById(submitBtnIds[idx]);
            int finalIdx = idx;
            btnSubmit.setOnClickListener(v->{
                String conversationMarkdown = "";
                if(finalIdx == 0) { //第1小题
                    EditText et = findViewById(R.id.answer_episode1);
                    if(!et.getText().toString().trim().isEmpty()) {
                        conversationMarkdown = "(a):" + et.getText().toString().trim();
                    }
                } else if(finalIdx == 1) { //第2小题
                    EditText et = findViewById(R.id.answer_episode2);
                    if(!et.getText().toString().trim().isEmpty()) {
                        conversationMarkdown = "(b):" + et.getText().toString().trim();
                    }
                } else if(finalIdx == 2) { //第3小题
                    EditText et = findViewById(R.id.answer_episode3);
                    if(!et.getText().toString().trim().isEmpty()) {
                        conversationMarkdown = "(c):" + et.getText().toString().trim();
                    }
                } else if(finalIdx == 3) { //第4小题
                    EditText et = findViewById(R.id.answer_episode4);
                    String text = et.getText().toString().trim();
                    ImageView imgView = findViewById(R.id.answer_episode4_1);
                    Uri path = imgView.getTag()  == null ? null : (Uri)imgView.getTag();
                    if(!text.isEmpty() && path != null) {
                        String remoteName = java.util.UUID.randomUUID().toString() + ".jpg";
                        if(uploadFile(path, remoteName)) {
                            conversationMarkdown = "(d):" + text + "  \n"
                                    + "(e):![(e)](" + ApiUrl.URL_RESOURCE_BASE+ "/essays/" +remoteName + ")";
                        } else {
                            Toast.makeText(this, "上传答案失败, 检查网络连接", Toast.LENGTH_SHORT).show();
                            return;
                        }
                    }
                } else if(finalIdx == 4) { //第5小题
                    ImageView imgView = findViewById(R.id.answer_episode5);
                    Uri path = imgView.getTag()  == null ? null : (Uri)imgView.getTag();
                    if(path != null) {
                        String remoteName = ApiUrl.URL_RESOURCE_BASE + "/" + java.util.UUID.randomUUID().toString() + ".jpg";
                        if(uploadFile(path, remoteName)) {
                            conversationMarkdown = "(f):![(f)](" +ApiUrl.URL_RESOURCE_BASE+ "/essays/" +remoteName + ")";
                        } else {
                            Toast.makeText(this, "上传答案失败, 检查网络连接", Toast.LENGTH_SHORT).show();
                            return;
                        }
                    }
                } else {
                    return;
                }

                if(conversationMarkdown.trim().isEmpty()) {
                    Toast.makeText(this, "请先完整写出你的答案再提交答案", Toast.LENGTH_SHORT).show();
                    return;
                }
                initEpisodeChat(finalIdx);
                aiChatMessageRequest.setCoversation(conversationMarkdown);
                mChatView.sendTextMessage(aiChatMessageRequest);
                mChatView.setChatEnable(true);
            });
        }
    }

    private boolean uploadFile(Uri localPath, String remoteName) {
         HttpFileUploader.uploadFile(this, localPath, remoteName, new HttpFileUploader.UploadCallback() {
            @Override
            public void onSuccess(String message) {
            }

            @Override
            public void onFailure(String error) {
            }
        });

        return true;
    }

    private void openImagePicker(int requestCode) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("image/*");
        startActivityForResult(intent, requestCode);
    }

    private final int PICK_IMAGE_REQUEST_T4 = 4;
    private final int PICK_IMAGE_REQUEST_T5 = 5;
    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == PICK_IMAGE_REQUEST_T4 && resultCode == RESULT_OK && data != null) {
            Uri selectedImageUri = data.getData();
            if (selectedImageUri != null) {
                // 显示图片
                ImageView imageView = findViewById(R.id.answer_episode4_1);
                imageView.setImageURI(selectedImageUri);

                // 获取图片路径
                //String imagePath = getRealPathFromURI(selectedImageUri);
                imageView.setTag(selectedImageUri);
            }
        } else if(requestCode == PICK_IMAGE_REQUEST_T5 && resultCode == RESULT_OK && data != null) {
            Uri selectedImageUri = data.getData();
            if (selectedImageUri != null) {
                // 显示图片
                ImageView imageView = findViewById(R.id.answer_episode5);
                imageView.setImageURI(selectedImageUri);

                // 获取图片路径
               // String imagePath = getRealPathFromURI(selectedImageUri);
                imageView.setTag(selectedImageUri);
            }
        }
    }

    private String getRealPathFromURI(Uri uri) {
        String[] projection = {MediaStore.Images.Media.DATA};
        Cursor cursor = getContentResolver().query(uri, projection, null, null, null);
        if (cursor != null) {
            int columnIndex = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DATA);
            cursor.moveToFirst();
            String path = cursor.getString(columnIndex);
            cursor.close();
            return path;
        }
        return uri.toString();
    }


    private void initEpisodeChat(int finalIdx) {
        if(!mRdoChatAi.isChecked()) {
            mRdoChatAi.setChecked(true);
        }

        mQuestions.get(mCurrentQuestionIndex).answer = episodes.get(finalIdx)[1];

        MarkdownTextView answer = findViewById(R.id.answerView);
        answer.setContent(episodes.get(finalIdx)[1]);

        mChatView.setChatEnable(false);
        chatResponceTimes = 0;
        setViewAnswer(false);
        mChatView.clearChatHistory();

        aiChatMessageRequest.setName(userInfoViewModel.userInfo.getValue().getName());
        aiChatMessageRequest.setNewValue("1");
        //aiChatMessageRequest.setSessionId(String.valueOf(System.currentTimeMillis()));
        aiChatMessageRequest.setQuestion(essayQuestionTrunk + "\n" + episodes.get(finalIdx)[0]);
        aiChatMessageRequest.setAnswer(episodes.get(finalIdx)[1] + "\n" + episodes.get(finalIdx)[2]);
        aiChatMessageRequest.setReason("start");
        aiChatMessageRequest.setBmNo("");
    }

    private Question getEssayQuestion() {
        Question q = new Question();
        q.title = "解答题:  \n植物通过调节激素水平协调自身生长和逆境响应（应对不良环境的系列反应）的关系，研究者对其分子机制进行了探索。";
        q.answer = "(1) 信息  " +
                "(2) IAA含量下降，在干早条件下ts的生存率高于WT  " +
                "(3) 随着TS量的增加，BG活性降低  " +
                "(4) 答案如图:![答案](https://www.imates.com.cn/essays/essay_a_4_0.png \"答案\")  " +
                "(5) 答案如图:![答案](https://www.imates.com.cn/essays/essay_a_5_0.png \"答案\")";
        return q;
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
    }
}