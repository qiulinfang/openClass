package com.cosinetech.imates.fragments;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.cardview.widget.CardView;
import androidx.fragment.app.Fragment;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ArrayAdapter;
import android.widget.Spinner;
import android.widget.Toast;

import com.cosinetech.imates.R;
import com.cosinetech.imates.ui.activities.FindExerciseActivity;
import com.cosinetech.imates.ui.activities.LessonPreviewActivity;
import com.cosinetech.imates.ui.activities.MyFavorCenterActivity;
import com.cosinetech.imates.ui.activities.MyHistoryActivity;
import com.cosinetech.imates.ui.activities.PhotoSearchActivity;
import com.cosinetech.imates.ui.activities.ExerciseSolveActivity;
import com.cosinetech.imates.data.models.Subject;
import com.cosinetech.imates.data.models.Chapter;
import com.cosinetech.imates.coreapiservice.ApiUrl;
import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.lang.reflect.Type;
import java.util.ArrayList;
import java.util.List;

/**
 * A simple {@link Fragment} subclass.
 * Use the {@link FragmentSubjectBiology#newInstance} factory method to
 * create an instance of this fragment.
 */
public class FragmentSubjectBiology extends Fragment {
    private static final String ARG_PARAM1 = "param1";
    private static final String ARG_PARAM2 = "param2";
    private int previousBackStackCount = 0;
    private Spinner mTextbookVersionSpinner;
    private WebAppInterface mWebViewInterface;
    private String mCurrentSchema;

    // TODO: Rename and change types of parameters
    private String mParam1;
    private String mParam2;

    public FragmentSubjectBiology() {
        // Required empty public constructor
    }

    public static FragmentSubjectBiology newInstance(String param1, String param2) {
        FragmentSubjectBiology fragment = new FragmentSubjectBiology();
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
        return inflater.inflate(R.layout.fragment_subject_biology, container, false);
    }

    @SuppressLint("ClickableViewAccessibility")
    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        initPopStackListner(view);
        mWebViewInterface = new WebAppInterface(getContext());
        CardView button = view.findViewById(R.id.photo_to_solve);
        button.setOnClickListener(v -> startPhotoQuestionLookupActivity());

        CardView btnExercise = view.findViewById(R.id.exercise);
        btnExercise.setOnClickListener(v-> startQuestionSolveActivity());

        CardView btnHistory = view.findViewById(R.id.history);
        btnHistory.setOnClickListener(v -> {
            Intent intent = new Intent(getActivity(), MyHistoryActivity.class);
            intent.putExtra(MyHistoryActivity.KEY_SUBJECT_NAME, Subject.SUBJECT_BIOLOGY.name());
            startActivity(intent);
        });

        CardView btnMyFavor = view.findViewById(R.id.card_my_favor);
        btnMyFavor.setOnClickListener( v-> {
            Intent intent = new Intent(getActivity(), MyFavorCenterActivity.class);
            intent.putExtra(MyFavorCenterActivity.KEY_SUBJECT_NAME, Subject.SUBJECT_BIOLOGY.name());
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
        webView.addJavascriptInterface(mWebViewInterface, "Android");
        // Load the local HTML file
        //webView.loadUrl("file:///android_asset/knowledge_graph_biology.html");
        webView.setOnTouchListener((v, event) -> {
            // 禁止ViewPager2拦截触摸事件
            if (event.getAction() == MotionEvent.ACTION_DOWN || event.getAction() == MotionEvent.ACTION_MOVE) {
                v.getParent().requestDisallowInterceptTouchEvent(true);
            } else if (event.getAction() == MotionEvent.ACTION_UP || event.getAction() == MotionEvent.ACTION_CANCEL) {
                v.getParent().requestDisallowInterceptTouchEvent(false);
            }
            return false; // 返回false，让HScrollView继续处理触摸事件
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                Log.e("WebViewJS", consoleMessage.message()
                        + " -- From line "
                        + consoleMessage.lineNumber()
                        + " of "
                        + consoleMessage.sourceId());
                return true;
            }
        });


        mTextbookVersionSpinner = view.findViewById(R.id.textbook_version_spinner);
        // 数据源（字符串数组）
        String[] items = {"人教版生物 必修一",
                        "人教版生物 必修二",
                        "人教版生物 选择性必修一"};
        String[] urls = {"file:///android_asset/knowledge_graph_biology_0.html",
                        "file:///android_asset/knowledge_graph_biology.html",
                        "file:///android_asset/knowledge_graph_biology_1.html"};
        String[] schemas = {"biology_learn_schema_0.json",
                        "biology_learn_schema.json",
                        "biology_learn_schema_1.json"};

        // 创建 ArrayAdapter
        ArrayAdapter<String> adapter = new ArrayAdapter<>(
                getContext(),
                android.R.layout.simple_spinner_item,  // 系统自带的布局
                items
        );
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);

        // 设置适配器
        mTextbookVersionSpinner.setAdapter(adapter);

        // 监听选择事件（可选）
        mTextbookVersionSpinner.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(android.widget.AdapterView<?> parent, android.view.View view, int position, long id) {
                if(position >= 0 && position < items.length) {
                    webView.clearCache(true);
                    webView.loadUrl(urls[position]);
                    mCurrentSchema = schemas[position];
                }
            }

            @Override
            public void onNothingSelected(android.widget.AdapterView<?> parent) {}
        });
        mTextbookVersionSpinner.setSelection(0);
    }

    public class WebAppInterface {
        private Context context;
        private String mMindData = "";

        WebAppInterface(Context context) {
            this.context = context;
        }

        public void updateMindData(String mindData) {
            mMindData = mindData;
        }

        @JavascriptInterface
        public String getMindData() {
            return mMindData;
        }

        @JavascriptInterface
        public void onPrepareLesson(String nodeId, String nodeName) {
            new Handler(Looper.getMainLooper()).post(()->startPreviewLessonActivity(mCurrentSchema, nodeId, nodeName));
        }

        @JavascriptInterface
        public void onReviewLesson(String nodeId, String nodeName) {
            Chapter.Section s = getSection(mCurrentSchema, nodeId);
            if(s == null) {
                Toast.makeText(context, "选择小节去练习", Toast.LENGTH_SHORT).show();
                return;
            }

            if(s.getKnowledgeNo().trim().isEmpty()) {
                Toast.makeText(context, "没有相关的习题", Toast.LENGTH_SHORT).show();
            } else {
                // 在 UI 线程上执行的代码
                new Handler(Looper.getMainLooper()).post(() -> startFindExerciseActivity(s.getKnowledgeNo()));
            }
        }
    }

    public void startPhotoQuestionLookupActivity() {
        Intent intent = new Intent(getActivity(), PhotoSearchActivity.class);
        intent.putExtra(PhotoSearchActivity.KEY_PARAM_SUBJECT, Subject.SUBJECT_BIOLOGY.name());
        startActivity(intent);
    }

    public void startQuestionSolveActivity() {
        Intent intent = new Intent(getActivity(), ExerciseSolveActivity.class);
        intent.putExtra(ExerciseSolveActivity.KEY_CHATBOT_URL, ApiUrl.URL_CHAT_BIOLOGY);
        intent.putExtra(ExerciseSolveActivity.KEY_SUBJECT, Subject.SUBJECT_BIOLOGY.name());
        startActivity(intent);
    }

    public void startFindExerciseActivity(String knowledgeList) {
        Intent intent = new Intent(getActivity(), FindExerciseActivity.class);
        intent.putExtra(FindExerciseActivity.KEY_CHATBOT_URL, ApiUrl.URL_CHAT_BIOLOGY);
        intent.putExtra(FindExerciseActivity.KEY_PARAM_SUBJECT, Subject.SUBJECT_BIOLOGY.name());
        intent.putExtra(FindExerciseActivity.KEY_KNOWLEDGE_LIST, knowledgeList);
        startActivity(intent);
    }

    public Chapter.Section getSection(String fileName, String sectionId) {
        StringBuilder newstringBuilder = new StringBuilder();
        InputStream inputStream;
        try {
            inputStream = getContext().getResources().getAssets().open(fileName);
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
        // 使用 TypeToken 反序列化
        Type listType = new TypeToken<List<Chapter>>() {}.getType();
        List<Chapter> chapters = gson.fromJson(newstringBuilder.toString(), listType);

        for(Chapter c : chapters) {
            for (Chapter.Section s : c.getSections()) {
                if (s.getSection().equals(sectionId)) {
                    return s;
                }
            }
        }
        return null;
    }

    public void startPreviewLessonActivity(String schemaFile, String sectionId, String sectionName) {
        Chapter.Section s = getSection(schemaFile, sectionId);
        if(s != null) {
            List<Chapter.Schema> validSchemas = new ArrayList<>();
            for (Chapter.Schema schema : s.getSchemas()) {
                if(!schema.getTextBook().trim().isEmpty()) {
                    validSchemas.add(schema);
                }
            }
            if(validSchemas.isEmpty()) {
                Toast.makeText(getContext(), "选择小节去学习", Toast.LENGTH_SHORT).show();
                return;
            }
            s.setSchemas(validSchemas);
            Intent previewLessonActivity = new Intent(getActivity(), LessonPreviewActivity.class);
            previewLessonActivity.putExtra(LessonPreviewActivity.KEY_PREVIEW_SECTION_NAME, sectionName);
            previewLessonActivity.putExtra(LessonPreviewActivity.KEY_SECTION_SCHEMA, s);

            startActivity(previewLessonActivity);
        } else {
            Toast.makeText(this.getContext(), "请选择小节去学习", Toast.LENGTH_SHORT).show();
        }
    }

    private void initPopStackListner(View view) {
        // 添加 OnBackStackChangedListener
        getChildFragmentManager().addOnBackStackChangedListener(() -> {
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
        });

        // 初始化记录的 BackStack 数量
        previousBackStackCount = getChildFragmentManager().getBackStackEntryCount();
    }
    private void onChildFragmentPopped() {
    }
}

