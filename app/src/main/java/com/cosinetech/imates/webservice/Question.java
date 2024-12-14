package com.cosinetech.imates.webservice;

import com.google.gson.annotations.Expose;
import com.google.gson.annotations.SerializedName;

import java.util.ArrayList;
import java.util.List;

public class Question {
    @Expose
    @SerializedName("bmNo")
    public String bmNo = "";

    @Expose
    @SerializedName("titleImg")
    public String titleImg = "";

    @Expose
    @SerializedName("ref")
    public String ref = "";

    @Expose
    @SerializedName("answer")
    public String answer = "";

    @Expose
    @SerializedName("imgPath")
    public String imgPath = "";

    @Expose
    @SerializedName("optionsFileName")
    public List<String> optionsFileName = new ArrayList<>();

    @Expose
    @SerializedName("options")
    public List<String> options = new ArrayList<>();

    @Expose
    @SerializedName("options1")
    public List<String> options1 = new ArrayList<>();

    @Expose
    @SerializedName("optionsImg")
    public List<String> optionsImg = new ArrayList<>();

    @Expose
    @SerializedName("imgUrl")
    public List<String> imgUrl = new ArrayList<>();

    @Expose
    @SerializedName("fullText")
    public String fullText = "";

    @Expose
    @SerializedName("title")
    public String title = "";

    @Expose
    @SerializedName("explanation")
    public String explanation = "";

    @Expose
    @SerializedName("reasonData")
    public String reasonData = "";

    @Expose
    @SerializedName("id")
    public String id = "";

    @Expose
    @SerializedName("DAJX")
    public String DAJX = "";

    private void emitNull() {
        if(this.bmNo == null) {
            this.bmNo = "";
        }

        if(this.titleImg == null) {
            this.titleImg = "";
        }

        if(this.ref == null) {
            this.ref  ="";
        }

        if(this.answer == null) {
            this.answer = "";
        }
        if(this.imgPath == null) {
            this.imgPath = "";
        }
        if(this.options == null) {
            this.options = new ArrayList<>();
        }
        if(this.optionsImg == null) {
            this.optionsImg = new ArrayList<>();
        }
        if(this.imgUrl == null) {
            this.imgUrl = new ArrayList<>();
        }

        if(this.optionsFileName == null) {
            this.optionsFileName = new ArrayList<>();
        }
        if(this.options1 == null) {
            this.options1 = new ArrayList<>();
        }
        if(this.fullText == null) {
            this.fullText = "";
        }
        if(this.title == null) {
            this.title = "";
        }
        if(this.explanation == null) {
            this.explanation = "";
        }
        if(this.reasonData == null) {
            this.reasonData = "";
        }
        if(this.id == null) {
            this.id = "";
        }

        if(this.DAJX == null) {
            this.DAJX = "";
        }

    }

    public String getQuestion() {
        StringBuilder result = new StringBuilder();
        emitNull();
        try {
            result.append(title).append("\n\n");
            if (!titleImg.trim().isEmpty()) {
                result.append("![alt 图片](").append(ApiUrl.URL_RESOURCE_BASE).append("/").append(titleImg.replace("\\", "/")).append(")").append("\n\n");
            }

            for (int i = 0; i < options.size(); i++) {
                result.append(options.get(i));
                final List<String> optImg = optionsImg.isEmpty() ? imgUrl : optionsImg;
                if (optImg.size() >= i + 1 && !optImg.get(i).trim().isEmpty()) { // 选项中的图片
                    result.append("![alt 图片](").append(ApiUrl.URL_RESOURCE_BASE).append("/").append(optImg.get(i).replace("\\", "/")).append(")");
                }
                result.append("\n\n");
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return result.toString();
    }

    public String getAnswer() {
        emitNull();
        return answer;
    }

    public String getAnalysis() {
        emitNull();
        return explanation;
    }
}
