package com.cosinetech.imates;

import android.os.Bundle;

import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Toast;

import com.scwang.smart.refresh.layout.SmartRefreshLayout;

import java.util.ArrayList;
import java.util.List;

/**
 * A simple {@link Fragment} subclass.
 * Use the {@link FragmentChatAi#newInstance} factory method to
 * create an instance of this fragment.
 */
public class FragmentChatAi extends Fragment {

    // TODO: Rename parameter arguments, choose names that match
    // the fragment initialization parameters, e.g. ARG_ITEM_NUMBER
    private static final String ARG_PARAM1 = "param1";
    private static final String ARG_PARAM2 = "param2";

    private RecyclerView recyclerView;
    private SmartRefreshLayout refreshLayout;
    private EditText etMessage;
    private Button btnSend;
    private ChatAdapter chatAdapter;
    private List<ChatMessage> messageList = new ArrayList<>();
    private String mParam1;
    private String mParam2;

    public FragmentChatAi() {
        // Required empty public constructor
    }

    /**
     * Use this factory method to create a new instance of
     * this fragment using the provided parameters.
     *
     * @param param1 Parameter 1.
     * @param param2 Parameter 2.
     * @return A new instance of fragment FragmentChatAi.
     */
    // TODO: Rename and change types and number of parameters
    public static FragmentChatAi newInstance(String param1, String param2) {
        FragmentChatAi fragment = new FragmentChatAi();
        Bundle args = new Bundle();
        args.putString(ARG_PARAM1, param1);
        args.putString(ARG_PARAM2, param2);
        fragment.setArguments(args);
        return fragment;
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (getArguments() != null) {
            mParam1 = getArguments().getString(ARG_PARAM1);
            mParam2 = getArguments().getString(ARG_PARAM2);
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

        return view;
    }

    private void sendMessage() {
        String messageText = etMessage.getText().toString().trim();
        if (!messageText.isEmpty()) {
            // Add message to the list and notify the adapter
            ChatMessage message = new ChatMessage(messageText, true, 0, ChatMessage.TYPE_TEXT);
            messageList.add(message);
            chatAdapter.notifyItemInserted(messageList.size() - 1);
            etMessage.setText("");
            recyclerView.scrollToPosition(messageList.size() - 1);
        }
    }

    private void loadMessages() {
        // Example: Load previous messages from database or network
        // Simulate adding a message
        ChatMessage message = new ChatMessage("Hello, how are you?", false, 0, ChatMessage.TYPE_TEXT);
        messageList.add(0, message);
        chatAdapter.notifyItemInserted(0);
    }
}