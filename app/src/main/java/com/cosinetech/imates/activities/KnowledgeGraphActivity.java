package com.cosinetech.imates.activities;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.MotionEvent;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import com.cosinetech.imates.R;
import com.cosinetech.imates.models.Chapter;
import com.cosinetech.imates.models.Subject;
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

public class KnowledgeGraphActivity extends BaseActivity {
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
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true); // 启用 DOM storage
        webView.getSettings().setSupportZoom(true);
        webView.getSettings().setBuiltInZoomControls(true);
        webView.getSettings().setDisplayZoomControls(false);
        // 设置WebViewClient以防止外部浏览器打开链接
        webView.setWebViewClient(new WebViewClient());
        // Add JavaScript interface
        webView.addJavascriptInterface(new KnowledgeGraphActivity.WebAppInterface(this), "Android");
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

        findViewById(R.id.btn_res_center).setOnClickListener(v -> {
            Intent intent = new Intent(KnowledgeGraphActivity.this, TextbookDownloadActivity.class);
            startActivity(intent);
        });
    }

    public class WebAppInterface {
        private Context context;

        WebAppInterface(Context context) {
            this.context = context;
        }

        @JavascriptInterface
        public void onPrepareLesson(String nodeId, String nodeName) {
            new Handler(Looper.getMainLooper()).post(()->startPreviewLessonActivity(nodeId, nodeName));
        }
        @JavascriptInterface
        public void onReviewLesson(String nodeId, String nodeName) {
            Chapter.Section s = getSection(nodeId);
            if(s == null) {
                Toast.makeText(context, "未查询到相关的学习资料", Toast.LENGTH_SHORT).show();
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
            Chapter.Section s = getSection(sectionId);
            if(s != null) {
                List<Chapter.Schema> validSchemas = new ArrayList<>();
                for (Chapter.Schema schema : s.getSchemas()) {
                    if(!schema.getTextBook().trim().isEmpty()) {
                        validSchemas.add(schema);
                    }
                }
                if(validSchemas.isEmpty()) {
                    Toast.makeText(context, "未查询到相关的课程", Toast.LENGTH_SHORT).show();
                    return;
                }
                s.setSchemas(validSchemas);
                Intent previewLessonActivity = new Intent(context, LessonPreviewActivity.class);
                previewLessonActivity.putExtra(LessonPreviewActivity.KEY_PREVIEW_SECTION_NAME, sectionName);
                previewLessonActivity.putExtra(LessonPreviewActivity.KEY_SECTION_SCHEMA, s);
                startActivity(previewLessonActivity);
            } else {
                Toast.makeText(context, "未查询到相关的课程", Toast.LENGTH_SHORT).show();
            }
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

}