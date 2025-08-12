package com.cosinetech.imates.adapters;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.cosinetech.imates.R;
import com.cosinetech.imates.views.MarkdownTextView;
import com.cosinetech.imates.coreapiservice.Question;

import java.util.List;

public class AdapterMultiSelectSimilarQuestionList extends RecyclerView.Adapter<AdapterMultiSelectSimilarQuestionList.SimilarQuestionItemViewHolder> {
    private final List<Question> dataList;
    private int selectedPosition = -1;

    // 构造函数接收数据列表
    public AdapterMultiSelectSimilarQuestionList(List<Question> dataList) {
        this.dataList = dataList;
    }

    @NonNull
    @Override
    public SimilarQuestionItemViewHolder onCreateViewHolder(ViewGroup parent, int viewType) {
        View itemView = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_multi_select_similar_question, parent, false);

        return new SimilarQuestionItemViewHolder(itemView);
    }

    @Override
    public void onBindViewHolder(SimilarQuestionItemViewHolder holder, int position) {
        Question data = dataList.get(position);
        holder.itemNo.setText(position + 1 + ".");
        holder.itemText.setContent(data.getQuestion());

        // 设置选中状态
        if (selectedPosition == position) {
            holder.itemView.setSelected(true);
        } else {
            holder.itemView.setSelected(false);
        }

        if(data.atUserList) {
            holder.checkSelected.setChecked(true);
            holder.checkSelected.setEnabled(false);
        } else {
            holder.checkSelected.setEnabled(true);
            holder.checkSelected.setChecked(data.userSelect);
        }

        // 设置点击监听器
        holder.container.setOnClickListener(v -> {
            setSelectedPosition(holder.getBindingAdapterPosition());
        });
        holder.itemText.setOnClickListener(v -> {
            setSelectedPosition(holder.getBindingAdapterPosition());
        });

        holder.checkSelected.setOnCheckedChangeListener((compoundButton, b) -> {
            int pos = holder.getBindingAdapterPosition();
            if(pos >= 0) {
                dataList.get(pos).userSelect = b;
            }
        });

        holder.btnAddToFavor.setOnClickListener(v -> {
        });
    }

    public void resetSelection(){
        selectedPosition = -1;
    }

    public void setSelectedPosition(int position) {
        int previousPosition = selectedPosition;
        selectedPosition = position;
        notifyItemChanged(previousPosition);
        notifyItemChanged(selectedPosition);
    }

    @Override
    public int getItemCount() {
        return dataList.size();
    }

    // ViewHolder静态内部类
    public static class SimilarQuestionItemViewHolder extends RecyclerView.ViewHolder {
        View container;
        MarkdownTextView itemText;
        TextView itemNo;
        CheckBox checkSelected;
        Button btnAddToFavor;
        SimilarQuestionItemViewHolder(View view) {
            super(view);
            container = view.findViewById(R.id.container);
            itemText = view.findViewById(R.id.question_text);
            itemNo = view.findViewById(R.id.item_number);
            checkSelected = view.findViewById(R.id.add_to_list);
            btnAddToFavor = view.findViewById(R.id.add_to_favor);
        }
    }
}