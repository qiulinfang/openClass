package com.cosinetech.imates;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.cosinetech.imates.webservice.Question;

import java.util.List;

public class AdapterSimilarQuestionList extends RecyclerView.Adapter<AdapterSimilarQuestionList.SimilarExerciseItemViewHolder> {
    public interface SimilarExerciseListChangedListener {
        void onExerciseAddToMyList(int pos, Question q);
        void onExerciseAddToMyFavor(int pos, Question q);
    }
    private final List<Question> dataList;
    private int selectedPosition = -1;

    private SimilarExerciseListChangedListener listener;

    // 构造函数接收数据列表
    public AdapterSimilarQuestionList(List<Question> dataList, SimilarExerciseListChangedListener listener) {
        this.dataList = dataList;
        this.listener = listener;
    }

    @NonNull
    @Override
    public SimilarExerciseItemViewHolder onCreateViewHolder(ViewGroup parent, int viewType) {
        View itemView = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_exercise_similar, parent, false);

        return new SimilarExerciseItemViewHolder(itemView);
    }

    @Override
    public void onBindViewHolder(SimilarExerciseItemViewHolder holder, int position) {
        Question data = dataList.get(position);
        holder.itemNo.setText(position + 1 + ".");
        holder.itemText.setContent(data.getQuestion());

        // 设置选中状态
        if (selectedPosition == position) {
            holder.itemView.setSelected(true);
        } else {
            holder.itemView.setSelected(false);
        }

        // 设置点击监听器
        holder.container.setOnClickListener(v -> {
            setSelectedPosition(holder.getBindingAdapterPosition());
        });
        holder.itemText.setOnClickListener(v -> {
            setSelectedPosition(holder.getBindingAdapterPosition());
        });

        holder.btnAddToList.setOnClickListener(v -> {
            if(listener != null)  {
                int pos = holder.getBindingAdapterPosition();
                listener.onExerciseAddToMyList(pos, dataList.get(pos));
            }
        });

        holder.btnAddMyFavor.setOnClickListener(v -> {
            if(listener != null)  {
                int pos = holder.getBindingAdapterPosition();
                listener.onExerciseAddToMyFavor(pos, dataList.get(pos));
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
    public class SimilarExerciseItemViewHolder extends RecyclerView.ViewHolder {
        LinearLayout container;
        MarkdownTextView itemText;
        TextView itemNo;
        Button btnAddToList;
        Button btnAddMyFavor;
        SimilarExerciseItemViewHolder(View view) {
            super(view);
            container = view.findViewById(R.id.container);
            itemText = view.findViewById(R.id.exercise);
            itemNo = view.findViewById(R.id.item_number);
            btnAddToList = view.findViewById(R.id.add_my_list);
            btnAddMyFavor = view.findViewById(R.id.add_my_favor);
        }
    }
}