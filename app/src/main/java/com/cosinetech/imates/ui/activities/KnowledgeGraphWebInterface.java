package com.cosinetech.imates.ui.activities;

import android.content.Context;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

import com.cosinetech.imates.coreapiservice.ApiUrl;
import com.cosinetech.imates.data.models.Subject;
import com.cosinetech.imates.textbookservice.ChapterNode;
import com.cosinetech.imates.textbookservice.LearnResourceManager;
import com.cosinetech.imates.textbookservice.LocalPackageInfo;
import com.cosinetech.imates.textbookservice.UserTextbookInfo;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

import java.util.ArrayList;
import java.util.LinkedList;
import java.util.List;
import java.util.Queue;

public class KnowledgeGraphWebInterface {
    // ========== 属性 ==========
    private final Context context;
    private String mMindData = "";
    private UserTextbookInfo mCurrentUserTextbookInfo;
    private List<LocalPackageInfo> mLearnPackages = new ArrayList<>();

    // ========== 构造函数 ==========
    public KnowledgeGraphWebInterface(Context context) {
        this.context = context;
    }

    // ========== 公共设置方法 ==========
    // 传入用于在网页上渲染思维导图的 JSON 字符串
    public void updateMindData(String mindData) {
        mMindData = mindData;
    }

    //传入当前课本的数据结构
    public void setCurrentUserTextbookInfo(UserTextbookInfo textbookInfo) {
        mCurrentUserTextbookInfo = textbookInfo;
    }

    //传入当前课本关联的学习套餐
    public void setLearnPackages(List<LocalPackageInfo> packages) {
        mLearnPackages = packages != null ? packages : new ArrayList<>();
    }

    // ========== JavaScript接口方法 ==========
    // 图谱数据
    @JavascriptInterface
    public String getMindData() {
        return mMindData;
    }

    // “预习”按钮
    @JavascriptInterface
    public void onPrepareLesson(String nodeId, String nodeName) {
        //启动新的预习页面
        new Handler(Looper.getMainLooper()).post(() -> startPreviewLessonActivity(nodeId, nodeName));
    }

    // “复习/练习”节点
    @JavascriptInterface
    public void onReviewLesson(String nodeId, String nodeName) {
        // 找练习题
        if (mCurrentUserTextbookInfo == null) {
            Toast.makeText(context, "当前课本没有练习题", Toast.LENGTH_SHORT).show();
            return;
        }

        // 在课本的树形结构中查找用户点击的节点
        ChapterNode node = findChapterNodeById(mCurrentUserTextbookInfo.structure, nodeId);
        if (node == null) {
            Toast.makeText(context, "选择小节去练习", Toast.LENGTH_SHORT).show();
            return;
        }

        // 收集知识点
        List<String> knowledgeIds = getAllKnowledgeLists(mCurrentUserTextbookInfo.structure, nodeId);
        StringBuilder knowledgeId = new StringBuilder();
        for (String id : knowledgeIds) {
            knowledgeId.append(id).append(",");
        }

        if (knowledgeId.toString().trim().isEmpty()) {
            Toast.makeText(context, "没有相关的习题", Toast.LENGTH_SHORT).show();
        } else {
            // 启动新的习题页面
            new Handler(Looper.getMainLooper()).post(() -> startFindExerciseActivity(knowledgeId.toString().trim()));
        }
    }

    // ========== 业务逻辑方法 ==========
    public List<String> getAllKnowledgeLists(List<ChapterNode> roots, String targetId) {
        List<String> knowledgeLists = new ArrayList<>();

        ChapterNode targetNode = findChapterNodeById(roots, targetId);

        if (targetNode == null) {
            return knowledgeLists; // return empty list if node not found
        }

        // Add knowledge lists recursively
        addKnowledgeListsRecursive(targetNode, knowledgeLists);

        return knowledgeLists;
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

    // ========== Activity跳转方法 ==========
    //启动新的预习页面
    public void startPreviewLessonActivity(String sectionId, String sectionName) {
        Intent previewLessonActivity = new Intent(context, LessonPreviewActivity.class);
        previewLessonActivity.putExtra(LessonPreviewActivity.KEY_PREVIEW_SECTION_NAME, sectionName);
        Gson gson = new GsonBuilder()
                .setDateFormat("yyyy-MM-dd HH:mm:ss")
                .create();
        if (!mLearnPackages.isEmpty()) {
            previewLessonActivity.putExtra(LessonPreviewActivity.KEY_LEARN_PACKAGE, gson.toJson(mLearnPackages));
            context.startActivity(previewLessonActivity);
        } else {
            Toast.makeText(context, "选择小节去学习", Toast.LENGTH_SHORT).show();
        }
    }

    // 启动新的练习页面
    public void startFindExerciseActivity(String knowledgeList) {
        Intent intent = new Intent(context, FindExerciseActivity.class);
        intent.putExtra(FindExerciseActivity.KEY_CHATBOT_URL, ApiUrl.URL_CHAT_MATH);
        intent.putExtra(FindExerciseActivity.KEY_PARAM_SUBJECT, Subject.SUBJECT_MATH.name());
        intent.putExtra(FindExerciseActivity.KEY_KNOWLEDGE_LIST, knowledgeList);
        context.startActivity(intent);
    }

    // ========== 私有辅助方法 ==========
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
}