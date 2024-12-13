package com.cosinetech.imates;

import android.os.Bundle;

import androidx.fragment.app.Fragment;
import androidx.lifecycle.ViewModelProvider;
import androidx.lifecycle.ViewModelStoreOwner;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import android.util.Log;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import com.cosinetech.imates.model.UserInfoViewModel;
import com.scwang.smart.refresh.layout.SmartRefreshLayout;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * A simple {@link Fragment} subclass.
 * Use the {@link FragmentChatAi#newInstance} factory method to
 * create an instance of this fragment.
 */
public class FragmentChatAi extends Fragment {
    ChatMessage responseMessage;
    private UserInfoViewModel userInfoViewModel;
    private static final String PARAM_CHATBOT_URL = "CHAT_URL";
    private static final String PARAM_SHOW_HEADER = "SHOW_HEADER";

    private MessageVO messageVO = new MessageVO("", "", "", "", "", "", "start");
    private RecyclerView recyclerView;
    private SmartRefreshLayout refreshLayout;
    private EditText etMessage;
    private AdapterChatAi adapterChatAi;
    private List<ChatMessage> messageList = new ArrayList<>();
    private String chatBotUrl;
    private Button btnSend;

    private String aiName = "";

    private boolean showHeader;

    private FragmentChatAi() {
    }

    public static FragmentChatAi newInstance(String chatBotUrl, boolean showHeader) {
        FragmentChatAi fragment = new FragmentChatAi();
        Bundle args = new Bundle();
        args.putString(PARAM_CHATBOT_URL, chatBotUrl);
        args.putBoolean(PARAM_SHOW_HEADER, showHeader);
        fragment.setArguments(args);
        return fragment;
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (getArguments() != null) {
            chatBotUrl = getArguments().getString(PARAM_CHATBOT_URL);
            showHeader = getArguments().getBoolean(PARAM_SHOW_HEADER);
        }
    }

    @Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container,
                             Bundle savedInstanceState) {
        // Inflate the layout for this fragment
        View view = inflater.inflate(R.layout.fragment_chat_ai, container, false);
        recyclerView = view.findViewById(R.id.recyclerView);
        refreshLayout = view.findViewById(R.id.chat_message_session);
        etMessage = view.findViewById(R.id.et_message);
        btnSend = view.findViewById(R.id.btn_send);

        // Initialize RecyclerView
        recyclerView.setLayoutManager(new LinearLayoutManager(getContext()));
        adapterChatAi = new AdapterChatAi(messageList);
        recyclerView.setAdapter(adapterChatAi);

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
            getParentFragmentManager().popBackStack();
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

        messageVO.setName(Objects.requireNonNull(userInfoViewModel.userInfo.getValue()).getName());

        return view;
    }

    public void setAiName(String name) {
        aiName = name;
    }

    private void pollChat() {
        MessagePoster.postMessage(messageVO, chatBotUrl, userInfoViewModel.token.getValue(), (success, response) -> {
            requireActivity().runOnUiThread(() -> {
                if (success) {
                    if(!response.trim().isEmpty() && !response.equals("end")) {
                        adapterChatAi.updateLastMessage(response);
                        Log.d("%%%%%%%%", response);
                    }
                    if(!response.equals("end")) {
                        messageVO.setReason("continue");
                        pollChat();
                    } else {
                        btnSend.setEnabled(true);
                    }
                } else {
                    btnSend.setEnabled(true);
                }
            });
        });
    }

    private void sendMessage() {
        String messageText = etMessage.getText().toString().trim();
        if (!messageText.isEmpty()) {
            // Add message to the list and notify the adapter
            ChatMessage message = new ChatMessage(messageText, true, System.currentTimeMillis(), ChatMessage.TYPE_TEXT, false);
            messageList.add(message);
            adapterChatAi.notifyItemInserted(messageList.size() - 1);
            etMessage.setText("");

            responseMessage = new ChatMessage("", false, System.currentTimeMillis(), ChatMessage.TYPE_TEXT, false);
            messageList.add(responseMessage);
            adapterChatAi.notifyItemInserted(messageList.size() - 1);

            recyclerView.scrollToPosition(messageList.size() - 1);

            messageVO.setReason("start");
            messageVO.setCoversation(messageText);

            btnSend.setEnabled(false);
            pollChat();
        }
    }

    private void loadMessages() {
//        ChatMessage message = new ChatMessage("Hello, how are you?", false, 0, ChatMessage.TYPE_TEXT, false);
//        messageList.add(0, message);
//        adapterChatAi.notifyItemInserted(0);
    }
}