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
import android.widget.Toast;

import com.cosinetech.imates.model.UserViewModel;
import com.scwang.smart.refresh.layout.SmartRefreshLayout;

import java.util.ArrayList;
import java.util.List;

/**
 * A simple {@link Fragment} subclass.
 * Use the {@link FragmentChatAi#newInstance} factory method to
 * create an instance of this fragment.
 */
public class FragmentChatAi extends Fragment {
    ChatMessage responseMessage;
    private UserViewModel userViewModel;
    private static final String CHATBOT_URL = "";

    private MessageVO messageVO = new MessageVO("", "", "", "", "", "", "start");
    private RecyclerView recyclerView;
    private SmartRefreshLayout refreshLayout;
    private EditText etMessage;
    private ChatAdapter chatAdapter;
    private List<ChatMessage> messageList = new ArrayList<>();
    private String chatBotUrl;

    private FragmentChatAi() {
    }

    public static FragmentChatAi newInstance(String chatBotUrl) {
        FragmentChatAi fragment = new FragmentChatAi();
        Bundle args = new Bundle();
        args.putString(CHATBOT_URL, chatBotUrl);
        fragment.setArguments(args);
        return fragment;
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (getArguments() != null) {
            chatBotUrl = getArguments().getString(CHATBOT_URL);
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
        Button btnSend = view.findViewById(R.id.btn_send);

        // Initialize RecyclerView
        recyclerView.setLayoutManager(new LinearLayoutManager(getContext()));
        chatAdapter = new ChatAdapter(messageList);
        recyclerView.setAdapter(chatAdapter);

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
        userViewModel = new ViewModelProvider(
                owner,
                new ViewModelProvider.AndroidViewModelFactory(requireActivity().getApplication())
        ).get(UserViewModel.class);

        return view;
    }

    private void pollChat() {
        MessagePoster.postMessage(messageVO, chatBotUrl, userViewModel.token.getValue(), (success, response) -> {
            requireActivity().runOnUiThread(() -> {
                if (success) {
                    if(!response.trim().isEmpty() && !response.equals("end")) {
                        chatAdapter.updateLastMessage(response);
                        Log.d("%%%%%%%%", response);
                    }
                    if(!response.equals("end")) {
                        messageVO.setReason("continue");
                        pollChat();
                    } else {
                    }
                } else {

                }
            });
        });
    }

    private void sendMessage() {
        String messageText = etMessage.getText().toString().trim();
        if (!messageText.isEmpty()) {
            // Add message to the list and notify the adapter
            ChatMessage message = new ChatMessage(messageText, true, 0, ChatMessage.TYPE_TEXT, false);
            messageList.add(message);
            chatAdapter.notifyItemInserted(messageList.size() - 1);
            etMessage.setText("");

            responseMessage = new ChatMessage("", false, 0, ChatMessage.TYPE_TEXT, false);
            messageList.add(responseMessage);
            chatAdapter.notifyItemInserted(messageList.size() - 1);

            recyclerView.scrollToPosition(messageList.size() - 1);

            messageVO.setReason("start");
            messageVO.setCoversation(messageText);
            pollChat();
        }
    }

    private void loadMessages() {
//        ChatMessage message = new ChatMessage("Hello, how are you?", false, 0, ChatMessage.TYPE_TEXT, false);
//        messageList.add(0, message);
//        chatAdapter.notifyItemInserted(0);
    }
}