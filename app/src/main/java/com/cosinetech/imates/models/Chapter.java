package com.cosinetech.imates.models;

import java.util.List;
import android.os.Parcel;
import android.os.Parcelable;

public class Chapter implements Parcelable {
    private String chapter;
    private String title;
    private List<Section> sections;

    // 构造方法
    public Chapter() {
    }

    // Parcelable 实现
    protected Chapter(Parcel in) {
        chapter = in.readString();
        title = in.readString();
        sections = in.createTypedArrayList(Section.CREATOR);
    }

    @Override
    public void writeToParcel(Parcel dest, int flags) {
        dest.writeString(chapter);
        dest.writeString(title);
        dest.writeTypedList(sections);
    }

    @Override
    public int describeContents() {
        return 0;
    }

    public static final Creator<Chapter> CREATOR = new Creator<Chapter>() {
        @Override
        public Chapter createFromParcel(Parcel in) {
            return new Chapter(in);
        }

        @Override
        public Chapter[] newArray(int size) {
            return new Chapter[size];
        }
    };

    // Getters and Setters
    public String getChapter() {
        return chapter;
    }

    public void setChapter(String chapter) {
        this.chapter = chapter;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public List<Section> getSections() {
        return sections;
    }

    public void setSections(List<Section> sections) {
        this.sections = sections;
    }

    // 定义 Section 类（嵌套类）
    public static class Section implements Parcelable {
        private String section;
        private String title;

        public String getKnowledgeNo() {
            return knowledgeNo;
        }

        public void setKnowledgeNo(String knowledgeNo) {
            this.knowledgeNo = knowledgeNo;
        }

        private String knowledgeNo;
        private List<Schema> schemas;

        // 构造方法
        public Section() {
        }

        // Parcelable 实现
        protected Section(Parcel in) {
            section = in.readString();
            title = in.readString();
            knowledgeNo = in.readString();
            schemas = in.createTypedArrayList(Schema.CREATOR);
        }

        @Override
        public void writeToParcel(Parcel dest, int flags) {
            dest.writeString(section);
            dest.writeString(title);
            dest.writeString(knowledgeNo);
            dest.writeTypedList(schemas);
        }

        @Override
        public int describeContents() {
            return 0;
        }

        public static final Creator<Section> CREATOR = new Creator<Section>() {
            @Override
            public Section createFromParcel(Parcel in) {
                return new Section(in);
            }

            @Override
            public Section[] newArray(int size) {
                return new Section[size];
            }
        };

        // Getters and Setters
        public String getSection() {
            return section;
        }

        public void setSection(String section) {
            this.section = section;
        }

        public String getTitle() {
            return title;
        }

        public void setTitle(String title) {
            this.title = title;
        }

        public List<Schema> getSchemas() {
            return schemas;
        }

        public void setSchemas(List<Schema> schemas) {
            this.schemas = schemas;
        }
    }

    // 定义 Schema 类（嵌套类）
    public static class Schema implements Parcelable {
        private String introduction;
        private String textBook;
        private int bookPageStart;
        private String lecture;
        private String learnGuide; // 注意：这里假设 "learnGuide" 和 "learnGuideFile" 是同一个字段

        // 构造方法
        public Schema() {
        }

        // Parcelable 实现
        protected Schema(Parcel in) {
            introduction = in.readString();
            textBook = in.readString();
            bookPageStart = in.readInt();
            lecture = in.readString();
            learnGuide = in.readString();
        }

        @Override
        public void writeToParcel(Parcel dest, int flags) {
            dest.writeString(introduction);
            dest.writeString(textBook);
            dest.writeInt(bookPageStart);
            dest.writeString(lecture);
            dest.writeString(learnGuide);
        }

        @Override
        public int describeContents() {
            return 0;
        }

        public static final Creator<Schema> CREATOR = new Creator<Schema>() {
            @Override
            public Schema createFromParcel(Parcel in) {
                return new Schema(in);
            }

            @Override
            public Schema[] newArray(int size) {
                return new Schema[size];
            }
        };

        // Getters and Setters
        public String getIntroduction() {
            return introduction;
        }

        public void setIntroduction(String introduction) {
            this.introduction = introduction;
        }

        public String getTextBook() {
            return textBook;
        }

        public void setTextBook(String textBook) {
            this.textBook = textBook;
        }

        public int getBookPageStart() {
            return bookPageStart;
        }

        public void setBookPageStart(int bookPageStart) {
            this.bookPageStart = bookPageStart;
        }

        public String getLecture() {
            return lecture;
        }

        public void setLecture(String lecture) {
            this.lecture = lecture;
        }

        public String getLearnGuide() {
            return learnGuide;
        }

        public void setLearnGuide(String learnGuide) {
            this.learnGuide = learnGuide;
        }
    }
}