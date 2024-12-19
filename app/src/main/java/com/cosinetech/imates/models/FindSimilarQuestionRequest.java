package com.cosinetech.imates.models;

import androidx.annotation.NonNull;

import com.cosinetech.imates.Subject;
import com.cosinetech.imates.webservice.Question;
import com.google.gson.Gson;
import com.google.gson.annotations.SerializedName;

// 添加到习题列表的结构
public class FindSimilarQuestionRequest {
    @SerializedName("title")
    private String title;

    @SerializedName("imgName")
    private String imgName;

    @SerializedName("imgTitleUrl")
    private String imgTitleUrl;

    @SerializedName("options")
    private String options;

    @SerializedName("select")
    private String select;

    @SerializedName("imgUrl")
    private String imgUrl;

    @SerializedName("answer")
    private String answer;

    @SerializedName("explanation")
    private String explanation;

    @SerializedName("bmNo")
    private String bmNo;

    @SerializedName("exercisesId")
    private String exercisesId;

    @SerializedName("type")
    private String type;

    public String getKnowledgeNo() {
        return knowledgeNo;
    }

    public void setKnowledgeNo(String knowledgeNo) {
        this.knowledgeNo = knowledgeNo;
    }

    @SerializedName("knowledgeNo")
    private String knowledgeNo;

    // Getters and Setters
    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getImgName() {
        return imgName;
    }

    public void setImgName(String imgName) {
        this.imgName = imgName;
    }

    public String getImgTitleUrl() {
        return imgTitleUrl;
    }

    public void setImgTitleUrl(String imgTitleUrl) {
        this.imgTitleUrl = imgTitleUrl;
    }

    public String getOptions() {
        return options;
    }

    public void setOptions(String options) {
        this.options = options;
    }

    public String getSelect() {
        return select;
    }

    public void setSelect(String select) {
        this.select = select;
    }

    public String getImgUrl() {
        return imgUrl;
    }

    public void setImgUrl(String imgUrl) {
        this.imgUrl = imgUrl;
    }

    public String getAnswer() {
        return answer;
    }

    public void setAnswer(String answer) {
        this.answer = answer;
    }

    public String getExplanation() {
        return explanation;
    }

    public void setExplanation(String explanation) {
        this.explanation = explanation;
    }

    public String getBmNo() {
        return bmNo;
    }

    public void setBmNo(String bmNo) {
        this.bmNo = bmNo;
    }

    public String getExercisesId() {
        return exercisesId;
    }

    public void setExercisesId(String exercisesId) {
        this.exercisesId = exercisesId;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    private void emitNull() {
        if(title == null){
            title = "";
        }
        if(imgName == null) {
            imgName = "";
        }
        if(imgTitleUrl == null) {
            imgTitleUrl = "";
        }
        if(options == null) {
            options = "";
        }
        if(select == null) {
            select = "";
        }
        if(imgUrl == null) {
            imgUrl = "";
        }
        if(answer == null) {
            answer = "";
        }
        if(explanation == null) {
            explanation = "";
        }
        if(bmNo == null) {
            bmNo = "";
        }
        if(exercisesId == null) {
            exercisesId = "";
        }
        if(type == null) {
            type = "";
        }

        if(knowledgeNo == null) {
            knowledgeNo = "";
        }
    }

    @NonNull
    @Override
    @Deprecated
    public String toString() {
        emitNull();
        return new Gson().toJson(this);
    }

    public String toJsonString() {
        emitNull();
        return new Gson().toJson(this);
    }

    public static FindSimilarQuestionRequest fromQuestion(Question q, String existingBMids, String subject) {
        FindSimilarQuestionRequest item = new FindSimilarQuestionRequest();
        item.setTitle(q.title);
        item.setImgName(q.titleImg);
        item.setImgTitleUrl(q.titleImg);
        item.setOptions(q.title);
        item.setSelect("");
        item.setImgUrl("");
        item.setAnswer(q.answer);
        item.setExplanation(q.explanation);
        item.setExercisesId(existingBMids);
        item.setBmNo(q.bmNo);
        item.setType(subject);
        return item;
    }

    public static FindSimilarQuestionRequest fromKnowledgeId(String knowledgeNos, String existingBMids, String subject) {
        FindSimilarQuestionRequest item = new FindSimilarQuestionRequest();
        item.setKnowledgeNo(knowledgeNos);
        item.setExercisesId(existingBMids);
        item.setType(subject);
        return item;
    }
}
