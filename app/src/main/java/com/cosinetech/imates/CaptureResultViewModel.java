package com.cosinetech.imates;
import androidx.lifecycle.MutableLiveData;
import androidx.lifecycle.ViewModel;

public class CaptureResultViewModel extends ViewModel {
    // 存储结果字符串
    public MutableLiveData<String> result = new MutableLiveData<>();

    // 存储枚举类型
    public MutableLiveData<EnumSubject> subject = new MutableLiveData<>();

    // 存储 URL
    public MutableLiveData<String> url = new MutableLiveData<>();
}
