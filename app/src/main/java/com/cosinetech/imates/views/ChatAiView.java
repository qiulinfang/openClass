package com.cosinetech.imates.views;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.graphics.Rect;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.util.AttributeSet;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.ExpandableListView;
import android.widget.ImageView;
import android.widget.RelativeLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.fragment.app.FragmentActivity;
import androidx.lifecycle.ViewModelProvider;
import androidx.lifecycle.ViewModelStoreOwner;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.cosinetech.imates.ApplicationModelShared;
import com.cosinetech.imates.R;
import com.cosinetech.imates.activities.QuestionSolveActivity;
import com.cosinetech.imates.activities.ScreenShotActivity;
import com.cosinetech.imates.adapters.AdapterAiChatMessageList;
import com.cosinetech.imates.adapters.ChatExpandableListAdapter;
import com.cosinetech.imates.audio.AudioRecordManager;
import com.cosinetech.imates.audio.IAudioRecordListener;
import com.cosinetech.imates.models.ChatAiParam;
import com.cosinetech.imates.models.ChatDisplayItem;
import com.cosinetech.imates.models.ChatMessage;
import com.cosinetech.imates.models.ChatMessageCatalogue;
import com.cosinetech.imates.models.ChatMessageHistoryDB;
import com.cosinetech.imates.models.ChatMessageSession;
import com.cosinetech.imates.models.UserInfoViewModel;
import com.cosinetech.imates.mq.MessagingManager;
import com.cosinetech.imates.mq.StudentMessage;
import com.cosinetech.imates.mq.TeacherMessage;
import com.cosinetech.imates.mq.TeacherQaType;
import com.cosinetech.imates.util.AppUtils;
import com.cosinetech.imates.util.ImageUtils;
import com.cosinetech.imates.util.VoiceDbUtil;
import com.cosinetech.imates.webservice.AiChatMessageRequest;
import com.cosinetech.imates.webservice.ApiGateWayService;
import com.scwang.smart.refresh.layout.SmartRefreshLayout;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

public class ChatAiView extends RelativeLayout {
    public interface AiChatResponseListener {
        void onAiChatResponse(boolean success);
    }

    public interface OnSendToTeacherListener {
        void onSendToTeacher();
    }

    public interface OnScreenshotCapturedListener {
        void onScreenshotCaptured(String screenshotPath);
    }

    private UserInfoViewModel mUserInfoViewModel;
    private Context mContext;
    private AiChatMessageRequest mAiChatRequest = new AiChatMessageRequest("", "", "", "", "", "", "start", "", false);
    private AdapterAiChatMessageList mAdapterAiChatMessageList;
    private final List<ChatDisplayItem> messageList = new ArrayList<>();
    private RecyclerView mMsgDetailListView;
    private SmartRefreshLayout mMsgRefreshLayout;
    private EditText mEditMsg;
    private Button mBtnSendText;
    private CheckBox chkViewHistory;
    private TextView mTextViewTitle;
    private Button mKeyboardInputButton;
    private Button mVoiceInputButton;
    private Button mVoiceMessageButton;
    private CheckBox mCheckSearchWeb;
    private Button mSendPictureButton;
    private ChatAiParam mChatAiParam;
    private AiChatResponseListener mListener;
    private View voiceAnimateLayout;
    private CheckBox mSelectChatItemButton;
    private View mAskTeacherLayout;
    private Button mAskTeacherButton;
    private RelativeLayout rootLayout; // 用于调整布局的父布局
    private boolean mInSearchMode = false;
    private ChatMessageHistoryDB mChatDb;
    private ChatMessageCatalogue mCurrentCatalog;
    private ChatMessageSession mCurrentSession;
    private ExpandableListView expandableListView;
    private ChatExpandableListAdapter mChatSessionListAdapter;

    private ChatMessageSession mChatTeacherSession;
    private int clickCount = 0; // 记录点击次数

    private ChatMessage mLastReceivingMsg;

    private String mScreenShotImageUUID = "";

    private String mAudioRecordUUID = "";
    private boolean mAudioRecordCancel = false;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable resetClickCountRunnable = new Runnable() {
        @Override
        public void run() {
            clickCount = 0; // 重置点击次数
            handler.postDelayed(this, 2000);
        }
    };

    private OnSendToTeacherListener mSendTeacherListener;

    private ActivityResultLauncher<Intent> mScreenshotLauncher;
    private OnScreenshotCapturedListener mScreenshotCapturedListener;

    public ChatAiView(Context context) {
        super(context);
        init(context);
    }

    public ChatAiView(Context context, AttributeSet attrs) {
        super(context, attrs);
        init(context);
    }

    public ChatAiView(Context context, AttributeSet attrs, int defStyleAttr) {
        super(context, attrs, defStyleAttr);
        init(context);
    }

    public void registerForActivityResult(FragmentActivity activity) {
        mScreenshotLauncher = activity.registerForActivityResult(
                new ActivityResultContracts.StartActivityForResult(),
                result -> {
                    if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
                        // Get the screenshot path from the result
                        String screenshotPath = result.getData().getStringExtra(ScreenShotActivity.KEY_FINAL_IMAGE_PATH);
                        if (screenshotPath != null && !screenshotPath.isEmpty()) {
                            if (mScreenshotCapturedListener != null) {
                                mScreenshotCapturedListener.onScreenshotCaptured(screenshotPath);
                            }
                        }
                    }
                }
        );
    }

    private void launchScreenshotActivity() {
        if (mScreenshotLauncher != null) {
            Intent intent = new Intent(getContext(),  ScreenShotActivity.class);
            intent.setAction(ScreenShotActivity.ACTION_EDIT_IMAGE);
            intent.putExtra(ScreenShotActivity.KEY_SET_STORE_DIR, AppUtils.getUserFilePath().getAbsolutePath());
            intent.putExtra(ScreenShotActivity.KEY_SET_FILE_NAME, mScreenShotImageUUID + ".png");
            mScreenshotLauncher.launch(intent);
        }
    }

    public void setOnScreenshotCapturedListener(OnScreenshotCapturedListener listener) {
        this.mScreenshotCapturedListener = listener;
    }

    public void setSendTeacherListener(OnSendToTeacherListener l) {
        mSendTeacherListener = l;
    }

    public void setChatAiParam(ChatAiParam param) {
        this.setVisibility(VISIBLE);
        mChatAiParam = param;
        if(mChatAiParam != null) {
            initView(getContext());
            loadData();
        }
    }

    public void setChatResponseListener(AiChatResponseListener l) {
        mListener = l;
    }

    public void resetCurrentSession(ChatMessageCatalogue catalogue, ChatMessageSession session) {
        resetCurrentCatalog(catalogue);
        if(!mCurrentSession.sessionId.equals(session.sessionId)) {
            clearChatHistory();
            loadSelectedSessionMsg(session);
            mAiChatRequest.setNewValue("1");
        } else {
            mAiChatRequest.setNewValue("0");
        }
        mCurrentSession = session;
        if(mCurrentSession.type == ChatMessageSession.SessionType.USER_TALK_AI
                || mCurrentSession.type == ChatMessageSession.SessionType.SYSTEM_TALK_AI) {
            mAdapterAiChatMessageList.setOtherAvastarIconRes(R.drawable.chat_ai_avatar_robot);
            setChatAiSendMode(true);
        } else if (mCurrentSession.type == ChatMessageSession.SessionType.USER_FAVOR) {
            mAdapterAiChatMessageList.setOtherAvastarIconRes(R.drawable.chat_ai_avatar_robot);
            setChatAiSendMode(true);
            setChatEnable(false);
        } else {
            mAdapterAiChatMessageList.setOtherAvastarIconRes(R.drawable.avatar_7);
            setChatAiSendMode(false);
            setChatEnable(true);
        }

        mAskTeacherLayout.setVisibility(GONE);
        if(mCurrentCatalog.type.getValue() >= ChatMessageCatalogue.CatalogueType.USER_SUBJECT_BEGIN.getValue()
            && mCurrentCatalog.type.getValue() <= ChatMessageCatalogue.CatalogueType.USER_SUBJECT_END.getValue()) {
            mSelectChatItemButton.setVisibility(VISIBLE);
        } else {
            mSelectChatItemButton.setVisibility(GONE);
        }

        mAdapterAiChatMessageList.setItemCanSelect(false);
        mSelectChatItemButton.setChecked(false);

        String aiName = mCurrentCatalog.catalogName + " - " + mCurrentSession.sessionName;
        mTextViewTitle.setText(aiName);

        long timestamp = System.currentTimeMillis();
        mChatDb.updateMessageSessionLastReadTime(mCurrentSession.sessionId, timestamp, timestamp);

        mChatSessionListAdapter.setSelectedSessionId(mCurrentSession.sessionId);
        mAiChatRequest.setSessionId(mCurrentSession.sessionId);
        mChatSessionListAdapter.notifyDataSetChanged();
        mAdapterAiChatMessageList.notifyDataSetChanged();
    }

    public void resetCurrentCatalog(ChatMessageCatalogue catalogue) {
        mCurrentCatalog = catalogue;
        String aiName = mCurrentCatalog.catalogName + " - " + mCurrentSession.sessionName;
        mTextViewTitle.setText(aiName);
    }

    private void init(Context context) {
        mContext = context;
        // Required empty public constructor
        ViewModelStoreOwner owner = ApplicationModelShared.getInstance();
        mUserInfoViewModel = new ViewModelProvider(
                owner,
                new ViewModelProvider.AndroidViewModelFactory(ApplicationModelShared.getInstance())
        ).get(UserInfoViewModel.class);
        mChatDb = ChatMessageHistoryDB.getInstance(context, AppUtils.getUserId());

        mChatDb.addMessageCatalogue(ChatMessageCatalogue.CATEGORY_TEACHER_QA);
        mChatDb.addMessageCatalogue(ChatMessageCatalogue.CATEGORY_DEFAULT_SYSTEM);
        mChatDb.addMessageCatalogue(ChatMessageCatalogue.CATEGORY_MY_FAVOR);

        mChatDb.addMessageSession(ChatMessageSession.SESSION_DEFAULT_SYSTEM);

        mCurrentCatalog = ChatMessageCatalogue.CATEGORY_DEFAULT_SYSTEM;
        mCurrentSession = ChatMessageSession.SESSION_DEFAULT_SYSTEM;
    }

    @SuppressLint("ClickableViewAccessibility")
    private void initView(Context context) {
        // Inflate the layout for this fragment
        View view = LayoutInflater.from(mContext).inflate(R.layout.view_chat_ai, this, false);
        mMsgDetailListView = view.findViewById(R.id.chat_msg_list);
        mMsgRefreshLayout = view.findViewById(R.id.chat_msg_refresh_layout);
        mEditMsg = view.findViewById(R.id.et_message);
        mBtnSendText = view.findViewById(R.id.btn_send);
        mTextViewTitle = view.findViewById(R.id.ai_name);
        mSelectChatItemButton = view.findViewById(R.id.chk_select_history);
        mAskTeacherLayout = view.findViewById(R.id.select_history_function);
        mAskTeacherButton = view.findViewById(R.id.btn_ask_teacher);
        mSendPictureButton = view.findViewById(R.id.btn_send_picture);
        chkViewHistory = view.findViewById(R.id.btn_view_history);
        voiceAnimateLayout = view.findViewById(R.id.voice_animate_area);
        mKeyboardInputButton = view.findViewById(R.id.input_keyboard);
        mVoiceInputButton = view.findViewById(R.id.btn_voice);
        mVoiceMessageButton = view.findViewById(R.id.voice_message);
        mCheckSearchWeb = view.findViewById(R.id.check_search_web);
        rootLayout = view.findViewById(R.id.layout_chat);  // 父布局
        expandableListView = view.findViewById(R.id.expandable_list_view);
        ImageView viewCancelSend = view.findViewById(R.id.cancel_record);
        EditText editTextSearch = view.findViewById(R.id.et_search);
        CheckBox btnCancelSearch = view.findViewById(R.id.btn_search);
        Button btnNewChat = view.findViewById(R.id.btn_new_chat);
        Button btnAddFavor = view.findViewById(R.id.btn_add_favor);

        mSendPictureButton.setOnClickListener(v->{
            mScreenShotImageUUID = UUID.randomUUID().toString();
            if (context instanceof FragmentActivity) {
                launchScreenshotActivity();
            }
        });

        btnNewChat.setOnClickListener(v->{
            createChatSession();
        });

        mSelectChatItemButton.setOnCheckedChangeListener((buttonView, isChecked) -> {
            if(isChecked) {
                mAskTeacherLayout.setVisibility(VISIBLE);
                mAdapterAiChatMessageList.setItemCanSelect(true);
            } else {
                mAskTeacherLayout.setVisibility(GONE);
                mAdapterAiChatMessageList.setItemCanSelect(false);
            }
            mAdapterAiChatMessageList.notifyDataSetChanged();
        });

        mAskTeacherButton.setOnClickListener(v->{
            mAdapterAiChatMessageList.setItemCanSelect(false);
            mSelectChatItemButton.setChecked(false);
            mAskTeacherLayout.setVisibility(GONE);

            List<ChatDisplayItem> items = mAdapterAiChatMessageList.getSelectedItem();
            //切换到老师会话
            if(mChatTeacherSession == null) {
                ChatMessageSession.SessionType type;
                if(mCurrentCatalog.type == ChatMessageCatalogue.CatalogueType.USER_BIOLOGY) {
                    type = ChatMessageSession.SessionType.USER_TALK_TEACHER_BIOLOGY;
                } else {
                    type = ChatMessageSession.SessionType.USER_TALK_TEACHER_MATH;
                }
                mChatTeacherSession = QuestionSolveActivity.createChatTeacherSession(mCurrentSession.sessionId,
                        mCurrentSession.sessionName, type);
            }

            mChatDb.addMessageSession(mChatTeacherSession);
            mChatSessionListAdapter.addSession(mChatTeacherSession);
            mChatSessionListAdapter.notifyDataSetChanged();
            resetCurrentSession(ChatMessageCatalogue.CATEGORY_TEACHER_QA, mChatTeacherSession);

            for (ChatDisplayItem item: items) {
                ChatMessage msg = item.chatMessage;
                if(msg.type == ChatMessage.MessageType.TEXT) {
                    sendTextMessageToTeacher(msg.content);
                } else if(msg.type == ChatMessage.MessageType.IMAGE) {
                    sendPictureToTeacher(msg.content);
                } else if(msg.type == ChatMessage.MessageType.VOICE) {
                    VoiceDbUtil.VoiceDbItem vi = VoiceDbUtil.extractDbVoiceContent(msg.content);
                    sendVoiceMessageToTeacher(vi.voicePath, vi.duration);
                }
            }

            if(mSendTeacherListener != null) {
                mSendTeacherListener.onSendToTeacher();
            }

            loadSelectedSessionMsg(mCurrentSession);
            mAdapterAiChatMessageList.notifyDataSetChanged();
        });

        mEditMsg.setOnFocusChangeListener((v, hasFocus) -> {
            if (hasFocus) {
                new Handler(Looper.getMainLooper()).postDelayed(() -> {
                    InputMethodManager imm = (InputMethodManager) mEditMsg.getContext().getSystemService(Context.INPUT_METHOD_SERVICE);
                    imm.showSoftInput(mEditMsg, InputMethodManager.SHOW_IMPLICIT);
                }, 500); // 延迟 200 毫秒
            }
        });

        // Initialize RecyclerView
        mMsgDetailListView.setLayoutManager(new LinearLayoutManager(mContext, LinearLayoutManager.VERTICAL, false));
        mMsgDetailListView.addItemDecoration(new RecyclerViewOverscrollDecoration());
        mMsgDetailListView.setClipToPadding(false);// disabling clip to padding is critical

        mAdapterAiChatMessageList = new AdapterAiChatMessageList(getContext(), messageList);
        mMsgDetailListView.setAdapter(mAdapterAiChatMessageList);

        // Set up SmartRefreshLayout for pull-to-refresh
        mMsgRefreshLayout.setOnRefreshListener(refreshLayout -> {
            // Handle refresh
            loadHistoryMessages();
            refreshLayout.finishRefresh();
        });

        // Send button click
        mBtnSendText.setOnClickListener(v -> {
            String content = mEditMsg.getText().toString().trim();
            if(content.isEmpty()) {
                return;
            }
            if(mCurrentSession.type == ChatMessageSession.SessionType.SYSTEM_TALK_AI
                || mCurrentSession.type == ChatMessageSession.SessionType.USER_TALK_AI) {
                sendTextMessageToAi(content);
            } else { //和老师的对话
                sendTextMessageToTeacher(content);
            }
            mEditMsg.setText("");
        });


        chkViewHistory.setOnCheckedChangeListener((buttonView, isChecked) -> {
            if(isChecked) {
                view.findViewById(R.id.history_layout).setVisibility(View.VISIBLE);
                //view.findViewById(R.id.chat_input_area).setVisibility(View.INVISIBLE);
            } else {
                view.findViewById(R.id.history_layout).setVisibility(View.GONE);
                //view.findViewById(R.id.chat_input_area).setVisibility(View.VISIBLE);
            }
        });

        btnCancelSearch.setOnCheckedChangeListener((buttonView, isChecked) -> {
            if(isChecked) {
                editTextSearch.setVisibility(VISIBLE);
                editTextSearch.requestFocus();
                // 隐藏键盘
                InputMethodManager imm = (InputMethodManager) mContext.getSystemService(Context.INPUT_METHOD_SERVICE);
                imm.showSoftInput(editTextSearch, 0);
            } else {
                editTextSearch.setVisibility(GONE);
                if (editTextSearch.isFocused()) {
                    editTextSearch.clearFocus();
                }
                // 隐藏键盘
                InputMethodManager imm = (InputMethodManager) mContext.getSystemService(Context.INPUT_METHOD_SERVICE);
                imm.hideSoftInputFromWindow(editTextSearch.getWindowToken(), 0);

                editTextSearch.getText().clear();
                mInSearchMode = false;
                messageList.clear();
                loadHistoryMessages();
            }
        });

        // 设置焦点改变监听器
        editTextSearch.setOnFocusChangeListener((v, hasFocus) -> {
            if (hasFocus) {
                // 当 EditText 获取到焦点时执行的代码
                //btnCancelSearch.setVisibility(View.VISIBLE);
                mInSearchMode = true;
            } else {
                // 当 EditText 失去焦点时执行的代码
                //btnCancelSearch.setVisibility(View.INVISIBLE);
                mInSearchMode = false;
                loadHistoryMessages();
            }
        });
        editTextSearch.setOnEditorActionListener((v, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_SEARCH) {
                String searchContent = editTextSearch.getText().toString();
                if(searchContent.trim().isEmpty()) {
                    Toast.makeText(mContext, "请输入要搜索的关键字", Toast.LENGTH_LONG).show();
                    return true;
                }
                // 用户点击了搜索按钮，这里可以执行搜索逻辑
                List<ChatMessage> msgs =  mChatDb.searchMessageDetail(searchContent);
                if(msgs.isEmpty()) {
                    Toast.makeText(mContext, "没有搜索到记录", Toast.LENGTH_LONG).show();
                }
                clearChatHistory();
                messageList.clear();
                messageList.addAll(convertChatDisplayList(msgs, true));
                mAdapterAiChatMessageList.notifyDataSetChanged();

                return true; // 表示我们已经处理了这个事件
            }
            return false;
        });


        btnAddFavor.setOnClickListener(v->{
            if(!messageList.isEmpty()) {
                showAddMyFavorEditDialog();
            }
        });

        if(!mChatAiParam.showHeader) {
            chkViewHistory.setVisibility(View.INVISIBLE);
            view.findViewById(R.id.history_layout).setVisibility(View.GONE);

            view.findViewById(R.id.et_search).setVisibility(View.GONE);
            view.findViewById(R.id.btn_search).setVisibility(View.GONE);
            view.findViewById(R.id.btn_new_chat).setVisibility(View.GONE);
        }

        if(mChatAiParam.showHistory) {
            List<ChatMessage> msgs = mChatDb.getChatMessageDetail(mCurrentSession.sessionId);
            if(msgs.size() > 2) {
                messageList.addAll(convertChatDisplayList(msgs.subList(msgs.size() - 2, msgs.size()), true));
            } else if(msgs.size() > 1) {
                messageList.addAll(convertChatDisplayList(msgs.subList(msgs.size() - 1, msgs.size()), true));
            }
            if(!messageList.isEmpty()) {
                mAdapterAiChatMessageList.notifyDataSetChanged();
                mMsgDetailListView.smoothScrollToPosition(messageList.size() - 1);
            }
        }

        mBtnSendText.setEnabled(mChatAiParam.initialSendEnable);

        // 监听 EditText 的焦点变化
        mEditMsg.setOnFocusChangeListener((v, hasFocus) -> {
            if (hasFocus) {
                // EditText 获取焦点时，可以执行布局调整或其他操作
                //showKeyboardAndAdjustLayout(etMessage);
            } else {
                // EditText 失去焦点时，可以恢复布局
                //hideKeyboardAndRestoreLayout(etMessage);
            }
        });

        mTextViewTitle.setOnClickListener(v -> {
            clickCount++;
            // 如果点击次数达到
            if(clickCount >= 5) {

            }

            if (clickCount >= 10) {
                clickCount = 0;
            }
        });

        handler.postDelayed(resetClickCountRunnable, 2000);

        ApplicationModelShared app = ApplicationModelShared.getInstance();
        if(app.chatRequest != null) {
            sendTextMessageToAi(app.chatRequest);
        }



        // 监听视图变化，获取软键盘的高度
        view.getViewTreeObserver().addOnGlobalLayoutListener(() -> {
            // 获取当前屏幕可见区域的高度
            Rect rect = new Rect();
            view.getWindowVisibleDisplayFrame(rect);
            int screenHeight = view.getHeight();

            // 计算软键盘的高度
            int keypadHeight = screenHeight - rect.bottom;

            // 如果软键盘显示，调整布局
            if (keypadHeight > screenHeight * 0.15) {
                adjustLayoutForKeyboard(keypadHeight);
            } else {
                adjustLayoutForKeyboard(0);
            }
        });

        mKeyboardInputButton.setOnClickListener(v->{
            switchToKeyboardInput();
        });

        mVoiceInputButton.setOnClickListener(v->{
            switchToVoiceInput();
        });

        mVoiceMessageButton.setOnTouchListener((v, event) -> {
            float x = event.getRawX();  // 触摸点相对屏幕的 X 坐标
            float y = event.getRawY();  // 触摸点相对屏幕的 Y 坐标
            switch (event.getAction()) {
                case MotionEvent.ACTION_DOWN:
                    voiceAnimateLayout.setVisibility(VISIBLE);
                    mAudioRecordUUID = UUID.randomUUID().toString();
                    mAudioRecordCancel = false;
                    String AudioRecordFilePath = AppUtils.getUserFilePath() + "/" + mAudioRecordUUID + ".voice";
                    AudioRecordManager.getInstance(getContext()).setAudioSavePath(AudioRecordFilePath);
                    AudioRecordManager.getInstance(getContext()).setAudioRecordListener(new IAudioRecordListener() {
                        @Override
                        public void initTipView() {

                        }

                        @Override
                        public void setTimeoutTipView(int counter) {

                        }

                        @Override
                        public void setRecordingTipView() {

                        }

                        @Override
                        public void setAudioShortTipView() {

                        }

                        @Override
                        public void setCancelTipView() {

                        }

                        @Override
                        public void destroyTipView() {

                        }

                        @Override
                        public void onStartRecord() {

                        }

                        @Override
                        public void onFinish(Uri audioUri, String path, int duration) {
                            if(mAudioRecordCancel) {
                                AppUtils.deleteTempFile(path);
                                return;
                            }
                            if(duration < 1) {
                                Toast.makeText(getContext(), "录音时长太短了", Toast.LENGTH_SHORT).show();
                            } else {
                                sendVoiceMessageToTeacher(path, duration);
                            }
                        }

                        @Override
                        public void onAudioDBChanged(int db) {

                        }
                    });
                    AudioRecordManager.getInstance(this.getContext()).startRecord();
                    break;
                case MotionEvent.ACTION_MOVE:
                    if (isTouchInsideView(viewCancelSend, x, y)) {
                        AudioRecordManager.getInstance(this.getContext()).willCancelRecord();
                        viewCancelSend.setImageResource(R.drawable.chat_ai_cancel_send_active);
                    } else {
                        AudioRecordManager.getInstance(this.getContext()).continueRecord();
                        viewCancelSend.setImageResource(R.drawable.chat_ai_cancel_send);
                    }
                    break;
                case MotionEvent.ACTION_UP:
                    voiceAnimateLayout.setVisibility(GONE);
                    AudioRecordManager.getInstance(this.getContext()).stopRecord();
                    AudioRecordManager.getInstance(this.getContext()).destroyRecord();
                    if (isTouchInsideView(viewCancelSend, x, y)) {
                        mAudioRecordCancel = true;
                    } else {
                        mAudioRecordCancel = false;
                    }
                    break;
            }
            return false;
        });

        mAiChatRequest.setName(Objects.requireNonNull(mUserInfoViewModel.userInfo.getValue()).getName());
        expandableListView.setOnGroupClickListener((parent, v, groupPosition, id) -> {
            if(expandableListView.isGroupExpanded(groupPosition)) {
                expandableListView.collapseGroup(groupPosition);
            } else {
                expandableListView.expandGroup(groupPosition);
            }
            return true;
        });

        expandableListView.setOnChildClickListener((parent, v, groupPosition, childPosition, id) -> {
            ChatMessageCatalogue catalog = (ChatMessageCatalogue) mChatSessionListAdapter.getGroup(groupPosition);
            ChatMessageSession session = (ChatMessageSession) mChatSessionListAdapter.getChild(groupPosition, childPosition);
            resetCurrentSession(catalog, session);
            return true;
        });
        // expandableListView.setOnGroupExpandListener(groupPosition -> {
//            for (int i = 0; i < expandableListAdapter.getGroupCount(); i++) {
//                if (groupPosition != i) {
//                    expandableListView.collapseGroup(i);
//                }
//            }
//        });
        mChatSessionListAdapter = new ChatExpandableListAdapter(mContext, expandableListView);
        expandableListView.setAdapter(mChatSessionListAdapter);
        mChatSessionListAdapter.setOnItemActionListener(new ChatExpandableListAdapter.OnItemActionListener() {
            @Override
            public void onEditCatalogue(ChatMessageCatalogue catalogue) {
                showEditCatalogueDialog(catalogue);
            }

            @Override
            public void onDeleteCatalogue(ChatMessageCatalogue catalogue) {
                AlertDialog dlg = new AlertDialog.Builder(mContext)
                        .setTitle("删除确认")
                        .setMessage("确定要删除这个目录吗？这将删除该目录下的所有会话和消息。")
                        .setPositiveButton("确定", (dialog, which) -> {
                            new Thread(() -> {
                                List<ChatMessageSession> sessions = mChatDb.getMessageSessionByCatalogId(catalogue.catalogId);
                                for(ChatMessageSession s : sessions) {
                                    List<ChatMessage> messages = mChatDb.getChatMessageDetail(s.sessionId);
                                    for(ChatMessage m : messages) {
                                        deleteChatMessageFiles(m);
                                    }
                                }
                                mChatDb.deleteMessageCatalogue(catalogue.catalogId);
                                post(() -> loadData());
                            }).start();
                        })
                        .setNegativeButton("取消", null)
                        .create();
                dlg.getWindow().setType(WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY);
                dlg.show();
            }

            @Override
            public void onEditSession(ChatMessageSession session) {
                showEditSessionDialog(session);
            }

            @Override
            public void onDeleteSession(ChatMessageSession session) {
                AlertDialog dlg = new AlertDialog.Builder(mContext)
                        .setTitle("删除确认")
                        .setMessage("确定要删除这个会话吗？这将删除该会话下的所有消息。")
                        .setPositiveButton("确定", (dialog, which) -> {
                            // 处理确认按钮点击事件
                            new Thread(() -> {
                                List<ChatMessage> messages = mChatDb.getChatMessageDetail(session.sessionId);
                                for(ChatMessage m : messages) {
                                    deleteChatMessageFiles(m);
                                }
                                mChatDb.deleteMessageSession(session.sessionId);
                                post(() -> {
                                    if (session.sessionId.equals(mCurrentSession.sessionId)) {
                                        messageList.clear();
                                        mAdapterAiChatMessageList.notifyDataSetChanged();
                                    }
                                    resetCurrentSession(ChatMessageCatalogue.CATEGORY_DEFAULT_SYSTEM, ChatMessageSession.SESSION_DEFAULT_SYSTEM);
                                    loadData();
                                });
                            }).start();
                        })
                        .setNegativeButton("取消", null)
                        .create();
                dlg.getWindow().setType(WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY);
                dlg.show();
            }
            @Override
            public void onClearSession(ChatMessageSession session) {
                AlertDialog dlg = new AlertDialog.Builder(mContext)
                        .setTitle("清除确认")
                        .setMessage("确定要清除这个会话吗？这将删除会话所有消息。")
                        .setPositiveButton("确定", (dialog, which) -> {
                            new Thread(() -> {
                                mChatDb.clearMessageSession(session.sessionId);
                                post(() -> {
                                    clearChatHistory();
                                    loadData();
                                });
                            }).start();
                        })
                        .setNegativeButton("取消", null)
                        .create();
                dlg.getWindow().setType(WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY);
                dlg.show();
            }
        });
        resetCurrentSession(ChatMessageCatalogue.CATEGORY_DEFAULT_SYSTEM, ChatMessageSession.SESSION_DEFAULT_SYSTEM);
        addView(view);
    }

    public void setChatTeacherSession(ChatMessageSession s) {
        mChatTeacherSession = s;
    }

    private void deleteChatMessageFiles(ChatMessage msg) {
        switch (msg.type) {
            case IMAGE:
                AppUtils.deleteTempFile(msg.content);
                break;
            case VOICE:
            {
                VoiceDbUtil.VoiceDbItem vi = VoiceDbUtil.extractDbVoiceContent(msg.content);
                AppUtils.deleteTempFile(vi.voicePath);
            }
                break;
        }
    }

    private void switchToVoiceInput() {
        mKeyboardInputButton.setVisibility(VISIBLE);
        mCheckSearchWeb.setVisibility(GONE);
        mSendPictureButton.setVisibility(GONE);
        mVoiceInputButton.setVisibility(GONE);
        voiceAnimateLayout.setVisibility(GONE);
        mVoiceMessageButton.setVisibility(VISIBLE);
        mEditMsg.setVisibility(GONE);
        mBtnSendText.setVisibility(GONE);
    }

    private void switchToKeyboardInput() {
        mKeyboardInputButton.setVisibility(GONE);
        mCheckSearchWeb.setVisibility(VISIBLE);
        mSendPictureButton.setVisibility(VISIBLE);
        mVoiceInputButton.setVisibility(VISIBLE);
        voiceAnimateLayout.setVisibility(GONE);
        mVoiceMessageButton.setVisibility(GONE);
        mEditMsg.setVisibility(VISIBLE);
        mBtnSendText.setVisibility(VISIBLE);
    }

    private void setChatAiSendMode(boolean isChatAi) {
        if(isChatAi) {
            switchToKeyboardInput();
        }

        mVoiceInputButton.setVisibility(!isChatAi ? VISIBLE : INVISIBLE);
        mSendPictureButton.setVisibility(!isChatAi ? VISIBLE : INVISIBLE);
        mCheckSearchWeb.setVisibility(isChatAi ? VISIBLE : INVISIBLE);
    }

    private boolean isTouchInsideView(View view, float x, float y) {
        if (view == null || view.getVisibility() != View.VISIBLE) {
            return false;
        }

        int[] location = new int[2];
        view.getLocationOnScreen(location);  // 获取 View 在屏幕上的绝对位置
        int left = location[0];
        int top = location[1];
        int right = left + view.getWidth();
        int bottom = top + view.getHeight();

        return (x > left && x < right && y > top && y < bottom);
    }

    private void createChatSession() {
        long tick = System.currentTimeMillis();
        ChatMessageSession session = new ChatMessageSession(UUID.randomUUID().toString(),
                ChatMessageCatalogue.CATEGORY_DEFAULT_SYSTEM.catalogId,
                mContext.getString(R.string.chat_ai_new_session_name),
                ChatMessageSession.SessionType.USER_TALK_AI,
                tick,
                tick,
                tick);
        mChatDb.addMessageSession(session);
        mChatSessionListAdapter.addSession(session);

        resetCurrentSession(ChatMessageCatalogue.CATEGORY_DEFAULT_SYSTEM, session);
    }

    private void showEditCatalogueDialog(ChatMessageCatalogue catalogue) {
        EditText input = new EditText(mContext);
        input.setText(catalogue.catalogName);
        input.setSelection(input.length());

        AlertDialog dlg = new AlertDialog.Builder(mContext)
                .setTitle("重命名分类")
                .setView(input)
                .setPositiveButton("确定", (dialog, which) -> {
                    String newName = input.getText().toString().trim();
                    if (!TextUtils.isEmpty(newName)) {
                        new Thread(() -> {
                            catalogue.catalogName = newName;
                            catalogue.updateTime = System.currentTimeMillis();
                            mChatDb.updateMessageCatalogue(catalogue);
                            post(() -> loadData());
                        }).start();
                    }
                })
                .setNegativeButton("取消", null)
                .create();
        dlg.getWindow().setType(WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY);
        dlg.show();
    }

    private void showEditSessionDialog(ChatMessageSession session) {
        EditText input = new EditText(mContext);
        input.setText(session.sessionName);
        input.setSelection(input.length());

        AlertDialog dlg = new AlertDialog.Builder(mContext)
                .setTitle("重命名会话")
                .setView(input)
                .setPositiveButton("确定", (dialog, which) -> {
                    String newName = input.getText().toString().trim();
                    if (!TextUtils.isEmpty(newName)) {
                        new Thread(() -> {
                            session.sessionName = newName;
                            session.updateTime = System.currentTimeMillis();
                            mChatDb.updateMessageSession(session);
                            post(() -> loadData());
                        }).start();
                    }
                })
                .setNegativeButton("取消", null)
                .create();
        dlg.getWindow().setType(WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY);
        dlg.show();
    }

    private void showAddMyFavorEditDialog() {
        EditText input = new EditText(mContext);
        input.setText(mContext.getString(R.string.chat_ai_default_favor_name));
        input.setSelection(input.length());

        AlertDialog dlg = new AlertDialog.Builder(mContext)
                .setTitle("收藏会话")
                .setView(input)
                .setPositiveButton("确定", (dialog, which) -> {
                    String newName = input.getText().toString().trim();
                    ArrayList<ChatDisplayItem> msgs = new ArrayList<>(messageList);
                    if (!TextUtils.isEmpty(newName)) {
                        new Thread(() -> {
                            ChatMessageSession session = new ChatMessageSession(UUID.randomUUID().toString(),
                                    ChatMessageCatalogue.CATEGORY_MY_FAVOR.catalogId, newName, ChatMessageSession.SessionType.USER_FAVOR,
                                    0, 0, 0);
                            mChatDb.addMessageSession(session);
                            for (ChatDisplayItem item: msgs) {
                                // copy a message
                                item.chatMessage.messageId = UUID.randomUUID().toString();
                                item.chatMessage.sessionId = session.sessionId;
                                mChatDb.addChatMessageDetail(item.chatMessage);
                            }
                            post(() -> {
                                loadData();
                                Toast.makeText(mContext, "收藏成功", Toast.LENGTH_SHORT).show();
                            });
                        }).start();
                    }
                })
                .setNegativeButton("取消", null)
                .create();
        dlg.getWindow().setType(WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY);
        dlg.show();
    }
    private void loadData() {
        new Thread(() -> {
            List<ChatMessageCatalogue> catalogues = mChatDb.getAllMessageCatalogue();
            post(() -> {
                mChatSessionListAdapter.setData(catalogues);
                // 展开所有分组
                for (int i = 0; i < mChatSessionListAdapter.getGroupCount(); i++) {
                    expandableListView.expandGroup(i);
                }
            });
        }).start();
    }
    private void loadSelectedSessionMsg(ChatMessageSession session) {
        new Thread(() -> {
            List<ChatMessage> messages = mChatDb.getChatMessageDetail(session.sessionId);
            post(() -> {
                Log.e("!!!!!!!!", "loadSelectedSessionMsg: " + session.sessionName);
                messageList.clear();
                messageList.addAll(convertChatDisplayList(messages, true));
                mAdapterAiChatMessageList.notifyDataSetChanged();
                if(!messageList.isEmpty()) {
                    mMsgDetailListView.scrollToPosition(messageList.size() - 1);
                }
            });
        }).start();
    }
    public void clearChatHistory() {
        messageList.clear();
        mAdapterAiChatMessageList.notifyDataSetChanged();
    }

    private List<ChatDisplayItem> convertChatDisplayList(List<ChatMessage> msgs, boolean isHistory) {
        List<ChatDisplayItem> items = new ArrayList<>();
        for (ChatMessage msg: msgs) {
            ChatDisplayItem item = new ChatDisplayItem(msg, !isHistory);
            items.add(item);
        }

        return items;
    }

    private void pollChat() {
        String url = mChatAiParam.chatBotUrl;
        //优先使用Request里自带的url, 没有就用默认的
        if(mAiChatRequest.getDstUrl() != null && !mAiChatRequest.getDstUrl().isEmpty()) {
            url = mAiChatRequest.getDstUrl();
        }
        ApiGateWayService.sendChatMessage(mAiChatRequest, mLastReceivingMsg.messageId, url, mUserInfoViewModel.token.getValue(), (success, response, sessionId, msgId) -> {
            handler.post(() -> {
                if (success) {
                    if(!response.trim().isEmpty() && !response.equals("end")) {
                        mLastReceivingMsg.appendContent(response);
                        mAdapterAiChatMessageList.updateReceivingMessage(mLastReceivingMsg.messageId, mChatAiParam.streamDisplay);

                        Log.d("%%%%%%%%", response);
                    }
                    if(!response.equals("end")) {
                        mAiChatRequest.setReason("continue");
                        pollChat();
                    } else {
                        mBtnSendText.setEnabled(true);
                        if(mListener != null) {
                            mListener.onAiChatResponse(true);
                        }

                        mChatDb.addChatMessageDetail(mLastReceivingMsg);

                        ApplicationModelShared app = ApplicationModelShared.getInstance();
                        if(app.chatRequest != null) {
                            app.chatRequest = null;
                        }
                        mAiChatRequest.setDstUrl("");
                    }
                } else {
                    mLastReceivingMsg.appendContent("‼️消息接收失败");
                    mAdapterAiChatMessageList.updateReceivingMessage(mLastReceivingMsg.messageId, false);
                    mBtnSendText.setEnabled(true);
                    if(mListener != null) {
                        mListener.onAiChatResponse(false);
                    }
                    if(!messageList.isEmpty()) {
                        mChatDb.addChatMessageDetail(mLastReceivingMsg);
                    }

                    ApplicationModelShared app = ApplicationModelShared.getInstance();
                    if(app.chatRequest != null) {
                        app.chatRequest = null;
                    }
                    mAiChatRequest.setDstUrl("");
                }
            });
        });
    }

    private void sendTextMessageToAi(String content) {
        if (content.trim().isEmpty()) {
            return;
        }

        // Add message to the list and notify the adapter
        ChatMessage message = new ChatMessage(content,
                true,
                ChatMessage.MessageType.TEXT,
                mCurrentSession.sessionId,
                System.currentTimeMillis());
        messageList.add(new ChatDisplayItem(message, !message.isSelf));
        mChatDb.addChatMessageDetail(message);
        ChatMessage responseMessage = new ChatMessage("",
                false,
                ChatMessage.MessageType.TEXT,
                mCurrentSession.sessionId,
                System.currentTimeMillis());
        mLastReceivingMsg = responseMessage;
        messageList.add(new ChatDisplayItem(responseMessage, !responseMessage.isSelf));

        // 一次性通知 Adapter 插入两条消息
        mAdapterAiChatMessageList.notifyItemRangeInserted(messageList.size() - 2, 2);
        // 滚动到最新位置
        mMsgDetailListView.smoothScrollToPosition(messageList.size() - 1);

        mAiChatRequest.setReason("start");
        mAiChatRequest.setCoversation(content);
        mAiChatRequest.setIsWebSearch(mCheckSearchWeb.isChecked() ? "1" : "0");

        mBtnSendText.setEnabled(false);
        pollChat();

        autoDetectChatSessionName(content);
    }

    public void sendTextMessageToAi(AiChatMessageRequest mo) {
        mEditMsg.postDelayed(() -> {
            mAiChatRequest = mo;
            mAiChatRequest.setReason("start");
            mAiChatRequest.setIsWebSearch(mCheckSearchWeb.isChecked() ? "1" : "0");
            ChatMessage message = new ChatMessage(mAiChatRequest.getCoversation(),
                    true,
                    ChatMessage.MessageType.TEXT,
                    mCurrentSession.sessionId,
                    System.currentTimeMillis());
            messageList.add(new ChatDisplayItem(message, !message.isSelf));
            mChatDb.addChatMessageDetail(message);

            if(!mo.getQuestion().isEmpty()) {
                //可能是图片
                String question = mo.getQuestion().trim();
                ChatMessage msg;
                if(question.startsWith("data:image")) {
                    //截图问答的图片
                    msg = new ChatMessage("",
                            true,
                            ChatMessage.MessageType.IMAGE,
                            mCurrentSession.sessionId,
                            System.currentTimeMillis());
                    String localPath = AppUtils.getUserFilePath().getAbsolutePath() + "/" + msg.messageId + ".png";
                    msg.content = localPath;
                    ImageUtils.saveImageFile(question, localPath);

                } else {
                    msg = new ChatMessage(question,
                            true,
                            ChatMessage.MessageType.TEXT,
                            mCurrentSession.sessionId,
                            System.currentTimeMillis());
                }
                messageList.add(new ChatDisplayItem(msg, false));
                mChatDb.addChatMessageDetail(msg);
            }

            mAdapterAiChatMessageList.notifyDataSetChanged();
            mEditMsg.setText("");

            ChatMessage responseMessage = new ChatMessage(
                    "",
                    false,
                    ChatMessage.MessageType.TEXT,
                    mCurrentSession.sessionId,
                    System.currentTimeMillis());
            mLastReceivingMsg = responseMessage;
            messageList.add(new ChatDisplayItem(responseMessage, !responseMessage.isSelf));
            mAdapterAiChatMessageList.notifyItemInserted(messageList.size() - 1);

            mMsgDetailListView.smoothScrollToPosition(messageList.size() - 1);

//        aiChatMessageRequest.setReason("start");
//        aiChatMessageRequest.setCoversation(messageText);

            mBtnSendText.setEnabled(false);
            pollChat();

            autoDetectChatSessionName(mAiChatRequest.getCoversation().trim());
        }, 1000);
    }

    @NonNull
    private String getTeacherSubject() {
        String subject;
        if(mCurrentSession.type == ChatMessageSession.SessionType.USER_TALK_TEACHER_BIOLOGY) {
            subject = TeacherQaType.SCHOOL_SUBJECT_BIOLOGY;
        } else {
            subject = TeacherQaType.SCHOOL_SUBJECT_MATH;
        }
        return subject;
    }

    public void sendVoiceMessageToTeacher(String voicePath, int duration) {
        String subject = getTeacherSubject();

        StudentMessage studentMsg = new StudentMessage(mUserInfoViewModel.userId.getValue(),
                mCurrentSession.sessionId,
                subject,
                TeacherQaType.QA_MSG_TYPE_VOICE,
                VoiceDbUtil.getRawVoiceBase64(voicePath));
        MessagingManager.getInstance().sendMessageToTeacher(studentMsg, (success, messageId, errorMessage) -> {
            Log.e("=-=-=", success + messageId + errorMessage);
        });

        VoiceDbUtil.VoiceDbItem item = new VoiceDbUtil.VoiceDbItem();
        item.duration = duration;
        item.voicePath = voicePath;

        String dbContent = VoiceDbUtil.makeVoiceDbContent(item);
        ChatMessage message = new ChatMessage(dbContent,
                true,
                ChatMessage.MessageType.VOICE,
                mCurrentSession.sessionId,
                System.currentTimeMillis());
        message.messageId = studentMsg.getMessageId();

        messageList.add(new ChatDisplayItem(message, !message.isSelf));
        mChatDb.addChatMessageDetail(message);
        mAdapterAiChatMessageList.notifyDataSetChanged();
    }

    public void sendTextMessageToTeacher(String content) {
        String subject = getTeacherSubject();

        StudentMessage studentMsg = new StudentMessage(mUserInfoViewModel.userId.getValue(),
                mCurrentSession.sessionId,
                subject,
                TeacherQaType.QA_MSG_TYPE_TEXT,
                content);
        MessagingManager.getInstance().sendMessageToTeacher(studentMsg, (success, messageId, errorMessage) -> {
            Log.e("=-=-=", success + messageId + errorMessage);
        });

        ChatMessage message = new ChatMessage(content,
                true,
                ChatMessage.MessageType.TEXT,
                mCurrentSession.sessionId,
                System.currentTimeMillis());
        message.messageId = studentMsg.getMessageId();

        messageList.add(new ChatDisplayItem(message, !message.isSelf));
        mChatDb.addChatMessageDetail(message);
        mAdapterAiChatMessageList.notifyDataSetChanged();
    }

    public void sendPictureToTeacher(String path) {
        String subject = getTeacherSubject();
        String base64Content = ImageUtils.loadImageFileToBase64(path);
        StudentMessage studentMsg = new StudentMessage(mUserInfoViewModel.userId.getValue(),
                mCurrentSession.sessionId,
                subject,
                TeacherQaType.QA_MSG_TYPE_PICTURE,
                base64Content);
        studentMsg.setMessageId(mScreenShotImageUUID);

        MessagingManager.getInstance().sendMessageToTeacher(studentMsg, (success, messageId, errorMessage) -> {
            Log.e("=-=-=", success + messageId + errorMessage);
        });

        ChatMessage message = new ChatMessage(path,
                true,
                ChatMessage.MessageType.IMAGE,
                mCurrentSession.sessionId,
                System.currentTimeMillis());
        message.messageId = studentMsg.getMessageId();

        messageList.add(new ChatDisplayItem(message, !message.isSelf));
        mChatDb.addChatMessageDetail(message);
        mAdapterAiChatMessageList.notifyDataSetChanged();
    }

    public void onReceivedTeacherMessage(TeacherMessage msg) {
        ChatMessage chatMessage = msg.toChatMessage();
        if(chatMessage != null) {
            mChatDb.addChatMessageDetail(chatMessage);

            if(mCurrentSession.sessionId.equals(chatMessage.sessionId)) {
                messageList.add(new ChatDisplayItem(chatMessage, false));
                mAdapterAiChatMessageList.notifyDataSetChanged();
            }
        }

    }

    private void autoDetectChatSessionName(String content) {
        if(mCurrentSession.createTime == mCurrentSession.updateTime) {
            if(content.trim().length() < ChatMessageSession.MAX_SESSION_NAME_LENGTH) {
                mCurrentSession.sessionName = content.trim();
            } else {
                mCurrentSession.sessionName = content.trim().substring(0, ChatMessageSession.MAX_SESSION_NAME_LENGTH) + "...";
            }
            long updateTick = System.currentTimeMillis();
            mCurrentSession.updateTime = updateTick;
            mChatDb.updateMessageSessionName(mCurrentSession.sessionId,
                    mCurrentSession.sessionName,
                    updateTick);
            resetCurrentSession(mCurrentCatalog, mCurrentSession);
        }
    }
    private void loadHistoryMessages() {
        if(mInSearchMode) {
            return;
        }
        List<ChatMessage> allMessage =  mChatDb.getChatMessageDetail(mCurrentSession.sessionId);

        int curSize = messageList.size();
        int n = curSize + 2;
        if (allMessage.size() <= n) {
            messageList.clear();
            messageList.addAll(convertChatDisplayList(allMessage, true));
        } else {
            messageList.clear();
            messageList.addAll(convertChatDisplayList(allMessage.subList(allMessage.size() - n, allMessage.size()), true));
        }
        mAdapterAiChatMessageList.notifyDataSetChanged();
        mMsgDetailListView.smoothScrollToPosition(0);
    }

    public void setChatEnable(boolean b) {
        mBtnSendText.setEnabled(b);
        chkViewHistory.setEnabled(b);
        mTextViewTitle.setEnabled(b);
    }

    private void adjustLayoutForKeyboard(int keyboardHeight) {
        // 设置 padding 使布局留出足够的空间以防止软键盘遮挡
        // 隐藏软键盘时，恢复布局
        // 恢复 padding
        rootLayout.setPadding(0, 0, 0, Math.max(keyboardHeight, 0));  // 设置 padding 底部为软键盘的高度
    }
    // 获取焦点时，弹出软键盘并调整布局
    private void showKeyboardAndAdjustLayout(View view) {
        InputMethodManager imm = (InputMethodManager)mContext.getSystemService(Context.INPUT_METHOD_SERVICE);
        imm.showSoftInput(view, InputMethodManager.SHOW_IMPLICIT);

        // 调整布局，确保 EditText 不会被软键盘遮挡
        mMsgRefreshLayout.setVisibility(View.GONE);
    }
    //
//    // 失去焦点时，隐藏软键盘并恢复布局
    private void hideKeyboardAndRestoreLayout(View view) {
        InputMethodManager imm = (InputMethodManager) mContext.getSystemService(Context.INPUT_METHOD_SERVICE);
        imm.hideSoftInputFromWindow(view.getWindowToken(), 0);

        // 恢复布局，取消软键盘预留的空间
        //refreshLayout.setPadding(0, 0, 0, 0);
        mMsgRefreshLayout.setVisibility(View.VISIBLE);
    }
}
