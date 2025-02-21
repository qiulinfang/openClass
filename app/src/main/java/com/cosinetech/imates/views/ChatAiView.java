package com.cosinetech.imates.views;

import static com.cosinetech.imates.views.FlowTagLayout.FLOW_TAG_CHECKED_SINGLE;

import android.content.Context;
import android.graphics.Rect;
import android.os.Handler;
import android.os.Looper;
import android.util.AttributeSet;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.ListView;
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
import com.cosinetech.imates.adapters.AdapterChatCatalog;
import com.cosinetech.imates.adapters.ChatSessionAdapter;
import com.cosinetech.imates.models.ChatDisplayItem;
import com.cosinetech.imates.models.ChatMessage;
import com.cosinetech.imates.models.ChatMessageCatalogue;
import com.cosinetech.imates.models.ChatMessageHistoryDB;
import com.cosinetech.imates.models.ChatMessageSession;
import com.cosinetech.imates.models.UserInfoViewModel;
import com.cosinetech.imates.util.TimeUtils;
import com.cosinetech.imates.webservice.AiChatMessageRequest;
import com.cosinetech.imates.webservice.ApiGateWayService;
import com.scwang.smart.refresh.layout.SmartRefreshLayout;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

public class ChatAiView extends RelativeLayout {
    public interface AiChatResponseListener {
        void onAiChatResponced(boolean success);
    }

    public static class ChatAiParam {
        public String sessionId = "";
        public String chatBotUrl;
        public boolean showHeader;
        public boolean streamDisplay;
        public boolean showHistory;
        public boolean initialSendEnable;
        public AiChatResponseListener listener;
    }

    private UserInfoViewModel userInfoViewModel;
    private Context mContext;

    private AiChatMessageRequest aiChatMessageRequest = new AiChatMessageRequest("", "", "", "", "", "", "start", "");
    private RecyclerView recyclerView;
    private SmartRefreshLayout refreshLayout;
    private EditText etMessage;
    private AdapterAiChatMessageList adapterAiChatMessageList;
    private final List<ChatDisplayItem> messageList = new ArrayList<>();
    private Button btnSend;
    private CheckBox chkViewHistory;

    private TextView textViewTitle;

    private String aiName = "";

    private ChatAiParam mChatAiParam;

    // chat message tags
    private AdapterChatCatalog<ChatMessageCatalogue> mChatAdapterChatCatalog;

    // chat message catalog list by tag
    private final List<ChatMessageSession> mChatSessions = new ArrayList<>();
    private ChatSessionAdapter mChatSessionAdapter;

    private RelativeLayout rootLayout;  // 用于调整布局的父布局

    private boolean mInSearchMode = false;

    private ChatMessageHistoryDB mChatDb;

    private int clickCount = 0; // 记录点击次数
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
        }
    }

    private void init(Context context) {
        mContext = context;
        // Required empty public constructor
        ViewModelStoreOwner owner = ApplicationModelShared.getInstance();
        userInfoViewModel = new ViewModelProvider(
                owner,
                new ViewModelProvider.AndroidViewModelFactory(ApplicationModelShared.getInstance())
        ).get(UserInfoViewModel.class);
        mChatDb = ChatMessageHistoryDB.getInstance(context, userInfoViewModel.userPath.getValue());
    }

    private void initView() {
        // Inflate the layout for this fragment
        View view = LayoutInflater.from(mContext).inflate(R.layout.view_chat_ai, this, false);
        recyclerView = view.findViewById(R.id.chat_msg_view);
        refreshLayout = view.findViewById(R.id.chat_message_list);
        etMessage = view.findViewById(R.id.et_message);
        btnSend = view.findViewById(R.id.btn_send);
        textViewTitle = view.findViewById(R.id.ai_name);

        etMessage.setOnFocusChangeListener((v, hasFocus) -> {
            if (hasFocus) {
                new Handler(Looper.getMainLooper()).postDelayed(() -> {
                    Context context = etMessage.getContext();
                    InputMethodManager imm = (InputMethodManager) context.getSystemService(Context.INPUT_METHOD_SERVICE);
                    imm.showSoftInput(etMessage, InputMethodManager.SHOW_IMPLICIT);
                }, 500); // 延迟 200 毫秒
            }
        });

        // Initialize RecyclerView
        recyclerView.setLayoutManager(new LinearLayoutManager(getContext()));
        adapterAiChatMessageList = new AdapterAiChatMessageList(messageList);
        recyclerView.setAdapter(adapterAiChatMessageList);

        // Set up SmartRefreshLayout for pull-to-refresh
        refreshLayout.setOnRefreshListener(refreshLayout -> {
            // Handle refresh
            loadMessages();
            refreshLayout.finishRefresh();
        });

        // Send button click
        btnSend.setOnClickListener(v -> sendMessage());

        aiChatMessageRequest.setName(Objects.requireNonNull(userInfoViewModel.userInfo.getValue()).getName());

        FlowTagLayout layout = view.findViewById(R.id.chat_tags);
        mChatAdapterChatCatalog = new AdapterChatCatalog<>(mContext);
        layout.setTagCheckedMode(FLOW_TAG_CHECKED_SINGLE);
        layout.setTagCheckedMode(FlowTagLayout.FLOW_TAG_CHECKED_SINGLE);
        layout.setAdapter(mChatAdapterChatCatalog);
        layout.setOnTagSelectListener((parent, selectedList) -> {
            if (selectedList != null && !selectedList.isEmpty()) {
                String catalogId = mChatAdapterChatCatalog.getItem(selectedList.get(0)).catalogId;
                List<ChatMessageSession> sessions = mChatDb.getMessageSessionByCatalogId(catalogId);
                mChatSessions.clear();
                mChatSessions.addAll(sessions);
                mChatSessionAdapter.notifyDataSetChanged();
            }else{
                mChatSessions.clear();
                mChatSessionAdapter.notifyDataSetChanged();
            }
        });

        chkViewHistory = view.findViewById(R.id.btn_view_history);
        chkViewHistory.setOnCheckedChangeListener((buttonView, isChecked) -> {
            if(isChecked) {
                view.findViewById(R.id.history_layout).setVisibility(View.VISIBLE);
                view.findViewById(R.id.chat_input_area).setVisibility(View.INVISIBLE);

                List<ChatMessageCatalogue> catalogs = mChatDb.getAllMessageCatalogue();
                mChatAdapterChatCatalog.clearAndAddAll(catalogs);
                textViewTitle.setEnabled(false);
            } else {
                view.findViewById(R.id.history_layout).setVisibility(View.GONE);
                view.findViewById(R.id.chat_input_area).setVisibility(View.VISIBLE);
                textViewTitle.setEnabled(true);
            }
        });

        mChatSessionAdapter = new ChatSessionAdapter(mContext, mChatSessions);
        ListView catalogView = view.findViewById(R.id.chat_session_list);
        catalogView.setAdapter(mChatSessionAdapter);
        catalogView.setOnItemClickListener((parent, view1, position, id) -> {
            ChatMessageSession chatSession = mChatSessions.get(position);
            List<ChatMessage> msgs = mChatDb.getChatMessageDetail(chatSession.sessionId);
            messageList.clear();
            messageList.addAll(getChatDisplayList(msgs, true));
            adapterAiChatMessageList.notifyDataSetChanged();
        });

        CheckBox btnCancelSearch = view.findViewById(R.id.btn_search);
        EditText editTextSearch = view.findViewById(R.id.et_search);
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
                loadMessages();
            }
        });

        // 设置焦点改变监听器
        editTextSearch.setOnFocusChangeListener((v, hasFocus) -> {
            if (hasFocus) {
                // 当 EditText 获取到焦点时执行的代码
                btnCancelSearch.setVisibility(View.VISIBLE);
                mInSearchMode = true;
            } else {
                // 当 EditText 失去焦点时执行的代码
                btnCancelSearch.setVisibility(View.INVISIBLE);
                mInSearchMode = false;
                loadMessages();
            }
        });
        editTextSearch.setOnEditorActionListener((v, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_SEARCH) {
                String searchContent = editTextSearch.getText().toString();
                if(searchContent.trim().isEmpty()) {
                    Toast.makeText(mContext, "请输入要搜索的关键字", Toast.LENGTH_SHORT).show();
                    return true;
                }
                // 用户点击了搜索按钮，这里可以执行搜索逻辑
                List<ChatMessage> msgs =  mChatDb.searchMessageDetail(searchContent);
                if(msgs.isEmpty()) {
                    Toast.makeText(mContext, "没有搜索到记录", Toast.LENGTH_SHORT).show();
                }
                messageList.clear();
                messageList.addAll(getChatDisplayList(msgs, true));
                adapterAiChatMessageList.notifyDataSetChanged();

                return true; // 表示我们已经处理了这个事件
            }
            return false;
        });

        if(!mChatAiParam.showHeader) {
            chkViewHistory.setVisibility(View.INVISIBLE);
            view.findViewById(R.id.history_layout).setVisibility(View.GONE);

            view.findViewById(R.id.et_search).setVisibility(View.GONE);
            view.findViewById(R.id.btn_search).setVisibility(View.GONE);
        }
        if(!aiName.isEmpty()) {
            textViewTitle.setText(aiName);
        }

        if(mChatAiParam.showHistory) {
            List<ChatMessage> msgs = mChatDb.getChatMessageDetail(mChatAiParam.sessionId);
            if(msgs.size() > 2) {
                messageList.addAll(getChatDisplayList(msgs.subList(msgs.size() - 2, msgs.size()), true));
            } else if(msgs.size() > 1) {
                messageList.addAll(getChatDisplayList(msgs.subList(msgs.size() - 1, msgs.size()), true));
            }
            adapterAiChatMessageList.notifyDataSetChanged();
            recyclerView.scrollToPosition(messageList.size() - 1);
        }

        btnSend.setEnabled(mChatAiParam.initialSendEnable);

        // 监听 EditText 的焦点变化
        etMessage.setOnFocusChangeListener((v, hasFocus) -> {
            if (hasFocus) {
                // EditText 获取焦点时，可以执行布局调整或其他操作
                //showKeyboardAndAdjustLayout(etMessage);
            } else {
                // EditText 失去焦点时，可以恢复布局
                //hideKeyboardAndRestoreLayout(etMessage);
            }
        });

        textViewTitle.setOnClickListener(v -> {
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
            sendMessageDirectly(app.chatRequest);
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

        addView(view);
    }


    public void clearChatHistory() {
        messageList.clear();
        adapterAiChatMessageList.notifyDataSetChanged();
    }

    public void setAiName(String name) {
        aiName = name;
    }

    private List<ChatDisplayItem> getChatDisplayList(List<ChatMessage> msgs,  boolean isHistory) {
        List<ChatDisplayItem> items = new ArrayList<>();
        for (ChatMessage msg: msgs) {
            ChatDisplayItem item = new ChatDisplayItem(msg, isHistory);
            items.add(item);
        }

        return items;
    }

    private void pollChat() {
        String url = mChatAiParam.chatBotUrl;
        //优先使用Request里自带的url, 没有就用默认的
        if(aiChatMessageRequest.getDstUrl() != null && !aiChatMessageRequest.getDstUrl().isEmpty()) {
            url = aiChatMessageRequest.getDstUrl();
        }
        ApiGateWayService.sendChatMessage(aiChatMessageRequest, url, userInfoViewModel.token.getValue(), (success, response) -> {
            handler.post(() -> {
                if (success) {
                    if(!response.trim().isEmpty() && !response.equals("end")) {
                        adapterAiChatMessageList.updateLastMessage(response, mChatAiParam.streamDisplay);
                        Log.d("%%%%%%%%", response);
                    }
                    if(!response.equals("end")) {
                        aiChatMessageRequest.setReason("continue");
                        pollChat();
                    } else {
                        btnSend.setEnabled(true);
                        if(mChatAiParam.listener != null) {
                            mChatAiParam.listener.onAiChatResponced(true);
                        }
                        if(!messageList.isEmpty()) {
                            mChatDb.addChatMessageDetail(messageList.get(messageList.size() - 1).chatMessage);
                        }

                        ApplicationModelShared app = ApplicationModelShared.getInstance();
                        if(app.chatRequest != null) {
                            app.chatRequest = null;
                        }
                        aiChatMessageRequest.setDstUrl("");
                    }
                } else {
                    adapterAiChatMessageList.updateLastMessage("‼️消息接收失败", false);
                    btnSend.setEnabled(true);
                    if(mChatAiParam.listener != null) {
                        mChatAiParam.listener.onAiChatResponced(false);
                    }
                    if(!messageList.isEmpty()) {
                        mChatDb.addChatMessageDetail(messageList.get(messageList.size() - 1).chatMessage);
                    }

                    ApplicationModelShared app = ApplicationModelShared.getInstance();
                    if(app.chatRequest != null) {
                        app.chatRequest = null;
                    }
                    aiChatMessageRequest.setDstUrl("");
                }
            });
        });
    }

    private void sendMessage() {
        String messageText = etMessage.getText().toString().trim();
        if (!messageText.isEmpty()) {
            // Add message to the list and notify the adapter
            ChatMessage message = new ChatMessage(messageText,
                    true,
                    ChatMessage.TYPE_TEXT,
                    mChatAiParam.sessionId,
                    System.currentTimeMillis());
            messageList.add(new ChatDisplayItem(message, message.isSelf));

            etMessage.setText("");
            mChatDb.addChatMessageDetail(message);
            ChatMessage responseMessage = new ChatMessage("",
                    false,
                    ChatMessage.TYPE_TEXT,
                    mChatAiParam.sessionId,
                    System.currentTimeMillis());
            messageList.add(new ChatDisplayItem(responseMessage, responseMessage.isSelf));

            // 一次性通知 Adapter 插入两条消息
            adapterAiChatMessageList.notifyItemRangeInserted(messageList.size() - 2, 2);
            // 滚动到最新位置
            recyclerView.scrollToPosition(messageList.size() - 1);

            aiChatMessageRequest.setReason("start");
            aiChatMessageRequest.setCoversation(messageText);

            btnSend.setEnabled(false);
            pollChat();
        }
    }

    public void sendMessageDirectly(AiChatMessageRequest mo) {
        etMessage.postDelayed(new Runnable() {
            @Override
            public void run() {
                aiChatMessageRequest = mo;
                aiChatMessageRequest.setReason("start");
                ChatMessage message = new ChatMessage(aiChatMessageRequest.getCoversation(),
                        true,
                        ChatMessage.TYPE_TEXT,
                        mChatAiParam.sessionId,
                        System.currentTimeMillis());
                messageList.add(new ChatDisplayItem(message, !message.isSelf));
                adapterAiChatMessageList.notifyItemInserted(messageList.size() - 1);
                etMessage.setText("");

                mChatDb.addChatMessageDetail(message);
                ChatMessage responseMessage = new ChatMessage(
                        "",
                        false,
                        ChatMessage.TYPE_TEXT,
                        mChatAiParam.sessionId,
                        System.currentTimeMillis());
                messageList.add(new ChatDisplayItem(responseMessage, false));
                adapterAiChatMessageList.notifyItemInserted(messageList.size() - 1);

                recyclerView.scrollToPosition(messageList.size() - 1);

//        aiChatMessageRequest.setReason("start");
//        aiChatMessageRequest.setCoversation(messageText);

                btnSend.setEnabled(false);
                pollChat();
            }
        }, 1000);
    }

    private void loadMessages() {
        if(mInSearchMode) {
            return;
        }
        List<ChatMessage> allMessage =  mChatDb.getChatMessageDetail(mChatAiParam.sessionId);

        int curSize = messageList.size();
        int n = curSize + 2;
        if (allMessage.size() <= n) {
            messageList.clear();
            messageList.addAll(getChatDisplayList(allMessage, true));
        } else {
            messageList.clear();
            messageList.addAll(getChatDisplayList(allMessage.subList(allMessage.size() - n, allMessage.size()), true));
        }
        adapterAiChatMessageList.notifyDataSetChanged();
        recyclerView.scrollToPosition(0);
    }

    public void setChatEnable(boolean b) {
        btnSend.setEnabled(b);
        chkViewHistory.setEnabled(b);
        textViewTitle.setEnabled(b);
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
        refreshLayout.setVisibility(View.GONE);
    }
    //
//    // 失去焦点时，隐藏软键盘并恢复布局
    private void hideKeyboardAndRestoreLayout(View view) {
        InputMethodManager imm = (InputMethodManager) mContext.getSystemService(Context.INPUT_METHOD_SERVICE);
        imm.hideSoftInputFromWindow(view.getWindowToken(), 0);

        // 恢复布局，取消软键盘预留的空间
        //refreshLayout.setPadding(0, 0, 0, 0);
        refreshLayout.setVisibility(View.VISIBLE);
    }
}
