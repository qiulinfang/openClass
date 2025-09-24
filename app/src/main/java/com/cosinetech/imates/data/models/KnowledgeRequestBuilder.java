package com.cosinetech.imates.data.models;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import com.cosinetech.imates.textbookservice.ChapterNode;

public class KnowledgeRequestBuilder {
    // 请求中的 param 项
    public static class KnowledgeParam {
        public String textbook_id;
        public String section_id;

        public KnowledgeParam(String textbook_id, String section_id) {
            this.textbook_id = textbook_id;
            this.section_id = section_id;
        }
    }

    // 整体请求体
    public static class KnowledgeRequest {
        public String subject;
        public List<KnowledgeParam> param;

        public KnowledgeRequest(String subject, List<KnowledgeParam> param) {
            this.subject = subject;
            this.param = param;
        }
    }

    /**
     * 递归收集某个节点及其所有后代的 id 到 set 中（保留插入顺序，且去重）
     */
    private static void collectSections(ChapterNode node, Set<String> out) {
        if (node == null) return;
        // 把当前节点 id 作为一个 section
        if (node.id != null) {
            out.add(node.id);
        }
        if (node.children != null) {
            for (ChapterNode child : node.children) {
                collectSections(child, out);
            }
        }
    }

    /**
     * 根据 root（教材节点）和外部 textbookId、subject 构建 KnowledgeRequest
     * 这里默认跳过 root 本身，收集 root.children 及其后代作为 section_id。
     */
    public static KnowledgeRequest buildRequestFromTree(ChapterNode root, String textbookId, String subject) {
        List<KnowledgeParam> params = new ArrayList<>();
        if (root == null) {
            return new KnowledgeRequest(subject, params);
        }

        // 使用 LinkedHashSet 保持遍历顺序且去重
        Set<String> sectionIds = new LinkedHashSet<>();

        // 如果你认为 root 也是一个 section，需要把下面一行改成 collectSections(root, sectionIds);
        collectSections(root, sectionIds);
        if (root.children != null) {
            for (ChapterNode child : root.children) {
                collectSections(child, sectionIds);
            }
        }

        for (String sid : sectionIds) {
            params.add(new KnowledgeParam(textbookId, sid));
        }

        return new KnowledgeRequest(subject, params);
    }
}
