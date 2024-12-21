package com.cosinetech.imates.fragments;

import android.content.Context;
import android.os.Bundle;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.fragment.app.FragmentManager;
import androidx.lifecycle.ViewModelProvider;
import androidx.lifecycle.ViewModelStoreOwner;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.InputMethodManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import com.cosinetech.imates.ApplicationModelShared;
import com.cosinetech.imates.adapters.AdapterAiChatMessageList;
import com.cosinetech.imates.models.ChatMessage;
import com.cosinetech.imates.R;
import com.cosinetech.imates.models.UserInfoViewModel;
import com.cosinetech.imates.webservice.AiChatMessageRequest;
import com.cosinetech.imates.webservice.ApiGateWayService;
import com.scwang.smart.refresh.layout.SmartRefreshLayout;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * A simple {@link Fragment} subclass.
 * Use the {@link FragmentChatAi#newInstance} factory method to
 * create an instance of this fragment.
 */
public class FragmentChatAi extends Fragment {
    public interface AiChatResponseListener {
        void onAiChatResponced(boolean success);
    }

    private UserInfoViewModel userInfoViewModel;
    private static final String KEY_PARAM_CHATBOT_URL = "CHAT_URL";

    private static final String KEY_PARAM_CHATBOT_TAG = "CHAT_TAG";
    private static final String KEY_PARAM_SHOW_HEADER = "SHOW_HEADER";

    private AiChatMessageRequest aiChatMessageRequest = new AiChatMessageRequest("", "", "", "", "", "", "start", "");
    private RecyclerView recyclerView;
    private SmartRefreshLayout refreshLayout;
    private EditText etMessage;
    private AdapterAiChatMessageList adapterAiChatMesssageList;
    private List<ChatMessage> messageList = new ArrayList<>();
    private String chatBotUrl;
    private Button btnSend;

    private String aiName = "";
    private String tag = "";

    private boolean showHeader;

    private AiChatResponseListener mListener;

    public FragmentChatAi() {
    }

    public static FragmentChatAi newInstance(String chatBotUrl, String tag, boolean showHeader, AiChatResponseListener l) {
        FragmentChatAi fragment = new FragmentChatAi();
        Bundle args = new Bundle();
        args.putString(KEY_PARAM_CHATBOT_URL, chatBotUrl);
        args.putBoolean(KEY_PARAM_SHOW_HEADER, showHeader);
        args.putString(KEY_PARAM_CHATBOT_TAG, tag);
        fragment.setArguments(args);
        fragment.setAiChatListener(l);
        return fragment;
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (getArguments() != null) {
            chatBotUrl = getArguments().getString(KEY_PARAM_CHATBOT_URL);
            tag = getArguments().getString(KEY_PARAM_CHATBOT_TAG);
            showHeader = getArguments().getBoolean(KEY_PARAM_SHOW_HEADER);
        }
        setRetainInstance(true);
    }

    @Override
    public void onSaveInstanceState(Bundle outState) {
        //super.onSaveInstanceState(outState);
        // 在此处保存需要的状态数据到outState中
        outState.putString(KEY_PARAM_CHATBOT_URL, chatBotUrl);
        outState.putBoolean(KEY_PARAM_SHOW_HEADER, showHeader);
    }

    private void setAiChatListener(AiChatResponseListener l) {
        this.mListener = l;
    }

    private void fixBug(FragmentManager fragmentManager) {
        try {
            Class<? extends FragmentManager> aClass = fragmentManager.getClass();
            Method method = aClass.getMethod("noteStateNotSaved");
            method.setAccessible(true);
            method.invoke(fragmentManager);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container,
                             Bundle savedInstanceState) {
        // Inflate the layout for this fragment
        View view = inflater.inflate(R.layout.fragment_chat_ai, container, false);
        recyclerView = view.findViewById(R.id.chat_msg_view);
        refreshLayout = view.findViewById(R.id.chat_message_session);
        etMessage = view.findViewById(R.id.et_message);
        btnSend = view.findViewById(R.id.btn_send);

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
        adapterAiChatMesssageList = new AdapterAiChatMessageList(messageList);
        recyclerView.setAdapter(adapterAiChatMesssageList);

        // Set up SmartRefreshLayout for pull-to-refresh
        refreshLayout.setOnRefreshListener(refreshLayout -> {
            // Handle refresh
            loadMessages();
            refreshLayout.finishRefresh();
            Toast.makeText(getContext(),"refreshing", Toast.LENGTH_SHORT).show();
        });

        // Send button click
        btnSend.setOnClickListener(v -> sendMessage());

        Button btnExit = view.findViewById(R.id.back_exit);

        btnExit.setOnClickListener(v -> {
            FragmentManager fragmentManager = getParentFragmentManager();
            fixBug(fragmentManager);
            fragmentManager.popBackStackImmediate();
        });

        // Required empty public constructor
        ViewModelStoreOwner owner = (ViewModelStoreOwner) requireActivity().getApplication();
        userInfoViewModel = new ViewModelProvider(
                owner,
                new ViewModelProvider.AndroidViewModelFactory(requireActivity().getApplication())
        ).get(UserInfoViewModel.class);

        if(!showHeader) {
            btnExit.setVisibility(View.INVISIBLE);
        }
        if(!aiName.isEmpty()) {
            ((TextView)view.findViewById(R.id.ai_name)).setText(aiName);
        }

        aiChatMessageRequest.setName(Objects.requireNonNull(userInfoViewModel.userInfo.getValue()).getName());

        return view;
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        ApplicationModelShared app = (ApplicationModelShared) requireActivity().getApplication();
        if(app.chatRequest != null) {
            sendMessageDirectly(app.chatRequest);
            app.chatRequest = null;
        }
    }

    public void clearChatHistory() {
        messageList.clear();
        adapterAiChatMesssageList.notifyDataSetChanged();
    }

    public void setAiName(String name) {
        aiName = name;
    }

    private void pollChat() {
        ApiGateWayService.sendChatMessage(aiChatMessageRequest, chatBotUrl, userInfoViewModel.token.getValue(), (success, response) -> {
            requireActivity().runOnUiThread(() -> {
                if (success) {
                    if(!response.trim().isEmpty() && !response.equals("end")) {
                        adapterAiChatMesssageList.updateLastMessage(response);
                        Log.d("%%%%%%%%", response);
                    }
                    if(!response.equals("end")) {
                        aiChatMessageRequest.setReason("continue");
                        pollChat();
                    } else {
                        btnSend.setEnabled(true);
                        if(mListener != null) {
                            mListener.onAiChatResponced(true);
                        }
                    }
                } else {
                    btnSend.setEnabled(true);
                    if(mListener != null) {
                        mListener.onAiChatResponced(false);
                    }
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
                    false,
                    "",
                    tag,
                    System.currentTimeMillis());
            messageList.add(message);

            etMessage.setText("");

            ChatMessage responseMessage = new ChatMessage("",
                    false,
                    ChatMessage.TYPE_TEXT,
                    false,
                    "",
                    tag,
                    System.currentTimeMillis());
            messageList.add(responseMessage);

            // 一次性通知 Adapter 插入两条消息
            adapterAiChatMesssageList.notifyItemRangeInserted(messageList.size() - 2, 2);
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
                        false,
                        "",
                        tag,
                        System.currentTimeMillis());
                messageList.add(message);
                adapterAiChatMesssageList.notifyItemInserted(messageList.size() - 1);
                etMessage.setText("");

                ChatMessage responseMessage = new ChatMessage(
                        "",
                        false,
                        ChatMessage.TYPE_TEXT,
                        false,
                        "",
                        tag,
                        System.currentTimeMillis());
                messageList.add(responseMessage);
                adapterAiChatMesssageList.notifyItemInserted(messageList.size() - 1);

                recyclerView.scrollToPosition(messageList.size() - 1);

//        aiChatMessageRequest.setReason("start");
//        aiChatMessageRequest.setCoversation(messageText);

                btnSend.setEnabled(false);
                pollChat();
            }
        }, 3000);
    }

    private void loadMessages() {
//        ChatMessage message = new ChatMessage("Hello, how are you?", false, 0, ChatMessage.TYPE_TEXT, false);
//        messageList.add(0, message);
//        adapterChatAi.notifyItemInserted(0);
    }

    public void setChatEnable(boolean b) {
        //btnSend.setVisibility(b ? View.VISIBLE : View.INVISIBLE);
        btnSend.setEnabled(b);
    }
}