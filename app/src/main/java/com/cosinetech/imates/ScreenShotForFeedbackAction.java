package com.cosinetech.imates;

import android.content.Context;
import android.content.Intent;
import android.os.Parcel;
import android.os.Parcelable;

import androidx.annotation.NonNull;

import com.cosinetech.imates.activities.FeedbackActivity;
import com.cosinetech.imates.activities.ScreenShotActivity;

public class ScreenShotForFeedbackAction implements ScreenShotActivity.OnScreenShotListener {
    /**
     * @param filePath
     */
    @Override
    public void onImageCaptured(Context context, String filePath) {
        //启动反馈Activity
        Intent intent = new Intent(context, FeedbackActivity.class);
        intent.putExtra(FeedbackActivity.KEY_FEEDBACK_IMAGE, filePath);
        context.startActivity(intent);
    }

    @Override
    public int describeContents() {
        return 0;
    }

    @Override
    public void writeToParcel(@NonNull Parcel dest, int flags) {

    }

    public static final Parcelable.Creator<ScreenShotForFeedbackAction> CREATOR = new Parcelable.Creator<ScreenShotForFeedbackAction>() {
        @Override
        public ScreenShotForFeedbackAction createFromParcel(Parcel source) {
            return new ScreenShotForFeedbackAction();
        }

        @Override
        public ScreenShotForFeedbackAction[] newArray(int size) {
            return new ScreenShotForFeedbackAction[size];
        }
    };
}
