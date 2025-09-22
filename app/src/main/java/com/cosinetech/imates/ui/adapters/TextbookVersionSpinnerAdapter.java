package com.cosinetech.imates.ui.adapters;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ArrayAdapter;
import android.widget.TextView;

import androidx.annotation.NonNull;

import com.cosinetech.imates.R;
import com.cosinetech.imates.textbookservice.UserTextbookInfo;

import java.util.List;

public class TextbookVersionSpinnerAdapter extends ArrayAdapter<UserTextbookInfo> {

    private final LayoutInflater inflater;

    public TextbookVersionSpinnerAdapter(Context context, List<UserTextbookInfo> list) {
        super(context, 0, list);
        inflater = LayoutInflater.from(context);
    }

    @NonNull
    @Override
    public View getView(int position, View convertView, @NonNull ViewGroup parent) {
        return createView(position, convertView, parent);
    }

    @Override
    public View getDropDownView(int position, View convertView, @NonNull ViewGroup parent) {
        return createView(position, convertView, parent);
    }

    private View createView(int position, View convertView, ViewGroup parent) {
        View view = convertView;
        if (view == null) {
            view = inflater.inflate(R.layout.item_textbook_version_spinner, parent, false);
        }

        UserTextbookInfo item = getItem(position);
        if (item != null) {
            TextView tvTitle = view.findViewById(R.id.tvTitle);
            TextView tvPublisher = view.findViewById(R.id.tvPublisher);

            // 拼接学期、年级、名称
            String title = item.textbookGradeLabel + " " +
                    item.textbookSemesterLabel + " " +
                    item.textbookSubjectLabel + " " +
                    item.textbookName;
            tvTitle.setText(title);

            // 出版社
            tvPublisher.setText(item.textbookPublisher);
        }
        return view;
    }
}