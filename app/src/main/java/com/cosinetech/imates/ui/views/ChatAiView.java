package com.cosinetech.imates.ui.views;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.BitmapFactory;
import android.graphics.Color;
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
import android.view.ViewGroup;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.widget.AdapterView;
import android.widget.BaseAdapter;
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
import androidx.appcompat.widget.AppCompatSpinner;
import androidx.fragment.app.FragmentActivity;
import androidx.lifecycle.ViewModelProvider;
import androidx.lifecycle.ViewModelStoreOwner;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.cosinetech.imates.ApplicationModelShared;
import com.cosinetech.imates.R;
import com.cosinetech.imates.ui.activities.ExerciseSolveActivity;
import com.cosinetech.imates.ui.activities.RichInputBoardActivity;
import com.cosinetech.imates.ui.activities.ScreenShotActivity;
import com.cosinetech.imates.ui.adapters.AdapterAiChatMessageList;
import com.cosinetech.imates.ui.adapters.ChatExpandableListAdapter;
import com.cosinetech.imates.audio.AudioRecordManager;
import com.cosinetech.imates.audio.IAudioRecordListener;
import com.cosinetech.imates.data.models.ChatAiParam;
import com.cosinetech.imates.data.models.ChatDisplayItem;
import com.cosinetech.imates.data.models.ChatMessage;
import com.cosinetech.imates.data.models.ChatMessageCatalogue;
import com.cosinetech.imates.data.models.ChatMessageHistoryDB;
import com.cosinetech.imates.data.models.ChatMessageSession;
import com.cosinetech.imates.data.models.UserInfoViewModel;
import com.cosinetech.imates.teachermessagemq.MessagingManager;
import com.cosinetech.imates.teachermessagemq.StudentMessage;
import com.cosinetech.imates.teachermessagemq.TeacherQaType;
import com.cosinetech.imates.utils.AppUtils;
import com.cosinetech.imates.utils.ImageUtils;
import com.cosinetech.imates.utils.ScreenUtils;
import com.cosinetech.imates.utils.VoiceDbUtil;
import com.cosinetech.imates.coreapiservice.AiChatMessageRequest;
import com.cosinetech.imates.coreapiservice.ApiGateWayService;
import com.cosinetech.imates.coreapiservice.ApiUrl;
import com.scwang.smart.refresh.layout.SmartRefreshLayout;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

public class ChatAiView extends RelativeLayout {
    public enum ChatRole {
        CHAT_ROLE_AI_MATE("同桌", R.drawable.chat_ai_avatar_ai_mate, "mate"),
        CHAT_ROLE_AI_MENTOR("学长", R.drawable.chat_ai_avatar_ai_mentor, "mentor"),
        CHAT_ROLE_AI_RESEARCHER("大神", R.drawable.chat_ai_avatar_ai_researcher, "researcher"),

        CHAT_ROLE_MYSELF("我自己", R.drawable.chat_ai_avatar_user, "myself"),
        CHAT_ROLE_TEACHER("老师", R.drawable.chat_ai_avatar_teacher_woman, "teacher");

        private final String friendlyName;
        private final int iconResId;
        private final String name;

        ChatRole(String friendlyName, int iconResId, String paramName) {
            this.friendlyName = friendlyName;
            this.iconResId = iconResId;
            this.name = paramName;
        }

        public String getFriendlyName() {
            return friendlyName;
        }

        public int getIconResId() {
            return iconResId;
        }

        public  String getParamName() {
            return name;
        }
    }

    public interface AiChatResponseListener {
        void onAiChatResponse(boolean success);
    }

    public interface OnSendToTeacherListener {
        void onSendToTeacher();
    }

    public interface OnPictureSelectedListener {
        void onScreenshotCaptured(String screenshotPath);
    }

    public interface OnRichInputFinishListener {
        void onRichInputResult(String resultString);
    }

    private UserInfoViewModel mUserInfoViewModel;
    private Context mContext;
    private AiChatMessageRequest mAiChatRequest = new AiChatMessageRequest("", "", "", "", "", "", "start", "", false);
    private AdapterAiChatMessageList mAdapterAiChatMessageList;
    private RecyclerView mMsgDetailListView;
    private SmartRefreshLayout mMsgRefreshLayout;
    private EditText mEditMsg;
    private Button mBtnSendText;
    private CheckBox mChkViewHistory;
    private TextView mTextViewTitle;
    private Button mKeyboardInputButton;
    private Button mVoiceInputButton;
    private Button mVoiceMessageButton;
    private CheckBox mCheckSearchWeb;
    private Button mSendPictureButton;
    private Button mFormulaInputButton;
    private ChatAiParam mChatAiParam;
    private AiChatResponseListener mListener;
    private View mVoiceAnimateLayout;
    private CheckBox mSelectChatItemButton;
    private View mAskTeacherLayout;
    private View mInputUtilsLayout;
    private AppCompatSpinner mAiRoleSpinner;

    private static final String PREFS_NAME = "ChatRolePrefs";
    private static final String KEY_SELECTED_ROLE = "selectedRole";
    private List<AiRoleSettingsItem> mAiRoleSettingsItems;
    private int mSelectedRolePosition = 0; // 默认选择位置
    private ChatRole mSelectedRole = ChatRole.CHAT_ROLE_AI_MATE; // 默认选择角色
    private ChatAiRoleSettingsAdapter mChatAiRoleSettingsAdapter;
    private RelativeLayout mRootLayout; // 用于调整布局的父布局
    private boolean mInSearchMode = false;
    private ChatMessageHistoryDB mChatDb;
    private ChatMessageCatalogue mCurrentCatalog;
    private ChatMessageSession mCurrentSession;
    private ExpandableListView mExpandableListView;
    private ChatExpandableListAdapter mChatSessionListAdapter;
    private ChatMessageSession mChatTeacherSession;
    private ChatMessage mLastReceivingMsg;

    private String mSelectedImageUUID = "";

    private String mAudioRecordUUID = "";
    private boolean mAudioRecordCancel = false;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private OnSendToTeacherListener mSendTeacherListener;
    private ActivityResultLauncher<Intent> mScreenshotLauncher;
    private ActivityResultLauncher<Intent> mPickImageLauncher;
    private ActivityResultLauncher<Intent> mRichInputBoardLauncher;
    private OnPictureSelectedListener mPictureSelectedListener;
    private OnRichInputFinishListener mRichInputFinishListener;

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

    public void registerScreenShotForActivityResult(FragmentActivity activity) {
        mScreenshotLauncher = activity.registerForActivityResult(
                new ActivityResultContracts.StartActivityForResult(),
                result -> {
                    if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
                        // Get the screenshot path from the result
                        String screenshotPath = result.getData().getStringExtra(ScreenShotActivity.KEY_FINAL_IMAGE_PATH);
                        if (screenshotPath != null && !screenshotPath.isEmpty()) {
                            if (mPictureSelectedListener != null) {
                                mPictureSelectedListener.onScreenshotCaptured(screenshotPath);
                            }
                        }
                    }
                }
        );
    }

    public void registerPickImageForActivityResult(FragmentActivity activity) {
        mPickImageLauncher = activity.registerForActivityResult(
                new ActivityResultContracts.StartActivityForResult(),
                result -> {
                    if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
                        // Get the screenshot path from the result
                        Uri uri = result.getData().getData();
                        if(uri != null) {
                            // 复制图片到外部存储
                            String filePath = AppUtils.getUserFilePath().getAbsolutePath() + "/" + mSelectedImageUUID + ".png";
                            boolean success = AppUtils.copyImageToExternalFilesDir(getContext(), uri, filePath);
                            if (success) {
                                Log.d("PhotoPicker", "Image copied successfully!");
                                if (mPictureSelectedListener != null) {
                                    mPictureSelectedListener.onScreenshotCaptured(filePath);
                                }
                            } else {
                                Log.e("PhotoPicker", "Failed to copy image.");
                                Toast.makeText(getContext(), "照片拷贝失败", Toast.LENGTH_SHORT).show();
                            }
                        } else {
                            Toast.makeText(getContext(), "没有选择相片", Toast.LENGTH_SHORT).show();
                        }
                    }
                }
        );
    }

    public void registerRichInputBoardForActivityResult(FragmentActivity activity) {
        mRichInputBoardLauncher = activity.registerForActivityResult(
                new ActivityResultContracts.StartActivityForResult(),
                result -> {
                    if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
                        String resultString = result.getData().getStringExtra(RichInputBoardActivity.RICH_INPUT_RESULT_KEY);
                        if (mRichInputFinishListener != null) {
                            mRichInputFinishListener.onRichInputResult(resultString);
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
            intent.putExtra(ScreenShotActivity.KEY_SET_FILE_NAME, mSelectedImageUUID + ".png");
            mScreenshotLauncher.launch(intent);
        }
    }

    private void launchPickImageActivity() {
        if (mPickImageLauncher != null) {
            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("image/*");
            mPickImageLauncher.launch(intent);
        }
    }

    private void launchRichInputBoardActivity() {
        if(mRichInputBoardLauncher != null) {
            Intent intent = new Intent(getContext(), RichInputBoardActivity.class);
            mRichInputBoardLauncher.launch(intent);
        }
    }

    public void setOnPictureSelectedListener(OnPictureSelectedListener listener) {
        this.mPictureSelectedListener = listener;
    }

    public void setSendTeacherListener(OnSendToTeacherListener l) {
        mSendTeacherListener = l;
    }

    public void setRichInputFinishListener(OnRichInputFinishListener l) {
        mRichInputFinishListener = l;
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
            setChatAiSendMode(true);
        } else if (mCurrentSession.type == ChatMessageSession.SessionType.USER_FAVOR) {
            setChatAiSendMode(true);
            setChatEnable(false);
        } else {
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
        //mAdapterAiChatMessageList.notifyDataSetChanged();
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

    @SuppressLint({"ClickableViewAccessibility", "NotifyDataSetChanged"})
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
        Button mAskTeacherButton = view.findViewById(R.id.btn_ask_teacher);
        mSendPictureButton = view.findViewById(R.id.btn_send_picture);
        mFormulaInputButton = view.findViewById(R.id.btn_rich_input);
        mChkViewHistory = view.findViewById(R.id.btn_view_history);
        mVoiceAnimateLayout = view.findViewById(R.id.voice_animate_area);
        mKeyboardInputButton = view.findViewById(R.id.input_keyboard);
        mVoiceInputButton = view.findViewById(R.id.btn_voice);
        mVoiceMessageButton = view.findViewById(R.id.voice_message);
        mCheckSearchWeb = view.findViewById(R.id.check_search_web);
        mRootLayout = view.findViewById(R.id.layout_chat);  // 父布局
        mExpandableListView = view.findViewById(R.id.expandable_list_view);
        mInputUtilsLayout = view.findViewById(R.id.utils_layout);
        ImageView viewCancelSend = view.findViewById(R.id.cancel_record);
        EditText editTextSearch = view.findViewById(R.id.et_search);
        CheckBox btnCancelSearch = view.findViewById(R.id.btn_search);
        Button btnNewChat = view.findViewById(R.id.btn_new_chat);
        Button btnAddFavor = view.findViewById(R.id.btn_add_favor);
        mAiRoleSpinner = view.findViewById(R.id.settings_spinner);
        // 从 SharedPreferences 加载保存的角色
        loadSelectedRole();
        prepareSettingsItems();
        // Set up adapter
        mChatAiRoleSettingsAdapter = new ChatAiRoleSettingsAdapter(mAiRoleSettingsItems, getContext());
        mAiRoleSpinner.setAdapter(mChatAiRoleSettingsAdapter);

        // Set default selection
        mAiRoleSpinner.setSelection(mSelectedRolePosition);

        // Set item selection listener
        mAiRoleSpinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                // 检查项目是否已禁用
                if (!mAiRoleSettingsItems.get(position).isEnabled()) {
                    // 如果项目被禁用，恢复到之前的选择
                    mAiRoleSpinner.setSelection(mSelectedRolePosition);
                    return;
                }

                // 更新选择位置
                mSelectedRolePosition = position;

                // 更新选择的角色
                mSelectedRole = mAiRoleSettingsItems.get(position).getRole();

                // 保存选择到 SharedPreferences
                saveSelectedRole();
                mAiChatRequest.setChatRole(mSelectedRole.getParamName());

                // 更新所有项目以反映选择状态
                for (int i = 0; i < mAiRoleSettingsItems.size(); i++) {
                    mAiRoleSettingsItems.get(i).setSelected(i == mSelectedRolePosition);
                }

                // 通知适配器数据变化
                mChatAiRoleSettingsAdapter.notifyDataSetChanged();
            }

            @Override
            public void onNothingSelected(AdapterView<?> parent) {
                // Do nothing
            }
        });

        mSendPictureButton.setOnClickListener(v->{
            //截图
//            mScreenShotImageUUID = UUID.randomUUID().toString();
//            if (context instanceof FragmentActivity) {
//                launchScreenshotActivity();
//            }
            //从相册选择
            mSelectedImageUUID = UUID.randomUUID().toString();
            if (context instanceof FragmentActivity) {
                launchPickImageActivity();
            }
        });

        mFormulaInputButton.setOnClickListener(v->{
            if (context instanceof FragmentActivity) {
                launchRichInputBoardActivity();
            }
        });

        btnNewChat.setOnClickListener(v-> createChatSession());
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
            if(items.isEmpty()) {
                return;
            }
            //切换到老师会话
            if(mChatTeacherSession == null) {
                ChatMessageSession.SessionType type;
                if(mCurrentCatalog.type == ChatMessageCatalogue.CatalogueType.USER_BIOLOGY) {
                    type = ChatMessageSession.SessionType.USER_TALK_TEACHER_BIOLOGY;
                } else {
                    type = ChatMessageSession.SessionType.USER_TALK_TEACHER_MATH;
                }
                mChatTeacherSession = ExerciseSolveActivity.createChatTeacherSession(mCurrentSession.sessionId,
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
            } else {
                // 失去焦点时隐藏键盘
                InputMethodManager imm = (InputMethodManager) mEditMsg.getContext().getSystemService(Context.INPUT_METHOD_SERVICE);
                imm.hideSoftInputFromWindow(mEditMsg.getWindowToken(), 0);
            }
        });

        // Initialize RecyclerView
        mMsgDetailListView.setItemViewCacheSize(20);
        mMsgDetailListView.setItemAnimator(null);
        mMsgDetailListView.setLayoutManager(new LinearLayoutManager(mContext, LinearLayoutManager.VERTICAL, false));
        mMsgDetailListView.addItemDecoration(new RecyclerViewOverscrollDecoration());
        mMsgDetailListView.setClipToPadding(false);// disabling clip to padding is critical

        mAdapterAiChatMessageList = new AdapterAiChatMessageList(getContext(), null, mMsgDetailListView);
        //mAdapterAiChatMessageList.getItems().addAll(mAdapterAiChatMessageList.getItems());
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
            sendTextContent(content);
            mEditMsg.setText("");
            mEditMsg.clearFocus();
        });


        mChkViewHistory.setOnCheckedChangeListener((buttonView, isChecked) -> {
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
                //mAdapterAiChatMessageList.getItems().clear();
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
                mAdapterAiChatMessageList.getItems().clear();
                mAdapterAiChatMessageList.getItems().addAll(convertChatDisplayList(msgs, true));
                //mAdapterAiChatMessageList.notifyDataSetChanged();

                return true; // 表示我们已经处理了这个事件
            }
            return false;
        });

        btnAddFavor.setOnClickListener(v->{
            if(!mAdapterAiChatMessageList.getItems().isEmpty()) {
                showAddMyFavorEditDialog();
            }
        });

        if(!mChatAiParam.showHeader) {
            mChkViewHistory.setVisibility(View.INVISIBLE);
            view.findViewById(R.id.history_layout).setVisibility(View.GONE);

            view.findViewById(R.id.et_search).setVisibility(View.GONE);
            view.findViewById(R.id.btn_search).setVisibility(View.GONE);
            view.findViewById(R.id.btn_new_chat).setVisibility(View.GONE);
        }

        if(mChatAiParam.showHistory) {
            List<ChatMessage> msgs = mChatDb.getChatMessageDetail(mCurrentSession.sessionId);
            if(msgs.size() > 10) {
                mAdapterAiChatMessageList.getItems().addAll(convertChatDisplayList(msgs.subList(msgs.size() - 10, msgs.size()), true));
            } else if(!msgs.isEmpty()) {
                mAdapterAiChatMessageList.getItems().addAll(convertChatDisplayList(msgs, true));
            }
            if(!mAdapterAiChatMessageList.getItems().isEmpty()) {
                //mAdapterAiChatMessageList.notifyDataSetChanged();
                mMsgDetailListView.smoothScrollToPosition(mAdapterAiChatMessageList.getItems().size() - 1);
            }
        }

        mBtnSendText.setEnabled(mChatAiParam.initialSendEnable);

        // 监听 EditText 的焦点变化
        mEditMsg.setOnFocusChangeListener((v, hasFocus) -> {
            // EditText 获取焦点时，可以执行布局调整或其他操作
            //showKeyboardAndAdjustLayout(etMessage);
            if(!hasFocus)
                hideKeyboardAndRestoreLayout(mEditMsg);
        });

        ApplicationModelShared app = ApplicationModelShared.getInstance();
        if(app.chatRequest != null) {
            sendMessageToAi(app.chatRequest, true);
        }

        // 监听视图变化，获取软键盘的高度
        view.getViewTreeObserver().addOnGlobalLayoutListener(() -> {
            // 获取当前屏幕可见区域的高度
            Rect rect = new Rect();
            view.getWindowVisibleDisplayFrame(rect);
            int screenHeight = ScreenUtils.getScreenHeight(getContext());

            // 计算软键盘的高度
            int keypadHeight = screenHeight - rect.bottom;

            // 如果软键盘显示，调整布局
            if (keypadHeight > screenHeight * 0.15) {
                adjustLayoutForKeyboard(keypadHeight);
            } else {
                adjustLayoutForKeyboard(0);
            }
        });

        mKeyboardInputButton.setOnClickListener(v-> switchToKeyboardInput());

        mVoiceInputButton.setOnClickListener(v-> switchToVoiceInput());

        mVoiceMessageButton.setOnTouchListener((v, event) -> {
            float x = event.getRawX();  // 触摸点相对屏幕的 X 坐标
            float y = event.getRawY();  // 触摸点相对屏幕的 Y 坐标
            switch (event.getAction()) {
                case MotionEvent.ACTION_DOWN:
                    mVoiceAnimateLayout.setVisibility(VISIBLE);
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
                    mVoiceAnimateLayout.setVisibility(GONE);
                    AudioRecordManager.getInstance(this.getContext()).stopRecord();
                    AudioRecordManager.getInstance(this.getContext()).destroyRecord();
                    mAudioRecordCancel = isTouchInsideView(viewCancelSend, x, y);
                    break;
            }
            return false;
        });

        mAiChatRequest.setName(mUserInfoViewModel.userInfo.getValue().getName());
        mExpandableListView.setOnGroupClickListener((parent, v, groupPosition, id) -> {
            if(mExpandableListView.isGroupExpanded(groupPosition)) {
                mExpandableListView.collapseGroup(groupPosition);
            } else {
                mExpandableListView.expandGroup(groupPosition);
            }
            return true;
        });

        mExpandableListView.setOnChildClickListener((parent, v, groupPosition, childPosition, id) -> {
            ChatMessageCatalogue catalog = (ChatMessageCatalogue) mChatSessionListAdapter.getGroup(groupPosition);
            ChatMessageSession session = (ChatMessageSession) mChatSessionListAdapter.getChild(groupPosition, childPosition);
            resetCurrentSession(catalog, session);
            return true;
        });
        mChatSessionListAdapter = new ChatExpandableListAdapter(mContext, mExpandableListView);
        mExpandableListView.setAdapter(mChatSessionListAdapter);
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
                                        mAdapterAiChatMessageList.getItems().clear();
                                        //mAdapterAiChatMessageList.notifyDataSetChanged();
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
                        .setPositiveButton("确定", (dialog, which) -> new Thread(() -> {
                            mChatDb.clearMessageSession(session.sessionId);
                            post(() -> {
                                clearChatHistory();
                                loadData();
                            });
                        }).start())
                        .setNegativeButton("取消", null)
                        .create();
                dlg.getWindow().setType(WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY);
                dlg.show();
            }
        });
        //resetCurrentSession(ChatMessageCatalogue.CATEGORY_DEFAULT_SYSTEM, ChatMessageSession.SESSION_DEFAULT_SYSTEM);

        setChatAiSendMode(true);
		mAdapterAiChatMessageList.setOnAiMessageAnimationCallback(() -> {
            mBtnSendText.setEnabled(true);
        });
        addView(view);
    }

    public void sendTextContent(String content) {
        if(mCurrentSession.type == ChatMessageSession.SessionType.SYSTEM_TALK_AI
            || mCurrentSession.type == ChatMessageSession.SessionType.USER_TALK_AI) {
            sendTextMessageToAi(content);
        } else { //和老师的对话
            sendTextMessageToTeacher(content);
        }
    }

    public int getCurrentSessionMsgCount() {
        List<ChatMessage> allMessage =  mChatDb.getChatMessageDetail(mCurrentSession.sessionId);
        return allMessage.size();
    }
    private void loadSelectedRole() {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String roleName = prefs.getString(KEY_SELECTED_ROLE, ChatRole.CHAT_ROLE_AI_MATE.name());

        try {
            // 将存储的字符串转换回枚举
            mSelectedRole = ChatRole.valueOf(roleName);
        } catch (IllegalArgumentException e) {
            // 如果存储的值无效（可能是因为枚举定义改变），使用默认值
            mSelectedRole = ChatRole.CHAT_ROLE_AI_MATE;
        }

        mAiChatRequest.setChatRole(mSelectedRole.getParamName());
    }
    private void saveSelectedRole() {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        // 存储枚举的名称而不是位置
        editor.putString(KEY_SELECTED_ROLE, mSelectedRole.name());
        editor.apply();
    }
    private void prepareSettingsItems() {
        mAiRoleSettingsItems = new ArrayList<>();

        ChatRole [] settingRoles = new  ChatRole[]{
                ChatRole.CHAT_ROLE_AI_MATE,
                ChatRole.CHAT_ROLE_AI_MENTOR,
                ChatRole.CHAT_ROLE_AI_RESEARCHER
        };

        for (ChatRole role : settingRoles) {
            boolean isSelected = (role == mSelectedRole);
            boolean isEnabled = true; // 默认所有项目都启用

            mAiRoleSettingsItems.add(new AiRoleSettingsItem(role.getFriendlyName(), role.getIconResId(), isSelected, isEnabled, role));

            // 如果这是当前选择的角色，更新selectedPosition
            if (isSelected) {
                mSelectedRolePosition = mAiRoleSettingsItems.size() - 1;
            }
        }
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
        mVoiceInputButton.setVisibility(GONE);
        mInputUtilsLayout.setVisibility(GONE);
        mVoiceAnimateLayout.setVisibility(GONE);
        mVoiceMessageButton.setVisibility(VISIBLE);
        mEditMsg.setVisibility(GONE);
        mBtnSendText.setVisibility(GONE);
    }

    private void switchToKeyboardInput() {
        mKeyboardInputButton.setVisibility(GONE);
        mVoiceInputButton.setVisibility(VISIBLE);
        mInputUtilsLayout.setVisibility(VISIBLE);
        mVoiceAnimateLayout.setVisibility(GONE);
        mVoiceMessageButton.setVisibility(GONE);
        mEditMsg.setVisibility(VISIBLE);
        mBtnSendText.setVisibility(VISIBLE);
    }

    private void setChatAiSendMode(boolean isChatAi) {
        if(isChatAi) {
            switchToKeyboardInput();
        }

        mVoiceInputButton.setVisibility(isChatAi ? GONE : VISIBLE);
        mSendPictureButton.setVisibility(isChatAi ? GONE : VISIBLE);
        mCheckSearchWeb.setVisibility(isChatAi ? VISIBLE : GONE);
        mAiRoleSpinner.setVisibility(isChatAi ? VISIBLE : GONE);
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
                    ArrayList<ChatDisplayItem> msgs = new ArrayList<>(mAdapterAiChatMessageList.getItems());
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
            List<ChatMessageCatalogue> displayCatalogs = new ArrayList<>();
            for(ChatMessageCatalogue c : catalogues) {
                displayCatalogs.add(c);
            }
            post(() -> {
                mChatSessionListAdapter.setData(displayCatalogs);
                // 展开所有分组
                for (int i = 0; i < mChatSessionListAdapter.getGroupCount(); i++) {
                    mExpandableListView.expandGroup(i);
                }
            });
        }).start();
    }
    private void loadSelectedSessionMsg(ChatMessageSession session) {
        new Thread(() -> {
            List<ChatMessage> messages = mChatDb.getChatMessageDetail(session.sessionId);
            post(() -> {
                Log.e("!!!!!!!!", "loadSelectedSessionMsg: " + session.sessionName);
                mAdapterAiChatMessageList.getItems().clear();
                mAdapterAiChatMessageList.getItems().addAll(convertChatDisplayList(messages, true));
                //mAdapterAiChatMessageList.notifyDataSetChanged();
                if(!mAdapterAiChatMessageList.getItems().isEmpty()) {
                    mMsgDetailListView.scrollToPosition(mAdapterAiChatMessageList.getItems().size() - 1);
                }
            });
        }).start();
    }
    public void clearChatHistory() {
        mAdapterAiChatMessageList.getItems().clear();
        //mAdapterAiChatMessageList.notifyDataSetChanged();
    }

    private List<ChatDisplayItem> convertChatDisplayList(List<ChatMessage> msgs, boolean isHistory) {
        List<ChatDisplayItem> items = new ArrayList<>();
        for (ChatMessage msg: msgs) {
            ChatDisplayItem item = new ChatDisplayItem(msg, !isHistory, getContext());
            items.add(item);
        }

        return items;
    }

    private void pollChat() {
        String url = mChatAiParam.chatBotUrl;
        //优先使用Request里自带的url, 没有就用默认的
        if (mAiChatRequest.getDstUrl() != null && !mAiChatRequest.getDstUrl().isEmpty()) {
            url = mAiChatRequest.getDstUrl();
        }

        ApiGateWayService.sendChatMessage(mAiChatRequest,
                mLastReceivingMsg.messageId,
                url,
                mUserInfoViewModel.token.getValue(),
                (success, response, sessionId, msgId) -> handler.post(() -> {
                    if (success) {
                        if (!response.trim().isEmpty() && !response.equals("end")) {
                            mLastReceivingMsg.appendContent(response);
                            mAdapterAiChatMessageList.updateReceivingMessage(mLastReceivingMsg.messageId, mChatAiParam.streamDisplay, false);

                            Log.d("%%%%%%%%", response);
                        }

                        if (!response.equals("end")) {
                            mAiChatRequest.setReason("continue");
                            pollChat();
                        } else {
                            mAdapterAiChatMessageList.updateReceivingMessage(mLastReceivingMsg.messageId, mChatAiParam.streamDisplay, true);
                            ApplicationModelShared app = ApplicationModelShared.getInstance();
                            if (app.chatRequest != null) {
                                app.chatRequest = null;
                            }
                            mAiChatRequest.setDstUrl("");
                            if (mListener != null) {
                                mListener.onAiChatResponse(true);
                            }

                            mChatDb.addChatMessageDetail(mLastReceivingMsg);
                        }
                    } else {
                        ApplicationModelShared app = ApplicationModelShared.getInstance();
                        if (app.chatRequest != null) {
                            app.chatRequest = null;
                        }
                        mAiChatRequest.setDstUrl("");

                        mLastReceivingMsg.appendContent("‼️消息接收失败");
                        mAdapterAiChatMessageList.updateReceivingMessage(mLastReceivingMsg.messageId, mChatAiParam.streamDisplay, true);
                        if (mListener != null) {
                            mListener.onAiChatResponse(false);
                        }
                        if (!mAdapterAiChatMessageList.getItems().isEmpty()) {
                            mChatDb.addChatMessageDetail(mLastReceivingMsg);
                        }
                    }
                }));
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
                System.currentTimeMillis(),
                mSelectedRole);
        mAdapterAiChatMessageList.getItems().add(new ChatDisplayItem(message, !message.isSelf, getContext()));
        mChatDb.addChatMessageDetail(message);

        mLastReceivingMsg = new ChatMessage("",
                false,
                ChatMessage.MessageType.TEXT,
                mCurrentSession.sessionId,
                System.currentTimeMillis(),
                mSelectedRole);

        // 注意： 从 mChatAiParam决定是否启用打字机效果显示
        mAdapterAiChatMessageList.getItems().add(new ChatDisplayItem(mLastReceivingMsg, mChatAiParam.streamDisplay, getContext()));

        // 一次性通知 Adapter 插入两条消息
        //mAdapterAiChatMessageList.notifyItemRangeInserted(mAdapterAiChatMessageList.getItems().size() - 2, 2);
        // 滚动到最新位置
        mMsgDetailListView.smoothScrollToPosition(mAdapterAiChatMessageList.getItems().size() - 1);

        mAiChatRequest.setReason("start");
        mAiChatRequest.setCoversation(content);
        mAiChatRequest.setIsWebSearch(mCheckSearchWeb.isChecked() ? "1" : "0");

        mBtnSendText.setEnabled(false);
        pollChat();

        autoDetectChatSessionName(content);
    }

    public void sendMessageToAi(AiChatMessageRequest mo, boolean saveDb) {
        mEditMsg.postDelayed(() -> {
            mAiChatRequest = mo;
            mAiChatRequest.setReason("start");
            mAiChatRequest.setIsWebSearch(mCheckSearchWeb.isChecked() ? "1" : "0");
            mAiChatRequest.setChatRole(mSelectedRole.getParamName());
            ChatMessage message = new ChatMessage(mAiChatRequest.getCoversation(),
                    true,
                    ChatMessage.MessageType.TEXT,
                    mCurrentSession.sessionId,
                    System.currentTimeMillis(),
                    ChatRole.CHAT_ROLE_MYSELF);
            if(saveDb) {
                mAdapterAiChatMessageList.getItems().add(new ChatDisplayItem(message, !message.isSelf, getContext()));
                mChatDb.addChatMessageDetail(message);
            }

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
                            System.currentTimeMillis(),
                            ChatRole.CHAT_ROLE_MYSELF);
                    String localPath = AppUtils.getUserFilePath().getAbsolutePath() + "/" + msg.messageId + ".png";
                    msg.content = localPath;
                    ImageUtils.saveImageFile(question, localPath);

                } else {
                    msg = new ChatMessage(question,
                            true,
                            ChatMessage.MessageType.TEXT,
                            mCurrentSession.sessionId,
                            System.currentTimeMillis(),
                            ChatRole.CHAT_ROLE_MYSELF);
                }
                mAdapterAiChatMessageList.getItems().add(new ChatDisplayItem(msg, false, getContext()));
                mChatDb.addChatMessageDetail(msg);
            }

            //mAdapterAiChatMessageList.notifyDataSetChanged();
            mEditMsg.setText("");

            mLastReceivingMsg = new ChatMessage(
                    "",
                    false,
                    ChatMessage.MessageType.TEXT,
                    mCurrentSession.sessionId,
                    System.currentTimeMillis(),
                    mSelectedRole);
            // 注意： 从 mChatAiParam决定是否启用打字机效果显示
            mAdapterAiChatMessageList.getItems().add(new ChatDisplayItem(mLastReceivingMsg, mChatAiParam.streamDisplay, getContext()));
            //mAdapterAiChatMessageList.notifyItemInserted(mAdapterAiChatMessageList.getItems().size() - 1);

            mMsgDetailListView.smoothScrollToPosition(mAdapterAiChatMessageList.getItems().size() - 1);

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
                System.currentTimeMillis(),
                ChatRole.CHAT_ROLE_MYSELF);
        message.messageId = studentMsg.getMessageId();

        mAdapterAiChatMessageList.getItems().add(new ChatDisplayItem(message, !message.isSelf, getContext()));
        mChatDb.addChatMessageDetail(message);
        //mAdapterAiChatMessageList.notifyDataSetChanged();
        mMsgDetailListView.smoothScrollToPosition(mAdapterAiChatMessageList.getItems().size() - 1);
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
                System.currentTimeMillis(),
                ChatRole.CHAT_ROLE_MYSELF);
        message.messageId = studentMsg.getMessageId();

        mAdapterAiChatMessageList.getItems().add(new ChatDisplayItem(message, !message.isSelf, getContext()));
        mChatDb.addChatMessageDetail(message);
        //mAdapterAiChatMessageList.notifyDataSetChanged();
        mMsgDetailListView.smoothScrollToPosition(mAdapterAiChatMessageList.getItems().size() - 1);
    }

    public void sendHomeworkPicturesToTeacher(String pictures) {
        String [] paths = pictures.split(",");
        for(String path : paths) {
            postDelayed(() -> {
                sendPictureToTeacher(path);
            }, 1000);
        }
    }

    public void sendPicture(String path) {
        if(mCurrentSession.type.getValue() > ChatMessageSession.SessionType.USER_TALK_TEACHER_BEGIN.getValue()
          && mCurrentSession.type.getValue() < ChatMessageSession.SessionType.USER_TALK_TEACHER_END.getValue()) {
            sendPictureToTeacher(path);
        } else {
            mAiChatRequest.setDstUrl(ApiUrl.URL_CHAT_PREVIEW_PICTURE);
            mAiChatRequest.setQuestion(ImageUtils.bitmapToHtmlJpgBase64(BitmapFactory.decodeFile(path)));
            sendMessageToAi(mAiChatRequest, true);
        }
    }
    private void sendPictureToTeacher(String path) {
        String subject = getTeacherSubject();
        String base64Content = ImageUtils.loadImageFileToBase64(path);
        StudentMessage studentMsg = new StudentMessage(mUserInfoViewModel.userId.getValue(),
                mCurrentSession.sessionId,
                subject,
                TeacherQaType.QA_MSG_TYPE_PICTURE,
                base64Content);
        if(mSelectedImageUUID.isEmpty()) {
            studentMsg.setMessageId(UUID.randomUUID().toString());
        } else {
            studentMsg.setMessageId(mSelectedImageUUID);
        }

        MessagingManager.getInstance().sendMessageToTeacher(studentMsg, (success, messageId, errorMessage) -> {
            Log.e("=-=-=", success + messageId + errorMessage);
        });

        ChatMessage message = new ChatMessage(path,
                true,
                ChatMessage.MessageType.IMAGE,
                mCurrentSession.sessionId,
                System.currentTimeMillis(),
                ChatRole.CHAT_ROLE_MYSELF);
        message.messageId = studentMsg.getMessageId();

        mAdapterAiChatMessageList.getItems().add(new ChatDisplayItem(message, !message.isSelf, getContext()));
        mChatDb.addChatMessageDetail(message);
        //mAdapterAiChatMessageList.notifyDataSetChanged();
        mMsgDetailListView.smoothScrollToPosition(mAdapterAiChatMessageList.getItems().size() - 1);
    }

    public void onReceivedTeacherMessage(ChatMessage chatMessage) {
        if(chatMessage != null) {
            if(mCurrentSession.sessionId.equals(chatMessage.sessionId)) {
                mAdapterAiChatMessageList.getItems().add(new ChatDisplayItem(chatMessage, false, getContext()));
                //mAdapterAiChatMessageList.notifyDataSetChanged();
                mMsgDetailListView.smoothScrollToPosition(mAdapterAiChatMessageList.getItems().size() - 1);
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
        if (mInSearchMode) {
            return;
        }

        List<ChatMessage> allMessages = mChatDb.getChatMessageDetail(mCurrentSession.sessionId);
        int currentDisplayedCount = mAdapterAiChatMessageList.getItems().size();

        // 如果所有消息都已经显示，则不需要加载更多
        if (currentDisplayedCount >= allMessages.size()) {
            return;
        }

        // 计算需要加载的新消息数量（最多10条）
        int newMessagesToLoad = Math.min(10, allMessages.size() - currentDisplayedCount);

        // 计算要加载的历史消息范围
        // 当前已显示的是最新的 currentDisplayedCount 条消息
        // 所以要加载的是比当前显示更早的 newMessagesToLoad 条消息
        int startIndex = allMessages.size() - currentDisplayedCount - newMessagesToLoad;
        int endIndex = allMessages.size() - currentDisplayedCount;

        List<ChatMessage> historyMessages = allMessages.subList(startIndex, endIndex);

        // 将历史消息添加到列表的开头
        mAdapterAiChatMessageList.getItems().addAll(0, convertChatDisplayList(historyMessages, true));

        // 通知适配器数据变化
        mAdapterAiChatMessageList.notifyItemRangeInserted(0, newMessagesToLoad);

        // 滚动到新添加的消息位置
        mMsgDetailListView.smoothScrollToPosition(0);
    }

    public void setChatEnable(boolean b) {
        mBtnSendText.setEnabled(b);
        mChkViewHistory.setEnabled(b);
        mTextViewTitle.setEnabled(b);
    }

    private void adjustLayoutForKeyboard(int keyboardHeight) {
        // 设置 padding 使布局留出足够的空间以防止软键盘遮挡
        // 隐藏软键盘时，恢复布局
        // 恢复 padding
        mRootLayout.setPadding(0, 0, 0, Math.max(keyboardHeight, 0));  // 设置 padding 底部为软键盘的高度
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

    // Model class for settings items
    // 设置项目的模型类
    public static class AiRoleSettingsItem {
        private final String title;
        private final int iconResId;
        private boolean selected;
        private boolean enabled;
        private final ChatRole role; // 添加枚举引用

        public AiRoleSettingsItem(String title, int iconResId, boolean selected, boolean enabled, ChatRole role) {
            this.title = title;
            this.iconResId = iconResId;
            this.selected = selected;
            this.enabled = enabled;
            this.role = role;
        }

        public String getTitle() {
            return title;
        }

        public int getIconResId() {
            return iconResId;
        }

        public boolean isSelected() {
            return selected;
        }

        public void setSelected(boolean selected) {
            this.selected = selected;
        }

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }

        public ChatRole getRole() {
            return role;
        }
    }

    // 自定义适配器
    public class ChatAiRoleSettingsAdapter extends BaseAdapter {
        private final List<AiRoleSettingsItem> items;
        private final LayoutInflater inflater;

        public ChatAiRoleSettingsAdapter(List<AiRoleSettingsItem> items, Context context) {
            this.items = items;
            this.inflater = LayoutInflater.from(context);
        }

        @Override
        public int getCount() {
            return items.size();
        }

        @Override
        public Object getItem(int position) {
            return items.get(position);
        }

        @Override
        public long getItemId(int position) {
            return position;
        }

        @Override
        public boolean isEnabled(int position) {
            return items.get(position).isEnabled();
        }

        @Override
        public View getView(int position, View convertView, ViewGroup parent) {
            // 这个视图是 Spinner 关闭时显示的
            ViewHolder viewHolder;
            if(convertView == null) {
                viewHolder = new ViewHolder();
                convertView = inflater.inflate(R.layout.chat_ai_role_spinner_closed_view, parent, false);
                viewHolder.settingsIcon = convertView.findViewById(R.id.settings_icon);
                viewHolder.titleText = convertView.findViewById(R.id.settings_title);
                convertView.setTag(viewHolder);
            } else {
                viewHolder = (ViewHolder) convertView.getTag();
            }

            AiRoleSettingsItem currentItem = items.get(mSelectedRolePosition);
            viewHolder.settingsIcon.setImageResource(currentItem.getIconResId());
            viewHolder.titleText.setText(currentItem.getTitle());

            return convertView;
        }

        @Override
        public View getDropDownView(int position, View convertView, ViewGroup parent) {
            // 这个视图是下拉列表中每个项目的视图
            ViewHolderSettingItem holder;

            if (convertView == null) {
                convertView = inflater.inflate(R.layout.chat_ai_role_spinner_item_view, parent, false);
                holder = new ViewHolderSettingItem();
                holder.icon = convertView.findViewById(R.id.item_icon);
                holder.title = convertView.findViewById(R.id.item_title);
                holder.checkIcon = convertView.findViewById(R.id.item_check);
                convertView.setTag(holder);
            } else {
                holder = (ViewHolderSettingItem) convertView.getTag();
            }

            AiRoleSettingsItem item = items.get(position);

            holder.icon.setImageResource(item.getIconResId());
            holder.title.setText(item.getTitle());

            // 为选中的项目显示对勾
            if (item.isSelected()) {
                holder.checkIcon.setVisibility(View.VISIBLE);
            } else {
                holder.checkIcon.setVisibility(View.GONE);
            }

            // 处理禁用状态
            if (!item.isEnabled()) {
                // 灰显文本和图标
                holder.title.setTextColor(Color.GRAY);
                holder.icon.setAlpha(0.5f);
                if (holder.checkIcon.getVisibility() == View.VISIBLE) {
                    holder.checkIcon.setAlpha(0.5f);
                }
                // 设置背景为灰色
                convertView.setBackgroundColor(Color.parseColor("#F5F5F5"));
            } else {
                // 正常状态
                holder.title.setTextColor(Color.BLACK);
                holder.icon.setAlpha(1.0f);
                holder.checkIcon.setAlpha(1.0f);
                convertView.setBackgroundColor(Color.WHITE);
            }

            return convertView;
        }

        private static class ViewHolder {
            ImageView settingsIcon;
            TextView titleText;
        }

        private static class ViewHolderSettingItem {
            ImageView icon;
            TextView title;
            ImageView checkIcon;
        }
    }
}
