package com.cosinetech.imates.model;

import androidx.lifecycle.MutableLiveData;
import androidx.lifecycle.ViewModel;

public class UserViewModel extends ViewModel {
    public MutableLiveData<String> token = new MutableLiveData<>();
    public MutableLiveData<UserInfo> userInfo = new MutableLiveData<>();
}