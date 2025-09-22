package com.cosinetech.imates.textbookservice;

public class LoginResponse {
    public String token;
    public String userId;
    public boolean defaultPassword;
    
    public LoginResponse(String token, String userId, boolean defaultPassword) {
        this.token = token;
        this.userId = userId;
        this.defaultPassword = defaultPassword;
    }
}
