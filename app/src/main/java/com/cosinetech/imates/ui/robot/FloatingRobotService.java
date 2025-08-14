package com.cosinetech.imates.ui.robot;

import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.util.Log;
import android.view.Gravity;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.app.Service;
import android.content.Intent;
import android.graphics.PixelFormat;
import android.os.IBinder;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.PopupWindow;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.annotation.RequiresApi;
import androidx.appcompat.view.ContextThemeWrapper;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import androidx.lifecycle.ViewModelProvider;
import androidx.lifecycle.ViewModelStoreOwner;

import com.airbnb.lottie.LottieAnimationView;
import com.cosinetech.imates.ApplicationModelShared;
import com.cosinetech.imates.R;
import com.cosinetech.imates.ui.activities.ChatAiActivity;
import com.cosinetech.imates.ui.activities.ScreenShotActivity;
import com.cosinetech.imates.ui.data.models.ChatAiParam;
import com.cosinetech.imates.ui.data.models.ChatMessage;
import com.cosinetech.imates.ui.data.models.ChatMessageHistoryDB;
import com.cosinetech.imates.ui.data.models.UserInfoViewModel;
import com.cosinetech.imates.teachermessagemq.MessagingManager;
import com.cosinetech.imates.screencasting.ScreenCastingManager;
import com.cosinetech.imates.utils.AppUtils;
import com.cosinetech.imates.utils.ScreenUtils;
import com.cosinetech.imates.ui.views.ChatAiView;
import com.cosinetech.imates.coreapiservice.ApiUrl;

public class FloatingRobotService extends Service implements MessagingManager.MessageListener {
    private static final String CHANNEL_ID = "floating_window_channel";
    private static final int NOTIFICATION_ID = 1;

    private WindowManager windowManager;
    private View floatingRobotView;
    private View feedbackView;
    private ImageView newMsgIndicator;

    private ChatMessageHistoryDB mChatDb;

    public FloatingRobotService() {
    }


    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @SuppressLint("ClickableViewAccessibility")
    @Override
    public void onCreate() {
        super.onCreate();

        // 创建通知通道（对于 Android 8.0 及以上）
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            CharSequence name = "AI学伴通知";
            String description = "用于显示 AI学伴悬浮窗服务的通知";
            int importance = NotificationManager.IMPORTANCE_DEFAULT;
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, name, importance);
            channel.setDescription(description);
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            notificationManager.createNotificationChannel(channel);
        }

        // 创建并启动前台服务
        Notification notification = createNotification();

        startForeground(NOTIFICATION_ID, notification);

        // Log to verify
        Log.d("FloatingRobotService", "Service started as foreground.");

        // 获取 FragmentManagerProvider
        ApplicationModelShared myapp = (ApplicationModelShared)(getApplication());
        myapp.setFloatingWindowService(this);


        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        initFloatingRobot();
        //initFeedbackView();

        // 初始化MessageManager
        UserInfoViewModel userInfoViewModel = new ViewModelProvider(
                (ViewModelStoreOwner) getApplication(),
                new ViewModelProvider.AndroidViewModelFactory(getApplication())
        ).get(UserInfoViewModel.class);

        mChatDb = ChatMessageHistoryDB.getInstance(getApplicationContext(), AppUtils.getUserId());
        MessagingManager.getInstance().addMessageListener(this);
        MessagingManager.getInstance().initialize(getApplicationContext(), userInfoViewModel.userId.getValue());
    }

    @SuppressLint("ClickableViewAccessibility")
    private void initFloatingRobot() {
        WindowManager.LayoutParams layoutParams = new WindowManager.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
                PixelFormat.TRANSLUCENT);
        LayoutInflater inflater = (LayoutInflater) getSystemService(LAYOUT_INFLATER_SERVICE);
        floatingRobotView = inflater.inflate(R.layout.floating_robot, null);
        newMsgIndicator = floatingRobotView.findViewById(R.id.indicator_new_msg);
        final int screenWidth = ScreenUtils.getScreenWidth(this);
        final int screenHeight = ScreenUtils.getScreenHeight(this);
        // 初始位置
        layoutParams.x = 0; //ScreenUtils.getScreenWidth(this) - floatingRobotView.getWidth();
        layoutParams.y = 0; //ScreenUtils.getScreenHeight(this) - floatingRobotView.getHeight();
        layoutParams.gravity = Gravity.BOTTOM | Gravity.END;
        windowManager.addView(floatingRobotView, layoutParams);

        LottieAnimationView lottieAnimationView = floatingRobotView.findViewById(R.id.lottie_animation_view);
        lottieAnimationView.setOnTouchListener(new View.OnTouchListener() {
            private int initialX;
            private int initialY;
            private float initialTouchX;
            private float initialTouchY;

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                switch (event.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        // 记录按下时的坐标
                        initialX = layoutParams.x;
                        initialY = layoutParams.y;

                        initialTouchX = event.getRawX();
                        initialTouchY = event.getRawY();
                        return true;

                    case MotionEvent.ACTION_MOVE:
                        // 计算移动的偏移量
                        int offsetX = (int) (event.getRawX() - initialTouchX);
                        int offsetY = (int) (event.getRawY() - initialTouchY);
                        // 更新悬浮窗的位置

                        layoutParams.x = Math.min(initialX - offsetX, screenWidth);
                        layoutParams.y = Math.min(initialY - offsetY, screenHeight);
                        windowManager.updateViewLayout(floatingRobotView, layoutParams);
                        return true;

                    case MotionEvent.ACTION_UP:
                        // 判断是否为点击事件
                        float deltaX = event.getRawX() - initialTouchX;
                        float deltaY = event.getRawY() - initialTouchY;
                        if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
                            // 如果移动距离小于阈值，认为是点击事件
                            popupChatBot(ApiUrl.URL_CHAT_GENERAL, false);
                        }
                        return true;
                }
                return true;
            }
        });
    }

    @RequiresApi(api = Build.VERSION_CODES.O)
    @SuppressLint("ClickableViewAccessibility")
    private void initFeedbackView() {
        WindowManager.LayoutParams layoutParams = new WindowManager.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
                PixelFormat.TRANSLUCENT);
        final int screenWidth = ScreenUtils.getScreenWidth(this);
        final int screenHeight = ScreenUtils.getScreenHeight(this);
        LayoutInflater inflater = (LayoutInflater) getSystemService(LAYOUT_INFLATER_SERVICE);
        feedbackView = inflater.inflate(R.layout.floating_feedback, null);
        layoutParams.gravity = Gravity.BOTTOM | Gravity.START;
        windowManager.addView(feedbackView, layoutParams);
        LottieAnimationView lottieAnimationView = feedbackView.findViewById(R.id.lottie_animation_view);
        lottieAnimationView.setOnTouchListener(new View.OnTouchListener() {
            private int initialX;
            private int initialY;
            private float initialTouchX;
            private float initialTouchY;

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                switch (event.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        // 记录按下时的坐标
                        initialX = layoutParams.x;
                        initialY = layoutParams.y;

                        initialTouchX = event.getRawX();
                        initialTouchY = event.getRawY();
                        return true;

                    case MotionEvent.ACTION_MOVE:
                        // 计算移动的偏移量
                        int offsetX = (int) (event.getRawX() - initialTouchX);
                        int offsetY = (int) (event.getRawY() - initialTouchY);
                        // 更新悬浮窗的位置

                        layoutParams.x = Math.min(initialX + offsetX, screenWidth);
                        layoutParams.y = Math.min(initialY - offsetY, screenHeight);
                        windowManager.updateViewLayout(feedbackView, layoutParams);
                        return true;

                    case MotionEvent.ACTION_UP:
                        // 判断是否为点击事件
                        float deltaX = event.getRawX() - initialTouchX;
                        float deltaY = event.getRawY() - initialTouchY;
                        if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
                            performFeedback();
                        }
                        return true;
                }
                return true;
            }
        });
    }

    private void performFeedback() {
        if(ScreenCastingManager.isHavingClass()) {
            Toast.makeText(getApplicationContext(), "请在退出课堂后再进行反馈", Toast.LENGTH_SHORT).show();
            return;
        }

        String userId = AppUtils.getUserId();
        if(userId == null
                || userId.isEmpty()
                || userId.equals("guest000")) {
            Toast.makeText(getApplicationContext(), "请用其他账户进行反馈", Toast.LENGTH_SHORT).show();
            return;
        }

        Intent intent = new Intent(this, ScreenShotActivity.class);
        intent.setAction(ScreenShotActivity.ACTION_START_FEED_BACK);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK); // 启动新任务栈
        startActivity(intent);
    }

    public void hideRobot() {
        if(floatingRobotView != null) {
            floatingRobotView.setVisibility(View.GONE);
        }
    }

    public void showRobot() {
        if(floatingRobotView != null) {
            floatingRobotView.setVisibility(View.VISIBLE);
        }
    }

    public void popupChatBot1(String url, String tag) {
        // 加载 PopupWindow 的布局
        // 关键步骤：通过 ContextThemeWrapper 附加主题
        ContextThemeWrapper themedContext = new ContextThemeWrapper(this, R.style.Theme_IMatesApp_FullScreen);
        LayoutInflater inflater = LayoutInflater.from(themedContext);
        //floatingView = inflater.inflate(R.layout.floating_layout, null)

        View popupView = inflater.inflate(R.layout.popup_window_chat, null);

        popupView.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION // 隐藏导航栏
                        | View.SYSTEM_UI_FLAG_FULLSCREEN); // 隐藏状态栏

        int screenWidth = ScreenUtils.getScreenWidth(this);
        int screenHeight = ScreenUtils.getScreenHeight(this);

        // 初始化 PopupWindow
        PopupWindow popupWindow = new PopupWindow(
                popupView,
                screenWidth * 2 / 3,
                screenHeight,
                true
        );

        // 设置 PopupWindow 的背景
        popupWindow.setBackgroundDrawable(ContextCompat.getDrawable(this, android.R.color.transparent));

        // 显示 PopupWindow
        popupWindow.showAtLocation(floatingRobotView, Gravity.START, 0, 0);

        popupWindow.setOutsideTouchable(false);

        popupWindow.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);


        Button btnExit = popupView.findViewById(R.id.btn_exit);
        btnExit.setOnClickListener(v-> {
            popupWindow.dismiss();
        });

        ChatAiView  chatView = popupView.findViewById(R.id.chat_view);
        ChatAiParam param = new ChatAiParam();
        //param.sessionId = tag;
        param.chatBotUrl = url;
        param.showHeader = true;
        param.streamDisplay = true;
        param.showHistory = true;
        param.initialSendEnable = true;
//        param.listener = null;
        chatView.setChatAiParam(param);
    }

    public void popupChatBot(String url, boolean showOnlyTeacher) {
        ChatAiParam param = new ChatAiParam();
        param.chatBotUrl = url;
        param.showHeader = true;
        param.streamDisplay = true;
        param.showHistory = true;
        param.initialSendEnable = true;
        param.showTeacherSessionOnly = showOnlyTeacher;

        Intent intent = new Intent(this, ChatAiActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK); // 启动新任务栈
        intent.putExtra(ChatAiActivity.KEY_CHAT_AI_PARAM, param);
        startActivity(intent);

        hideRobot();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // 继续保持服务在前台
        startForeground(NOTIFICATION_ID, createNotification());
        return START_STICKY;  // 保持服务运行
    }

    private Notification createNotification() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("AI学伴")
                .setContentText("AI学伴, 伴你进步")
                .setSmallIcon(R.mipmap.ic_launcher)
                .build();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (floatingRobotView != null) {
            windowManager.removeView(floatingRobotView);
            floatingRobotView = null;
        }

        if(feedbackView != null) {
            windowManager.removeView(feedbackView);
            feedbackView = null;
        }

        // 关闭MessageManager
        MessagingManager.getInstance().shutdown();
    }

    @Override
    public void onTeacherMessageReceived(ChatMessage msg) {
        if(msg != null) {
            mChatDb.addChatMessageDetail(msg);
        }

        // check any unread chat sessions
        newMsgIndicator.setVisibility(View.GONE);
    }
}
