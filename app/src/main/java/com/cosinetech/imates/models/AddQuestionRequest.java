package com.cosinetech.imates.models;

import androidx.annotation.NonNull;

import com.google.gson.Gson;
import com.google.gson.annotations.SerializedName;

// 添加到习题列表的结构
public class AddQuestionRequest {
    @SerializedName("bmNo")
    private String bmNo;

    @SerializedName("exercisesId")
    private String exercisesId;

    @SerializedName("type")
    private String type;


    // Getters and Setters
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
