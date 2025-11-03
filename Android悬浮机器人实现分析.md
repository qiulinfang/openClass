# Android 悬浮机器人实现分析

## 概述

悬浮机器人是通过 Android 的 `WindowManager` API 实现的系统级悬浮窗功能，允许应用在所有界面之上显示可拖动的悬浮图标。

## 核心组件

### 1. FloatingRobotService（前台服务）

**文件位置**: `app/src/main/java/com/cosinetech/imates/ui/robot/FloatingRobotService.java`

#### 1.1 服务类型
- **前台服务 (Foreground Service)**: 使用 `startForeground()` 保证服务不被系统杀死
- **前台服务类型**: `foregroundServiceType="dataSync|mediaProjection"` (AndroidManifest.xml 第211行)
- **服务持久化**: `onStartCommand()` 返回 `START_STICKY`，确保服务被系统杀死后自动重启

#### 1.2 生命周期管理

```java
// onCreate() - 服务创建时
@Override
public void onCreate() {
    super.onCreate();
    // 1. 创建通知通道 (Android 8.0+)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        createNotificationChannel();
    }
    
    // 2. 启动前台服务
    startForeground(NOTIFICATION_ID, createNotification());
    
    // 3. 初始化 WindowManager
    windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
    
    // 4. 创建悬浮窗
    initFloatingRobot();
    
    // 5. 初始化消息管理器
    MessagingManager.getInstance().initialize(...);
}

// onDestroy() - 服务销毁时
@Override
public void onDestroy() {
    // 移除悬浮窗视图
    if (floatingRobotView != null) {
        windowManager.removeView(floatingRobotView);
    }
    // 关闭消息管理器
    MessagingManager.getInstance().shutdown();
}
```

### 2. 悬浮窗创建 (initFloatingRobot)

#### 2.1 WindowManager.LayoutParams 配置

```java
WindowManager.LayoutParams layoutParams = new WindowManager.LayoutParams(
    ViewGroup.LayoutParams.WRAP_CONTENT,  // 宽度
    ViewGroup.LayoutParams.WRAP_CONTENT,  // 高度
    WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,  // 窗口类型 (Android 6.0+)
    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,        // 标志：不获取焦点
    PixelFormat.TRANSLUCENT                                // 像素格式：透明
);

// 位置设置
layoutParams.gravity = Gravity.BOTTOM | Gravity.END;  // 右下角
layoutParams.x = 0;
layoutParams.y = 0;
```

**关键参数说明**:

| 参数 | 值 | 说明 |
|------|-----|------|
| **窗口类型** | `TYPE_APPLICATION_OVERLAY` | Android 6.0+ 的悬浮窗类型，需要 `SYSTEM_ALERT_WINDOW` 权限 |
| **标志** | `FLAG_NOT_FOCUSABLE` | 不获取输入焦点，允许点击事件穿透到下层应用 |
| **像素格式** | `TRANSLUCENT` | 支持透明背景 |

#### 2.2 布局加载

```java
LayoutInflater inflater = (LayoutInflater) getSystemService(LAYOUT_INFLATER_SERVICE);
floatingRobotView = inflater.inflate(R.layout.floating_robot, null);
```

**布局文件**: `app/src/main/res/layout/floating_robot.xml`
- 使用 `ConstraintLayout` 作为容器
- 包含 `LottieAnimationView` 显示动画
- 包含 `ImageView` 作为新消息指示器

#### 2.3 添加到窗口

```java
windowManager.addView(floatingRobotView, layoutParams);
```

### 3. 触摸事件处理（拖动和点击）

#### 3.1 触摸监听器

```java
lottieAnimationView.setOnTouchListener(new View.OnTouchListener() {
    private int initialX;
    private int initialY;
    private float initialTouchX;
    private float initialTouchY;

    @Override
    public boolean onTouch(View v, MotionEvent event) {
        switch (event.getAction()) {
            case MotionEvent.ACTION_DOWN:
                // 记录初始位置
                initialX = layoutParams.x;
                initialY = layoutParams.y;
                initialTouchX = event.getRawX();
                initialTouchY = event.getRawY();
                return true;

            case MotionEvent.ACTION_MOVE:
                // 计算偏移量并更新位置
                int offsetX = (int) (event.getRawX() - initialTouchX);
                int offsetY = (int) (event.getRawY() - initialTouchY);
                layoutParams.x = Math.min(initialX - offsetX, screenWidth);
                layoutParams.y = Math.min(initialY - offsetY, screenHeight);
                windowManager.updateViewLayout(floatingRobotView, layoutParams);
                return true;

            case MotionEvent.ACTION_UP:
                // 判断是点击还是拖动（移动距离 < 10px 认为是点击）
                float deltaX = event.getRawX() - initialTouchX;
                float deltaY = event.getRawY() - initialTouchY;
                if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
                    // 点击事件：打开聊天界面
                    popupChatBot(ApiUrl.URL_CHAT_GENERAL, false);
                }
                return true;
        }
        return true;
    }
});
```

**实现要点**:
1. **坐标系统**: 使用 `event.getRawX/Y()` 获取屏幕绝对坐标
2. **位置更新**: 通过 `windowManager.updateViewLayout()` 实时更新悬浮窗位置
3. **点击判断**: 如果移动距离小于 10 像素，认为是点击事件

### 4. 权限配置

#### 4.1 AndroidManifest.xml

```xml
<!-- 悬浮窗权限 -->
<uses-permission
    android:name="android.permission.SYSTEM_ALERT_WINDOW"
    android:required="true" />
```

#### 4.2 权限请求

**文件**: `app/src/main/java/com/cosinetech/imates/utils/PermissionHelper.java`

```java
// 检查悬浮窗权限
private boolean checkSpecialPermissionGranted(String permission) {
    return switch (permission) {
        case "DRAW_OVERLAY" ->
            Build.VERSION.SDK_INT < Build.VERSION_CODES.M || 
            Settings.canDrawOverlays(activity);
        // ...
    };
}

// 请求悬浮窗权限
private void showSpecialPermissionDialog(String permission) {
    if ("DRAW_OVERLAY".equals(permission)) {
        Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION);
        intent.setData(Uri.parse("package:" + activity.getPackageName()));
        // 显示对话框引导用户去设置页面
    }
}
```

**权限请求流程**:
1. Android 6.0 以下：不需要动态申请
2. Android 6.0+：使用 `Settings.canDrawOverlays()` 检查权限
3. 如果没有权限：引导用户前往系统设置的"在其他应用上层显示"页面授权

### 5. 通知管理

#### 5.1 通知通道创建 (Android 8.0+)

```java
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
    CharSequence name = "AI学伴通知";
    String description = "用于显示 AI学伴悬浮窗服务的通知";
    int importance = NotificationManager.IMPORTANCE_DEFAULT;
    NotificationChannel channel = new NotificationChannel(CHANNEL_ID, name, importance);
    channel.setDescription(description);
    NotificationManager notificationManager = getSystemService(NotificationManager.class);
    notificationManager.createNotificationChannel(channel);
}
```

#### 5.2 前台服务通知

```java
private Notification createNotification() {
    return new NotificationCompat.Builder(this, CHANNEL_ID)
        .setContentTitle("AI学伴")
        .setContentText("AI学伴, 伴你进步")
        .setSmallIcon(R.mipmap.ic_launcher)
        .build();
}

// 启动前台服务
startForeground(NOTIFICATION_ID, notification);
```

**作用**: 前台服务必须显示持续通知，否则系统会杀死服务

### 6. 服务启动和停止

#### 6.1 启动服务

**文件**: `app/src/main/java/com/cosinetech/imates/ui/activities/KnowledgeGraphActivity.java`

```java
private void startFloatingWindowService() {
    Intent intent = new Intent(this, FloatingRobotService.class);
    startService(intent);  // Android 8.0+ 需要使用 startForegroundService()
}
```

#### 6.2 AndroidManifest 配置

```xml
<service
    android:name=".ui.robot.FloatingRobotService"
    android:enabled="true"
    android:exported="false"
    android:foregroundServiceType="dataSync|mediaProjection" />
```

### 7. 功能扩展

#### 7.1 消息监听

```java
public class FloatingRobotService extends Service 
    implements MessagingManager.MessageListener {
    
    @Override
    public void onTeacherMessageReceived(ChatMessage msg) {
        // 保存消息到数据库
        mChatDb.addChatMessageDetail(msg);
        
        // 显示新消息指示器
        newMsgIndicator.setVisibility(View.VISIBLE);
    }
}
```

#### 7.2 悬浮窗显示/隐藏

```java
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
```

#### 7.3 打开聊天界面

```java
public void popupChatBot(String url, boolean showOnlyTeacher) {
    ChatAiParam param = new ChatAiParam();
    param.chatBotUrl = url;
    // ... 配置参数
    
    Intent intent = new Intent(this, ChatAiActivity.class);
    intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);  // 在新任务栈中启动
    intent.putExtra(ChatAiActivity.KEY_CHAT_AI_PARAM, param);
    startActivity(intent);
    
    hideRobot();  // 打开聊天界面时隐藏悬浮窗
}
```

## 技术要点总结

### 1. WindowManager API
- **addView()**: 添加悬浮窗视图
- **updateViewLayout()**: 更新悬浮窗位置
- **removeView()**: 移除悬浮窗视图

### 2. 窗口类型演进
- **Android 6.0 以下**: 使用 `TYPE_PHONE` 或 `TYPE_SYSTEM_ALERT`
- **Android 6.0+**: 使用 `TYPE_APPLICATION_OVERLAY`（需要权限）
- **Android 10+**: 限制更严格，必须通过用户主动授权

### 3. 触摸事件处理
- 使用 `OnTouchListener` 而非 `OnClickListener`，因为悬浮窗设置了 `FLAG_NOT_FOCUSABLE`
- 通过移动距离判断点击或拖动

### 4. 服务保活
- 前台服务 + 持续通知
- `START_STICKY` 标志
- 合理的前台服务类型声明

### 5. 权限管理
- `SYSTEM_ALERT_WINDOW` 是特殊权限，不能通过常规方式申请
- 必须引导用户到系统设置页面手动授权
- 使用 `Settings.canDrawOverlays()` 检查权限状态

## 潜在问题和注意事项

### 1. 性能考虑
- 频繁更新位置可能导致性能问题，可以限制更新频率
- Lottie 动画可能消耗较多资源

### 2. 兼容性
- 不同厂商（小米、华为等）可能有额外的悬浮窗权限管理
- Android 10+ 系统限制更严格

### 3. 用户体验
- 需要清晰引导用户授权悬浮窗权限
- 通知栏会显示前台服务通知，需要友好的通知内容

### 4. 安全考虑
- 悬浮窗权限是敏感权限，某些设备可能限制此功能
- 应合理使用，避免滥用悬浮窗功能

## 相关文件清单

1. **核心服务**: `FloatingRobotService.java`
2. **布局文件**: `res/layout/floating_robot.xml`
3. **权限管理**: `PermissionHelper.java`
4. **服务配置**: `AndroidManifest.xml`
5. **应用管理**: `ApplicationModelShared.java`

