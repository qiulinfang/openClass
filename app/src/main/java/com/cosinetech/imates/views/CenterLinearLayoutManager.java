package com.cosinetech.imates.views;

import android.content.Context;
import android.util.AttributeSet;
import android.view.View;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

public class CenterLinearLayoutManager extends LinearLayoutManager {

    private RecyclerView recyclerView;

    // Constructor
    public CenterLinearLayoutManager(Context context) {
        super(context);
    }

    public CenterLinearLayoutManager(Context context, int orientation, boolean reverseLayout) {
        super(context, orientation, reverseLayout);
    }

    public CenterLinearLayoutManager(Context context, AttributeSet attrs, int defStyleAttr, int defStyleRes) {
        super(context, attrs, defStyleAttr, defStyleRes);
    }

    @Override
    public void onLayoutChildren(RecyclerView.Recycler recycler, RecyclerView.State state) {
        // Always measure first item, its size determines starting offset
        // This must be done before super.onLayoutChildren
        if (getChildCount() == 0 && state.getItemCount() > 0) {
            View firstChild = recycler.getViewForPosition(0);
            measureChildWithMargins(firstChild, 0, 0);
            recycler.recycleView(firstChild);
        }
        super.onLayoutChildren(recycler, state);
    }

    @Override
    public void measureChildWithMargins(View child, int widthUsed, int heightUsed) {
        int lp = ((RecyclerView.LayoutParams) child.getLayoutParams()).getViewAdapterPosition();
        super.measureChildWithMargins(child, widthUsed, heightUsed);

        if (lp != 0 && lp != getItemCount() - 1) return;

        // After determining first and/or last items size, use it to alter host padding
        switch (getOrientation()) {
            case HORIZONTAL: {
                int hPadding = Math.max((getWidth() - child.getMeasuredWidth()) / 2, 0);
                if (!getReverseLayout()) {
                    //if (lp == 0) recyclerView.setPaddingRelative(hPadding, recyclerView.getPaddingTop(), recyclerView.getPaddingEnd(), recyclerView.getPaddingBottom());
                    if (lp == getItemCount() - 1) recyclerView.setPaddingRelative(recyclerView.getPaddingStart(), recyclerView.getPaddingTop(), hPadding, recyclerView.getPaddingBottom());
                } else {
                    //if (lp == 0) recyclerView.setPaddingRelative(recyclerView.getPaddingStart(), recyclerView.getPaddingTop(), hPadding, recyclerView.getPaddingBottom());
                    if (lp == getItemCount() - 1) recyclerView.setPaddingRelative(hPadding, recyclerView.getPaddingTop(), recyclerView.getPaddingEnd(), recyclerView.getPaddingBottom());
                }
                break;
            }
            case VERTICAL: {
                int vPadding = Math.max((getHeight() - child.getMeasuredHeight()) / 2, 0);
                if (!getReverseLayout()) {
                    //if (lp == 0) recyclerView.setPaddingRelative(recyclerView.getPaddingStart(), vPadding, recyclerView.getPaddingEnd(), recyclerView.getPaddingBottom());
                    if (lp == getItemCount() - 1) recyclerView.setPaddingRelative(recyclerView.getPaddingStart(), recyclerView.getPaddingTop(), recyclerView.getPaddingEnd(), vPadding);
                } else {
                    //if (lp == 0) recyclerView.setPaddingRelative(recyclerView.getPaddingStart(), recyclerView.getPaddingTop(), recyclerView.getPaddingEnd(), vPadding);
                    if (lp == getItemCount() - 1) recyclerView.setPaddingRelative(recyclerView.getPaddingStart(), vPadding, recyclerView.getPaddingEnd(), recyclerView.getPaddingBottom());
                }
                break;
            }
        }
    }

    // Capture host RecyclerView
    @Override
    public void onAttachedToWindow(RecyclerView view) {
        recyclerView = view;
        super.onAttachedToWindow(view);
    }
}
