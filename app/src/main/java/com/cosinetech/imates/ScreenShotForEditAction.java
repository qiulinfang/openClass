package com.cosinetech.imates;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Parcel;
import android.os.Parcelable;

import androidx.annotation.NonNull;

import com.cosinetech.imates.activities.FeedbackActivity;
import com.cosinetech.imates.activities.ScreenShotActivity;

import java.io.File;

import me.minetsh.imaging.IMGEditActivity;

public class ScreenShotForEditAction implements ScreenShotActivity.OnScreenShotListener {
    private IMGEditActivity.OnImageEditListener mListener; // 接口成员变量

    // 默认构造函数
    public ScreenShotForEditAction() {}

    // 从 Parcel 中重建对象的构造函数
    protected ScreenShotForEditAction(Parcel in) {
        // 从 Parcel 中读取 OnImageEditListener 对象
        this.mListener = in.readParcelable(IMGEditActivity.OnImageEditListener.class.getClassLoader());
    }

    // 设置接口
    public void setOnImageEditListener(IMGEditActivity.OnImageEditListener listener) {
        this.mListener = listener;
    }

    @Override
    public void onImageCaptured(Context context, String filePath) {
        // 启动图片编辑页面，并传递 mListener
        context.startActivity(
                new Intent(context, IMGEditActivity.class)
                        .putExtra(IMGEditActivity.EXTRA_IMAGE_URI, Uri.fromFile(new File(filePath)))
                        .putExtra(IMGEditActivity.EXTRA_IMAGE_SAVE_PATH, filePath)
                        .putExtra(IMGEditActivity.EXTRA_LISTENER, mListener));
    }

    // 实现 Parcelable 的方法
    @Override
    public int describeContents() {
        return 0;
    }

    @Override
    public void writeToParcel(@NonNull Parcel dest, int flags) {
        // 将 OnImageEditListener 对象写入 Parcel
        dest.writeParcelable((Parcelable) mListener, flags);
    }

    public static final Creator<ScreenShotForEditAction> CREATOR = new Creator<>() {
        @Override
        public ScreenShotForEditAction createFromParcel(Parcel source) {
            return new ScreenShotForEditAction(source);
        }

        @Override
        public ScreenShotForEditAction[] newArray(int size) {
            return new ScreenShotForEditAction[size];
        }
    };
}
