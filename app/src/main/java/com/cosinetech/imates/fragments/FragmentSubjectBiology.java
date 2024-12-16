package com.cosinetech.imates.fragments;

import android.annotation.SuppressLint;
import android.content.Context;
import android.os.Bundle;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.widget.PopupMenu;
import androidx.cardview.widget.CardView;
import androidx.fragment.app.Fragment;

import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.MenuItem;
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

import com.cosinetech.imates.Subject;
import com.cosinetech.imates.R;
import com.cosinetech.imates.webservice.ApiUrl;

/**
 * A simple {@link Fragment} subclass.
 * Use the {@link FragmentSubjectBiology#newInstance} factory method to
 * create an instance of this fragment.
 */
public class FragmentSubjectBiology extends Fragment {
    private static final String ARG_PARAM1 = "param1";
    private static final String ARG_PARAM2 = "param2";

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

//        class JsObject {
//            @JavascriptInterface
//            public String toString() { return "injectedObject"; }
//        }
//        webView.getSettings().setJavaScriptEnabled(true);
//        webView.addJavascriptInterface(new JsObject(), "injectedObject");
//        webView.loadData("  ", "text/ html", null);
//        webView.loadUrl("javascript:alert(injectedObject. toString())");
    }

    public class WebAppInterface {
        private Context context;

        WebAppInterface(Context context) {
            this.context = context;
        }

        @JavascriptInterface
        public void onPrepareLesson(String nodeId, String nodeName) {
            Toast.makeText(context, "Prepare clicked: " + nodeId + nodeName, Toast.LENGTH_SHORT).show();
        }

        @JavascriptInterface
        public void onReviewLesson(String nodeId, String nodeName) {
            Toast.makeText(context, "Review press: " + nodeId + nodeName, Toast.LENGTH_SHORT).show();
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
}

