package com.cosinetech.imates.activities;

import android.os.Bundle;

import com.cosinetech.imates.util.WindowUtils;
import com.google.android.material.snackbar.Snackbar;

import androidx.appcompat.app.AppCompatActivity;

import android.view.View;

import androidx.navigation.NavController;
import androidx.navigation.Navigation;
import androidx.navigation.ui.AppBarConfiguration;
import androidx.navigation.ui.NavigationUI;

import com.cosinetech.imates.databinding.ActivityMyProfileBinding;

import com.cosinetech.imates.R;

public class MyProfileActivity extends BaseActivity {
    @Override
    protected int getLayoutResId() {
        return R.layout.activity_my_profile;
    }

    @Override
    protected int getCurrentNavItemId() {
        return R.id.nav_profile;
    }
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        WindowUtils.hideSystemUI(this);
    }
}