package com.cosinetech.imates.coreapiservice;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.Strictness;
import com.google.gson.annotations.Expose;
import com.google.gson.annotations.SerializedName;

import java.util.ArrayList;
import java.util.List;

public class QuestionImageResponse {
    @Expose
    @SerializedName("success")
    public boolean success = false;

    @Expose
    @SerializedName("code")
    public int code = 0;

    @Expose
    @SerializedName("message")
    public String message = "";

    @Expose
    @SerializedName("data")
    public Data data = new Data();

    public static class Data {
        @Expose
        @SerializedName("item")
        public Item item = new Item();

        public static class Item {

            @Expose
            @SerializedName("questionsConfirm")
            public List<Question> questionsConfirm = new ArrayList<>();
        }
    }

    public static QuestionImageResponse fromJson(String json) {
        Gson gson = new GsonBuilder()
                .setStrictness(Strictness.LENIENT)
                .create();
        QuestionImageResponse question = gson.fromJson(json, QuestionImageResponse.class);
        if(question.message == null) {
            question.message = "";
        }
        if(question.data == null) {
            question.data = new Data();
        }

        if(question.data.item == null) {
            question.data.item = new Data.Item();
        }

        if(question.data.item.questionsConfirm == null) {
            question.data.item.questionsConfirm = new ArrayList<>();
        }

        for(Question q : question.data.item.questionsConfirm) {
            if(q.bmNo == null) {
                q.bmNo = "";
            }

            if(q.answer == null) {
                q.answer = "";
            }

            if(q.title == null) {
                q.title = "";
            }
            if(q.aiExplanation == null) {
                q.aiExplanation = "";
            }
            if(q.answerAnalysis == null) {
                q.answerAnalysis = "";
            }
        }
        return question;
    }
}
