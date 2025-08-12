package com.cosinetech.imates.coreapiservice;


import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.Strictness;
import com.google.gson.annotations.SerializedName;

import java.util.ArrayList;
import java.util.List;

public class SimilarExerciseResponse {
    @SerializedName("success")
    private boolean success;

    @SerializedName("code")
    private int code;

    @SerializedName("message")
    private String message;

    @SerializedName("pageNo")
    private long pageNo;

    @SerializedName("pageSize")
    private long pageSize;

    @SerializedName("totalCount")
    private long totalCount;

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

    public long getPageSize(){
        return  pageSize;
    }

    public void setPageSize(long pageSize) {
        this.pageSize = pageSize;
    }

    public long getPageNo() {
        return pageNo;
    }

    public void setPageNo(long pageNo) {
        this.pageNo = pageNo;
    }

    public long getTotalCount() {
        return totalCount;
    }

    public void setTotalCount(long totalCount) {
        this.totalCount = totalCount;
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

    public static SimilarExerciseResponse fromJson(String json) {
        Gson gson = new GsonBuilder()
                .setStrictness(Strictness.LENIENT)
                .create();
        SimilarExerciseResponse question = gson.fromJson(json, SimilarExerciseResponse.class);
        if(question.message == null) {
            question.message = "";
        }

        if(question.data == null) {
            question.data = new SimilarExerciseResponse.Data();
        }

        if(question.data.getQuestions() == null) {
            question.data.setQuestions(new ArrayList<>());
        }

        return question;
    }

    public static class Data {
        @SerializedName("questions")
        private List<Question> questions;

        // Getters and Setters
        public List<Question> getQuestions() {
            return questions;
        }

        public void setQuestions(List<Question> questionsList) {
            this.questions = questionsList;
        }
    }
}

