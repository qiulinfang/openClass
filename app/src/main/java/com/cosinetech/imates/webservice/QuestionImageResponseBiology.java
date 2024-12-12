package com.cosinetech.imates.webservice;
import com.cosinetech.imates.EnumApiUrl;
import com.google.gson.annotations.SerializedName;
import java.util.List;
import java.util.Optional;

public class QuestionImageResponseBiology implements QuestionObject{
    @SerializedName("success")
    public boolean success;

    @SerializedName("code")
    public int code;

    @SerializedName("message")
    public String message;

    @SerializedName("data")
    public Data data;

    public class Data {
        @SerializedName("item")
        public Item item;

        public class Item {
            @SerializedName("questionsConfirm")
            public List<Question> questionsConfirm;

            public class Question {
                @SerializedName("bmNo")
                public String bmNo;

                @SerializedName("titleImg")
                public String titleImg;

                @SerializedName("ref")
                public String ref;

                @SerializedName("answer")
                public String answer;

                @SerializedName("imgPath")
                public String imgPath;

                @SerializedName("optionsFileName")
                public String optionsFileName;

                @SerializedName("options")
                public List<String> options;

                @SerializedName("fullText")
                public String fullText;

                @SerializedName("title")
                public String title;

                @SerializedName("explanation")
                public String explanation;
            }
        }
    }

    @Override
    public String getQuestion() {
        StringBuilder result = new StringBuilder();
        for (Data.Item.Question q: data.item.questionsConfirm
             ) {
            result.append(q.title).append("\n\n");
            if(!q.titleImg.trim().isEmpty()) {
                result.append("![alt 图片](").append(EnumApiUrl.URL_RESOURCE_BASE).append("/").append(q.titleImg).append(")").append("\n\n");
            }
            for (String opt: q.options
                 ) {
                result.append(opt).append("\n\n");
            }

            break;
        }
        return result.toString();
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
}
