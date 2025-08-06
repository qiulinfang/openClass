package com.cosinetech.imates.models;

import com.google.gson.annotations.SerializedName;
import java.util.List;

public class TextbookVersion {
    @SerializedName("versionName")
    private String versionName;

    @SerializedName("books")
    private List<Textbook> books;

    public TextbookVersion() {}

    public TextbookVersion(String versionName, List<Textbook> books) {
        this.versionName = versionName;
        this.books = books;
    }

    public String getVersionName() { return versionName; }
    public void setVersionName(String versionName) { this.versionName = versionName; }

    public List<Textbook> getBooks() { return books; }
    public void setBooks(List<Textbook> books) { this.books = books; }
}
