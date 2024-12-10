package com.cosinetech.imates;

public class TodoItem {
    private String title;
    private String description;
    private long dueDate;
    private boolean isCompleted;
    private int color;

    public TodoItem(String title, String description, long dueDate, int color) {
        this.title = title;
        this.description = description;
        this.dueDate = dueDate;
        this.isCompleted = false;
        this.color = color;
    }

    // Getters and setters
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public long getDueDate() { return dueDate; }
    public void setDueDate(long dueDate) { this.dueDate = dueDate; }
    public boolean isCompleted() { return isCompleted; }
    public void setCompleted(boolean completed) { isCompleted = completed; }
    public int getColor() { return color; }
    public void setColor(int color) { this.color = color; }
}