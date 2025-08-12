package com.cosinetech.imates.coreapiservice;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.Strictness;
import com.google.gson.annotations.SerializedName;

import java.util.ArrayList;
import java.util.List;

public class QueryQuestionListResponse {
    @SerializedName("success")
    private boolean success;

    @SerializedName("code")
    private int code;

    @SerializedName("message")
    private String message;

    @SerializedName("data")
    private Data data;

    // Getters and Setters
    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public int getCode() {
        return code;
    }

    public void setCode(int code) {
        this.code = code;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public Data getData() {
        return data;
    }

    public void setData(Data data) {
        this.data = data;
    }

    public static QueryQuestionListResponse fromJson(String json) {
        Gson gson = new GsonBuilder()
                .setStrictness(Strictness.LENIENT)
                .create();
        QueryQuestionListResponse question = gson.fromJson(json, QueryQuestionListResponse.class);
        if(question.message == null) {
            question.message = "";
        }

        if(question.data == null) {
            question.data = new QueryQuestionListResponse.Data();
        }

        if(question.data.getQuestionsList() == null) {
            question.data.setQuestionsList(new ArrayList<>());
        }

        return question;
    }

    public static class Data {
        @SerializedName("questionsList")
        private List<Question> questionsList;

        // Getters and Setters
        public List<Question> getQuestionsList() {
            return questionsList;
        }

        public void setQuestionsList(List<Question> questionsList) {
            this.questionsList = questionsList;
        }
    }
}
