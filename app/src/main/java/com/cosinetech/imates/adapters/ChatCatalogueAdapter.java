package com.cosinetech.imates.adapters;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.TextView;

import com.cosinetech.imates.R;
import com.cosinetech.imates.models.ChatMessageCatalogue;

import java.util.List;

public class ChatCatalogueAdapter extends BaseAdapter {
    private Context context;
    private List<ChatMessageCatalogue> data;

    // 构造函数
    public ChatCatalogueAdapter(Context context, List<ChatMessageCatalogue> data) {
        this.context = context;
        this.data = data;
    }

    @Override
    public int getCount() {
        return data.size();
    }

    @Override
    public Object getItem(int position) {
        return data.get(position);
    }

    @Override
    public long getItemId(int position) {
        return position;
    }

    @Override
    public View getView(int position, View convertView, ViewGroup parent) {
        // 重用 convertView，提升性能
        if (convertView == null) {
            convertView = LayoutInflater.from(context).inflate(R.layout.tag_item, parent, false);
        }

        // 获取 TextView 并设置数据
        TextView textView = convertView.findViewById(R.id.tv_tag);
        textView.setText(data.get(position).date);
        return convertView;
    }
}

