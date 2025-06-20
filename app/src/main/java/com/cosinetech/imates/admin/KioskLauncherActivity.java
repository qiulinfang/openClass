package com.cosinetech.imates.admin;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.graphics.drawable.Drawable;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.widget.GridView;
import android.widget.Toast;
import androidx.recyclerview.widget.GridLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.cosinetech.imates.R;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

public class KioskLauncherActivity extends Activity {
    private static final String TAG = "KioskLauncher";

    private RecyclerView recyclerView;
    private AppGridAdapter adapter;
    private KioskManager kioskManager;
    private List<AppInfo> allowedAppsList;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_kiosk_launcher);

        kioskManager = KioskManager.getInstance();

        setupFullscreen();
        initializeViews();
        loadAllowedApps();

        // 启动Kiosk模式
        if (kioskManager.isDeviceOwner()) {
            kioskManager.startKioskMode(this);
        }
    }

    private void setupFullscreen() {
        // 隐藏状态栏和导航栏
        getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN
        );

        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
                        View.SYSTEM_UI_FLAG_FULLSCREEN |
                        View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY |
                        View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION |
                        View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
        );
    }

    private void initializeViews() {
        recyclerView = findViewById(R.id.apps_recycler_view);
        recyclerView.setLayoutManager(new GridLayoutManager(this, 4)); // 4列网格

        allowedAppsList = new ArrayList<>();
        adapter = new AppGridAdapter(allowedAppsList, this::launchApp);
        recyclerView.setAdapter(adapter);
    }

    private void loadAllowedApps() {
        allowedAppsList.clear();

        Set<String> allowedPackages = kioskManager.getAllowedApps();
        PackageManager packageManager = getPackageManager();

        for (String packageName : allowedPackages) {
            try {
                ApplicationInfo appInfo = packageManager.getApplicationInfo(packageName, 0);

                // 跳过本应用
                if (packageName.equals(getPackageName())) {
                    continue;
                }

                String appName = packageManager.getApplicationLabel(appInfo).toString();
                Drawable appIcon = packageManager.getApplicationIcon(appInfo);

                allowedAppsList.add(new AppInfo(packageName, appName, appIcon));

            } catch (PackageManager.NameNotFoundException e) {
                // 应用未安装，跳过
            }
        }

        adapter.notifyDataSetChanged();
    }

    private void launchApp(AppInfo appInfo) {
        try {
            Intent launchIntent = getPackageManager().getLaunchIntentForPackage(appInfo.getPackageName());
            if (launchIntent != null) {
                startActivity(launchIntent);
            } else {
                Toast.makeText(this, "无法启动应用: " + appInfo.getAppName(), Toast.LENGTH_SHORT).show();
            }
        } catch (Exception e) {
            Toast.makeText(this, "启动应用失败", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    public void onBackPressed() {
        // 在Kiosk模式下禁用返回键
        if (kioskManager.isKioskModeEnabled()) {
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onResume() {
        super.onResume();
        setupFullscreen();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            setupFullscreen();
        }
    }
}
