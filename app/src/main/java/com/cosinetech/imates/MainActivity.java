package com.cosinetech.imates;

import android.annotation.SuppressLint;
import android.os.Bundle;
import android.view.MenuItem;
import android.view.Menu;
import android.view.MotionEvent;
import android.view.View;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;

import com.airbnb.lottie.LottieAnimationView;
import com.google.android.material.bottomnavigation.BottomNavigationView;
import com.google.android.material.snackbar.Snackbar;
import com.google.android.material.navigation.NavigationView;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.navigation.NavController;
import androidx.navigation.Navigation;
import androidx.navigation.fragment.NavHostFragment;
import androidx.navigation.ui.AppBarConfiguration;
import androidx.navigation.ui.NavigationUI;
import androidx.appcompat.app.AppCompatActivity;

import com.cosinetech.imates.databinding.ActivityMainBinding;
import com.google.android.material.tabs.TabLayout;

public class MainActivity extends AppCompatActivity {

    private float dX, dY;
    private float initialX, initialY;
    private static final int CLICK_THRESHOLD = 10; // 拖动的阈值
    private AppBarConfiguration mAppBarConfiguration;

    @SuppressLint("ClickableViewAccessibility")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        ActivityMainBinding binding = ActivityMainBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        // 设置全屏并不遮挡导航栏
        View decorView = getWindow().getDecorView();
        decorView.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
        );

        TabLayout tabLayout = findViewById(R.id.tabLayout);

        // 设置选项卡选中监听器
        tabLayout.addOnTabSelectedListener(new TabLayout.OnTabSelectedListener() {
            @Override
            public void onTabSelected(TabLayout.Tab tab) {
                // 处理选项卡选中事件
                switch (tab.getPosition()) {
                    case 0:
                        // 处理"语文"选项
                        break;
                    case 1:
                        // 处理"数学"选项
                        break;
                    case 2:
                        // 处理"英语"选项
                        break;
                    case 3:
                        // 处理"科学"选项
                        break;
                    case 4:
                        // 处理"视频课"选项
                        break;
                    case 5:
                        // 处理"阅读"选项
                        break;
                    case 6:
                        // 处理"AI题拟人"选项
                        break;
                }
            }

            @Override
            public void onTabUnselected(TabLayout.Tab tab) {
                // 可以在这里处理选项卡取消选中的事件
            }

            @Override
            public void onTabReselected(TabLayout.Tab tab) {
                // 可以在这里处理选项卡重新选中的事件
            }
        });

        LottieAnimationView lottieAnimationView = findViewById(R.id.lottieAnimationView);

        // 设置点击事件
        lottieAnimationView.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                // 处理点击事件
                // 在这里你可以处理点击事件，比如播放或暂停动画等
                //lottieAnimationView.pauseAnimation();
            }
        });

        // 设置拖动监听器
        lottieAnimationView.setOnTouchListener(new View.OnTouchListener() {
            @SuppressLint("ClickableViewAccessibility")
            @Override
            public boolean onTouch(View view, MotionEvent motionEvent) {
                switch (motionEvent.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        // 记录触摸的初始位置
                        initialX = motionEvent.getRawX();
                        initialY = motionEvent.getRawY();
                        dX = view.getX() - motionEvent.getRawX();
                        dY = view.getY() - motionEvent.getRawY();
                        return true;

                    case MotionEvent.ACTION_MOVE:
                        // 如果触摸点移动的距离超过阈值，认为是拖动
                        if (Math.abs(motionEvent.getRawX() - initialX) > CLICK_THRESHOLD ||
                                Math.abs(motionEvent.getRawY() - initialY) > CLICK_THRESHOLD) {
                            // 更新位置
                            view.animate()
                                    .x(motionEvent.getRawX() + dX)
                                    .y(motionEvent.getRawY() + dY)
                                    .setDuration(0)
                                    .start();
                        }
                        return true;

                    case MotionEvent.ACTION_UP:
                        // 在这里可以判断是否是点击（可以放置额外的条件判断）
                        if (Math.abs(motionEvent.getRawX() - initialX) <= CLICK_THRESHOLD &&
                                Math.abs(motionEvent.getRawY() - initialY) <= CLICK_THRESHOLD) {
                            // 如果触摸的移动距离小于阈值，认为是点击
                            lottieAnimationView.performClick();
                        }
                        return true;

                    default:
                        return false;
                }
            }
        });

//        setSupportActionBar(binding.appBarMain.toolbar);
//        if (binding.appBarMain.fab != null) {
//            binding.appBarMain.fab.setOnClickListener(view -> Snackbar.make(view, "Replace with your own action", Snackbar.LENGTH_LONG)
//                    .setAction("Action", null).setAnchorView(R.id.fab).show());
//        }
//        NavHostFragment navHostFragment = (NavHostFragment) getSupportFragmentManager().findFragmentById(R.id.nav_host_fragment_content_main);
//        assert navHostFragment != null;
//        NavController navController = navHostFragment.getNavController();
//
//        NavigationView navigationView = binding.navView;
//        if (navigationView != null) {
//            mAppBarConfiguration = new AppBarConfiguration.Builder(
//                    R.id.nav_transform, R.id.nav_reflow, R.id.nav_slideshow, R.id.nav_settings)
//                    .setOpenableLayout(binding.drawerLayout)
//                    .build();
//            NavigationUI.setupActionBarWithNavController(this, navController, mAppBarConfiguration);
//            NavigationUI.setupWithNavController(navigationView, navController);
//        }
//
//        BottomNavigationView bottomNavigationView = binding.appBarMain.contentMain.bottomNavView;
//        if (bottomNavigationView != null) {
//            mAppBarConfiguration = new AppBarConfiguration.Builder(
//                    R.id.nav_transform, R.id.nav_reflow, R.id.nav_slideshow)
//                    .build();
//            NavigationUI.setupActionBarWithNavController(this, navController, mAppBarConfiguration);
//            NavigationUI.setupWithNavController(bottomNavigationView, navController);
//        }
    }

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        boolean result = super.onCreateOptionsMenu(menu);
        // Using findViewById because NavigationView exists in different layout files
        // between w600dp and w1240dp
        NavigationView navView = findViewById(R.id.nav_view);
        if (navView == null) {
            // The navigation drawer already has the items including the items in the overflow menu
            // We only inflate the overflow menu if the navigation drawer isn't visible
            getMenuInflater().inflate(R.menu.overflow, menu);
        }
        return result;
    }

    @Override
    public boolean onOptionsItemSelected(@NonNull MenuItem item) {
        if (item.getItemId() == R.id.nav_settings) {
            NavController navController = Navigation.findNavController(this, R.id.nav_host_fragment_content_main);
            navController.navigate(R.id.nav_settings);
        }
        return super.onOptionsItemSelected(item);
    }

    @Override
    public boolean onSupportNavigateUp() {
        NavController navController = Navigation.findNavController(this, R.id.nav_host_fragment_content_main);
        return NavigationUI.navigateUp(navController, mAppBarConfiguration)
                || super.onSupportNavigateUp();
    }
}