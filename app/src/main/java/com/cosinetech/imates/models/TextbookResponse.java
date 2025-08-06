package com.cosinetech.imates.models;

import com.google.gson.annotations.SerializedName;
import java.util.List;

public class TextbookResponse {
    @SerializedName("textbooks")
    private List<TextbookVersion> textbooks;

    public TextbookResponse() {}

    public List<TextbookVersion> getTextbooks() { return textbooks; }
    public void setTextbooks(List<TextbookVersion> textbooks) { this.textbooks = textbooks; }
}
