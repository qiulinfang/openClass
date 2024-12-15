package com.cosinetech.imates.webservice;
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

            if(q.titleImg == null) {
                q.titleImg = "";
            }

            if(q.ref == null) {
                q.ref  ="";
            }

            if(q.answer == null) {
                q.answer = "";
            }
            if(q.imgPath == null) {
                q.imgPath = "";
            }
            if(q.options == null) {
                q.options = new ArrayList<>();
            }
            if(q.optionsImg == null) {
                q.optionsImg = new ArrayList<>();
            }
//            if(q.optionsFileName == null) {
//                q.optionsFileName = new ArrayList<>();
//            }
            if(q.options1 == null) {
                q.options1 = new ArrayList<>();
            }
            if(q.fullText == null) {
                q.fullText = "";
            }
            if(q.title == null) {
                q.title = "";
            }
            if(q.explanation == null) {
                q.explanation = "";
            }
            if(q.reasonData == null) {
                q.reasonData = "";
            }
        }
        return question;
    }
}
