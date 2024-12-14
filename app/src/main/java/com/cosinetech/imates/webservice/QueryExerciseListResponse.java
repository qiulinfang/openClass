package com.cosinetech.imates.webservice;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.Strictness;
import com.google.gson.annotations.SerializedName;

import java.util.ArrayList;
import java.util.List;

public class QueryExerciseListResponse {
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

    public static QueryExerciseListResponse fromJson(String json) {
        Gson gson = new GsonBuilder()
                .setStrictness(Strictness.LENIENT)
                .create();
        QueryExerciseListResponse question = gson.fromJson(json, QueryExerciseListResponse.class);
        if(question.message == null) {
            question.message = "";
        }
        if(question.data == null) {
            question.data = new QueryExerciseListResponse.Data();
        }

        if(question.data.getQuestionsList() == null) {
            question.data.setQuestionsList(new ArrayList<>());
        }

        for(Question q : question.data.getQuestionsList()) {
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
            if(q.optionsFileName == null) {
                q.optionsFileName = new ArrayList<>();
            }
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
