package com.cosinetech.imates.textbookservice;

import java.util.List;

public class ChapterNode {
    public String id;
    public String name;
    public String parentId;
    public String label;
    public Integer level;
    public String knowledgeList;
    public boolean isRoot;
    public List<ChapterNode> children;
}
