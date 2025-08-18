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

import com.cosinetech.imates.R;
import com.cosinetech.imates.ui.adapters.TextbookVersionSpinnerAdapter;
import com.cosinetech.imates.data.models.Chapter;
import com.cosinetech.imates.data.models.Subject;
import com.cosinetech.imates.coreapiservice.ApiUrl;
import com.cosinetech.imates.textbookservice.*;
import com.cosinetech.imates.utils.AppUtils;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.lang.reflect.Type;
import java.util.ArrayList;
import java.util.List;

public class KnowledgeGraphActivity extends BaseActivity {
    private static final String TAG = "KnowledgeGraphActivity";

    private Spinner mTextbookVersionSpinner;
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
        mTextbookVersionSpinner = findViewById(R.id.textbook_version_spinner);
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

    private void checkUserLearnResources() {
        LearnResourceManager.getInstance().loadAllUserTextbooks(new LearnResourceManager.AllTextbooksCallback() {
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
        preformResourcesChecks();
    }

    private void preformResourcesChecks() {
        try {
            if (LearnResourceManager.getInstance().isLoggedIn()) {
                checkUserLearnResources();
                checkUpdateLearnResource();
            } else {
                LearnResourceManager.getInstance().login(AppUtils.getUserId(), AppUtils.getUserPassword(), new LearnResourceManager.LoginCallback() {
                    @Override
                    public void onSuccess(LoginResponse response) {
                        checkUserLearnResources();
                        checkUpdateLearnResource();
                    }

                    @Override
                    public void onError(String error) {
                        Toast.makeText(KnowledgeGraphActivity.this, "登录研伴失败, 无法获取在线资源", Toast.LENGTH_SHORT).show();
                    }
                });
            }
        } catch (Exception e) {
            Log.e(TAG, "Perform resource check:" + e.getMessage());
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
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
            new Handler(Looper.getMainLooper()).post(()->startPreviewLessonActivity(nodeId, nodeName));
        }
        @JavascriptInterface
        public void onReviewLesson(String nodeId, String nodeName) {
            Chapter.Section s = getSection(nodeId);
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

        public void startPreviewLessonActivity(String sectionId, String sectionName) {
            Intent previewLessonActivity = new Intent(context, LessonPreviewActivity.class);
            previewLessonActivity.putExtra(LessonPreviewActivity.KEY_PREVIEW_SECTION_NAME, sectionName);
            //previewLessonActivity.putExtra(LessonPreviewActivity.KEY_SECTION_SCHEMA, s);
            Gson gson = new GsonBuilder()
                    .setDateFormat("yyyy-MM-dd HH:mm:ss")
                    .create();
            previewLessonActivity.putExtra(LessonPreviewActivity.KEY_LEARN_PACKAGE, gson.toJson(mLearnPackages));
            startActivity(previewLessonActivity);
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

        public Chapter.Section getSection(String sectionId) {
            StringBuilder newstringBuilder = new StringBuilder();
            InputStream inputStream;
            try {
                inputStream = context.getResources().getAssets().open("math_learn_schema.json");
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
}