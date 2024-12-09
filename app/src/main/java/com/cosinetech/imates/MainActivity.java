package com.cosinetech.imates;

import android.annotation.SuppressLint;
import android.graphics.Color;
import android.graphics.drawable.Drawable;
import android.os.Bundle;
import android.text.Spanned;
import android.view.MenuItem;
import android.view.Menu;
import android.view.MotionEvent;
import android.view.View;
import android.widget.TextView;
import android.widget.Toast;

import com.airbnb.lottie.LottieAnimationView;
import com.bumptech.glide.Glide;
import com.bumptech.glide.RequestBuilder;
import com.google.android.material.navigation.NavigationView;

import androidx.annotation.NonNull;
import androidx.fragment.app.FragmentManager;
import androidx.fragment.app.FragmentTransaction;
import androidx.navigation.NavController;
import androidx.navigation.Navigation;
import androidx.navigation.ui.AppBarConfiguration;
import androidx.navigation.ui.NavigationUI;
import androidx.appcompat.app.AppCompatActivity;

import com.cosinetech.imates.databinding.ActivityMainBinding;
import com.google.android.material.tabs.TabLayout;

import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

import io.noties.markwon.Markwon;
import io.noties.markwon.ext.latex.JLatexMathPlugin;
import io.noties.markwon.image.AsyncDrawable;
import io.noties.markwon.image.ImagesPlugin;
import io.noties.markwon.image.glide.GlideImagesPlugin;
import io.noties.markwon.image.network.NetworkSchemeHandler;
import io.noties.markwon.inlineparser.MarkwonInlineParserPlugin;
import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

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
                showFloatingFragment();
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


        TextView textView = findViewById(R.id.markdownTextView);

// 创建 Markwon 实例并添加插件
        Markwon markwon = Markwon.builder(this)
                // automatically create Glide instance
                .usePlugin(MarkwonInlineParserPlugin.create())
                .usePlugin(GlideImagesPlugin.create(this))
                .usePlugin(JLatexMathPlugin.create(textView.getTextSize(), builder -> {
                    // enable inlines (require `MarkwonInlineParserPlugin`), by default `false`
                    builder.inlinesEnabled(true);
                    builder.allowInlinesSingleDollar(true);
//
                }))
                .build();

        // Prepare Markdown text
        String markdown = "# Image and LaTeX Examples\n\n" +
                "## Local File Image\n\n" +
                "![Local Image](file:///android_asset/local_image.png)\n\n" +
                "## Network Image\n\n" +
                "![Network Image](http://pic.caodingtushuguan.com/241116/0T6093941-0.jpg)\n\n" +
                "## Base64 Image\n\n" +
                "![Base64 Image](data:image/jpeg;base64,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)\n\n" +
                "## Inline LaTeX\n\n" +
                "This is an inline LaTeX equation: $E = mc^2$\n\n" +
                "## Block LaTeX\n\n" +
                "This is a block LaTeX equation:\n\n" +
                "$$\\int_{a}^{b} x^2 dx = \\frac{1}{3}(b^3 - a^3)$$";

        // Set Markdown text to TextView
        markwon.setMarkdown(textView, markdown);
    }

    private void showFloatingFragment() {
        FragmentManager fragmentManager = getSupportFragmentManager();
        FragmentTransaction transaction = fragmentManager.beginTransaction();
        transaction.setCustomAnimations(
                R.anim.fragment_enter, // enter animation
                R.anim.fragment_exit,  // exit animation
                R.anim.fragment_enter, // popEnter animation
                R.anim.fragment_exit   // popExit animation
        );

        // 创建悬浮 Fragment 实例
        ChatAiFragment floatingFragment = new ChatAiFragment();
        transaction.replace(R.id.fragmentChatAiContainer, floatingFragment);
        transaction.addToBackStack(null);
        transaction.commit();
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