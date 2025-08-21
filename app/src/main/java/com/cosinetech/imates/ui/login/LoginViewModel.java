package com.cosinetech.imates.ui.login;

import android.util.Log;

import androidx.lifecycle.LiveData;
import androidx.lifecycle.MutableLiveData;
import androidx.lifecycle.ViewModel;

import com.cosinetech.imates.data.models.UserInfo;
import com.cosinetech.imates.data.models.UserInfoViewModel;
import com.cosinetech.imates.data.repository.LoginRepository;

import java.io.File;

// 登录模块的ViewModel，负责处理登录逻辑和数据状态
public class LoginViewModel extends ViewModel {
    // 登录仓库，负责与数据层交互
    private final LoginRepository loginRepository = new LoginRepository();
    
    // 用户信息ViewModel的引用，用于设置全局用户数据
    private UserInfoViewModel userInfoViewModel;

    // 用户信息的可观察数据
    private final MutableLiveData<UserInfo> _userInfo = new MutableLiveData<>();
    public LiveData<UserInfo> userInfo = _userInfo;

    // 登录token的可观察数据
    private final MutableLiveData<String> _token = new MutableLiveData<>();
    public LiveData<String> token = _token;

    // 错误信息的可观察数据
    private final MutableLiveData<String> _errorMessage = new MutableLiveData<>();
    public LiveData<String> errorMessage = _errorMessage;

    // 加载状态的可观察数据
    private final MutableLiveData<Boolean> _isLoading = new MutableLiveData<>(false); // 默认不在加载中
    public LiveData<Boolean> isLoading = _isLoading;

    /**
     * 设置UserInfoViewModel引用
     * @param userInfoVM UserInfoViewModel实例
     */
    public void setUserInfoViewModel(UserInfoViewModel userInfoVM) {
        this.userInfoViewModel = userInfoVM;
    }

    /**
     * 登录方法，异步执行登录操作并更新LiveData
     * @param account 用户账号
     * @param password 用户密码
     * @param userFilesDir 用户文件目录
     */
    public void login(String account, String password, File userFilesDir) {
        Log.d("LoginViewModel", "login: account=" + account);
        _isLoading.setValue(true); // 设置加载中
        new Thread(() -> {
            try {
                // 设置UserInfoViewModel的相关数据（恢复重构前的功能）
                if (userInfoViewModel != null) {
                    userInfoViewModel.userId.postValue(account);
                    userInfoViewModel.password.postValue(password);
                }
                
                // 调用仓库登录方法，获取token
                String token = loginRepository.login(account, password);
                Log.d("LoginViewModel", "login: token received=" + token);
                _token.postValue(token); // 更新token
                
                // 设置UserInfoViewModel的token（恢复重构前的功能）
                if (userInfoViewModel != null) {
                    userInfoViewModel.token.postValue(token);
                }
                
                // 获取用户信息
                UserInfo user = loginRepository.getUserInfo(token);
                Log.d("LoginViewModel", "login: userInfo received, name=" + (user != null ? user.getName() : "null"));
                _userInfo.postValue(user); // 更新用户信息
                
                // 设置UserInfoViewModel的用户信息（恢复重构前的功能）
                if (userInfoViewModel != null) {
                    userInfoViewModel.userInfo.postValue(user);
                    userInfoViewModel.userPath.postValue(userFilesDir);
                }
                
            } catch (Exception e) {
                Log.e("LoginViewModel", "login: error=" + e.getMessage());
                _errorMessage.postValue(e.getMessage()); // 更新错误信息
            } finally {
                Log.d("LoginViewModel", "login: finally, set isLoading false");
                _isLoading.postValue(false); // 结束加载
            }
        }).start();
    }

    /**
     * 登录方法重载，保持向后兼容
     * @param account 用户账号
     * @param password 用户密码
     */
    public void login(String account, String password) {
        // 如果没有设置userFilesDir，使用默认值null
        login(account, password, null);
    }

    /**
     * 清除登录信息（可选补充方法）
     */
    public void clearLoginState() {
        _token.setValue(null);
        _userInfo.setValue(null);
        _errorMessage.setValue(null);
    }
}