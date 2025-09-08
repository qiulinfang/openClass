package com.cosinetech.imates.ui.activities;

import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.MotionEvent;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.AdapterView;
import android.widget.Button;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import com.cosinetech.imates.ApplicationModelShared;
import com.cosinetech.imates.R;
import com.cosinetech.imates.appenv.AppEnvConfig;
import com.cosinetech.imates.screencasting.H264MpegTSStreamerManager;
import com.cosinetech.imates.screencasting.ScreenCastingManager;
import com.cosinetech.imates.screencasting.UdpForwarderManager;
import com.cosinetech.imates.ui.adapters.TextbookVersionSpinnerAdapter;
import com.cosinetech.imates.data.models.Subject;
import com.cosinetech.imates.coreapiservice.ApiUrl;
import com.cosinetech.imates.textbookservice.*;
import com.cosinetech.imates.ui.robot.FloatingRobotService;
import com.cosinetech.imates.utils.AppUtils;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.lzf.easyfloat.EasyFloat;
import com.xuexiang.xupdate.easy.EasyUpdate;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Dictionary;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Queue;

public class KnowledgeGraphActivity extends BaseActivity {
    private static final String TAG = "KnowledgeGraphActivity";
    private final static String FLOAT_ACTION_TAG = "MAIN_FLOAT_ACTION";
    private long mCheckUpdateTick = 0;
    private final Handler mMainHandler = new Handler(Looper.getMainLooper());
    private final Runnable mCheckUpdateRunnable = new Runnable() {
        @Override
        public void run() {
            long tick = System.currentTimeMillis();
            if(tick - mCheckUpdateTick >= 3600000) {
                mCheckUpdateTick = tick;
                EasyUpdate.create(KnowledgeGraphActivity.this, ApiUrl.URL_APP_UPDATE)
                        .isAutoMode(false)
                        .update();
            }
            mMainHandler.postDelayed(this, 60000); // 每秒执行一次
        }
    };

    private TextView mTextViewUpdateBadge;
    private TextbookVersionSpinnerAdapter mTextbookVersionSpinnerAdapter;
    private List<UserTextbookInfo> mTextbookVersions;
    private UserTextbookInfo mCurrentUserTextbookInfo;

    private WebAppInterface mWebViewInterface;

    private List<LocalPackageInfo> mLearnPackages = new ArrayList<>();

    @Override
    protected int getLayoutResId() {
        return R.layout.activity_knowledge_graph;
    }

    @Override
    protected int getCurrentNavItemId() {
        return R.id.nav_textbook_knowledge;
    }

    @SuppressLint("ClickableViewAccessibility")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView webView = findViewById(R.id.knowledge_view);
        mTextViewUpdateBadge = findViewById(R.id.update_badge);
        mWebViewInterface = new KnowledgeGraphActivity.WebAppInterface(this);
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

        findViewById(R.id.btn_res_center).setOnClickListener(v -> {
            Intent intent = new Intent(KnowledgeGraphActivity.this, TextbookManagementActivity.class);
            startActivity(intent);
        });

        mTextbookVersions = new ArrayList<>();
        Spinner mTextbookVersionSpinner = findViewById(R.id.textbook_version_spinner);
        mTextbookVersionSpinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                mCurrentUserTextbookInfo = (UserTextbookInfo) parent.getItemAtPosition(position);
                new Thread(() -> {
                    getTextbookMindData(mCurrentUserTextbookInfo, mindData -> {
                        mWebViewInterface.updateMindData(mindData);
                        runOnUiThread(() -> {
                            webView.evaluateJavascript("refreshMindData()", null);
                        });

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

                    });

                }).start();
            }

            @Override
            public void onNothingSelected(AdapterView<?> parent) { }
        });
        mTextbookVersionSpinnerAdapter = new TextbookVersionSpinnerAdapter(this, mTextbookVersions);
        mTextbookVersionSpinner.setAdapter(mTextbookVersionSpinnerAdapter);

        Button btnGoExerciseList = findViewById(R.id.btn_my_exercise);
        btnGoExerciseList.setOnClickListener(v->{
            Intent intent = new Intent(this, ExerciseSolveActivity.class);
                intent.putExtra(ExerciseSolveActivity.KEY_CHATBOT_URL, ApiUrl.URL_CHAT_MATH);
                intent.putExtra(ExerciseSolveActivity.KEY_SUBJECT, Subject.SUBJECT_MATH.name());
            startActivity(intent);
        });

        miscellaneousInitialization();
    }

    private void miscellaneousInitialization() {
        stopFloatingWindowService();
        startFloatingWindowService();
        EasyUpdate.create(this, ApiUrl.URL_APP_UPDATE)
                .isAutoMode(false)
                .update();
        mCheckUpdateTick = System.currentTimeMillis();
        mMainHandler.postDelayed(mCheckUpdateRunnable, 60000);
    }

    private void promptToDownloadResource() {
        new AlertDialog.Builder(this)
                .setTitle("学习资源")
                .setIcon(android.R.drawable.ic_dialog_alert)
                .setMessage("没有学习资源, 请先下载资源再来学习")
                .setPositiveButton("确定", (dialog, which) -> {
                    Intent intent = new Intent(this, TextbookManagementActivity.class);
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
                Toast.makeText(KnowledgeGraphActivity.this, "加载本地资源失败:" + error, Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void checkUpdateLearnResource() {
        LearnResourceManager.getInstance().checkForUpdates(new LearnResourceManager.UpdateCheckCallback() {
            @Override
            public void onUpdateAvailable(List<TextbookVersion> updatedTextbooks) {
                runOnUiThread(() -> {
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

    @Override
    protected void onStop() {
        super.onStop();
    }

    @Override
    protected void onResume() {
        super.onResume();
        ApplicationModelShared app = (ApplicationModelShared) getApplication();
        if (app.getFloatingWindowService() != null) {
            app.getFloatingWindowService().showRobot();
        }
        preformResourcesChecks();
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
                        Toast.makeText(KnowledgeGraphActivity.this, "登录研伴失败, 无法获取在线资源", Toast.LENGTH_SHORT).show();
                    }
                });
            }
        } catch (Exception e) {
            Log.e(TAG, "Perform resource check:" + e.getMessage());
        }
    }

    private void startFloatingWindowService() {
        Intent intent = new Intent(this, FloatingRobotService.class);
        startService(intent);
    }

    private void stopFloatingWindowService() {
        Intent intent = new Intent(this, FloatingRobotService.class);
        stopService(intent);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        EasyFloat.dismiss(FLOAT_ACTION_TAG);
        stopFloatingWindowService();
        mMainHandler.removeCallbacksAndMessages(null); // 彻底清除
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
                LocalPackageInfo info = null;
                for (LocalPackageInfo pkg : mLearnPackages) {
                    if(pkg.sectionId != null && pkg.sectionId.toLowerCase().equals(sectionId.toLowerCase())) {
                        info = pkg;
                        break;
                    }
                }
                if(info != null) {
                    List<LocalPackageInfo> packages = new ArrayList<>();
                    packages.add(info);
                    previewLessonActivity.putExtra(LessonPreviewActivity.KEY_LEARN_PACKAGE, gson.toJson(packages));
                    startActivity(previewLessonActivity);
                } else {
                    Toast.makeText(context, "没有对应的学习资源", Toast.LENGTH_SHORT).show();
                }
            } else {
                Toast.makeText(context, "选择小节去学习", Toast.LENGTH_SHORT).show();
            }
//            Chapter.Section s = getSection(sectionId);
//            if(s != null) {
//                List<Chapter.Schema> validSchemas = new ArrayList<>();
//                for (Chapter.Schema schema : s.getSchemas()) {
//                    if(!schema.getTextBook().trim().isEmpty()) {
//                        validSchemas.add(schema);
//                    }
//                }
//                if(validSchemas.isEmpty()) {
//                    Toast.makeText(context, "选择小节去学习", Toast.LENGTH_SHORT).show();
//                    return;
//                }
//                s.setSchemas(validSchemas);
//                Intent previewLessonActivity = new Intent(context, LessonPreviewActivity.class);
//                previewLessonActivity.putExtra(LessonPreviewActivity.KEY_PREVIEW_SECTION_NAME, sectionName);
//                previewLessonActivity.putExtra(LessonPreviewActivity.KEY_SECTION_SCHEMA, s);
//                startActivity(previewLessonActivity);
//            } else {
//                Toast.makeText(context, "选择小节去学习", Toast.LENGTH_SHORT).show();
//            }
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
        return knowledgeMap.getOrDefault(nodeId, "");
    }
}