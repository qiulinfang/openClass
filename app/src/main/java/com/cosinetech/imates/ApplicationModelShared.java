package com.cosinetech.imates;

import static com.xuexiang.xupdate.entity.UpdateError.ERROR.CHECK_NO_NEW_VERSION;

import android.app.Activity;
import android.app.Application;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.util.Log;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.RelativeLayout;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.lifecycle.ViewModelStore;
import androidx.lifecycle.ViewModelStoreOwner;

import com.bumptech.glide.Glide;
import com.bumptech.glide.request.target.SimpleTarget;
import com.bumptech.glide.request.transition.Transition;
import com.cosinetech.imates.activities.MainActivity;
import com.cosinetech.imates.service.FloatingWindowService;
import com.cosinetech.imates.util.AssetsCopyUtils;
import com.cosinetech.imates.webservice.AiChatMessageRequest;
import com.sendtion.xrichtext.IImageLoader;
import com.sendtion.xrichtext.XRichText;
import com.xuexiang.xupdate.XUpdate;
import com.xuexiang.xupdate.utils.UpdateUtils;

public class ApplicationModelShared extends Application implements ViewModelStoreOwner {
    private final ViewModelStore viewModelStore = new ViewModelStore();
    private MainActivity mainActivity;
    private FloatingWindowService floatingWindowService;

    public AiChatMessageRequest chatRequest;
    private int activityCount = 0;

    private static ApplicationModelShared appInstance = null;

    @Override
    public void onCreate() {
        super.onCreate();
        appInstance = this;
        // 拷贝文件到 Documents 目录
        AssetsCopyUtils.copyAssetsToDocuments(this);


        // 在任意地方，调用以下方法即可，崩溃发生后，会在下一次App启动的时候使用Service异步打包日志，
        // 然后上传日志，发送成功与否，Service都会自动退出释放内存
        //LogReport.getInstance().upload(this);
        // 使用以下方法，打印Log的同时，把Log信息保存到本地（保存的时候会附带线程名称，线程id，打印时间），
        // 并且随同崩溃日志一起，发送到特定的邮箱或者服务器上。帮助开发者还原用户的操作路径，更好的分析崩溃产生的原因
        //LogWriter.writeLog("wenming", "打Log测试！！！！");

        XRichText.getInstance().setImageLoader(new IImageLoader() {
            @Override
            public void loadImage(final String imagePath, final ImageView imageView, final int imageHeight) {
                Log.e("---", "imageHeight: "+imageHeight);
                //如果是网络图片
                if (imagePath.startsWith("http://") || imagePath.startsWith("https://")){
                    Glide.with(getApplicationContext()).asBitmap().load(imagePath).dontAnimate()
                            .into(new SimpleTarget<Bitmap>() {
                                @Override
                                public void onResourceReady(@NonNull Bitmap resource, @Nullable Transition<? super Bitmap> transition) {
                                    if (imageHeight > 0) {//固定高度
                                        RelativeLayout.LayoutParams lp = new RelativeLayout.LayoutParams(
                                                FrameLayout.LayoutParams.MATCH_PARENT, imageHeight);//固定图片高度，记得设置裁剪剧中
                                        lp.bottomMargin = 10;//图片的底边距
                                        imageView.setLayoutParams(lp);
                                        Glide.with(getApplicationContext()).asBitmap().load(imagePath).centerCrop()
                                                .placeholder(R.mipmap.img_load_fail).error(R.mipmap.img_load_fail).into(imageView);
                                    } else {//自适应高度
                                        Glide.with(getApplicationContext()).asBitmap().load(imagePath)
                                                .placeholder(R.mipmap.img_load_fail).error(R.mipmap.img_load_fail).fitCenter().into(imageView);
                                    }
                                }
                            });
                } else { //如果是本地图片
//                    if (imageHeight > 0) {//固定高度
//                        RelativeLayout.LayoutParams lp = new RelativeLayout.LayoutParams(
//                                FrameLayout.LayoutParams.MATCH_PARENT, imageHeight);//固定图片高度，记得设置裁剪剧中
//                        lp.bottomMargin = 10;//图片的底边距
//                        imageView.setLayoutParams(lp);
//
//                        Glide.with(getApplicationContext()).asBitmap().load(imagePath).centerCrop()
//                                .placeholder(R.mipmap.img_load_fail).error(R.mipmap.img_load_fail).fitCenter().into(imageView);
//                    } else {//自适应高度
//                        Glide.with(getApplicationContext()).asBitmap().load(imagePath)
//                                .placeholder(R.mipmap.img_load_fail).error(R.mipmap.img_load_fail).fitCenter().into(imageView);
//                    }

                    Glide.with(getApplicationContext()).asBitmap().load(imagePath)
                            .placeholder(R.mipmap.img_load_fail).error(R.mipmap.img_load_fail).fitCenter().into(imageView);
                }
            }
        });

//        registerActivityLifecycleCallbacks(new Application.ActivityLifecycleCallbacks(){
//
//            /**
//             * Called when the Activity calls {@link Activity#onCreate super.onCreate()}.
//             *
//             * @param activity
//             * @param savedInstanceState
//             */
//            @Override
//            public void onActivityCreated(@NonNull Activity activity, @Nullable Bundle savedInstanceState) {
//                activityCount++;
//            }
//
//            /**
//             * Called when the Activity calls {@link Activity#onStart super.onStart()}.
//             *
//             * @param activity
//             */
//            @Override
//            public void onActivityStarted(@NonNull Activity activity) {
//
//            }
//
//            /**
//             * Called when the Activity calls {@link Activity#onResume super.onResume()}.
//             *
//             * @param activity
//             */
//            @Override
//            public void onActivityResumed(@NonNull Activity activity) {
//
//            }
//
//            /**
//             * Called when the Activity calls {@link Activity#onPause super.onPause()}.
//             *
//             * @param activity
//             */
//            @Override
//            public void onActivityPaused(@NonNull Activity activity) {
//
//            }
//
//            /**
//             * Called when the Activity calls {@link Activity#onStop super.onStop()}.
//             *
//             * @param activity
//             */
//            @Override
//            public void onActivityStopped(@NonNull Activity activity) {
//
//            }
//
//            /**
//             * Called when the Activity calls
//             * {@link Activity#onSaveInstanceState super.onSaveInstanceState()}.
//             *
//             * @param activity
//             * @param outState
//             */
//            @Override
//            public void onActivitySaveInstanceState(@NonNull Activity activity, @NonNull Bundle outState) {
//            }
//
//            /**
//             * Called when the Activity calls {@link Activity#onDestroy super.onDestroy()}.
//             *
//             * @param activity
//             */
//            @Override
//            public void onActivityDestroyed(@NonNull Activity activity) {
//                activityCount--;
//                if (activityCount == 0) {
//                    // 应用完全退出，停止服务
//                    stopService(new Intent(ApplicationModelShared.this, FloatingWindowService.class));
//                }
//            }
//        });

    }

    public static ApplicationModelShared getInstance() {
            return appInstance;
    }

    public void setMainActivity(MainActivity activity) {
        mainActivity = activity;
    }

    public MainActivity getMainActivity() {
        return mainActivity;
    }

    public void setFloatingWindowService(FloatingWindowService service) {
        floatingWindowService = service;
    }

    public FloatingWindowService getFloatingWindowService() {
        return floatingWindowService;
    }

    @NonNull
    @Override
    public ViewModelStore getViewModelStore() {
        return viewModelStore;
    }
}
