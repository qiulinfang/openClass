package com.cosinetech.imates.textbookservice;

import java.util.ArrayList;
import java.util.List;

public class UserLearnData {
    public String username;
    public String lastSyncTime;
    public List<UserTextbookInfo> textbooks;
    public String version = "1.0";
    
    public UserLearnData() {
        this.textbooks = new ArrayList<>();
    }
    
    public UserLearnData(String username) {
        this.username = username;
        this.textbooks = new ArrayList<>();
        this.lastSyncTime = null;
    }
    
    public UserTextbookInfo findTextbook(String textbookId) {
        for (UserTextbookInfo info : textbooks) {
            if (info.textbookId.equals(textbookId)) {
                return info;
            }
        }
        return null;
    }
    
    public void updateOrAddTextbook(UserTextbookInfo textbookInfo) {
        UserTextbookInfo existing = findTextbook(textbookInfo.textbookId);
        if (existing != null) {
            textbooks.remove(existing);
        }
        textbooks.add(textbookInfo);
    }
}
