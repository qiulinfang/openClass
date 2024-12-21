package com.cosinetech.imates.fragments;

import android.annotation.SuppressLint;
import android.content.Context;
import android.os.Bundle;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.cardview.widget.CardView;
import androidx.fragment.app.Fragment;
import androidx.fragment.app.FragmentManager;

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

import com.cosinetech.imates.models.Subject;
import com.cosinetech.imates.R;
import com.cosinetech.imates.models.Chapter;
import com.cosinetech.imates.webservice.ApiUrl;
import com.cosinetech.imates.widgets.FindKnowledgeQuestionPopupWindow;
import com.google.gson.Gson;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;

/**
 * A simple {@link Fragment} subclass.
 * Use the {@link FragmentSubjectBiology#newInstance} factory method to
 * create an instance of this fragment.
 */
public class FragmentSubjectBiology extends Fragment {
    private static final String ARG_PARAM1 = "param1";
    private static final String ARG_PARAM2 = "param2";
    private int previousBackStackCount = 0;

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

        CardView button = view.findViewById(R.id.photo_to_solve);
        button.setOnClickListener(v -> loadCameraFragment());

        CardView btnExercise = view.findViewById(R.id.exercise);
        btnExercise.setOnClickListener(v-> loadExerciseListFragment());

        CardView btnHistory = view.findViewById(R.id.history);
        btnHistory.setOnClickListener(v -> {
            showMyHistory(view, R.drawable.history_biology);
        });

        CardView btnMyFavor = view.findViewById(R.id.card_my_favor);
        btnMyFavor.setOnClickListener( v-> {
            showMyFavor(view);
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

        @JavascriptInterface
        public void onReviewLesson(String nodeId, String nodeName) {
            Chapter.Section s = getSection(nodeId);
            if(s == null) {
                Toast.makeText(getContext(), "未查询到相关的练习资料", Toast.LENGTH_SHORT).show();
                return;
            }
            FindKnowledgeQuestionPopupWindow win = new FindKnowledgeQuestionPopupWindow(requireActivity(), Subject.SUBJECT_BIOLOGY,
                   s.getKnowledgeNo() , new FindKnowledgeQuestionPopupWindow.OnSimilarQuestionSelectionListener() {
                @Override
                public void onQuestionSelected() {
                    loadExerciseListFragment();
                }
            });
            win.show();
        }
    }

    public void showMyHistory(View anchorView, int imageResId) {
        // 加载布局
        View popupView = LayoutInflater.from(getActivity()).inflate(R.layout.popup_window_history_image, null);

        // 初始化 PopupWindow
        PopupWindow popupWindow = new PopupWindow(popupView,
                ViewGroup.LayoutParams.MATCH_PARENT, // 宽度
                ViewGroup.LayoutParams.MATCH_PARENT); // 高度

        // 设置背景
        //popupWindow.setBackgroundDrawable(new ColorDrawable(android.R.color.white));

        // 设置点击外部区域关闭
        popupWindow.setOutsideTouchable(true);
        popupWindow.setFocusable(true);

        // 设置图片
        ImageView imageView = popupView.findViewById(R.id.img_view);
        imageView.setImageResource(imageResId);

        // 关闭按钮点击事件
        Button closeButton = popupView.findViewById(R.id.close);
        closeButton.setOnClickListener(v -> popupWindow.dismiss());

        // 显示 PopupWindow
        popupWindow.showAtLocation(anchorView, Gravity.CENTER, 0, 0);
    }

    public void showMyFavor(View anchorView) {
        View popupView = LayoutInflater.from(getActivity()).inflate(R.layout.popup_window_my_favor, null);

        // 初始化 PopupWindow
        PopupWindow popupWindow = new PopupWindow(popupView,
                ViewGroup.LayoutParams.MATCH_PARENT, // 宽度
                ViewGroup.LayoutParams.MATCH_PARENT); // 高度

        // 设置背景
        //popupWindow.setBackgroundDrawable(new ColorDrawable(android.R.color.white));

        // 设置点击外部区域关闭
        popupWindow.setOutsideTouchable(true);
        popupWindow.setFocusable(true);

        // 关闭按钮点击事件
        Button closeButton = popupView.findViewById(R.id.close);
        closeButton.setOnClickListener(v -> popupWindow.dismiss());

        CardView btnShowNotes = popupView.findViewById(R.id.my_note);
        btnShowNotes.setOnClickListener(v->{
            showMyFavorNotes(anchorView);
        });

        CardView btnShowMind = popupView.findViewById(R.id.my_mind);
        btnShowMind.setOnClickListener(v->{
            showMyFavorMind(anchorView);
        });

        // 显示 PopupWindow
        popupWindow.showAtLocation(anchorView, Gravity.CENTER, 0, 0);
    }

    public void showMyFavorNotes(View view) {
        // 加载布局
        View popupView = LayoutInflater.from(getActivity()).inflate(R.layout.popup_window_my_notes, null);

        // 初始化 PopupWindow
        PopupWindow popupWindow = new PopupWindow(popupView,
                ViewGroup.LayoutParams.MATCH_PARENT, // 宽度
                ViewGroup.LayoutParams.MATCH_PARENT); // 高度

        // 设置背景
        //popupWindow.setBackgroundDrawable(new ColorDrawable(android.R.color.white));

        // 设置点击外部区域关闭
        popupWindow.setOutsideTouchable(true);
        popupWindow.setFocusable(true);

        // 设置图片
        ImageView imageView = popupView.findViewById(R.id.img_view);
        imageView.setImageResource(R.drawable.notes_biology);

        // 关闭按钮点击事件
        Button closeButton = popupView.findViewById(R.id.close);
        closeButton.setOnClickListener(v -> popupWindow.dismiss());

        // 显示 PopupWindow
        popupWindow.showAtLocation(view, Gravity.CENTER, 0, 0);
    }

    public void showMyFavorMind(View view) {
// 加载布局
        View popupView = LayoutInflater.from(getActivity()).inflate(R.layout.popup_window_my_mind, null);

        // 初始化 PopupWindow
        PopupWindow popupWindow = new PopupWindow(popupView,
                ViewGroup.LayoutParams.MATCH_PARENT, // 宽度
                ViewGroup.LayoutParams.MATCH_PARENT); // 高度

        // 设置背景
        //popupWindow.setBackgroundDrawable(new ColorDrawable(android.R.color.white));

        // 设置点击外部区域关闭
        popupWindow.setOutsideTouchable(true);
        popupWindow.setFocusable(true);

        // 设置图片
        ImageView imageView = popupView.findViewById(R.id.img_view);
        imageView.setImageResource(R.drawable.notes_biology);

        // 关闭按钮点击事件
        Button closeButton = popupView.findViewById(R.id.close);
        closeButton.setOnClickListener(v -> popupWindow.dismiss());

        // 显示 PopupWindow
        popupWindow.showAtLocation(view, Gravity.CENTER, 0, 0);
    }

    public void loadCameraFragment() {
        final FragmentCamera childFragment = FragmentCamera.newInstance(Subject.SUBJECT_BIOLOGY);
        getChildFragmentManager().beginTransaction()
                .replace(R.id.container, childFragment)
                .addToBackStack(null)
                .commit();
    }

    public void loadExerciseListFragment() {
        final FragmentQuestionList fragmentQuestionList = FragmentQuestionList.newInstance(ApiUrl.URL_CHAT_BIOLOGY, Subject.SUBJECT_BIOLOGY);
        getChildFragmentManager().beginTransaction()
                .replace(R.id.container, fragmentQuestionList)
                .addToBackStack(null)
                .commit();
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
        Chapter chapter = gson.fromJson(newstringBuilder.toString(), Chapter.class);
        for (Chapter.Section s: chapter.getSections()) {
            if(s.getSection().equals(sectionId)) {
                return s;
            }
        }
        return null;
    }

    public void loadPrepareLessonFragment(String sectionId, String sectionName) {
        Chapter.Section s = getSection(sectionId);
        if(s != null) {
            final FragmentPreviewLesson fragmentPreviewLesson = FragmentPreviewLesson.newInstance(sectionName, s);
            getChildFragmentManager().beginTransaction()
                    .replace(R.id.container, fragmentPreviewLesson)
                    .addToBackStack(null)
                    .commit();
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

