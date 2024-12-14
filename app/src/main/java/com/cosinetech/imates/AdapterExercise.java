package com.cosinetech.imates;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
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
        holder.itemNo.setText(String.valueOf(position + 1) + ".");
        holder.itemText.setContent(data.getQuestion());

        // 设置选中状态
        if (selectedPosition == position) {
            holder.itemView.setSelected(true);
            holder.btnDelete.setVisibility(View.VISIBLE);
            holder.btnOnTop.setVisibility(View.VISIBLE);
        } else {
            holder.itemView.setSelected(false);
            holder.btnDelete.setVisibility(View.INVISIBLE);
            holder.btnOnTop.setVisibility(View.INVISIBLE);
        }

        // 设置点击监听器
        holder.container.setOnClickListener(v -> {
            setSelectedPosition(holder.getBindingAdapterPosition());
        });
        holder.itemText.setOnClickListener(v -> {
            setSelectedPosition(holder.getBindingAdapterPosition());
        });

        holder.btnOnTop.setOnClickListener(v -> {

        });

        holder.btnDelete.setOnClickListener(v -> {

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
        LinearLayout container;
        MarkdownTextView itemText;
        TextView itemNo;
        Button btnOnTop;
        Button btnDelete;
        ExerciseItemViewHolder(View view) {
            super(view);
            container = view.findViewById(R.id.container);
            itemText = view.findViewById(R.id.exercise);
            itemNo = view.findViewById(R.id.item_number);
            btnOnTop = view.findViewById(R.id.ontop);
            btnDelete = view.findViewById(R.id.delete);
        }
    }
}