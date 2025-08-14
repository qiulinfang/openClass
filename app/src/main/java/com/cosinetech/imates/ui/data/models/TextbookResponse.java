package com.cosinetech.imates.ui.data.models;

import com.google.gson.annotations.SerializedName;
import java.util.List;

public class TextbookResponse {
    @SerializedName("textbooks")
    private List<TextbookVersionDisplayItem> textbooks;

    public TextbookResponse() {}

    public List<TextbookVersionDisplayItem> getTextbooks() { return textbooks; }
    public void setTextbooks(List<TextbookVersionDisplayItem> textbooks) { this.textbooks = textbooks; }
}
