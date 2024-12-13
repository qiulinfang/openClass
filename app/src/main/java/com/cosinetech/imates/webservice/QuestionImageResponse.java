package com.cosinetech.imates.webservice;
import com.cosinetech.imates.EnumApiUrl;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.Strictness;
import com.google.gson.annotations.Expose;
import com.google.gson.annotations.SerializedName;

import java.util.ArrayList;
import java.util.List;

public class QuestionImageResponse implements QuestionObject{
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
            }
        }
    }

    @Override
    public String getQuestion() {
        StringBuilder result = new StringBuilder();
        try {
            for (Data.Item.Question q : data.item.questionsConfirm
            ) {
                result.append(q.title).append("\n\n");
                if (!q.titleImg.trim().isEmpty()) {
                    result.append("![alt 图片](").append(EnumApiUrl.URL_RESOURCE_BASE).append("/").append(q.titleImg.replace("\\", "/")).append(")").append("\n\n");
                }

                for (int i = 0; i < q.options.size(); i++) {
                    result.append(q.options.get(i));
                    if (q.optionsImg.size() >= i + 1 && !q.optionsImg.get(i).trim().isEmpty()) { // 选项中的图片
                        result.append("![alt 图片](").append(EnumApiUrl.URL_RESOURCE_BASE).append("/").append(q.optionsImg.get(i).replace("\\", "/")).append(")");
                    }
                    result.append("\n\n");
                }

                break;
            }

            return result.toString();
        } catch (Exception e) {
        }
        return "";
    }

    @Override
    public String getAnswer() {
        String result = "";
        for (Data.Item.Question q: data.item.questionsConfirm) {
            result = q.answer;
            break;
        }

        return result;
    }

    @Override
    public String getAnalysis() {
        String result = "";
        for (Data.Item.Question q: data.item.questionsConfirm) {
            result = q.explanation;
            break;
        }
        return result;
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

        for(Data.Item.Question q : question.data.item.questionsConfirm) {
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
}
