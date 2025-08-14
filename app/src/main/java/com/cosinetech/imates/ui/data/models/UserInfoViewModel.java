package com.cosinetech.imates.ui.data.models;

import androidx.lifecycle.MutableLiveData;
import androidx.lifecycle.ViewModel;

import java.io.File;

public class UserInfoViewModel extends ViewModel {
    public MutableLiveData<String> token = new MutableLiveData<>();
    public MutableLiveData<UserInfo> userInfo = new MutableLiveData<>();

    public MutableLiveData<String> userId = new MutableLiveData<>();

    public MutableLiveData<String> password = new MutableLiveData<>();
    public MutableLiveData<File> userPath = new MutableLiveData<>();
}