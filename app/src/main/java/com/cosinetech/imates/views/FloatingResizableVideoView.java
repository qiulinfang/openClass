package com.cosinetech.imates.views;

import android.content.Context;
import android.util.AttributeSet;
import android.util.TypedValue;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;

import com.cosinetech.imates.R;

public class FloatingResizableVideoView extends FrameLayout {
    private static final int MIN_WIDTH = 320; // 最小宽度
    private static final int MIN_HEIGHT = 200; // 最小高度

    private View resizeLeftBottom;
    private View resizeRightBottom;
    private boolean isResizing = false;
    private WindowManager.LayoutParams params;

    public FloatingResizableVideoView(Context context) {
        super(context);
        init();
    }

    public FloatingResizableVideoView(Context context, AttributeSet attrs) {
        super(context, attrs);
        init();
    }

    private void init() {
        inflate(getContext(), R.layout.floating_video_play, this);

        resizeLeftBottom = findViewById(R.id.resize_left_bottom);
        resizeRightBottom = findViewById(R.id.resize_right_bottom);

        setupResizeListeners();
    }

    private void setupResizeListeners() {
        resizeLeftBottom.setOnTouchListener(new ResizeTouchListener(true));
        resizeRightBottom.setOnTouchListener(new ResizeTouchListener(false));
    }

    private class ResizeTouchListener implements OnTouchListener {
        private final boolean isLeftBottom;

        public ResizeTouchListener(boolean isLeftBottom) {
            this.isLeftBottom = isLeftBottom;
        }

        @Override
        public boolean onTouch(View v, MotionEvent event) {
            switch (event.getAction()) {
                case MotionEvent.ACTION_DOWN:
                    isResizing = true;
                    params = (WindowManager.LayoutParams) getLayoutParams();
                    break;
                case MotionEvent.ACTION_MOVE:
                    if (isResizing) {
                        adjustSize(event.getRawX(), event.getRawY(), isLeftBottom);
                        return true; // 消费此事件以防止传递给其他视图
                    }
                    break;
                case MotionEvent.ACTION_UP:
                    isResizing = false;
                    break;
            }
            return false;
        }
    }

    private void adjustSize(float rawX, float rawY, boolean isLeftBottom) {
        int newWidth, newHeight;
        int [] outValue = new int[2];
        getLocationOnScreen(outValue);
        if (isLeftBottom) {
            newWidth = Math.max(MIN_WIDTH, (int) (getWidth() - (rawX - outValue[0])));
            newHeight = Math.max(MIN_HEIGHT, (int) (rawY - outValue[1]));
            params.x += getWidth() - newWidth;
        } else {
            newWidth = Math.max(MIN_WIDTH, (int) (rawX - outValue[0]));
            newHeight = Math.max(MIN_HEIGHT, (int) (rawY - outValue[1]));
        }

        params.width = newWidth;
        params.height = newHeight;

        WindowManager wm = (WindowManager) getContext().getSystemService(Context.WINDOW_SERVICE);
        wm.updateViewLayout(FloatingResizableVideoView.this, params);
    }

    private int dpToPx(int dp) {
        return (int) TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP, dp, getResources().getDisplayMetrics());
    }
}
