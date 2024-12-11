package com.cosinetech.imates;

import androidx.lifecycle.LiveData;
import androidx.lifecycle.MutableLiveData;
import androidx.lifecycle.ViewModel;

public class AppViewModel extends ViewModel {
    private MutableLiveData<String> authToken = new MutableLiveData<>();
    private MutableLiveData<String> userInfo = new MutableLiveData<>();

    public LiveData<String> getAuthToken() {
        return authToken;
    }

    public void setAuthToken(String token) {
        if (authToken.getValue() == null || !authToken.getValue().equals(token)) {
            authToken.postValue(token);
        }
    }

    public LiveData<String> getUserInfo() {
        return userInfo;
    }

    public void setUserInfo(String info) {
        if (userInfo.getValue() == null || !userInfo.getValue().equals(info)) {
            userInfo.postValue(info);
        }
    }

    @Override
    protected void onCleared() {
        super.onCleared();
        // 清理资源
    }
}
