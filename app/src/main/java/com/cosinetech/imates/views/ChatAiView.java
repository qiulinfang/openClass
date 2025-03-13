package com.cosinetech.imates.views;

import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.content.Context;
import android.graphics.Rect;
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
import androidx.lifecycle.ViewModelProvider;
import androidx.lifecycle.ViewModelStoreOwner;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.cosinetech.imates.ApplicationModelShared;
import com.cosinetech.imates.R;
import com.cosinetech.imates.adapters.AdapterAiChatMessageList;
import com.cosinetech.imates.adapters.ChatExpandableListAdapter;
import com.cosinetech.imates.audio.AudioRecordManager;
import com.cosinetech.imates.models.ChatDisplayItem;
import com.cosinetech.imates.models.ChatMessage;
import com.cosinetech.imates.models.ChatMessageCatalogue;
import com.cosinetech.imates.models.ChatMessageHistoryDB;
import com.cosinetech.imates.models.ChatMessageSession;
import com.cosinetech.imates.models.UserInfoViewModel;
import com.cosinetech.imates.util.AppUtils;
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

    public static class ChatAiParam {
        public String chatBotUrl;
        public boolean showHeader;
        public boolean streamDisplay;
        public boolean showHistory;
        public boolean initialSendEnable;
        public AiChatResponseListener listener;
    }

    private final static String CATALOG_ID_DEFAULT = "0".repeat(32);
    private final static String CATALOG_ID_TEACHER = "3".repeat(32);
    private final static String CATALOG_ID_MY_FAVOR = "7".repeat(32);
    private final static String SESSION_ID_DEFAULT = "9".repeat(32);
    private UserInfoViewModel mUserInfoViewModel;
    private Context mContext;
    private AiChatMessageRequest mAiChatRequest = new AiChatMessageRequest("", "", "", "", "", "", "start", "");
    private AdapterAiChatMessageList adapterAiChatMessageList;
    private final List<ChatDisplayItem> messageList = new ArrayList<>();
    private RecyclerView mMsgDetailListView;
    private SmartRefreshLayout mMsgRefreshLayout;
    private EditText mEditMsg;
    private Button mBtnSend;
    private CheckBox chkViewHistory;
    private TextView mTextViewTitle;
    private Button mKeyboardInputButton;
    private Button mVoiceInputButton;
    private Button mVoiceMessageButton;
    private ChatAiParam mChatAiParam;
    private RelativeLayout rootLayout; // 用于调整布局的父布局
    private boolean mInSearchMode = false;
    private ChatMessageHistoryDB mChatDb;
    private ChatMessageCatalogue mCurrentCatalog;
    private ChatMessageSession mCurrentSession;
    private ExpandableListView expandableListView;
    private ChatExpandableListAdapter mChatSessionListAdapter;

    private ChatMessageSession mFixedDefaultSession;
    private ChatMessageCatalogue mDefaultCatalogue;
    private ChatMessageCatalogue mTeacherQACatalogue;

    private ChatMessageCatalogue mMyFavorCatalogue;
    private int clickCount = 0; // 记录点击次数

    private ChatMessage mLastReceivingMsg;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable resetClickCountRunnable = new Runnable() {
        @Override
        public void run() {
            clickCount = 0; // 重置点击次数
            handler.postDelayed(this, 2000);
        }
    };

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

    public void setChatAiParam(ChatAiParam param) {
        this.setVisibility(VISIBLE);
        mChatAiParam = param;
        if(mChatAiParam != null) {
            initView();
            loadData();
        }
    }

    public void resetCurrentSession(ChatMessageSession session) {
        if(!mCurrentSession.sessionId.equals(session.sessionId)) {
            clearChatHistory();
            loadSelectedSessionMsg(session);
            mAiChatRequest.setNewValue("1");
        } else {
            mAiChatRequest.setNewValue("0");
        }
        mCurrentSession = session;
        String aiName = mCurrentCatalog.catalogName + " - " + mCurrentSession.sessionName;
        mTextViewTitle.setText(aiName);
        mChatSessionListAdapter.setSelectedSessionId(mCurrentSession.sessionId);
        mAiChatRequest.setSessionId(mCurrentSession.sessionId);
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

        // 和老师对话的分类
        mTeacherQACatalogue = new ChatMessageCatalogue(CATALOG_ID_TEACHER,
                mContext.getString(R.string.chat_ai_catalog_teacher),
                ChatMessageCatalogue.CatalogueType.SYSTEM,
                Long.MAX_VALUE,
                Long.MAX_VALUE);
        mChatDb.addMessageCatalogue(mTeacherQACatalogue);

        mDefaultCatalogue = new ChatMessageCatalogue(CATALOG_ID_DEFAULT,
                mContext.getString(R.string.chat_ai_catalog_default),
                        ChatMessageCatalogue.CatalogueType.SYSTEM,
                        Long.MAX_VALUE  - 100,
                        Long.MAX_VALUE - 100);
        mChatDb.addMessageCatalogue(mDefaultCatalogue);

        mMyFavorCatalogue = new ChatMessageCatalogue(CATALOG_ID_MY_FAVOR,
                mContext.getString(R.string.chat_ai_catalog_my_favor),
                ChatMessageCatalogue.CatalogueType.SYSTEM,
                Long.MAX_VALUE  - 200,
                Long.MAX_VALUE - 200);
        mChatDb.addMessageCatalogue(mMyFavorCatalogue);


        mFixedDefaultSession = new ChatMessageSession(SESSION_ID_DEFAULT, CATALOG_ID_DEFAULT,
                mContext.getString(R.string.chat_ai_default_session_name),
                ChatMessageSession.SessionType.SYSTEM_TALK_AI,
                Long.MAX_VALUE - 100, 0, Long.MAX_VALUE - 100);

        mChatDb.addMessageSession(mFixedDefaultSession);

        mCurrentCatalog = mDefaultCatalogue;
        mCurrentSession = mFixedDefaultSession;
    }

    @SuppressLint("ClickableViewAccessibility")
    private void initView() {
        // Inflate the layout for this fragment
        View view = LayoutInflater.from(mContext).inflate(R.layout.view_chat_ai, this, false);
        mMsgDetailListView = view.findViewById(R.id.chat_msg_list);
        mMsgRefreshLayout = view.findViewById(R.id.chat_msg_refresh_layout);
        mEditMsg = view.findViewById(R.id.et_message);
        mBtnSend = view.findViewById(R.id.btn_send);
        mTextViewTitle = view.findViewById(R.id.ai_name);
        Button btnNewChat = view.findViewById(R.id.btn_new_chat);
        btnNewChat.setOnClickListener(v->{
            createChatSession();
        });

        mEditMsg.setOnFocusChangeListener((v, hasFocus) -> {
            if (hasFocus) {
                new Handler(Looper.getMainLooper()).postDelayed(() -> {
                    Context context = mEditMsg.getContext();
                    InputMethodManager imm = (InputMethodManager) context.getSystemService(Context.INPUT_METHOD_SERVICE);
                    imm.showSoftInput(mEditMsg, InputMethodManager.SHOW_IMPLICIT);
                }, 500); // 延迟 200 毫秒
            }
        });

        // Initialize RecyclerView
        mMsgDetailListView.setLayoutManager(new LinearLayoutManager(mContext, LinearLayoutManager.VERTICAL, false));
        mMsgDetailListView.addItemDecoration(new RecyclerViewOverscrollDecoration());
        mMsgDetailListView.setClipToPadding(false);// disabling clip to padding is critical

        adapterAiChatMessageList = new AdapterAiChatMessageList(messageList);
        mMsgDetailListView.setAdapter(adapterAiChatMessageList);

        // Set up SmartRefreshLayout for pull-to-refresh
        mMsgRefreshLayout.setOnRefreshListener(refreshLayout -> {
            // Handle refresh
            loadHistoryMessages();
            refreshLayout.finishRefresh();
        });

        // Send button click
        mBtnSend.setOnClickListener(v -> sendTextMessage());

        mAiChatRequest.setName(Objects.requireNonNull(mUserInfoViewModel.userInfo.getValue()).getName());

        expandableListView = view.findViewById(R.id.expandable_list_view);
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
            resetCurrentCatalog(catalog);
            resetCurrentSession(session);
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
        resetCurrentSession(mCurrentSession);
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
                                mChatDb.deleteMessageSession(session.sessionId);
                                post(() -> {
                                    if (session.sessionId.equals(mCurrentSession.sessionId)) {
                                        messageList.clear();
                                        adapterAiChatMessageList.notifyDataSetChanged();
                                    }
                                    resetCurrentSession(mFixedDefaultSession);
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

        chkViewHistory = view.findViewById(R.id.btn_view_history);
        chkViewHistory.setOnCheckedChangeListener((buttonView, isChecked) -> {
            if(isChecked) {
                view.findViewById(R.id.history_layout).setVisibility(View.VISIBLE);
                //view.findViewById(R.id.chat_input_area).setVisibility(View.INVISIBLE);
            } else {
                view.findViewById(R.id.history_layout).setVisibility(View.GONE);
                //view.findViewById(R.id.chat_input_area).setVisibility(View.VISIBLE);
            }
        });

        EditText editTextSearch = view.findViewById(R.id.et_search);
        CheckBox btnCancelSearch = view.findViewById(R.id.btn_search);
        btnCancelSearch.setOnCheckedChangeListener((buttonView, isChecked) -> {
            if(isChecked) {
                editTextSearch.setVisibility(VISIBLE);
            } else {
                editTextSearch.setVisibility(GONE);
                if (editTextSearch.isFocused()) {
                    editTextSearch.clearFocus();
                    // 隐藏键盘
                    InputMethodManager imm = (InputMethodManager) mContext.getSystemService(Context.INPUT_METHOD_SERVICE);
                    imm.hideSoftInputFromWindow(editTextSearch.getWindowToken(), 0);
                }
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
                adapterAiChatMessageList.notifyDataSetChanged();

                return true; // 表示我们已经处理了这个事件
            }
            return false;
        });

        Button btnAddFavor = view.findViewById(R.id.btn_add_favor);
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
                adapterAiChatMessageList.notifyDataSetChanged();
                mMsgDetailListView.smoothScrollToPosition(messageList.size() - 1);
            }
        }

        mBtnSend.setEnabled(mChatAiParam.initialSendEnable);

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
            sendTextMessage(app.chatRequest);
        }

        rootLayout = view.findViewById(R.id.layout_chat);  // 父布局

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

        View voiceAnimateLayout = view.findViewById(R.id.voice_animate_area);
        mKeyboardInputButton = view.findViewById(R.id.input_keyboard);
        mVoiceInputButton = view.findViewById(R.id.btn_voice);
        mVoiceMessageButton = view.findViewById(R.id.voice_message);

        mKeyboardInputButton.setOnClickListener(v->{
            mKeyboardInputButton.setVisibility(GONE);
            mVoiceInputButton.setVisibility(VISIBLE);
            voiceAnimateLayout.setVisibility(GONE);
            mVoiceMessageButton.setVisibility(GONE);
            mEditMsg.setVisibility(VISIBLE);
            mBtnSend.setVisibility(VISIBLE);
        });

        mVoiceInputButton.setOnClickListener(v->{
            mKeyboardInputButton.setVisibility(VISIBLE);
            mVoiceInputButton.setVisibility(GONE);
            voiceAnimateLayout.setVisibility(GONE);
            mVoiceMessageButton.setVisibility(VISIBLE);
            mEditMsg.setVisibility(GONE);
            mBtnSend.setVisibility(GONE);
        });

        ImageView viewCancelSend = view.findViewById(R.id.cancel_record);

        mVoiceMessageButton.setOnTouchListener((v, event) -> {
            float x = event.getRawX();  // 触摸点相对屏幕的 X 坐标
            float y = event.getRawY();  // 触摸点相对屏幕的 Y 坐标
            switch (event.getAction()) {
                case MotionEvent.ACTION_DOWN:
                    voiceAnimateLayout.setVisibility(VISIBLE);
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

                    } else {

                    }
                    break;
            }
            return false;
        });

        addView(view);
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
                mDefaultCatalogue.catalogId,
                mContext.getString(R.string.chat_ai_new_session_name),
                ChatMessageSession.SessionType.USER_TALK_AI,
                tick,
                tick,
                tick);
        mChatDb.addMessageSession(session);
        mChatSessionListAdapter.addSession(session);

        resetCurrentCatalog(mDefaultCatalogue);
        resetCurrentSession(session);
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
                                    mMyFavorCatalogue.catalogId, newName, ChatMessageSession.SessionType.USER_FAVOR,
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
                adapterAiChatMessageList.notifyDataSetChanged();
                if(!messageList.isEmpty()) {
                    mMsgDetailListView.scrollToPosition(messageList.size() - 1);
                }
            });
        }).start();
    }
    public void clearChatHistory() {
        messageList.clear();
        adapterAiChatMessageList.notifyDataSetChanged();
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
                        adapterAiChatMessageList.updateReceivingMessage(mLastReceivingMsg.messageId, mChatAiParam.streamDisplay);

                        Log.d("%%%%%%%%", response);
                    }
                    if(!response.equals("end")) {
                        mAiChatRequest.setReason("continue");
                        pollChat();
                    } else {
                        mBtnSend.setEnabled(true);
                        if(mChatAiParam.listener != null) {
                            mChatAiParam.listener.onAiChatResponse(true);
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
                    adapterAiChatMessageList.updateReceivingMessage(mLastReceivingMsg.messageId, false);
                    mBtnSend.setEnabled(true);
                    if(mChatAiParam.listener != null) {
                        mChatAiParam.listener.onAiChatResponse(false);
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

    private void sendTextMessage() {
        String messageText = mEditMsg.getText().toString().trim();
        if (messageText.trim().isEmpty()) {
            return;
        }

        // Add message to the list and notify the adapter
        ChatMessage message = new ChatMessage(messageText,
                true,
                ChatMessage.MessageType.TEXT,
                mCurrentSession.sessionId,
                System.currentTimeMillis());
        messageList.add(new ChatDisplayItem(message, !message.isSelf));

        mEditMsg.setText("");
        mChatDb.addChatMessageDetail(message);
        ChatMessage responseMessage = new ChatMessage("",
                false,
                ChatMessage.MessageType.TEXT,
                mCurrentSession.sessionId,
                System.currentTimeMillis());
        mLastReceivingMsg = responseMessage;
        messageList.add(new ChatDisplayItem(responseMessage, !responseMessage.isSelf));

        // 一次性通知 Adapter 插入两条消息
        adapterAiChatMessageList.notifyItemRangeInserted(messageList.size() - 2, 2);
        // 滚动到最新位置
        mMsgDetailListView.smoothScrollToPosition(messageList.size() - 1);

        mAiChatRequest.setReason("start");
        mAiChatRequest.setCoversation(messageText);

        mBtnSend.setEnabled(false);
        pollChat();

        autoDetectChatSessionName(messageText.trim());
    }

    public void sendVoiceMessageToTeacher(String voicePath) {

    }

    public void sendTextMessageToTeacher(String content) {

    }

    public void sendPictureToTeacher(String path) {

    }

    public void sendTextMessage(AiChatMessageRequest mo) {
        mEditMsg.postDelayed(() -> {
            mAiChatRequest = mo;
            mAiChatRequest.setReason("start");
            ChatMessage message = new ChatMessage(mAiChatRequest.getCoversation(),
                    true,
                    ChatMessage.MessageType.TEXT,
                    mCurrentSession.sessionId,
                    System.currentTimeMillis());
            messageList.add(new ChatDisplayItem(message, !message.isSelf));
            mChatDb.addChatMessageDetail(message);

//            if(!mo.getQuestion().isEmpty()) {
//                //可能是图片
//                String question = mo.getQuestion().trim();
//                if(question.startsWith("data:image")) {
//                    //截图问答的图片
//                    ChatMessage msgPicture = new ChatMessage(ImageUtils.htmlJpgBase64ToMd(question),
//                            true,
//                            ChatMessage.MessageType.TEXT,
//                            mCurrentSession.sessionId,
//                            System.currentTimeMillis());
//                    messageList.add(new ChatDisplayItem(msgPicture, true));
//                    mChatDb.addChatMessageDetail(msgPicture);
//                }
//            }

            adapterAiChatMessageList.notifyDataSetChanged();
            mEditMsg.setText("");

            ChatMessage responseMessage = new ChatMessage(
                    "",
                    false,
                    ChatMessage.MessageType.TEXT,
                    mCurrentSession.sessionId,
                    System.currentTimeMillis());
            mLastReceivingMsg = responseMessage;
            messageList.add(new ChatDisplayItem(responseMessage, !responseMessage.isSelf));
            adapterAiChatMessageList.notifyItemInserted(messageList.size() - 1);

            mMsgDetailListView.smoothScrollToPosition(messageList.size() - 1);

//        aiChatMessageRequest.setReason("start");
//        aiChatMessageRequest.setCoversation(messageText);

            mBtnSend.setEnabled(false);
            pollChat();

            autoDetectChatSessionName(mAiChatRequest.getCoversation().trim());
        }, 1000);
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
            resetCurrentSession(mCurrentSession);
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
        adapterAiChatMessageList.notifyDataSetChanged();
        mMsgDetailListView.smoothScrollToPosition(0);
    }

    public void setChatEnable(boolean b) {
        mBtnSend.setEnabled(b);
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
