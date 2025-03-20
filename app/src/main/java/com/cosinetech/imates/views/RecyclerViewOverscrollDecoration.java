package com.cosinetech.imates.views;

import android.graphics.Rect;
import android.view.View;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

public class RecyclerViewOverscrollDecoration extends RecyclerView.ItemDecoration {

    @Override
    public void getItemOffsets(@NonNull Rect outRect, @NonNull View view,
                               @NonNull RecyclerView parent, @NonNull RecyclerView.State state) {
        super.getItemOffsets(outRect, view, parent, state);

        RecyclerView.LayoutManager layoutManager = parent.getLayoutManager();
        if (!(layoutManager instanceof LinearLayoutManager)) {
            return; // Only works with LinearLayoutManager
        }

        LinearLayoutManager linearLayoutManager = (LinearLayoutManager) layoutManager;
        RecyclerView.Adapter<?> adapter = parent.getAdapter();
        if (adapter == null) return;

        int position = parent.getChildAdapterPosition(view);
        boolean isReverseLayout = linearLayoutManager.getReverseLayout();
        boolean isHorizontal = linearLayoutManager.getOrientation() == LinearLayoutManager.HORIZONTAL;

        int reservePadH = parent.getWidth() * 3 / 4;
        int reservePadV = parent.getHeight() * 3 / 4;
        // Calculate extra space for first/last item based on orientation and reverseLayout
        if (isReverseLayout) {
            // When reversed, we need to add space to the first item
            if (position == 0) {
                if (isHorizontal) {
                    // Horizontal + reversed: add space to the left of first item
                    outRect.left = reservePadH; //parent.getWidth();
                } else {
                    // Vertical + reversed: add space to the top of first item
                    outRect.top = reservePadV;// parent.getHeight();
                }
            }
        } else {
            // Normal layout, add space to the last item
            if (position == adapter.getItemCount() - 1) {
                if (isHorizontal) {
                    // Horizontal: add space to the right of last item
                    outRect.right = reservePadH; // parent.getWidth();
                } else {
                    // Vertical: add space to the bottom of last item
                    outRect.bottom = reservePadV; //parent.getHeight();
                }
            }
        }
    }
}

