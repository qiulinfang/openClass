package com.cosinetech.imates.textbookservice;

import org.w3c.dom.Text;

public class TextbookVersion {
    public String id;
    public String textbookId;
    public int textbookGrade;
    public String textbookGradeLabel;
    public int textbookSemester;
    public String textbookSemesterLabel;
    public int textbookSubject;
    public String textbookSubjectLabel;
    public String textbookName;
    public String textbookEditionYear;
    public String textbookIsbn;
    public String textbookPublisher;
    public String textbookCover;
    public String textbookUpdateTime;

    public TextbookVersion() {
    }

    public TextbookVersion(UserTextbookInfo textbook) {
        this.id = textbook.versionId;
        this.textbookId = textbook.textbookId;
        this.textbookName = textbook.textbookName;
        this.textbookGrade = textbook.textbookGrade;
        this.textbookGradeLabel = textbook.textbookGradeLabel;
        this.textbookSubject = textbook.textbookSubject;
        this.textbookSubjectLabel = textbook.textbookSubjectLabel;
        this.textbookSemester = textbook.textbookSemester;
        this.textbookSemesterLabel = textbook.textbookSemesterLabel;
        this.textbookUpdateTime = textbook.textbookUpdateTime;
        this.textbookCover = textbook.textbookCover;
        this.textbookPublisher = textbook.textbookPublisher;
        this.textbookEditionYear = textbook.textbookEditionYear;
        this.textbookIsbn = textbook.textbookIsbn;
    }
}
