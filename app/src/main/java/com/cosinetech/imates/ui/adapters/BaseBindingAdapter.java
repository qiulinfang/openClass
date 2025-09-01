package com.cosinetech.imates.ui.adapters;

import android.annotation.SuppressLint;
import android.content.Context;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.ViewGroup;

import androidx.annotation.LayoutRes;
import androidx.annotation.NonNull;
import androidx.databinding.DataBindingUtil;
import androidx.databinding.ObservableArrayList;
import androidx.databinding.ViewDataBinding;
import androidx.recyclerview.widget.RecyclerView;

public abstract class BaseBindingAdapter<M, B extends ViewDataBinding>
        extends RecyclerView.Adapter<BaseBindingViewHolder<B, M>> {
    protected Context context;
    protected ObservableArrayList<M> items;
    protected ListChangedCallback itemsChangeCallback;

    public BaseBindingAdapter(Context context) {
        this.context = context;
        this.items = new ObservableArrayList<>();
        this.itemsChangeCallback = new ListChangedCallback();
    }

    public ObservableArrayList<M> getItems() {
        return items;
    }

    @Override
    public int getItemCount() {
        return this.items.size();
    }

    @NonNull
    @Override
    public BaseBindingViewHolder<B, M> onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        B binding = DataBindingUtil.inflate(LayoutInflater.from(this.context), this.getLayoutResId(viewType), parent, false);
        BaseBindingViewHolder<B, M> viewHolder = new BaseBindingViewHolder<>(binding.getRoot());
        viewHolder.setViewType(viewType);
        viewHolder.setBinding(binding);
        return viewHolder;
    }

    @Override
    public void onBindViewHolder(@NonNull BaseBindingViewHolder<B, M> holder, int position) {
        holder.setBindItem(this.items.get(position));
        B binding = DataBindingUtil.getBinding(holder.itemView);
        Log.e("BaseBindingAdapter", "View bind: " + holder);
        this.onBindItem(binding, this.items.get(position), position);
    }

    @Override
    public void onAttachedToRecyclerView(@NonNull RecyclerView recyclerView) {
        super.onAttachedToRecyclerView(recyclerView);
        this.items.addOnListChangedCallback(itemsChangeCallback);
    }

    @Override
    public void onDetachedFromRecyclerView(@NonNull RecyclerView recyclerView) {
        super.onDetachedFromRecyclerView(recyclerView);
        this.items.removeOnListChangedCallback(itemsChangeCallback);
    }

    //region 处理数据集变化
    @SuppressLint("NotifyDataSetChanged")
    protected void onChanged(ObservableArrayList<M> newItems) {
        resetItems(newItems);
        notifyDataSetChanged();
    }

    protected void onItemRangeChanged(ObservableArrayList<M> newItems, int positionStart, int itemCount) {
        resetItems(newItems);
        notifyItemRangeChanged(positionStart,itemCount);
    }

    protected void onItemRangeInserted(ObservableArrayList<M> newItems, int positionStart, int itemCount) {
        resetItems(newItems);
        notifyItemRangeInserted(positionStart,itemCount);
    }

    @SuppressLint("NotifyDataSetChanged")
    protected void onItemRangeMoved(ObservableArrayList<M> newItems) {
        resetItems(newItems);
        notifyDataSetChanged();
    }

    protected void onItemRangeRemoved(ObservableArrayList<M> newItems, int positionStart, int itemCount) {
        resetItems(newItems);
        notifyItemRangeRemoved(positionStart,itemCount);
    }

    protected void resetItems(ObservableArrayList<M> newItems) {
        this.items = newItems;
    }
    //endregion

    protected abstract @LayoutRes
    int getLayoutResId(int viewType);

    protected abstract void onBindItem(B binding, M item, int position);

    protected  class ListChangedCallback extends ObservableArrayList.OnListChangedCallback<ObservableArrayList<M>> {
        @Override
        public void onChanged(ObservableArrayList<M> newItems) {
            BaseBindingAdapter.this.onChanged(newItems);
        }

        @Override
        public void onItemRangeChanged(ObservableArrayList<M> newItems, int i, int i1) {
            BaseBindingAdapter.this.onItemRangeChanged(newItems,i,i1);
        }

        @Override
        public void onItemRangeInserted(ObservableArrayList<M> newItems, int i, int i1) {
            BaseBindingAdapter.this.onItemRangeInserted(newItems,i,i1);
        }

        @Override
        public void onItemRangeMoved(ObservableArrayList<M> newItems, int i, int i1, int i2) {
            BaseBindingAdapter.this.onItemRangeMoved(newItems);
        }

        @Override
        public void onItemRangeRemoved(ObservableArrayList<M> sender, int positionStart, int itemCount) {
            BaseBindingAdapter.this.onItemRangeRemoved(sender,positionStart,itemCount);
        }
    }
}
