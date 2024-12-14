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

    public String getQuestion() {
        StringBuilder result = new StringBuilder();
        try {
            result.append(title).append("\n\n");
            if (!titleImg.trim().isEmpty()) {
                result.append("![alt 图片](").append(ApiUrl.URL_RESOURCE_BASE).append("/").append(titleImg.replace("\\", "/")).append(")").append("\n\n");
            }

            for (int i = 0; i < options.size(); i++) {
                result.append(options.get(i));
                if (optionsImg.size() >= i + 1 && !optionsImg.get(i).trim().isEmpty()) { // 选项中的图片
                    result.append("![alt 图片](").append(ApiUrl.URL_RESOURCE_BASE).append("/").append(optionsImg.get(i).replace("\\", "/")).append(")");
                }
                result.append("\n\n");
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return "";
    }

    public String getAnswer() {
        return answer;
    }

    public String getAnalysis() {
        return explanation;
    }
}
