package com.cosinetech.imates;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.cosinetech.imates.webservice.Question;

import java.util.List;

public class AdapterExercise extends RecyclerView.Adapter<AdapterExercise.ExerciseItemViewHolder> {
    private List<Question> dataList;
    private int selectedPosition = -1;

    // 构造函数接收数据列表
    public AdapterExercise(List<Question> dataList) {
        this.dataList = dataList;
    }

    @NonNull
    @Override
    public ExerciseItemViewHolder onCreateViewHolder(ViewGroup parent, int viewType) {
        View itemView = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_exercise, parent, false);

        return new ExerciseItemViewHolder(itemView);
    }

    @Override
    public void onBindViewHolder(ExerciseItemViewHolder holder, int position) {
        Question data = dataList.get(position);
        holder.itemNo.setText(String.valueOf(position + 1));
        holder.itemText.setContent(data.getQuestion());

        // 设置选中状态
        if (selectedPosition == position) {
            holder.itemView.setSelected(true);
        } else {
            holder.itemView.setSelected(false);
        }

        // 设置点击监听器
        holder.itemView.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                // 处理点击事件
                //Toast.makeText(v.getContext(), "Clicked on item " + position, Toast.LENGTH_SHORT).show();
                setSelectedPosition(holder.getBindingAdapterPosition());
            }
        });

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
    public class ExerciseItemViewHolder extends RecyclerView.ViewHolder {
        MarkdownTextView itemText;
        TextView itemNo;
        ExerciseItemViewHolder(View view) {
            super(view);
            itemText = view.findViewById(R.id.exercise);
            itemNo = view.findViewById(R.id.item_number);
        }
    }
}