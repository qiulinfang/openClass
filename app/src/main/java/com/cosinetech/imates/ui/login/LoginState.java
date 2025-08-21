package com.cosinetech.imates.ui.login;

import com.cosinetech.imates.data.models.UserInfo;

public abstract class LoginState {
    private LoginState() {}

    public static final class Idle extends LoginState {}
    public static final class Loading extends LoginState {}
    public static final class Success extends LoginState {
        public final UserInfo userInfo;
        public Success(UserInfo userInfo) { this.userInfo = userInfo; }
    }
    public static final class Error extends LoginState {
        public final String message;
        public Error(String message) { this.message = message; }
    }
}