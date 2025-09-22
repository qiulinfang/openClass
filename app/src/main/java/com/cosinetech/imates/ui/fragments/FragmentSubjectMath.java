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
 * Use the {@link FragmentSubjectMath#newInstance} factory method to
 * create an instance of this fragment.
 */
public class FragmentSubjectMath extends Fragment {
    private static final String TAG = "FragmentSubjectMath";
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
            Intent intent = new Intent(getContext(), TextbookManagementActivity.class);
            startActivity(intent);
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
            intent.putExtra(ExerciseSolveActivity.KEY_CHATBOT_URL, ApiUrl.URL_CHAT_MATH);
            intent.putExtra(ExerciseSolveActivity.KEY_SUBJECT, Subject.SUBJECT_MATH.name());
            startActivity(intent);
        });
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
                    Intent intent = new Intent(getContext(), TextbookManagementActivity.class);
                    startActivity(intent);
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
                        if(textbook.isDownloaded) {
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
                    if(updatedTextbooks.isEmpty()) {
                        mTextViewUpdateBadge.setVisibility(View.GONE);
                    } else {
                        int count = updatedTextbooks.size();
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

//            List<String> knowledgeIds = getAllKnowledgeLists(mCurrentUserTextbookInfo.structure, nodeId);
//            StringBuilder knowledgeId = new StringBuilder();
//            for (String id : knowledgeIds) {
//                knowledgeId.append(id).append(",");
//            }

            String knowledgeId = getKnowledgeId(nodeId);
            if(knowledgeId.toString().trim().isEmpty()) {
                Toast.makeText(context, "没有相关的习题", Toast.LENGTH_SHORT).show();
            } else {
                // 在 UI 线程上执行的代码
                new Handler(Looper.getMainLooper()).post(() -> startFindExerciseActivity(knowledgeId.toString().trim()));
            }
        }

        ///
        /// 去学习课本的套餐
        ///
        public void startPreviewLessonActivity(String sectionId, String sectionName) {
            Intent previewLessonActivity = new Intent(context, LessonPreviewActivity.class);
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
                    Toast.makeText(context, "没有对应的学习资源", Toast.LENGTH_SHORT).show();
                }
            } else {
                Toast.makeText(context, "选择小节去学习", Toast.LENGTH_SHORT).show();
            }
        }

        public void startFindExerciseActivity(String knowledgeList) {
            Intent intent = new Intent(context, FindExerciseActivity.class);
            intent.putExtra(FindExerciseActivity.KEY_CHATBOT_URL, ApiUrl.URL_CHAT_MATH);
            intent.putExtra(FindExerciseActivity.KEY_PARAM_SUBJECT, Subject.SUBJECT_MATH.name());
            intent.putExtra(FindExerciseActivity.KEY_KNOWLEDGE_LIST, knowledgeList);
            startActivity(intent);
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

    private String getKnowledgeId(String nodeId) {
        Map<String, String> knowledgeMap = new HashMap<>();
        knowledgeMap.put("2dc0dd3d-359d-487b-be75-cbc6db7afcad", "1942495553826639874,1942495552635457538,1942495554015383557,1942495554015383556,1942495554015383555,1942495554015383554,1942495554015383553,1942495553952468998,1942495553952468997,1942495553952468995,1942495553952468994,1942495553889554437,1942495553889554436,1942495553889554435,1942495553889554434,1942495553952468996,1942495777605332995,1942495777668247555,1942495777668247554,1942495777605332997,1942495777605332996,1942495777605332994,1942495777538224131,1942495777538224130,1942495777538224129,1942495775860502530,1942495952721739780,1942495952851763204,1942495952851763203,1942495952851763202,1942495952851763201,1942495952788848644,1942495952788848643,1942495952788848642,1942495952788848641,1942495952721739781,1942495952721739779,1942495952721739778,1942495950800748546");
        knowledgeMap.put("c33c917c-89d4-48be-802d-568c3a97c277", "1942495553826639874,1942495552635457538,1942495554015383557,1942495554015383556,1942495554015383555,1942495554015383554,1942495554015383553,1942495553952468998,1942495553952468997,1942495553952468995,1942495553952468994,1942495553889554437,1942495553889554436,1942495553889554435,1942495553889554434,1942495553952468996");
        knowledgeMap.put("6c3c31bc-d453-4fcd-8f05-01de68830ad1", "1942495777605332995,1942495777668247555,1942495777668247554,1942495777605332997,1942495777605332996,1942495777605332994,1942495777538224131,1942495777538224130,1942495777538224129,1942495775860502530");
        knowledgeMap.put("fa156eb3-694d-47b0-8647-39c7abeeb022", "1942495952721739780,1942495952851763204,1942495952851763203,1942495952851763202,1942495952851763201,1942495952788848644,1942495952788848643,1942495952788848642,1942495952788848641,1942495952721739781,1942495952721739779,1942495952721739778,1942495950800748546");
        knowledgeMap.put("87d6a9e7-8dd5-458f-b7f6-6f1b88f4fc22", "1942496301260009473,1942496302778347521,1942496302841262082,1942496302841262083,1942496502670442500,1942496502733357062,1942496502733357061,1942496502733357060,1942496502733357059,1942496502733357058,1942496502670442499,1942496502670442498,1942496502670442497,1942496501252767745,1942496502670442501,1942496738130280450,1942496739405348865,1942496739405348866,1942496739468263426,1942496739468263427,1942496739468263428,1942496739468263429,1942496739468263430");
        knowledgeMap.put("8297454f-e573-4cf9-80fa-52befecf22bc", "1942496301260009473,1942496302778347521,1942496302841262082,1942496302841262083");
        knowledgeMap.put("a4e35797-2bfc-4f10-8924-d28d982ae97a", "1942496502670442500,1942496502733357062,1942496502733357061,1942496502733357060,1942496502733357059,1942496502733357058,1942496502670442499,1942496502670442498,1942496502670442497,1942496501252767745,1942496502670442501");
        knowledgeMap.put("932e3125-0c67-4c18-99ce-58d4557351e9", "1942496738130280450,1942496739405348865,1942496739405348866,1942496739468263426,1942496739468263427,1942496739468263428,1942496739468263429,1942496739468263430");
        knowledgeMap.put("cca50c64-bceb-47fc-b372-86f027020976", "1942497161411080193,1942497161348165636,1942497161348165635,1942497161348165633,1942497160106651649,1942497161348165634,1942497531604586499,1942497531734609922,1942497531734609921,1942497531671695365,1942497531671695364,1942497531671695363,1942497531671695362,1942497531604586502,1942497531604586501,1942497531604586500,1942497531604586498,1942497531541671941,1942497531541671940,1942497531541671939,1942497531541671938,1942497531478757377,1942497529507434498,1942505191452209154");
        knowledgeMap.put("4dac13d6-b2ad-4289-8fb7-58250936dcfb", "1942497161411080193,1942497161348165636,1942497161348165635,1942497161348165633,1942497160106651649,1942497161348165634");
        knowledgeMap.put("2e6909eb-8329-4b0e-a82d-f12d78a40b92", "1942497531604586499,1942497531734609922,1942497531734609921,1942497531671695365,1942497531671695364,1942497531671695363,1942497531671695362,1942497531604586502,1942497531604586501,1942497531604586500,1942497531604586498,1942497531541671941,1942497531541671940,1942497531541671939,1942497531541671938,1942497531478757377,1942497529507434498");
        knowledgeMap.put("369d470f-500d-400e-80bb-f501e5eb2e9c", "1942505191452209154");
        knowledgeMap.put("725b5488-36b5-4d90-a7f5-64d9a254b7a4", "1942499081416728579,1942499080007442434,1942499081483837443,1942499081483837441,1942499081416728578,1942499081483837442,1942499294776717313,1942499294978043907,1942499294978043906,1942499294910935046,1942499294910935045,1942499294910935044,1942499294910935042,1942499293417762818,1942499294843826177,1942499294843826179,1942499294910935043,1942499294843826178,1942499475303784450,1942499475626745858,1942499475626745857,1942499475563831300,1942499475563831299,1942499475563831298,1942499475500916739,1942499475500916738,1942499475433807876,1942499473777057793,1942499475370893313,1942499475370893314,1942499475370893315,1942499475433807874,1942499475500916737,1942499475433807875,1942499475433807873,1942499643046539266,1942499644661346306,1942499644598431747,1942499644598431746,1942499644598431745,1942499644535517189,1942499644535517187,1942499644468408321,1942499644468408322,1942499644535517186,1942499644535517188,1942499644468408323");
        knowledgeMap.put("4d4ef18b-f1e3-48ce-9392-660636ada25a", "1942499081416728579,1942499080007442434,1942499081483837443,1942499081483837441,1942499081416728578,1942499081483837442");
        knowledgeMap.put("608bc66b-ea83-4d3c-8a8d-867e05dda362", "1942499294776717313,1942499294978043907,1942499294978043906,1942499294910935046,1942499294910935045,1942499294910935044,1942499294910935042,1942499293417762818,1942499294843826177,1942499294843826179,1942499294910935043,1942499294843826178");
        knowledgeMap.put("0df7e8ff-9c28-4a4c-bf33-3aea202fc811", "1942499475303784450,1942499475626745858,1942499475626745857,1942499475563831300,1942499475563831299,1942499475563831298,1942499475500916739,1942499475500916738,1942499475433807876,1942499473777057793,1942499475370893313,1942499475370893314,1942499475370893315,1942499475433807874,1942499475500916737,1942499475433807875,1942499475433807873");
        knowledgeMap.put("313ca7f1-8554-47ff-9eea-c72dba15ab61", "1942499643046539266,1942499644661346306,1942499644598431747,1942499644598431746,1942499644598431745,1942499644535517189,1942499644535517187,1942499644468408321,1942499644468408322,1942499644535517186,1942499644535517188,1942499644468408323");
        knowledgeMap.put("2e80b2e1-81e6-45d3-9980-edc440a884ab", "1942500049470410753,1942500049596239877,1942500049596239876,1942500049596239875,1942500049596239874,1942500049596239873,1942500049533325318,1942500049533325316,1942500048090484737,1942500049470410754,1942500049470410755,1942500049533325315,1942500049533325314,1942500049533325317,1942500592255279106,1942500592188170244,1942500592058146817,1942500592255279109,1942500592255279108,1942500592058146818,1942500592255279110,1942500592318193667,1942500592188170243,1942500592125255684,1942500592188170245,1942500592058146821,1942500592255279107,1942500592125255686,1942500592125255683,1942500592125255682,1942500592058146819,1942500592318193666,1942500592058146820,1942500590757912578,1942500592188170241,1942500592125255685,1942500592188170242,1942500773491224578,1942500773491224579,1942500772031606785,1942500773361201154,1942500773424115714,1942500773424115715,1942500773424115716,1942500773491224577");
        knowledgeMap.put("3b884b8a-00df-406e-91ed-4ed90178ceee", "1942500049470410753,1942500049596239877,1942500049596239876,1942500049596239875,1942500049596239874,1942500049596239873,1942500049533325318,1942500049533325316,1942500048090484737,1942500049470410754,1942500049470410755,1942500049533325315,1942500049533325314,1942500049533325317");
        knowledgeMap.put("2a13cd44-65fb-4a2d-8ed6-53e078a2c0a2", "1942500592255279106,1942500592188170244,1942500592058146817,1942500592255279109,1942500592255279108,1942500592058146818,1942500592255279110,1942500592318193667,1942500592188170243,1942500592125255684,1942500592188170245,1942500592058146821,1942500592255279107,1942500592125255686,1942500592125255683,1942500592125255682,1942500592058146819,1942500592318193666,1942500592058146820,1942500590757912578,1942500592188170241,1942500592125255685,1942500592188170242");
        knowledgeMap.put("3983a26f-19cc-4bba-869c-7d3164ee0571", "1942500773491224578,1942500773491224579,1942500772031606785,1942500773361201154,1942500773424115714,1942500773424115715,1942500773424115716,1942500773491224577");
        knowledgeMap.put("dbaac650-49cc-4f27-8bb6-659f1271ddad", "1942501001132830721,1942501002944770049,1942501003011878914,1942501003011878915,1942501003011878916,1942501003011878917,1942501003078987777,1942501003078987778,1942501003078987779,1942501003141902338,1942501003141902339,1942501003141902340,1942501003141902341,1942501003204816897,1942501003204816898,1942501003204816899,1942501003267731457,1942501003267731458,1942501003267731459,1942501003267731460,1942501003330646017,1942501003330646018");
        knowledgeMap.put("f6b39f9f-0979-4156-b3d8-548ea9b2da63", "1942503484144005122,1942503485670731777,1942503485733646338");
        //knowledgeMap.put("0f0aea84-c061-4d34-bc0d-6758273397a1", "");
        knowledgeMap.put("8e2cd157-3815-4c07-b512-49e0eea62512", "1947924703254740994,1947924859182186498,1947924893235740673,1947924895148343298,1947924896507297793,1947924897815920642,1947924898969354241,1947924902773587970,1947924904774270978,1947924906049339393,1947924907328602114,1947924908414926850,1947924909476085761,1947924910503690241,1947924912630202370,1947924914538610689,1947924916627374081,1947924918829383681,1947924920951701505,1947924922755252226,1947924924940484609,1947924926433656833,1947924928002326529,1947924929709408258,1947924932259545089,1947924934948093953,1947924937238183937,1947924939008180225");
        knowledgeMap.put("12328b7b-4114-4c7f-be2a-28c7bd8d2a1e", "1947924703254740994,1947924859182186498,1947924893235740673,1947924895148343298,1947924896507297793,1947924897815920642,1947924898969354241");
        knowledgeMap.put("5d5cc96d-45ca-480f-ba40-00d152f63553", "1947924902773587970,1947924904774270978,1947924906049339393,1947924907328602114,1947924908414926850,1947924909476085761,1947924910503690241,1947924912630202370,1947924914538610689,1947924916627374081,1947924918829383681,1947924920951701505,1947924922755252226,1947924924940484609,1947924926433656833,1947924928002326529,1947924929709408258,1947924932259545089,1947924934948093953,1947924937238183937,1947924939008180225");
        knowledgeMap.put("ded49a9c-39a8-46c9-bf68-f61ebeaa2bee", "1947924940740427777,1947924948952875009,1947924953717604354,1947924956078997505,1947924957874159617,1947924959430246401,1947924960814366721,1947924965541347329,1947924967269400577,1947924969072951297,1947924970561929217,1947924971925078018,1947924973296615426,1947924974852702210,1947924976786276353,1947924978342363137,1947924979969753089,1947924981932687361,1947924983690100737,1947924985439125506,1947924987041349634,1947924988723265537,1947924991088852994,1947924993169227777,1947924995266379777,1947924997514526721,1947924999980777474");
        knowledgeMap.put("6d4d9401-f737-4017-9b32-c74a63bde603", "1947924940740427777,1947924948952875009");
        knowledgeMap.put("28d16798-371f-4d9d-8fa3-53d0f946c60a", "1947924953717604354,1947924956078997505,1947924957874159617,1947924959430246401");
        knowledgeMap.put("056dcf14-edcc-4cf7-8d31-6c73852388fc", "1947924960814366721,1947924965541347329,1947924967269400577,1947924969072951297,1947924970561929217,1947924971925078018,1947924973296615426,1947924974852702210,1947924976786276353,1947924978342363137,1947924979969753089,1947924981932687361,1947924983690100737,1947924985439125506,1947924987041349634,1947924988723265537,1947924991088852994,1947924993169227777,1947924995266379777,1947924997514526721,1947924999980777474");
        knowledgeMap.put("14bf9776-94c0-45a5-812e-348c121e650a", "1947925111423434754,1947925164972113922,1947925164976308226,1947925164976308227");
        knowledgeMap.put("352a8cf1-beda-4b5f-98d9-06d2231de0e4", "1947925165764837378,1947925165764837379,1947925165827751938,1947925165827751939,1947925165827751940,1947925165894860802,1947925165894860803,1947925165894860804,1947925165961969665,1947925165961969666,1947925165961969667,1947925165961969668,1947925166024884226,1947925166024884227,1947925166024884228,1947925166091993089,1947925166091993090,1947925166154907649,1947925166154907650");
        knowledgeMap.put("ae1d680f-df3b-4767-b723-6ebbf02ee46b", "1947925166414954497,1947925166477869057");
        knowledgeMap.put("e5325598-6faf-4c50-9112-af779aed25ac", "1947925166742110210,1947925166742110211");
        knowledgeMap.put("4108bbf8-645c-4ae3-9e0c-5e353f67d031", "1947925167060877314,1947925167123791874,1947925167123791875");
        knowledgeMap.put("12e3170f-1073-4f01-b5ea-e25cb3dc8f03", "1947925167715188738,1947925167715188739,1947925167782297601,1947925168109453314,1947925168109453315,1947925168109453316,1947925168109453317,1947925168176562177,1947925168436609026,1947925168436609027,1947925168436609028,1947925168499523585,1947925168499523586,1947925168499523587,1947925168499523588,1947925168562438146");
        knowledgeMap.put("243e19a9-62c0-49f5-8f56-4bb27ae99077", "1947925167715188738,1947925167715188739,1947925167782297601");
        knowledgeMap.put("b72097a3-ecad-4ed9-8210-a93c5d6727c2", "1947925168109453314,1947925168109453315,1947925168109453316,1947925168109453317,1947925168176562177");
        knowledgeMap.put("1f282422-740f-403b-bd2f-f4078286deae", "1947925168436609026,1947925168436609027,1947925168436609028,1947925168499523585,1947925168499523586,1947925168499523587,1947925168499523588,1947925168562438146");
        knowledgeMap.put("4892d4e6-53a8-4613-ab3a-dd0fc9592208", "1947925169673928706,1947925169673928707,1947925169673928708,1947925170001084417,1947925170068193282,1947925170068193283,1947925170328240130,1947925170391154690,1947925170391154691,1947925170391154692,1947925170458263553,1947925170458263554,1947925170458263555,1947925170781224962,1947925170781224963,1947925170781224964,1947925171171295234,1947925171171295235,1947925171171295236,1947925171234209794,1947925171234209795,1947925171234209796,1947925171234209797,1947925171301318657,1947925171301318658");
        knowledgeMap.put("37e41d38-888a-40a4-bb8a-0de0e4202e0b", "1947925169673928706,1947925169673928707,1947925169673928708");
        knowledgeMap.put("83c1abe9-9b2c-409d-8c2d-09e076e710af", "1947925170001084417,1947925170068193282,1947925170068193283");
        knowledgeMap.put("c0e14c98-12e4-4057-ad64-9a411d67de0c", "1947925170328240130,1947925170391154690,1947925170391154691,1947925170391154692,1947925170458263553,1947925170458263554,1947925170458263555");
        knowledgeMap.put("a67f838b-3337-48fc-81f6-5237dcfef794", "1947925170781224962,1947925170781224963,1947925170781224964");
        knowledgeMap.put("6592b51e-2360-493a-ac2f-5b8b5a103578", "1947925171171295234,1947925171171295235,1947925171171295236,1947925171234209794,1947925171234209795,1947925171234209796,1947925171234209797,1947925171301318657,1947925171301318658");
        knowledgeMap.put("8f6afe4c-1950-4d1f-bbf2-789bdc41fb4f", "1947925171620085761,1947925171687194625,194792517168719462a,194792517168719462b,194792517168719462c");
        knowledgeMap.put("7df091d1-4ffe-4570-98a0-66503408f7d2", "1947925172278591490,1947925172278591491,1947925172345700354,1947925172345700355,1947925172345700356,1947925172668661762,1947925172668661763,1947925172668661764,1947925172987428865,1947925172987428866,1947925173050343426,1947925173050343427,1947925173369110529,1947925173369110530,1947925173436219393,1947925173436219394,1947925173503328257,1947925173830483970,1947925173830483971,1947925173830483972,1947925173897592834");
        knowledgeMap.put("30f783ae-1793-4530-93b4-e9376d4075d4", "1947925172278591490,1947925172278591491,1947925172345700354,1947925172345700355,1947925172345700356");
        knowledgeMap.put("00f8b9da-1b42-48de-96f3-56e29d8784c7", "1947925172668661762,1947925172668661763,1947925172668661764");
        knowledgeMap.put("823c9f9a-bf24-4ac1-8374-ee45b7a8aa56", "1947925172987428865,1947925172987428866,1947925173050343426,1947925173050343427");
        knowledgeMap.put("9c398985-4f53-47d9-8b79-b7c38e14e4a8", "1947925173369110529,1947925173369110530,1947925173436219393,1947925173436219394,1947925173503328257");
        knowledgeMap.put("2e55faf4-56b2-4f7e-b4f2-491f0091cfec", "1947925173830483970,1947925173830483971,1947925173830483972,1947925173897592834");
        knowledgeMap.put("d50887c2-d362-4c01-9e31-01917c215f26", "1947925174484795394,1947925174484795395,1947925174484795396,1947925174551904258,1947925175210409986,1947925175210409987,1947925175273324546,1947925175273324547,1947925175273324548,1947925175336239105,1947925175336239106,1947925175336239107,1947925175336239108,1947925175403347969,1947925175403347970,1947925175403347971,1947925175470456833");
        knowledgeMap.put("5bcc8e48-e6ca-4407-9ad5-6befe9e88886", "1947925174484795394,1947925174484795395,1947925174484795396,1947925174551904258");
        knowledgeMap.put("85d70ffc-f463-4040-b300-00d37c6a74d7", "1947925175210409986,1947925175210409987,1947925175273324546,1947925175273324547,1947925175273324548,1947925175336239105,1947925175336239106,1947925175336239107,1947925175336239108,1947925175403347969,1947925175403347970,1947925175403347971,1947925175470456833");
        knowledgeMap.put("4e95ab47-0e87-493b-97ea-491258f74b86", "1947925175210409986,1947925175210409987,1947925175273324546,1947925175273324547,1947925175273324548,1947925175336239105,1947925175336239106,1947925175336239107,1947925175336239108,1947925175403347969,1947925175403347970,1947925175403347971,1947925175470456833");
        knowledgeMap.put("37009ecb-dd85-4115-836d-9fc2eed64cac", "1947925175793418241,1947925175793418242,1947925175793418243,1947925175860527105,1947925175860527106,1947925175860527107,1947925175860527108,1947925175923441665,1947925175923441666");

        // 人教A数学必一和二
        knowledgeMap.put("da38ab1f-7b04-4cfe-82cb-bb7631f90e9f", "1942495553826639874,1942495552635457538,1942495554015383557,1942495554015383556,1942495554015383555,1942495554015383554,1942495554015383553,1942495553952468998,1942495553952468997,1942495553952468995,1942495553952468994,1942495553889554437,1942495553889554436,1942495553889554435,1942495553889554434,1942495553952468996");
        knowledgeMap.put("7eb3a8ef-d269-49ff-9b0e-3bae0892102a", "1942495777605332995,1942495777668247555,1942495777668247554,1942495777605332997,1942495777605332996,1942495777605332994,1942495777538224131,1942495777538224130,1942495777538224129,1942495775860502530");
        knowledgeMap.put("49e52a96-07d0-4589-a680-a1e6448bc7c9", "1942495952721739779,1942495952851763204,1942495952851763203,1942495952851763202,1942495952851763201,1942495952788848644,1942495952788848643,1942495952788848642,1942495952788848641,1942495952721739781,1942495952721739780,1942495952721739778,1942495950800748546");
        knowledgeMap.put("2637047a-7610-48b9-a1ce-40853a994e34", "1942496301260009473,1942496302778347521,1942496302841262082,1942496302841262083,1942496739405348866,1942496739468263430,1942496739468263429,1942496739468263428,1942496739468263427,1942496739468263426,1942496739405348865,1942496738130280450");
        knowledgeMap.put("6af21afb-80eb-4f52-88f1-c70dd3964717", "1942496502733357062,1942496502733357061,1942496502733357060,1942496502733357059,1942496502733357058,1942496502670442500,1942496502670442499,1942496502670442498,1942496502670442497,1942496501252767745,1942496502670442501");
        knowledgeMap.put("b782429d-bf42-4930-a34f-df40dc11e79c", "1942497160106651649,1942497161411080193,1942497161348165636,1942497161348165635,1942497161348165634,1942497161348165633,1942499081416728579,1942499081483837443,1942499081483837442,1942499081483837441,1942499081416728578,1942499080007442434");
        knowledgeMap.put("5adc3971-9a6b-48db-bf37-eb3401d20339", "1942499293417762818,1942499294978043907,1942499294978043906,1942499294910935046,1942499294910935045,1942499294910935044,1942499294910935042,1942499294843826179,1942499294843826178,1942499294843826177,1942499294910935043,1942499294776717313,1942499644535517188,1942499644661346306,1942499644598431747,1942499644598431746,1942499644598431745,1942499644535517189,1942499644535517187,1942499644535517186,1942499644468408323,1942499644468408322,1942499644468408321,1942499643046539266");
        knowledgeMap.put("be5ec256-6e0b-424e-b551-8f65de491bab", "1942497531734609922,1942497531734609921,1942497531671695365,1942497531671695364,1942497531671695363,1942497531541671941,1942497531671695362,1942497531604586502,1942497531604586501,1942497531604586499,1942497531604586498,1942497531541671940,1942497531541671939,1942497531541671938,1942497531478757377,1942497529507434498,1942497531604586500,1942499475626745858,1942499475626745857,1942499475563831300,1942499475563831299,1942499475563831298,1942499475500916739,1942499475500916738,1942499475500916737,1942499475433807875,1942499475433807874,1942499475433807873,1942499475370893315,1942499475370893314,1942499475370893313,1942499473777057793,1942499475303784450,1942499475433807876");
        knowledgeMap.put("f055261a-dbf6-457a-9f8c-5842db0baa85", "1942500049596239877,1942500049596239876,1942500049470410755,1942500049596239875,1942500049596239874,1942500049596239873,1942500049533325318,1942500049533325316,1942500049533325315,1942500049533325314,1942500049470410754,1942500049470410753,1942500048090484737,1942500049533325317,1942501003330646017,1942501003330646018,1942501003267731460,1942501003267731459,1942501003267731458,1942501003267731457,1942501003204816899,1942501003204816898,1942501003204816897,1942501003141902341,1942501003141902339,1942501003141902340,1942501002944770049,1942501003011878914,1942501001132830721,1942501003011878915,1942501003011878916,1942501003011878917,1942501003078987777,1942501003078987778,1942501003078987779,1942501003141902338,1942503484144005122,1942503485670731777,1942503485733646338");
        knowledgeMap.put("ad759f15-d5d4-41ba-87b2-5a49ddabe21c", "1942500592188170243,1942500592125255686,1942500592188170244,1942500592188170245,1942500592255279106,1942500592255279107,1942500592255279108,1942500592255279109,1942500592255279110,1942500592318193666,1942500592318193667,1942500592188170242,1942500592188170241,1942500592125255685,1942500592125255684,1942500592125255683,1942500592125255682,1942500592058146821,1942500592058146820,1942500592058146819,1942500592058146818,1942500592058146817,1942500590757912578,1942500773491224579,1942500773491224578,1942500773491224577,1942500773424115715,1942500773424115714,1942500773361201154,1942500773424115716,1942500772031606785");
        knowledgeMap.put("1b33c070-4045-4e4e-ac46-72e45d0b3559", "1947925166154907650,1947925166154907649,1947925166091993090,1947925166091993089,1947925166024884228,1947925166024884227,1947925166024884226,1947925165961969668,1947925165961969667,1947925165961969665,1947925165894860804,1947925165894860803,1947925165894860802,1947925165827751940,1947925165827751939,1947925165827751938,1947925165764837379,1947925165764837378,1947925165961969666");
        knowledgeMap.put("fc97f00e-75c4-4e95-8efe-d0f661f650f8", "1942503484144005122,1942503485670731777,1942503485733646338");
        knowledgeMap.put("8d454770-4d5a-42e3-bdad-716b5eb9589d", "1947924898969354241,1947924859182186498,1947924897815920642,1947924896507297793,1947924895148343298,1947924893235740673,1947924703254740994");
        knowledgeMap.put("cbf43140-5dd8-4066-8763-ffd90ddc11da", "1947924910503690241,1947924939008180225,1947924937238183937,1947924934948093953,1947924932259545089,1947924929709408258,1947924928002326529,1947924926433656833,1947924924940484609,1947924922755252226,1947924920951701505,1947924916627374081,1947924914538610689,1947924912630202370,1947924902773587970,1947924909476085761,1947924908414926850,1947924907328602114,1947924906049339393,1947924904774270978,1947924918829383681");
        knowledgeMap.put("d5a450a8-6c27-4de4-a082-6746ff35d2ee", "1947924940740427777,1947924948952875009,1947924956078997505,1947924959430246401,1947924957874159617,1947924953717604354");
        knowledgeMap.put("03865715-2025-49d1-b16a-34794a3342ec", "1947924969072951297,1947924999980777474,1947924997514526721,1947924995266379777,1947924993169227777,1947924991088852994,1947924988723265537,1947924987041349634,1947924985439125506,1947924983690100737,1947924981932687361,1947924979969753089,1947924978342363137,1947924976786276353,1947924974852702210,1947924973296615426,1947924971925078018,1947924970561929217,1947924967269400577,1947924965541347329,1947924960814366721");
        knowledgeMap.put("37ad2159-50d2-4b4f-9c59-f1e1bb408cbb", "1947925166414954497,1947925166477869057,1947925166742110210,1947925166742110211");
        knowledgeMap.put("0195555a-41d0-4ecc-9024-8cda31993e16", "1947934304092086273,1947934304108863490,1947934304108863491,1947934304108863492,1947934304108863493,1947934304175972353,1947934304175972354,1947934304175972355,1947934304175972356,1947934304503128067,1947934304503128066,1947934304570236930,1947934304503128068,1947934304570236931,1947934304570236932,1947934304637345793,1947934304637345794");
        knowledgeMap.put("6b03e648-8f77-4816-9589-81bc6ae09693", "1947934305295851522,1947934305425874947,1947934305425874946,1947934305425874945,1947934305358766084,1947934305358766083,1947934305358766082,1947934305295851525,1947934305295851524,1947934305295851523,1947934305228742658,1947934305228742657,1947934305677533187,1947934305677533186,1947934306067603460,1947934306067603461,1947934306134712322,1947934306067603462,1947934306134712321,1947934306067603459,1947934306067603458,1947934306004688898");
        knowledgeMap.put("6f8d740e-bbea-4957-b675-f5650414fb23", "1947934306528976898,1947934306461868036,1947934306461868037,1947934306461868035,1947934306461868034");
        knowledgeMap.put("e286b0b3-86f6-42fe-afc1-7a08367a053a", "1947934307258785793,1947934307258785795,1947934307258785794,1947934307321700353,1947934307258785796,1947934307258785797,1947934307321700355,1947934307187482628,1947934307187482627,1947934307187482626,1947934307187482625,1947934307120373761,1947934307321700354,1947934307321700356,1947934307384614914,1947934307384614915,1947934307384614916,1947934307384614917,1947934307447529474,1947934307447529475,1947934307447529476,1947934307447529477,1947934307447529478,1947934307510444033,1947934307510444034,1947934307510444035,1947934307510444036,1947934307904708611,1947934307967623170,1947934307967623169,1947934307904708610,1947934308420608003,1947934308420608002,1947934308357693445,1947934308420608001,1947934308483522564,1947934308420608004,1947934308483522561,1947934308483522562,1947934308483522563,1947934308676460547,1947934308357693444,1947934308357693443,1947934308357693442,1947934308290584580,1947934308290584579,1947934308290584578,1947934308290584577,1947934308227670017,1947934308676460546,1947934308550631427,1947934308550631428,1947934308550631429,1947934308613545986,1947934308613545987,1947934308613545988,1947934308613545989,1947934308550631426,1947934309196554242,1947934309066530820,1947934309196554241,1947934309133639685,1947934309133639684,1947934309133639683,1947934309133639682,1947934309066530822,1947934309066530821,1947934309066530819,1947934309066530818,1947934309066530817,1947934308999421954,1947934308999421953,1947934309196554244,1947934309263663105,1947934309263663106,1947934309263663107,1947934309263663108,1947934309326577666,1947934309196554243,1947934309590818818");
        knowledgeMap.put("1e44dc75-a6c2-4a6a-a792-d0d8f27d41ff", "1947934311809605634,1947934311809605635,1947934311809605636,1947934311809605637,1947934312199675909,1947934312199675908,1947934312199675907,1947934312199675905,1947934312136761347,1947934312136761345,1947934312136761346,1947934312199675906,1947934312652660738,1947934312652660739,1947934312589746181,1947934312589746180,1947934312589746179,1947934312589746178,1947934312589746177");
        knowledgeMap.put("97c12bf5-2cd5-41f9-b78b-55ca12d0608c", "1947934313114034180,1947934313114034179,1947934313114034178,1947934313051119622,1947934313051119621,1947934313051119620,1947934313051119618,1947934312984010756,1947934312984010755,1947934312984010754,1947934313051119619,1947934312984010753,1947934312916901890");
        knowledgeMap.put("a4869108-d532-4b00-858b-71025cc7bd00", "1947934313114034180,1947934313114034179,1947934313114034178,1947934313051119622,1947934313051119621,1947934313051119620,1947934313051119618,1947934312984010756,1947934312984010755,1947934312984010754,1947934313051119619,1947934312984010753,1947934312916901890,1947934309590818818");
        knowledgeMap.put("1a793c4c-a0b2-4ecb-ae9b-846ba388a2e7", "1947925172278591490,1947925172345700356,1947925172345700355,1947925172345700354,1947925172278591491");
        knowledgeMap.put("3d2f8368-b1ac-415e-9fe8-7c19e461acd1", "1947925172668661762,1947925172668661763,1947925172668661764,1947925173050343427,1947925173050343426,1947925172987428865,1947925172987428866,1947925173369110529,1947925173369110530,1947925173436219393,1947925173436219394,1947925173503328257,1947925173897592834,1947925173830483972,1947925173830483971,1947925173830483970");
        knowledgeMap.put("c898c704-e075-447d-8e3c-ffcfb8b245c7", "1947925174484795394,1947925174484795395,1947925174484795396,1947925174551904258,1947925175403347970,1947925175470456833,1947925175403347971,1947925175403347969,1947925175336239108,1947925175336239107,1947925175336239105,1947925175273324548,1947925175273324547,1947925175210409986,1947925175273324546,1947925175210409987,1947925175336239106");
        knowledgeMap.put("b8da8b4c-9167-4c03-a9ac-14cc059ca337", "1947925175923441665,1947925175923441666,1947925175860527108,1947925175860527107,1947925175860527105,1947925175793418243,1947925175793418242,1947925175793418241,1947925175860527106");
        knowledgeMap.put("ad2cf5aa-0aa3-4804-9ade-1c3b28ad4005", "1947937997638152195,1947937997575237634,1947937997575237635,1947937997575237636,1947937997638152194,1947937997701066754,1947937997701066755,1947937998099525633,1947937998032416770,1947937998032416771,1947937998099525634,1947937998162440193,1947937998162440194,1947937998162440195,1947937998225354753,1947937998225354754,1947937998225354755,1947937998292463618,1947937998292463619");
        knowledgeMap.put("783f1bdd-6e17-4cd4-a7b9-a7a92f4a760b", "1947937998879666177,1947937998879666178,1947937998946775041,1947937998946775042,1947937999336845313,1947937999336845314,1947937999336845315,1947937999399759874,1947937999399759875,1947937999466868738,1947937999466868739,1947937999466868740,1947937999399759873");
        knowledgeMap.put("33093a6d-ae8f-4156-b6d1-cd8d5c3d834f", "1947937999861133313");
        knowledgeMap.put("fb57cb29-3918-4bac-a2f0-b1d4ab147214", "1947938001677266948,1947938001677266947,1947938001677266946,1947938001614352388,1947938001547243522,1947938001614352386,1947938001614352387,1947938002004422657,1947938002004422658,1947938002130251780,1947938002130251779,1947938002130251778,1947938002067337221,1947938002067337220,1947938002067337219,1947938002067337218,1947938002004422659,1947938002453213185,1947938002453213186");
        knowledgeMap.put("829a257a-4875-4161-825b-3be13cafe306", "1947938000830017538,1947938000767102980,1947938000767102979,1947938000767102978,1947938000704188417");
        knowledgeMap.put("59809d46-0a61-4098-8df1-9396e8d67de4", "1947938001677266948,1947938001677266947,1947938001677266946,1947938001614352388,1947938001547243522,1947938001614352386,1947938001614352387,1947938002004422657,1947938002004422658,1947938002130251780,1947938002130251779,1947938002130251778,1947938002067337221,1947938002067337220,1947938002067337219,1947938002067337218,1947938002004422659,1947938002453213185,1947938002453213186,1947938002914586626,1947938002784563201,1947938002847477762,1947938002847477763,1947938002847477764,1947938002914586625,1947938002914586628,1947938002914586627");
        knowledgeMap.put("8c51e31c-aff2-4c5f-a7f4-b4435ef358e5", "1947938001287196674,1947938001220087811,1947938001220087810,1947938001157173250,1947938003367571460,1947938003367571459,1947938003367571458,1947938003367571457,1947938003304656900,1947938003304656899,1947938003304656898,1947938003304656897,1947938003237548035,1947938003237548034");
        knowledgeMap.put("e4329a1c-1cb0-49f7-b8bd-17db08b3d5b7", "1947938004013494273,1947938004076408834,1947938004076408835,1947938004076408836,1947938004143517698,1947938004143517699,1947938004143517700,1947938004210626562,1947938004537782273,1947938004537782274,1947938004537782276,1947938004604891137,1947938004604891138,1947938004604891139,1947938004667805698,1947938004730720257,1947938004537782275,1947938004986572801,1947938005049487361,1947938005049487362,1947938005049487363");
        knowledgeMap.put("729d3a79-446e-453c-971d-c94750a300f9", "1947938005703798785,1947938005766713346,1947938005766713345,1947938005703798788,1947938005703798787,1947938005703798786,1947938006156783618,1947938006156783619,1947938006156783620,1947938006156783621,1947938006223892481");
        knowledgeMap.put("ba7c3dc2-ab3d-441f-9ab7-bda2390b4514", "1947925167715188738,1947925167715188739,1947925167782297601,1947925168109453314,1947925168109453315,1947925168109453316,1947925168109453317,1947925168176562177");
        knowledgeMap.put("8513f80a-93fd-408d-816a-b7c52daf3308", "1947925168562438146,1947925168499523588,1947925168499523587,1947925168499523586,1947925168436609028,1947925168436609027,1947925168436609026,1947925168499523585");
        knowledgeMap.put("6bccf216-6596-4d1f-8512-339290bfd2c5", "1947925169673928706,1947925169673928707,1947925169673928708,1947925171171295236,1947925171301318658,1947925171301318657,1947925171234209797,1947925171234209796,1947925171234209794,1947925171171295235,1947925171171295234,1947925171234209795");
        knowledgeMap.put("e9efd012-6c56-4135-86bd-98cc84e7272f", "1947925170001084417,1947925170068193282,1947925170068193283,1947925170391154691,1947925170458263555,1947925170458263554,1947925170458263553,1947925170391154692,1947925170391154690,1947925170328240130,1947925171171295236,1947925171301318658,1947925171301318657,1947925171234209797,1947925171234209796,1947925171234209794,1947925171171295235,1947925171171295234,1947925171234209795");
        knowledgeMap.put("38ae49cd-8cfe-4d83-b114-3a2c6dcdb4f3", "1947925170781224962,1947925170781224963,1947925170781224964,1947925171620085761,1947925171687194625,194792517168719462a,194792517168719462b,194792517168719462c");
        return knowledgeMap.getOrDefault(nodeId, "");
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

    @Override
    public void onResume() {
        super.onResume();
        preformResourcesChecks();
        updateLearnPackages();
    }
}