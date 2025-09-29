package com.cosinetech.imates.ui.webview.findexercise;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import androidx.annotation.NonNull;
import androidx.lifecycle.ViewModelProvider;
import androidx.lifecycle.ViewModelStoreOwner;

import com.cosinetech.imates.R;
import com.cosinetech.imates.data.models.Subject;
import com.cosinetech.imates.data.models.UserInfoViewModel;
import com.cosinetech.imates.ui.activities.BaseActivity;
import com.cosinetech.imates.ui.activities.ExerciseSolveActivity;
import com.cosinetech.imates.ui.activities.KnowledgeGraphActivity;
import com.cosinetech.imates.ui.webview.common.KeyboardAwareWebView;
import com.cosinetech.imates.ui.webview.common.WebAppInterface;
import com.cosinetech.imates.ui.webview.common.WebViewConfig;
import com.cosinetech.imates.ui.webview.exercisesolve.ExerciseSolveWebViewActivity;
import com.cosinetech.imates.utils.WindowUtils;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

/**
 * 习题查找功能的WebView实现
 * 使用混合开发模式，集成Vue.js前端
 */
public class FindExerciseWebViewActivity extends BaseActivity implements WebAppInterface.FindExerciseActivityBridge {

    private static final String TAG = "FindExerciseWebView";
    
    /**
     * 安全启动FindExerciseWebViewActivity的静态方法
     */
    public static void startActivity(Context context, String chatBotUrl, Subject subject, String knowledgeList) {
        Intent intent = new Intent(context, FindExerciseWebViewActivity.class);
        intent.putExtra(ExerciseSolveActivity.KEY_CHATBOT_URL, chatBotUrl != null ? chatBotUrl : "");
        intent.putExtra(ExerciseSolveActivity.KEY_SUBJECT, 
                subject != null ? subject.name() : Subject.SUBJECT_MATH.name());
        intent.putExtra(KEY_KNOWLEDGE_LIST, knowledgeList != null ? knowledgeList : "");
        context.startActivity(intent);
    }

    // Intent参数键
    public static final String KEY_KNOWLEDGE_LIST = "KEY_KNOWLEDGE_LIST";
    
    private KeyboardAwareWebView webView;
    private WebAppInterface webAppInterface;
    private UserInfoViewModel userInfoViewModel;
    private String chatBotUrl;
    private Subject subject;
    private String knowledgeList;
    private Gson gson = new Gson();

    @Override
    protected int getLayoutResId() {
        return R.layout.activity_webview;
    }

    @Override
    protected int getCurrentNavItemId() {
        return R.id.nav_textbook_knowledge;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // 立即输出调试信息
        Log.e(TAG, "🚨🚨🚨 FindExerciseWebViewActivity onCreate 被调用 🚨🚨🚨");
        
        // 获取传入参数并进行空值检查
        chatBotUrl = getIntent().getStringExtra(ExerciseSolveActivity.KEY_CHATBOT_URL);
        String subjectString = getIntent().getStringExtra(ExerciseSolveActivity.KEY_SUBJECT);
        knowledgeList = getIntent().getStringExtra(KEY_KNOWLEDGE_LIST);

        // 检查subject参数是否为空
        if (subjectString == null || subjectString.isEmpty()) {
            subject = Subject.SUBJECT_MATH; // 默认数学科目
            Log.w(TAG, "Subject parameter is null, using default: MATH");
        } else {
            try {
                subject = Subject.valueOf(subjectString);
            } catch (IllegalArgumentException e) {
                subject = Subject.SUBJECT_MATH;
                Log.w(TAG, "Invalid subject: " + subjectString + ", using default: MATH");
            }
        }

        // 初始化ViewModel
        ViewModelStoreOwner owner = (ViewModelStoreOwner) getApplication();
        userInfoViewModel = new ViewModelProvider(
                owner,
                new ViewModelProvider.AndroidViewModelFactory(getApplication())).get(UserInfoViewModel.class);

        // 初始化WebView
        initWebView();
    }

    /**
     * 初始化WebView
     */
    private void initWebView() {
        webView = findViewById(R.id.webview);
        
        // 启用WebView调试（重要：这样就能在Chrome DevTools中看到console.log）
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.KITKAT) {
            WebView.setWebContentsDebuggingEnabled(true);
        }
        
        // 配置WebView
        WebViewConfig.configureWebView(webView, this);
        
        // 禁用缩放功能 - 确保与 ExerciseSolveView.vue 用户体验一致
        android.webkit.WebSettings settings = webView.getSettings();
        settings.setSupportZoom(false);           // 禁用缩放支持
        settings.setBuiltInZoomControls(false);   // 禁用内置缩放控件
        settings.setDisplayZoomControls(false);   // 隐藏缩放控件UI
        
        // 创建WebAppInterface
        webAppInterface = new WebAppInterface(this);
        webAppInterface.setFindExerciseBridge(this); // 设置桥接器
        webView.addJavascriptInterface(webAppInterface, "Android");
        
        // 设置WebViewClient
        webView.setWebViewClient(new FindExerciseWebViewClient(this) {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                Log.i(TAG, "页面加载完成，注入配置参数");
                
                // 构建配置参数
                String configJson = buildConfigJson();
                
                // 注入配置参数到页面
                String injectScript = String.format(
                    "if (typeof window !== 'undefined') { " +
                    "window.AndroidConfig = %s; " +
                    "console.log('Android配置已注入:', window.AndroidConfig); " +
                    "} else { " +
                    "console.error('window对象未定义'); " +
                    "}", configJson);
                
                // 延迟注入，确保Vue应用已完全加载
                view.postDelayed(() -> {
                    webView.evaluateJavascript(injectScript, null);
                }, 100);
            }
        });
        
        // 加载Vue应用
        loadVueApp();
    }

    /**
     * 加载Vue应用
     */
    private void loadVueApp() {
        try {
            // 直接加载现有的HTML文件
            String url = "file:///android_asset/findExercise/index.html";
            Log.i(TAG, "加载Vue应用: " + url);
            
            // 加载HTML文件
            webView.loadUrl(url);
                    
        } catch (Exception e) {
            Log.e(TAG, "加载Vue应用失败", e);
            // 显示错误页面
            showErrorPage();
        }
    }

    /**
     * 构建配置JSON
     */
    private String buildConfigJson() {
        try {
            FindExerciseConfig config = new FindExerciseConfig();
            config.apiBaseURL = "http://www.imates.com.cn:8222/blw-edu-service-alc";
            config.subject = subject.name();
            config.token = userInfoViewModel.token.getValue();
            config.knowledgeList = knowledgeList;
            
            return gson.toJson(config);
        } catch (Exception e) {
            Log.e(TAG, "构建配置JSON失败", e);
            return "{}";
        }
    }


    /**
     * 显示错误页面
     */
    private void showErrorPage() {
        String errorHtml = """
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>加载失败</title>
            </head>
            <body style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: Arial, sans-serif;">
                <div style="text-align: center;">
                    <h2>页面加载失败</h2>
                    <p>请检查网络连接或稍后重试</p>
                    <button onclick="window.Android.finishActivity()" style="padding: 10px 20px; margin-top: 20px;">返回</button>
                </div>
            </body>
            </html>
            """;
        webView.loadDataWithBaseURL(null, errorHtml, "text/html", "UTF-8", null);
    }

    // ==================== WebAppInterface.FindExerciseActivityBridge 实现 ====================

    @Override
    public void startExerciseSolve() {
        Log.i(TAG, "启动练习页面");
        Intent intent = new Intent(this, ExerciseSolveActivity.class);
        intent.putExtra(ExerciseSolveActivity.KEY_CHATBOT_URL, chatBotUrl);
        intent.putExtra(ExerciseSolveActivity.KEY_SUBJECT, subject.name());
        startActivity(intent);
    }

    /**
     * 启动练习页面 - WebView版本
     * 跳转到 ExerciseSolveWebViewActivity
     */
    @Override
    public void startExerciseSolveWebView() {
        Log.i(TAG, "🚀 启动练习页面 - WebView版本");
        Log.i(TAG, "🚀 chatBotUrl: " + chatBotUrl);
        Log.i(TAG, "🚀 subject: " + (subject != null ? subject.name() : "null"));
        
        try {
            Intent intent = new Intent(this, ExerciseSolveWebViewActivity.class);
            intent.putExtra(ExerciseSolveActivity.KEY_CHATBOT_URL, chatBotUrl);
            intent.putExtra(ExerciseSolveActivity.KEY_SUBJECT, subject.name());
            intent.putExtra(ExerciseSolveActivity.KEY_SHOW_LAST_QUESTION, false);
            
            Log.i(TAG, "🚀 准备启动 ExerciseSolveWebViewActivity");
            startActivity(intent);
            Log.i(TAG, "🚀 ExerciseSolveWebViewActivity 启动成功");
        } catch (Exception e) {
            Log.e(TAG, "🚀 启动 ExerciseSolveWebViewActivity 失败", e);
        }
    }

    @Override
    public void finishActivity() {
        Log.i(TAG, "🔙 关闭习题查找页面，返回到知识图谱");
        
        try {
            // 创建Intent返回到知识图谱页面
            Intent intent = new Intent(this, KnowledgeGraphActivity.class);
            // 清除任务栈，确保返回到知识图谱页面
            intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            startActivity(intent);
            
            // 关闭当前Activity
            finish();
            
            Log.i(TAG, "🔙 成功返回到知识图谱页面");
        } catch (Exception e) {
            Log.e(TAG, "🔙 返回到知识图谱页面失败", e);
            // 备用方案：直接关闭当前Activity
            finish();
        }
    }

    @Override
    public void showToast(String message) {
        runOnUiThread(() -> {
            // 这里可以显示Toast消息
            Log.i(TAG, "Toast: " + message);
        });
    }

    // ==================== 内部类 ====================

    /**
     * 配置类
     */
    public static class FindExerciseConfig {
        public String apiBaseURL;
        public String subject;
        public String token;
        public String knowledgeList;
    }
}
