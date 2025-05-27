package com.cosinetech.imates.admin;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.cosinetech.imates.R;

import java.util.List;

public class AppGridAdapter extends RecyclerView.Adapter<AppGridAdapter.AppViewHolder> {

    public interface OnAppClickListener {
        void onAppClick(AppInfo appInfo);
    }

    private List<AppInfo> appList;
    private OnAppClickListener clickListener;

    public AppGridAdapter(List<AppInfo> appList, OnAppClickListener clickListener) {
        this.appList = appList;
        this.clickListener = clickListener;
    }

    @NonNull
    @Override
    public AppViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_app_grid, parent, false);
        return new AppViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull AppViewHolder holder, int position) {
        AppInfo appInfo = appList.get(position);
        holder.bind(appInfo, clickListener);
    }

    @Override
    public int getItemCount() {
        return appList.size();
    }

    static class AppViewHolder extends RecyclerView.ViewHolder {
        private ImageView appIcon;
        private TextView appName;

        public AppViewHolder(@NonNull View itemView) {
            super(itemView);
            appIcon = itemView.findViewById(R.id.app_icon);
            appName = itemView.findViewById(R.id.app_name);
        }

        public void bind(AppInfo appInfo, OnAppClickListener clickListener) {
            appIcon.setImageDrawable(appInfo.getAppIcon());
            appName.setText(appInfo.getAppName());

            itemView.setOnClickListener(v -> {
                if (clickListener != null) {
                    clickListener.onAppClick(appInfo);
                }
            });
        }
    }
}
