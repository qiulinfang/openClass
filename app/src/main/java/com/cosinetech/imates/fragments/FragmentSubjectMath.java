package com.cosinetech.imates.fragments;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.cardview.widget.CardView;
import androidx.fragment.app.Fragment;
import androidx.fragment.app.FragmentManager;

import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.PopupWindow;
import android.widget.Toast;

import com.cosinetech.imates.R;
import com.cosinetech.imates.activities.FindExerciseActivity;
import com.cosinetech.imates.activities.MyFavorCenterActivity;
import com.cosinetech.imates.activities.MyHistoryActivity;
import com.cosinetech.imates.activities.PhotoQuestionLookupActivity;
import com.cosinetech.imates.activities.QuestionSolveActivity;
import com.cosinetech.imates.models.Subject;
import com.cosinetech.imates.models.Chapter;
import com.cosinetech.imates.webservice.ApiUrl;
import com.google.gson.Gson;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;

/**
 * A simple {@link Fragment} subclass.
 * Use the {@link FragmentSubjectMath#newInstance} factory method to
 * create an instance of this fragment.
 */
public class FragmentSubjectMath extends Fragment {
    private static final String ARG_PARAM1 = "param1";
    private static final String ARG_PARAM2 = "param2";
    private int previousBackStackCount = 0;

    // TODO: Rename and change types of parameters
    private String mParam1;
    private String mParam2;

    public FragmentSubjectMath() {
        // Required empty public constructor
    }

    /**
     * Use this factory method to create a new instance of
     * this fragment using the provided parameters.
     *
     * @param param1 Parameter 1.
     * @param param2 Parameter 2.
     * @return A new instance of fragment FragmentSubjectMath.
     */
    // TODO: Rename and change types and number of parameters
    public static FragmentSubjectMath newInstance(String param1, String param2) {
        FragmentSubjectMath fragment = new FragmentSubjectMath();
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
        return inflater.inflate(R.layout.fragment_subject_math, container, false);
    }

    @SuppressLint("ClickableViewAccessibility")
    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        initPopStackListner(view);
        CardView button = view.findViewById(R.id.photo_to_solve);
        button.setOnClickListener(v -> startPhotoQuestionLookupActivity());

        CardView btnExercise = view.findViewById(R.id.exercise);
        btnExercise.setOnClickListener(v-> startQuestionSolveActivity());

        CardView btnHistory = view.findViewById(R.id.history);
        btnHistory.setOnClickListener(v -> {
            Intent intent = new Intent(getActivity(), MyHistoryActivity.class);
            intent.putExtra(MyHistoryActivity.KEY_SUBJECT_NAME, Subject.SUBJECT_MATH.name());
            startActivity(intent);
        });

        CardView btnMyFavor = view.findViewById(R.id.card_my_favor);
        btnMyFavor.setOnClickListener( v-> {
            Intent intent = new Intent(getActivity(), MyFavorCenterActivity.class);
            intent.putExtra(MyFavorCenterActivity.KEY_SUBJECT_NAME, Subject.SUBJECT_MATH.name());
            startActivity(intent);
        });

        WebView webView = view.findViewById(R.id.knowledge_view);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true); // 启用 DOM storage
        webView.getSettings().setSupportZoom(true);
        webView.getSettings().setBuiltInZoomControls(true);
        webView.getSettings().setDisplayZoomControls(false);
        // 设置WebViewClient以防止外部浏览器打开链接
        webView.setWebViewClient(new WebViewClient());
        // Add JavaScript interface
        webView.addJavascriptInterface(new FragmentSubjectMath.WebAppInterface(getContext()), "Android");
        // Load the local HTML file
        webView.loadUrl("file:///android_asset/knowledge_graph_math.html");
        webView.setOnTouchListener((v, event) -> {
            // 禁止ViewPager2拦截触摸事件
            if (event.getAction() == MotionEvent.ACTION_DOWN || event.getAction() == MotionEvent.ACTION_MOVE) {
                v.getParent().requestDisallowInterceptTouchEvent(true);
            } else if (event.getAction() == MotionEvent.ACTION_UP || event.getAction() == MotionEvent.ACTION_CANCEL) {
                v.getParent().requestDisallowInterceptTouchEvent(false);
            }
            return false; // 返回false，让HScrollView继续处理触摸事件
        });
    }

    public class WebAppInterface {
        private Context context;

        WebAppInterface(Context context) {
            this.context = context;
        }

        @JavascriptInterface
        public void onPrepareLesson(String nodeId, String nodeName) {
            loadPrepareLessonFragment(nodeId, nodeName);
        }

        public Chapter.Section getSection(String sectionId) {
            StringBuilder newstringBuilder = new StringBuilder();
            InputStream inputStream;
            try {
                inputStream = getResources().getAssets().open("math_learn_schema.json");
                InputStreamReader isr = new InputStreamReader(inputStream);
                BufferedReader reader = new BufferedReader(isr);
                String jsonLine;
                while ((jsonLine = reader.readLine()) != null) {
                    newstringBuilder.append(jsonLine);
                }
                reader.close();
                isr.close();
                inputStream.close();
            } catch (IOException e) {
                e.printStackTrace();
            }

            Gson gson = new Gson();
            Chapter chapter = gson.fromJson(newstringBuilder.toString(), Chapter.class);
            for (Chapter.Section s: chapter.getSections()) {
                if(s.getSection().equals(sectionId)) {
                    return s;
                }
            }
            return null;
        }

        @JavascriptInterface
        public void onReviewLesson(String nodeId, String nodeName) {
            Chapter.Section s = getSection(nodeId);
            if(s == null) {
                Toast.makeText(getContext(), "未查询到相关的练习资料", Toast.LENGTH_SHORT).show();
                return;
            }
            // 在 UI 线程上执行的代码
            new Handler(Looper.getMainLooper()).post(() -> startFindExerciseActivity(s.getKnowledgeNo()));
        }
    }

    public void startPhotoQuestionLookupActivity() {
        Intent intent = new Intent(requireActivity(), PhotoQuestionLookupActivity.class);
        intent.putExtra(PhotoQuestionLookupActivity.KEY_PARAM_SUBJECT, Subject.SUBJECT_MATH.name());
        startActivity(intent);
    }

    public void startFindExerciseActivity(String knowledgeList) {
        Intent intent = new Intent(requireActivity(), FindExerciseActivity.class);
        intent.putExtra(FindExerciseActivity.KEY_CHATBOT_URL, ApiUrl.URL_CHAT_MATH);
        intent.putExtra(FindExerciseActivity.KEY_PARAM_SUBJECT, Subject.SUBJECT_MATH.name());
        intent.putExtra(FindExerciseActivity.KEY_KNOWLEDGE_LIST, knowledgeList);
        startActivity(intent);
    }

    public void startQuestionSolveActivity() {
        Intent intent = new Intent(requireActivity(), QuestionSolveActivity.class);
        intent.putExtra(QuestionSolveActivity.KEY_CHATBOT_URL, ApiUrl.URL_CHAT_MATH);
        intent.putExtra(QuestionSolveActivity.KEY_SUBJECT, Subject.SUBJECT_MATH.name());
        startActivity(intent);
    }

    public void loadPrepareLessonFragment(String sectionId, String sectionName) {
        Toast.makeText(this.getContext(), "暂无相关课程", Toast.LENGTH_SHORT).show();
    }

    private void initPopStackListner(View view) {
        // 添加 OnBackStackChangedListener
        getChildFragmentManager().addOnBackStackChangedListener(new FragmentManager.OnBackStackChangedListener() {
            @Override
            public void onBackStackChanged() {
                // 获取当前 BackStack 中的数量
                int currentBackStackCount = getChildFragmentManager().getBackStackEntryCount();

                // 如果 BackStack 数量减少，说明有 Fragment 被 pop
                if (currentBackStackCount < previousBackStackCount) {
                    onChildFragmentPopped();
                }

                // 更新记录的 BackStack 数量
                previousBackStackCount = currentBackStackCount;
                if(currentBackStackCount > 0) {
                    view.findViewById(R.id.container).setClickable(true);
                    view.findViewById(R.id.container).setFocusable(true);
                } else {
                    view.findViewById(R.id.container).setClickable(false);
                    view.findViewById(R.id.container).setFocusable(false);
                }
            }
        });

        // 初始化记录的 BackStack 数量
        previousBackStackCount = getChildFragmentManager().getBackStackEntryCount();
    }
    private void onChildFragmentPopped() {
    }
}