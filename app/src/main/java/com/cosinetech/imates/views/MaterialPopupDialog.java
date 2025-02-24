package com.cosinetech.imates.views;

import android.content.Context;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.PopupWindow;
import android.widget.TextView;

import com.cosinetech.imates.R;
import com.google.android.material.button.MaterialButton;

public class MaterialPopupDialog {
    private Context context;
    private String title;
    private String message;
    private String positiveButtonText;
    private OnClickListener positiveListener;
    private String negativeButtonText;
    private OnClickListener negativeListener;
    private PopupWindow popupWindow;

    // 构造函数私有化，通过 Builder 创建
    private MaterialPopupDialog(Builder builder) {
        this.context = builder.context;
        this.title = builder.title;
        this.message = builder.message;
        this.positiveButtonText = builder.positiveButtonText;
        this.positiveListener = builder.positiveListener;
        this.negativeButtonText = builder.negativeButtonText;
        this.negativeListener = builder.negativeListener;
    }

    public void show(View anchorView) {
        // 1. 解析布局
        LayoutInflater inflater = LayoutInflater.from(context);
        View dialogView = inflater.inflate(R.layout.dialog_custom_popup, null);

        // 2. 设置标题和消息
        TextView tvTitle = dialogView.findViewById(R.id.tv_title);
        TextView tvMessage = dialogView.findViewById(R.id.tv_message);

        if (title != null) {
            tvTitle.setText(title);
            tvTitle.setVisibility(View.VISIBLE);
        } else {
            tvTitle.setVisibility(View.GONE);
        }

        if (message != null) {
            tvMessage.setText(message);
            tvMessage.setVisibility(View.VISIBLE);
        } else {
            tvMessage.setVisibility(View.GONE);
        }

        // 3. 设置按钮
        MaterialButton btnPositive = dialogView.findViewById(R.id.btn_positive);
        MaterialButton btnNegative = dialogView.findViewById(R.id.btn_negative);

        if (positiveButtonText != null) {
            btnPositive.setText(positiveButtonText);
            btnPositive.setOnClickListener(v -> {
                if (positiveListener != null) positiveListener.onClick();
                popupWindow.dismiss();
            });
            btnPositive.setVisibility(View.VISIBLE);
        } else {
            btnPositive.setVisibility(View.GONE);
        }

        if (negativeButtonText != null) {
            btnNegative.setText(negativeButtonText);
            btnNegative.setOnClickListener(v -> {
                if (negativeListener != null) negativeListener.onClick();
                popupWindow.dismiss();
            });
            btnNegative.setVisibility(View.VISIBLE);
        } else {
            btnNegative.setVisibility(View.GONE);
        }

        // 4. 创建并显示 PopupWindow
        popupWindow = new PopupWindow(
                dialogView,
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
                true
        );

        // 设置背景和动画
        popupWindow.setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
        popupWindow.setAnimationStyle(R.style.PopupAnimation);

        // 显示在锚点视图下方
        popupWindow.showAsDropDown(anchorView);
    }

    // 点击监听接口
    public interface OnClickListener {
        void onClick();
    }

    // Builder 类（链式调用）
    public static class Builder {
        private Context context;
        private String title;
        private String message;
        private String positiveButtonText;
        private OnClickListener positiveListener;
        private String negativeButtonText;
        private OnClickListener negativeListener;

        public Builder(Context context) {
            this.context = context;
        }

        public Builder setTitle(String title) {
            this.title = title;
            return this;
        }

        public Builder setMessage(String message) {
            this.message = message;
            return this;
        }

        public Builder setPositiveButton(String text, OnClickListener listener) {
            this.positiveButtonText = text;
            this.positiveListener = listener;
            return this;
        }

        public Builder setNegativeButton(String text, OnClickListener listener) {
            this.negativeButtonText = text;
            this.negativeListener = listener;
            return this;
        }

        public MaterialPopupDialog build() {
            return new MaterialPopupDialog(this);
        }
    }
}
