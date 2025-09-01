package com.cosinetech.imates.ui.adapters;

import android.view.View;

import androidx.databinding.ViewDataBinding;
import androidx.recyclerview.widget.RecyclerView;

public class BaseBindingViewHolder<B extends ViewDataBinding, M> extends RecyclerView.ViewHolder {
    private B binding;
    private M item;
    private int viewType;

    public BaseBindingViewHolder(View itemView) {
        super(itemView);
    }

    public B getBinding() {
        return binding;
    }

    public void setBinding(B binding) {
        this.binding = binding;
    }

    public M getBindItem() {
        return item;
    }

    public void setBindItem(M item) {
        this.item = item;
    }

    public int getViewType() {
        return viewType;
    }

    public void setViewType(int viewType) {
        this.viewType = viewType;
    }
}
