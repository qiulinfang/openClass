package com.cosinetech.imates.textbookservice;

import java.util.List;

public class UserTextbookInfo {
    public String textbookId;
    public String textbookName;
    public String textbookSubjectLabel;
    public String textbookGradeLabel;
    public String textbookSemesterLabel;
    public String textbookUpdateTime;
    public String lastDownloadTime;
    public boolean isDownloaded;
    public long totalSize;
    public int totalFiles;
    public int downloadedFiles;
    
    public UserTextbookInfo() {}
    
    public UserTextbookInfo(TextbookVersion textbook) {
        this.textbookId = textbook.id;
        this.textbookName = textbook.textbookName;
        this.textbookSubjectLabel = textbook.textbookSubjectLabel;
        this.textbookGradeLabel = textbook.textbookGradeLabel;
        this.textbookSemesterLabel = textbook.textbookSemesterLabel;
        this.textbookUpdateTime = textbook.textbookUpdateTime;
        this.isDownloaded = false;
        this.totalSize = 0;
        this.totalFiles = 0;
        this.downloadedFiles = 0;
    }
}
