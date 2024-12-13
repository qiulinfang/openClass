package com.cosinetech.imates.model;

import com.google.gson.annotations.SerializedName;

import java.util.List;

public class BiologyQuestion {
    @SerializedName("bmNo")
    private String bmNo;

    @SerializedName("ref")
    private String ref;

    @SerializedName("TG")
    private String tg;

    @SerializedName("DAJX")
    private String dajx;

    @SerializedName("answer")
    private String answer;

    @SerializedName("imgTitleUrl")
    private String imgTitleUrl;

    @SerializedName("options")
    private List<String> options;

    @SerializedName("fullText")
    private String fullText;

    @SerializedName("id")
    private String id;

    @SerializedName("title")
    private String title;

    @SerializedName("explanation")
    private String explanation;

    // Getters and Setters
    public String getBmNo() {
        return bmNo;
    }

    public void setBmNo(String bmNo) {
        this.bmNo = bmNo;
    }

    public String getRef() {
        return ref;
    }

    public void setRef(String ref) {
        this.ref = ref;
    }

    public String getTg() {
        return tg;
    }

    public void setTg(String tg) {
        this.tg = tg;
    }

    public String getDajx() {
        return dajx;
    }

    public void setDajx(String dajx) {
        this.dajx = dajx;
    }

    public String getAnswer() {
        return answer;
    }

    public void setAnswer(String answer) {
        this.answer = answer;
    }

    public String getImgTitleUrl() {
        return imgTitleUrl;
    }

    public void setImgTitleUrl(String imgTitleUrl) {
        this.imgTitleUrl = imgTitleUrl;
    }

    public List<String> getOptions() {
        return options;
    }

    public void setOptions(List<String> options) {
        this.options = options;
    }

    public String getFullText() {
        return fullText;
    }

    public void setFullText(String fullText) {
        this.fullText = fullText;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getExplanation() {
        return explanation;
    }

    public void setExplanation(String explanation) {
        this.explanation = explanation;
    }

    // 获取markdown格式问题
    public String getQuestion() {
        return "";
    }
}
