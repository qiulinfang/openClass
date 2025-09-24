package com.cosinetech.imates.ui.fragments;

import android.annotation.SuppressLint;
import android.app.AlertDialog;
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
import android.util.Log;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.AdapterView;
import android.widget.Button;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import com.cosinetech.imates.R;
import com.cosinetech.imates.data.models.KnowledgeRequestBuilder;
import com.cosinetech.imates.textbookservice.ChapterNode;
import com.cosinetech.imates.textbookservice.LearnResourceManager;
import com.cosinetech.imates.textbookservice.LocalPackageInfo;
import com.cosinetech.imates.textbookservice.LoginResponse;
import com.cosinetech.imates.textbookservice.TextbookVersion;
import com.cosinetech.imates.textbookservice.UserTextbookInfo;
import com.cosinetech.imates.ui.activities.FindExerciseActivity;
import com.cosinetech.imates.ui.activities.LessonPreviewActivity;
import com.cosinetech.imates.ui.activities.MyFavorCenterActivity;
import com.cosinetech.imates.ui.activities.MyHistoryActivity;
import com.cosinetech.imates.ui.activities.ExerciseSolveActivity;
import com.cosinetech.imates.data.models.Subject;
import com.cosinetech.imates.coreapiservice.ApiUrl;
import com.cosinetech.imates.ui.activities.PhotoSearchActivity;
import com.cosinetech.imates.ui.activities.TextbookManagementActivity;
import com.cosinetech.imates.ui.adapters.TextbookVersionSpinnerAdapter;
import com.cosinetech.imates.utils.AppUtils;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Queue;

/**
 * A simple {@link Fragment} subclass.
 * Use the {@link FragmentSubjectBiology#newInstance} factory method to
 * create an instance of this fragment.
 */
public class FragmentSubjectBiology extends Fragment {
    private static final String TAG = "FragmentSubjectBiology";
    private static final String ARG_PARAM1 = "param1";
    private static final String ARG_PARAM2 = "param2";
    private int previousBackStackCount = 0;

    // TODO: Rename and change types of parameters
    private String mParam1;
    private String mParam2;

    private TextView mTextViewUpdateBadge;
    private TextbookVersionSpinnerAdapter mTextbookVersionSpinnerAdapter;
    private List<UserTextbookInfo> mTextbookVersions;
    private UserTextbookInfo mCurrentUserTextbookInfo;

    private WebAppInterface mWebViewInterface;

    private List<LocalPackageInfo> mLearnPackages = new ArrayList<>();

    public FragmentSubjectBiology() {
        // Required empty public constructor
    }

    /**
     * Use this factory method to create a new instance of
     * this fragment using the provided parameters.
     *
     * @param param1 Parameter 1.
     * @param param2 Parameter 2.
     * @return A new instance of fragment FragmentSubjectBiology.
     */
    // TODO: Rename and change types and number of parameters
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
        // Inflate the layout for this fragment
        return inflater.inflate(R.layout.fragment_subject_biology, container, false);
    }

    @SuppressLint("ClickableViewAccessibility")
    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        initPopStackListener(view);
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
        mTextViewUpdateBadge = view.findViewById(R.id.update_badge);
        mWebViewInterface = new WebAppInterface(getContext());
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
        webView.loadUrl("file:///android_asset/knowledge_graph.html");
        webView.setOnTouchListener((v, event) -> {
            // 禁止ViewPager2拦截触摸事件
            if (event.getAction() == MotionEvent.ACTION_DOWN || event.getAction() == MotionEvent.ACTION_MOVE) {
                v.getParent().requestDisallowInterceptTouchEvent(true);
            } else if (event.getAction() == MotionEvent.ACTION_UP || event.getAction() == MotionEvent.ACTION_CANCEL) {
                v.getParent().requestDisallowInterceptTouchEvent(false);
            }
            return false; // 返回false，让HScrollView继续处理触摸事件
        });

        view.findViewById(R.id.btn_res_center).setOnClickListener(v -> {
            startTextbookManagement();
        });

        mTextbookVersions = new ArrayList<>();
        Spinner mTextbookVersionSpinner = view.findViewById(R.id.textbook_version_spinner);
        mTextbookVersionSpinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                mCurrentUserTextbookInfo = (UserTextbookInfo) parent.getItemAtPosition(position);
                new Thread(() -> {
                    getTextbookMindData(mCurrentUserTextbookInfo, mindData -> {
                        mWebViewInterface.updateMindData(mindData);
                        getActivity().runOnUiThread(() -> {
                            webView.evaluateJavascript("refreshMindData()", null);
                        });
                        updateLearnPackages();

                    });

                }).start();
            }

            @Override
            public void onNothingSelected(AdapterView<?> parent) { }
        });
        mTextbookVersionSpinnerAdapter = new TextbookVersionSpinnerAdapter(getContext(), mTextbookVersions);
        mTextbookVersionSpinner.setAdapter(mTextbookVersionSpinnerAdapter);

        Button btnGoExerciseList = view.findViewById(R.id.btn_my_exercise);
        btnGoExerciseList.setOnClickListener(v->{
            Intent intent = new Intent(getContext(), ExerciseSolveActivity.class);
            intent.putExtra(ExerciseSolveActivity.KEY_CHATBOT_URL, ApiUrl.URL_CHAT_BIOLOGY);
            intent.putExtra(ExerciseSolveActivity.KEY_SUBJECT, Subject.SUBJECT_BIOLOGY.name());
            startActivity(intent);
        });
    }

    private void startTextbookManagement() {
        Intent intent = new Intent(getContext(), TextbookManagementActivity.class);
        intent.putExtra(TextbookManagementActivity.KEY_SUBJECT, UserTextbookInfo.TEXTBOOK_SUBJECT.BIOLOGY.getValue());
        startActivity(intent);
    }

    private void updateLearnPackages() {
        try {
            LearnResourceManager.getInstance().getTextbookPackagesWithLocalFiles(mCurrentUserTextbookInfo.textbookId,
                    new LearnResourceManager.TextbookPackagesCallback() {
                        @Override
                        public void onSuccess(List<LocalPackageInfo> packages) {
                            mLearnPackages = packages;
                        }

                        @Override
                        public void onError(String error) {
                            mLearnPackages.clear();
                        }
                    });
        } catch (Exception e) {
            Log.e(TAG, "Update learn packages:" + e.getMessage());
        }
    }

    private void promptToDownloadResource() {
        new AlertDialog.Builder(getContext())
                .setTitle("学习资源")
                .setIcon(android.R.drawable.ic_dialog_alert)
                .setMessage("没有学习资源, 请先下载资源再来学习")
                .setPositiveButton("确定", (dialog, which) -> {
                    startTextbookManagement();
                })
                .setNegativeButton("取消", ((dialog, which) -> {
                }))
                .create()
                .show();
    }

    private void presentLocalLearnResource(List<UserTextbookInfo> textbooks) {
        mTextbookVersions.clear();
        mTextbookVersions.addAll(textbooks);
        mTextbookVersionSpinnerAdapter.notifyDataSetChanged();
    }

    private void checkUserLocalLearnResources() {
        LearnResourceManager.getInstance().loadUserAllLocalTextbooks(new LearnResourceManager.AllTextbooksCallback() {
            @Override
            public void onSuccess(List<UserTextbookInfo> textbooks) {
                if(textbooks == null) {
                    promptToDownloadResource();
                } else {
                    List<UserTextbookInfo> localTextbooks = new ArrayList<>();
                    for (UserTextbookInfo textbook: textbooks) {
                        if(textbook.textbookSubject == UserTextbookInfo.TEXTBOOK_SUBJECT.BIOLOGY.getValue()
                            && textbook.isDownloaded) {
                            localTextbooks.add(textbook);
                        }
                    }

                    if(localTextbooks.isEmpty()) {
                        promptToDownloadResource();
                    } else {
                        presentLocalLearnResource(localTextbooks);
                    }
                }
            }

            @Override
            public void onError(String error) {
                Toast.makeText(getContext(), "加载本地资源失败:" + error, Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void checkUpdateLearnResource() {
        LearnResourceManager.getInstance().checkForUpdates(new LearnResourceManager.UpdateCheckCallback() {
            @Override
            public void onUpdateAvailable(List<TextbookVersion> updatedTextbooks) {
                getActivity().runOnUiThread(() -> {
                    List<TextbookVersion> updates = new ArrayList<>();
                    for(TextbookVersion textbook : updatedTextbooks) {
                        if(textbook.textbookSubject == UserTextbookInfo.TEXTBOOK_SUBJECT.BIOLOGY.getValue()) {
                            updates.add(textbook);
                        }
                    }

                    if(updates.isEmpty()) {
                        mTextViewUpdateBadge.setVisibility(View.GONE);
                    } else {
                        int count = updates.size();
                        mTextViewUpdateBadge.setText(count >= 99 ? "99+" : String.valueOf(count));
                        mTextViewUpdateBadge.setVisibility(View.VISIBLE);
                    }
                });
            }

            @Override
            public void onNoUpdates() {
                mTextViewUpdateBadge.setVisibility(View.GONE);
            }

            @Override
            public void onError(String error) {

            }
        });
    }

    interface TextbookMindDataCallback {
        void onGetTextbookMindData(String mindData);
    }
    private void getTextbookMindData(UserTextbookInfo textbook, TextbookMindDataCallback callback) {
        LearnResourceManager.getInstance().getTextbookStructureLocal(textbook.textbookId,
                true,
                new LearnResourceManager.TextbookStructureLocalCallback() {
                    @Override
                    public void onSuccess(List<ChapterNode> structure) {
                        if(!structure.isEmpty()) {
                            String mindData = ChapterNodeConverter.convertToMindJson(structure.get(0).children, textbook.textbookGradeLabel
                                    + textbook.textbookSubjectLabel + textbook.textbookName);
                            if (callback != null) {
                                callback.onGetTextbookMindData(mindData);
                            }
                        }
                    }

                    @Override
                    public void onNotFound() {

                    }

                    @Override
                    public void onError(String error) {

                    }
                });
    }

    private void preformResourcesChecks() {
        try {
            if (LearnResourceManager.getInstance().isLoggedIn()) {
                checkUserLocalLearnResources();
                checkUpdateLearnResource();
            } else {
                LearnResourceManager.getInstance().login(AppUtils.getUserId(), AppUtils.getUserPassword(), new LearnResourceManager.LoginCallback() {
                    @Override
                    public void onSuccess(LoginResponse response) {
                        checkUserLocalLearnResources();
                        checkUpdateLearnResource();
                    }

                    @Override
                    public void onError(String error) {
                        checkUserLocalLearnResources();
                        Toast.makeText(getContext(), "登录研伴失败, 无法获取在线资源", Toast.LENGTH_SHORT).show();
                    }
                });
            }
        } catch (Exception e) {
            Log.e(TAG, "Perform resource check:" + e.getMessage());
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

    public void startPreviewLessonActivity(String sectionId, String sectionName) {
        Intent previewLessonActivity = new Intent(getContext(), LessonPreviewActivity.class);
        previewLessonActivity.putExtra(LessonPreviewActivity.KEY_PREVIEW_SECTION_NAME, sectionName);
        Gson gson = new GsonBuilder()
                .setDateFormat("yyyy-MM-dd HH:mm:ss")
                .create();
        if(!mLearnPackages.isEmpty()) {
            List<LocalPackageInfo> packages = new ArrayList<>();
            for (LocalPackageInfo pkg : mLearnPackages) {
                if(pkg.sectionId != null && pkg.sectionId.toLowerCase().equals(sectionId.toLowerCase())) {
                    packages.add(pkg);
                }
            }
            if(!packages.isEmpty()) {
                previewLessonActivity.putExtra(LessonPreviewActivity.KEY_LEARN_PACKAGE, gson.toJson(packages));
                startActivity(previewLessonActivity);
            } else {
                Toast.makeText(getContext(), "没有对应的学习资源", Toast.LENGTH_SHORT).show();
            }
        } else {
            Toast.makeText(getContext(), "选择小节去学习", Toast.LENGTH_SHORT).show();
        }
    }

    public class WebAppInterface {
        private final Context context;
        private String mMindData = "";

        WebAppInterface(Context context) {
            this.context = context;
        }

        public void updateMindData(String mindData) {
            mMindData = mindData;
        }

        public List<String> getAllKnowledgeLists(List<ChapterNode> roots, String targetId) {
            List<String> knowledgeLists = new ArrayList<>();

            // Find the target node
            ChapterNode targetNode = findChapterNodeById(roots, targetId);

            if (targetNode == null) {
                return knowledgeLists; // return empty list if node not found
            }

            // Add knowledge lists recursively
            addKnowledgeListsRecursive(targetNode, knowledgeLists);

            return knowledgeLists;
        }

        private void addKnowledgeListsRecursive(ChapterNode node, List<String> knowledgeLists) {
            // Add current node's knowledgeList if not null/empty
            if (node.knowledgeList != null && !node.knowledgeList.isEmpty()) {
                knowledgeLists.add(node.knowledgeList);
            }

            // Process children recursively
            if (node.children != null) {
                for (ChapterNode child : node.children) {
                    addKnowledgeListsRecursive(child, knowledgeLists);
                }
            }
        }

        // Helper function from previous solution to find a node by ID
        private ChapterNode findChapterNodeById(List<ChapterNode> roots, String targetId) {
            if (roots == null || targetId == null) {
                return null;
            }

            for (ChapterNode node : roots) {
                ChapterNode foundNode = findNodeRecursive(node, targetId);
                if (foundNode != null) {
                    return foundNode;
                }
            }

            return null;
        }

        private ChapterNode findNodeRecursive(ChapterNode currentNode, String targetId) {
            if (currentNode != null && targetId.equals(currentNode.id)) {
                return currentNode;
            }

            if (currentNode != null && currentNode.children != null) {
                for (ChapterNode child : currentNode.children) {
                    ChapterNode foundNode = findNodeRecursive(child, targetId);
                    if (foundNode != null) {
                        return foundNode;
                    }
                }
            }

            return null;
        }

        public ChapterNode findChapterNodeBFS(List<ChapterNode> roots, String targetId) {
            if (roots == null || targetId == null) {
                return null;
            }

            Queue<ChapterNode> queue = new LinkedList<>(roots);

            while (!queue.isEmpty()) {
                ChapterNode currentNode = queue.poll();

                if (targetId.equals(currentNode.id)) {
                    return currentNode;
                }

                if (currentNode.children != null) {
                    queue.addAll(currentNode.children);
                }
            }

            return null;
        }

        @JavascriptInterface
        public String getMindData() {
            return mMindData;
        }

        @JavascriptInterface
        public void onPrepareLesson(String nodeId, String nodeName) {
            new Handler(Looper.getMainLooper()).post(()->startPreviewLessonActivity(nodeId, nodeName));
        }
        @JavascriptInterface
        public void onReviewLesson(String nodeId, String nodeName) {
            // 找练习题
            if(mCurrentUserTextbookInfo == null) {
                Toast.makeText(context, "当前课本没有练习题", Toast.LENGTH_SHORT).show();
                return;
            }

            ChapterNode node = findChapterNodeById(mCurrentUserTextbookInfo.structure, nodeId);
            if(node == null) {
                Toast.makeText(context, "选择小节去练习", Toast.LENGTH_SHORT).show();
                return;
            }

            KnowledgeRequestBuilder.KnowledgeRequest request = KnowledgeRequestBuilder.buildRequestFromTree(node, mCurrentUserTextbookInfo.textbookId, "biology");
            if(request.param.isEmpty()) {
                Toast.makeText(context, "没有相关的习题", Toast.LENGTH_SHORT).show();
                return;
            }

            Gson gson = new GsonBuilder().setPrettyPrinting().create();
            String knowledgeRequest = gson.toJson(request);
            new Handler(Looper.getMainLooper()).post(() -> startFindExerciseActivity(knowledgeRequest.toString().trim()));
        }
    }

    public static class ChapterNodeConverter {

        private static final Gson gson = new Gson();

        public static String convertToMindJson(List<ChapterNode> chapters, String bookTitle) {
            // 构建根节点
            MindNode root = new MindNode();
            root.id = "book";
            root.topic = bookTitle;

            // 处理每个章节
            for (int i = 0; i < chapters.size(); i++) {
                ChapterNode chapter = chapters.get(i);
                MindNode chapterNode = convertChapterNode(chapter);

                // 设置方向：奇数左，偶数右
                chapterNode.direction = (i % 2 == 0) ? "left" : "right";

                root.children.add(chapterNode);
            }

            // 构建最终数据结构
            MindData data = new MindData();
            data.data = root;

            return gson.toJson(data);
        }

        private static MindNode convertChapterNode(ChapterNode chapter) {
            MindNode node = new MindNode();
            node.id = chapter.id;
            node.topic = chapter.label != null ? chapter.label : chapter.name;

            // 递归处理子节点
            if (chapter.children != null && !chapter.children.isEmpty()) {
                for (ChapterNode child : chapter.children) {
                    node.children.add(convertChapterNode(child));
                }
            }

            return node;
        }

        // 定义目标JSON结构对应的类
        private static class MindData {
            MindNode data;
        }

        private static class MindNode {
            String id;
            String topic;
            String direction; // 只有一级章节需要
            List<MindNode> children = new ArrayList<>();
        }
    }
    private void initPopStackListener(View view) {
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

    @Override
    public void onResume() {
        super.onResume();
        preformResourcesChecks();
        updateLearnPackages();
    }
}

