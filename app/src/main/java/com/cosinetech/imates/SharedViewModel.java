package com.cosinetech.imates;

import androidx.lifecycle.LiveData;
import androidx.lifecycle.MutableLiveData;
import androidx.lifecycle.ViewModel;

public class SharedViewModel extends ViewModel {
    private MutableLiveData<Object> sharedObject = new MutableLiveData<>();

    public LiveData<Object> getSharedObject() {
        return sharedObject;
    }

    public void setSharedObject(Object obj) {
        this.sharedObject.setValue(obj);
    }
}
