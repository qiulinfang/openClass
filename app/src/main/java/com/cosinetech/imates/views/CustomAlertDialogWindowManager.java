package com.cosinetech.imates.views;

import android.content.Context;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.PopupWindow;
import android.widget.TextView;

import com.cosinetech.imates.R;

import android.content.Context;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

public class CustomAlertDialogWindowManager {

    private Context mContext;
    private View mPopupView;
    private WindowManager mWindowManager;

    public CustomAlertDialogWindowManager(Context context) {
        mContext = context;
        mWindowManager = (WindowManager) context.getSystemService(Context.WINDOW_SERVICE);

        // 初始化布局
        LayoutInflater inflater = (LayoutInflater) context.getSystemService(Context.LAYOUT_INFLATER_SERVICE);
        mPopupView = inflater.inflate(R.layout.popup_alert_dialog, null);
    }

    public void show(String message, String positiveButtonText, String negativeButtonText,
                     View.OnClickListener positiveListener, View.OnClickListener negativeListener) {
        // 设置消息文本
        TextView messageTextView = mPopupView.findViewById(R.id.message);
        messageTextView.setText(message);

        // 设置确认按钮
        Button positiveButton = mPopupView.findViewById(R.id.positive_button);
        positiveButton.setText(positiveButtonText);
        positiveButton.setOnClickListener(new AutoDismissClickListener(positiveListener));

        // 设置取消按钮
        Button negativeButton = mPopupView.findViewById(R.id.negative_button);
        negativeButton.setText(negativeButtonText);
        negativeButton.setOnClickListener(new AutoDismissClickListener(negativeListener));

        // 创建 LayoutParams
        WindowManager.LayoutParams params = new WindowManager.LayoutParams();
        params.type = WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY; // 确保你使用的是合适的类型
        params.flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE;
        params.width = WindowManager.LayoutParams.WRAP_CONTENT;
        params.height = WindowManager.LayoutParams.WRAP_CONTENT;
        params.gravity = Gravity.CENTER; // 在屏幕中央显示

        // 添加视图到 WindowManager
        mWindowManager.addView(mPopupView, params);
    }

    // 关闭弹窗
    public void dismiss() {
        if (mWindowManager != null && mPopupView != null) {
            mWindowManager.removeView(mPopupView);
        }
    }

    // 封装点击监听器，自动关闭弹窗
    private class AutoDismissClickListener implements View.OnClickListener {
        private final View.OnClickListener mWrappedListener;

        AutoDismissClickListener(View.OnClickListener wrappedListener) {
            mWrappedListener = wrappedListener;
        }

        @Override
        public void onClick(View v) {
            // 执行原有的点击事件
            if (mWrappedListener != null) {
                mWrappedListener.onClick(v);
            }
            // 自动关闭弹窗
            dismiss();
        }
    }
}

