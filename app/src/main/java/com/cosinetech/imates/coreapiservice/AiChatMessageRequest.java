package com.cosinetech.imates.coreapiservice;

public class AiChatMessageRequest {
    private String sessionId;
    private String newValue;
    private String coversation;
    private String question;
    private String answer;
    private String name;
    private String reason;

    private String dstUrl;

    private String isWebSearch;
    private String bmNo;

    private String chatRole;

    private String subject;

    public String getBmNo() {
        return bmNo;
    }

    public void setBmNo(String bmNo) {
        this.bmNo = bmNo;
    }

    public String getIsWebSearch() {
        return isWebSearch;
    }

    public void setIsWebSearch(String isWebSearch) {
        this.isWebSearch = isWebSearch;
    }

    public void setChatRole(String role) {
        this.chatRole = role;
    }

    public String getChatRole() {
        return this.chatRole;
    }

    public String getSubject() {
        return subject;
    }

    // 构造函数
    public AiChatMessageRequest(String sessionId, String newValue,
                                String conversation, String question,
                                String answer,
                                String name, String reason,
                                String bmNo,
                                boolean isWebSearch,
                                String subject) {
        this.sessionId = sessionId;
        this.newValue = newValue;
        this.coversation = conversation;
        this.question = question;
        this.answer = answer;
        this.name = name;
        this.reason = reason;
        this.bmNo = bmNo;
        this.isWebSearch = isWebSearch ? "1" : "0";
        this.subject = subject;
    }

    // Getters 和 Setters 方法
    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    public String getNewValue() {
        return newValue;
    }

    public void setNewValue(String newValue) {
        this.newValue = newValue;
    }

    public String getCoversation() {
        return coversation;
    }

    public void setCoversation(String coversation) {
        this.coversation = coversation;
    }

    public String getQuestion() {
        return question;
    }

    public void setQuestion(String question) {
        this.question = question;
    }

    public String getAnswer() {
        return answer;
    }

    public void setAnswer(String answer) {
        this.answer = answer;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public String getDstUrl() {
        return dstUrl;
    }

    public void setDstUrl(String dstUrl) {
        this.dstUrl = dstUrl;
    }
}
