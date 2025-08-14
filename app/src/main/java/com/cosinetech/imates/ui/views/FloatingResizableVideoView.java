package com.cosinetech.imates.ui.views;

import android.content.Context;
import android.util.AttributeSet;
import android.util.TypedValue;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import com.cosinetech.imates.R;

public class FloatingResizableVideoView extends FrameLayout {
    private static final int MIN_WIDTH = 640; // 最小宽度
    private static final int MIN_HEIGHT = 400; // 最小高度

    private OnResizeListener onResizeListener;

    private View resizeLeftBottom;
    private View resizeRightBottom;
    private boolean isResizing = false;
    private ViewGroup.LayoutParams params;

    public FloatingResizableVideoView(Context context) {
        super(context);
        init();
    }

    public FloatingResizableVideoView(Context context, AttributeSet attrs) {
        super(context, attrs);
        init();
    }

    private void init() {
        inflate(getContext(), R.layout.floating_video_view, this);

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
                    params =  getLayoutParams();
                    if (onResizeListener != null) {
                        onResizeListener.onResizeBegin();
                    }
                    break;
                case MotionEvent.ACTION_MOVE:
                    if (isResizing) {
                        adjustSize(event.getRawX(), event.getRawY(), isLeftBottom);
                        return true; // 消费此事件以防止传递给其他视图
                    }
                    break;
                case MotionEvent.ACTION_UP:
                    isResizing = false;
                    if (onResizeListener != null) {
                        onResizeListener.onResizeEnd();
                    }
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
//            params.x += getWidth() - newWidth;
        } else {
            newWidth = Math.max(MIN_WIDTH, (int) (rawX - outValue[0]));
            newHeight = Math.max(MIN_HEIGHT, (int) (rawY - outValue[1]));
        }

        if(newWidth < MIN_WIDTH) {
            newWidth = MIN_WIDTH;
        }

        if(newHeight < MIN_HEIGHT) {
            newHeight = MIN_HEIGHT;
        }
        params.width = newWidth;
        params.height = newHeight;

        if (onResizeListener != null) {
            onResizeListener.onResize(newWidth, newHeight);
        }
    }

    public void setOnResizeListener(OnResizeListener listener) {
        this.onResizeListener = listener;
    }

    public interface OnResizeListener {
        void onResizeBegin();
        void onResize(int width, int height);

        void onResizeEnd();
    }

    private int dpToPx(int dp) {
        return (int) TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP, dp, getResources().getDisplayMetrics());
    }
}
