package com.cosinetech.imates.model;

import androidx.annotation.NonNull;

import com.google.gson.Gson;
import com.google.gson.annotations.SerializedName;

import java.util.ArrayList;
import java.util.List;

// 添加到习题列表的结构
public class ExerciseToAddList {
    @SerializedName("title")
    private String title;

    @SerializedName("imgName")
    private String imgName;

    @SerializedName("imgTitleUrl")
    private String imgTitleUrl;

    @SerializedName("options")
    private List<String> options;

    @SerializedName("select")
    private List<String> select;

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

    public List<String> getOptions() {
        return options;
    }

    public void setOptions(List<String> options) {
        this.options = options;
    }

    public List<String> getSelect() {
        return select;
    }

    public void setSelect(List<String> select) {
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

    @NonNull
    @Override
    public String toString() {
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
            options = new ArrayList<>();
        }
        if(select == null) {
            select = new ArrayList<>();
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
        return new Gson().toJson(this);
    }
}
