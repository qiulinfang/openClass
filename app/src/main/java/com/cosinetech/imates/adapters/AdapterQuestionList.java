package com.cosinetech.imates.adapters;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.cosinetech.imates.R;
import com.cosinetech.imates.webservice.Question;
import com.cosinetech.imates.views.MarkdownTextView;

import java.util.List;

public class AdapterQuestionList extends RecyclerView.Adapter<AdapterQuestionList.ExerciseItemViewHolder> {
    public interface ExerciseListChangedListener {
        void onExerciseDelete(int position);
        void onExerciseToTop(int position);
        void onSelectExerciseChange(int previous, int pos);

        void onBeginGuideToSolveQuestion(int pos);
    }
    private final List<Question> dataList;
    private int selectedPosition = -1;

    private ExerciseListChangedListener listener;

    // 构造函数接收数据列表
    public AdapterQuestionList(List<Question> dataList, ExerciseListChangedListener listener) {
        this.dataList = dataList;
        this.listener = listener;
    }

    @NonNull
    @Override
    public ExerciseItemViewHolder onCreateViewHolder(ViewGroup parent, int viewType) {
        View itemView = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_question, parent, false);

        return new ExerciseItemViewHolder(itemView);
    }

    @Override
    public void onBindViewHolder(ExerciseItemViewHolder holder, int position) {
        Question data = dataList.get(position);
        holder.itemNo.setText(position + 1 + ".");
        holder.itemText.setContent(data.getQuestion());

        // 设置选中状态
        if (selectedPosition == position) {
            holder.itemView.setSelected(true);
//            holder.btnDelete.setVisibility(View.VISIBLE);
//            holder.btnDelete.setEnabled(true);
            holder.btnMoveToTop.setVisibility(View.VISIBLE);
            holder.btnAiGuide.setVisibility(View.VISIBLE);
        } else {
            holder.itemView.setSelected(false);
//            holder.btnDelete.setVisibility(View.INVISIBLE);
            holder.btnMoveToTop.setVisibility(View.INVISIBLE);
            holder.btnAiGuide.setVisibility(View.INVISIBLE);
        }

        holder.btnAiGuide.setEnabled(!data.isAiGuiding);

        // 设置点击监听器
        holder.container.setOnClickListener(v -> {
            setSelectedPosition(holder.getBindingAdapterPosition());
        });
        holder.itemText.setOnClickListener(v -> {
            setSelectedPosition(holder.getBindingAdapterPosition());
        });

        holder.btnMoveToTop.setOnClickListener(v -> {
            if(listener != null)  {
                listener.onExerciseToTop(holder.getBindingAdapterPosition());
            }
        });

        holder.btnDelete.setOnClickListener(v -> {
            if(listener != null)  {
                holder.btnDelete.setEnabled(false);
                listener.onExerciseDelete(holder.getBindingAdapterPosition());
            }
        });

        holder.btnAiGuide.setOnClickListener(v -> {
            if(listener != null)  {
                listener.onBeginGuideToSolveQuestion(holder.getBindingAdapterPosition());
            }
        });
    }

    public void resetSelection() {
        selectedPosition = -1;
    }

    public void setSelectedPosition(int position) {
        int previousPosition = selectedPosition;
        selectedPosition = position;
        if(previousPosition >= 0 && previousPosition < dataList.size()) {
            notifyItemChanged(previousPosition);
        }
        if(selectedPosition >= 0 && selectedPosition < dataList.size()) {
            notifyItemChanged(selectedPosition);
        }
        //notifyDataSetChanged();

        if(listener != null) {
            listener.onSelectExerciseChange(previousPosition, position);
        }
    }

    @Override
    public int getItemCount() {
        return dataList.size();
    }

    // ViewHolder静态内部类
    public static class ExerciseItemViewHolder extends RecyclerView.ViewHolder {
        LinearLayout container;
        MarkdownTextView itemText;
        TextView itemNo;
        Button btnMoveToTop;
        Button btnDelete;

        Button btnAiGuide;
        ExerciseItemViewHolder(View view) {
            super(view);
            container = view.findViewById(R.id.container);
            itemText = view.findViewById(R.id.question_text);
            itemNo = view.findViewById(R.id.item_number);
            btnMoveToTop = view.findViewById(R.id.move_to_top);
            btnDelete = view.findViewById(R.id.delete);
            btnAiGuide = view.findViewById(R.id.ai_guide);
        }
    }
}