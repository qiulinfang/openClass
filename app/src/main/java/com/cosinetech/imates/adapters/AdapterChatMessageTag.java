package com.cosinetech.imates.adapters;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.TextView;

import com.cosinetech.imates.R;
import com.cosinetech.imates.models.SubjectUtils;
import com.cosinetech.imates.widgets.OnInitSelectedPosition;

import java.util.ArrayList;
import java.util.List;

public class AdapterChatMessageTag<T> extends BaseAdapter implements OnInitSelectedPosition {

    private final Context mContext;
    private final List<String> mDataList;

    public AdapterChatMessageTag(Context context) {
        this.mContext = context;
        mDataList = new ArrayList<>();
    }

    @Override
    public int getCount() {
        return mDataList.size();
    }

    @Override
    public Object getItem(int position) {
        return mDataList.get(position);
    }

    @Override
    public long getItemId(int position) {
        return position;
    }

    @Override
    public View getView(int position, View convertView, ViewGroup parent) {

        if(convertView == null) {
            convertView = LayoutInflater.from(mContext).inflate(R.layout.chat_msg_tag_item, null);
        }

        TextView textView =  convertView.findViewById(R.id.tv_tag);
        String t = mDataList.get(position);

        textView.setText(SubjectUtils.getSubjectDisplayName(t));
        return convertView;
    }

    public void onlyAddAll(List<String> datas) {
        mDataList.addAll(datas);
        notifyDataSetChanged();
    }

    public void clearAndAddAll(List<String> datas) {
        mDataList.clear();
        onlyAddAll(datas);
    }

    @Override
    public boolean isSelectedPosition(int position) {
        return position % 2 == 0;
    }
}
