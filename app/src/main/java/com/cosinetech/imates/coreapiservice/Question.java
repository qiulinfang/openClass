package com.cosinetech.imates.coreapiservice;

import com.cosinetech.imates.ui.views.MarkdownTextView;
import com.google.gson.annotations.Expose;
import com.google.gson.annotations.SerializedName;

public class Question {
    @Expose
    @SerializedName("bmNo")
    public String bmNo = "";

    @Expose
    @SerializedName("title")
    public String title = "";

    //答案
    @Expose
    @SerializedName("answer")
    public String answer = "";

    //解析
    @Expose
    @SerializedName("explanation")
    public String aiExplanation = "";

    //AI详解
    @Expose
    @SerializedName("analysisData")
    public String answerAnalysis = "";

    @Expose
    @SerializedName("id")
    public String id = "";


    /// 和显示相关的属性
    // 题目是否已经加入了用户题库表
    public boolean atUserList = false;

    // 此题目是否已经开始引导
    public boolean isAiGuiding = false;

    //用户选择了这个题(知识点举一反三)
    public boolean userSelect = false;

    public boolean beginGuideToSolve = false;

    private void emitNull() {
        if(this.bmNo == null) {
            this.bmNo = "";
        }

        if(this.title == null) {
            this.title = "";
        }
        if(this.aiExplanation == null) {
            this.aiExplanation = "";
        }
        if(this.answerAnalysis == null) {
            this.answerAnalysis = "";
        }
        if(this.id == null) {
            this.id = "";
        }
    }

    public String getQuestion() {
        StringBuilder result = new StringBuilder();
        emitNull();
        result.append(title).append("  \n");
        return MarkdownTextView.filterLatexString(result.toString());
    }

    public String getAnswer() {
        emitNull();
        return answer;
    }

    public String getAiExplanation() {
        emitNull();
        return aiExplanation;
    }

    public String getAnswerAnalysis() {
        emitNull();
        return answerAnalysis;
    }
}
