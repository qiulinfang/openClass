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
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Spinner;
import android.widget.Toast;

import com.cosinetech.imates.activities.FindExerciseActivity;
import com.cosinetech.imates.activities.LessonPreviewActivity;
import com.cosinetech.imates.activities.MyFavorCenterActivity;
import com.cosinetech.imates.activities.MyHistoryActivity;
import com.cosinetech.imates.activities.PhotoSearchActivity;
import com.cosinetech.imates.activities.ExerciseSolveActivity;
import com.cosinetech.imates.models.Subject;
import com.cosinetech.imates.R;
import com.cosinetech.imates.models.Chapter;
import com.cosinetech.imates.webservice.ApiUrl;
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
    private String mParam1;
    private String mParam2;

    private Spinner mSpinTextbookVersion;
    private Spinner mSpinTextbookVolumes;
    private ArrayAdapter mTextbookVersionAdapter;
    private ArrayAdapter mTextbookVolumeAdapter;
    //定义字符串数组,指定数组的元素
    private final String[] textbookVersion = new String[]{"人教版","北师大版"};
    private final String[] volumesRenJiao = new String[]{
            "必修1 分子与细胞",
            "必修2 遗传与进化",
            "选择性必修1 稳态与调节",
            "选择性必修2 生物与环境",
            "选择性必修3 生物技术与工程"
    };
    private final String[] volumesBeiShiDa = new String[]{
            "北师大必修1 分子与细胞",
            "必修2 遗传与进化",
            "选择性必修1 稳态与调节",
            "选择性必修2 生物与环境",
            "北师大选择性必修3 生物技术与工程"
    };

    private List<String[]> mTextbookVolumes = new ArrayList<>();

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
        mTextbookVolumes.add(volumesRenJiao);
        mTextbookVolumes.add(volumesBeiShiDa);
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
        // 设置WebViewClient以防止外部浏览器打开链接
        webView.setWebViewClient(new WebViewClient());
        // Add JavaScript interface
        webView.addJavascriptInterface(new WebAppInterface(getContext()), "Android");
        // Load the local HTML file
        webView.loadUrl("file:///android_asset/knowledge_graph_biology.html");
        webView.setOnTouchListener((v, event) -> {
            // 禁止ViewPager2拦截触摸事件
            if (event.getAction() == MotionEvent.ACTION_DOWN || event.getAction() == MotionEvent.ACTION_MOVE) {
                v.getParent().requestDisallowInterceptTouchEvent(true);
            } else if (event.getAction() == MotionEvent.ACTION_UP || event.getAction() == MotionEvent.ACTION_CANCEL) {
                v.getParent().requestDisallowInterceptTouchEvent(false);
            }
            return false; // 返回false，让HScrollView继续处理触摸事件
        });

        mSpinTextbookVersion = view.findViewById(R.id.spinner_textbook_versions);
        mSpinTextbookVolumes = view.findViewById(R.id.spinner_textbook_volumes);
        mTextbookVersionAdapter = new ArrayAdapter(getContext(), android.R.layout.simple_spinner_item, textbookVersion);
        //设置适配器列表框下拉时的列表样式
        mTextbookVersionAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        //将适配器与下拉列表框关联起来
        mSpinTextbookVersion.setAdapter(mTextbookVersionAdapter);
        mSpinTextbookVersion.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                setSelectedTextbookVolume(position);
            }

            @Override
            public void onNothingSelected(AdapterView<?> parent) {

            }
        });

        setSelectedTextbookVolume(0);
    }

    private void setSelectedTextbookVolume(int position) {
        if(position >= mTextbookVolumes.size()) {
            return;
        }
        mTextbookVolumeAdapter = new ArrayAdapter(getContext(), android.R.layout.simple_spinner_item, mTextbookVolumes.get(position));
        mTextbookVolumeAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        mSpinTextbookVolumes.setAdapter(mTextbookVolumeAdapter);
        mSpinTextbookVolumes.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {

            }

            @Override
            public void onNothingSelected(AdapterView<?> parent) {

            }
        });

    }

    public class WebAppInterface {
        private Context context;

        WebAppInterface(Context context) {
            this.context = context;
        }

        @JavascriptInterface
        public void onPrepareLesson(String nodeId, String nodeName) {
            startPreviewLessonActivity(nodeId, nodeName);
        }

        @JavascriptInterface
        public void onReviewLesson(String nodeId, String nodeName) {
            Chapter.Section s = getSection(nodeId);
            if(s == null) {
                Toast.makeText(getContext(), "未查询到相关的练习资料", Toast.LENGTH_SHORT).show();
                return;
            }
            new Handler(Looper.getMainLooper()).post(() -> startFindExerciseActivity(s.getKnowledgeNo()));
        }
    }
    public void startPhotoQuestionLookupActivity() {
        Intent intent = new Intent(requireActivity(), PhotoSearchActivity.class);
        intent.putExtra(PhotoSearchActivity.KEY_PARAM_SUBJECT, Subject.SUBJECT_BIOLOGY.name());
        startActivity(intent);
    }

    public void startQuestionSolveActivity() {
        Intent intent = new Intent(requireActivity(), ExerciseSolveActivity.class);
        intent.putExtra(ExerciseSolveActivity.KEY_CHATBOT_URL, ApiUrl.URL_CHAT_BIOLOGY);
        intent.putExtra(ExerciseSolveActivity.KEY_SUBJECT, Subject.SUBJECT_BIOLOGY.name());
        startActivity(intent);
    }

    public void startFindExerciseActivity(String knowledgeList) {
        Intent intent = new Intent(requireActivity(), FindExerciseActivity.class);
        intent.putExtra(FindExerciseActivity.KEY_CHATBOT_URL, ApiUrl.URL_CHAT_BIOLOGY);
        intent.putExtra(FindExerciseActivity.KEY_PARAM_SUBJECT, Subject.SUBJECT_BIOLOGY.name());
        intent.putExtra(FindExerciseActivity.KEY_KNOWLEDGE_LIST, knowledgeList);
        startActivity(intent);
    }

    public Chapter.Section getSection(String sectionId) {
        StringBuilder newstringBuilder = new StringBuilder();
        InputStream inputStream;
        try {
            inputStream = getResources().getAssets().open("biology_learn_schema.json");
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
        //Chapter chapter = gson.fromJson(newstringBuilder.toString(), Chapter.class);
        for(Chapter c : chapters) {
            for (Chapter.Section s : c.getSections()) {
                if (s.getSection().equals(sectionId)) {
                    return s;
                }
            }
        }
        return null;
    }

    public void startPreviewLessonActivity(String sectionId, String sectionName) {
        Chapter.Section s = getSection(sectionId);
        if(s != null) {
            Intent previewLessonActivity = new Intent(requireActivity(), LessonPreviewActivity.class);
            previewLessonActivity.putExtra(LessonPreviewActivity.KEY_PREVIEW_SECTION_NAME, sectionName);
            previewLessonActivity.putExtra(LessonPreviewActivity.KEY_SECTION_SCHEMA, s);

            startActivity(previewLessonActivity);
        } else {
            Toast.makeText(this.getContext(), "未查询到相关的课程", Toast.LENGTH_SHORT).show();
        }
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

