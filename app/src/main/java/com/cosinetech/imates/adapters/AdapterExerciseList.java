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
import com.cosinetech.imates.widgets.MarkdownTextView;

import java.util.List;

public class AdapterExerciseList extends RecyclerView.Adapter<AdapterExerciseList.ExerciseItemViewHolder> {
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
    public AdapterExerciseList(List<Question> dataList, ExerciseListChangedListener listener) {
        this.dataList = dataList;
        this.listener = listener;
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
        holder.itemNo.setText(position + 1 + ".");
        holder.itemText.setContent(data.getQuestion());

        // 设置选中状态
        if (selectedPosition == position) {
            holder.itemView.setSelected(true);
            holder.btnDelete.setVisibility(View.VISIBLE);
            holder.btnOnTop.setVisibility(View.VISIBLE);
            holder.btnAiGuide.setVisibility(View.VISIBLE);
        } else {
            holder.itemView.setSelected(false);
            holder.btnDelete.setVisibility(View.INVISIBLE);
            holder.btnOnTop.setVisibility(View.INVISIBLE);
            holder.btnAiGuide.setVisibility(View.INVISIBLE);
        }

        // 设置点击监听器
        holder.container.setOnClickListener(v -> {
            setSelectedPosition(holder.getBindingAdapterPosition());
        });
        holder.itemText.setOnClickListener(v -> {
            setSelectedPosition(holder.getBindingAdapterPosition());
        });

        holder.btnOnTop.setOnClickListener(v -> {
            if(listener != null)  {
                listener.onExerciseToTop(holder.getBindingAdapterPosition());
            }
        });

        holder.btnDelete.setOnClickListener(v -> {
            if(listener != null)  {
                listener.onExerciseDelete(holder.getBindingAdapterPosition());
            }
        });

        holder.btnAiGuide.setOnClickListener(v -> {
            if(listener != null)  {
                listener.onBeginGuideToSolveQuestion(holder.getBindingAdapterPosition());
            }
        });
    }

    public void setSelectedPosition(int position) {
        int previousPosition = selectedPosition;
        selectedPosition = position;
        notifyItemChanged(previousPosition);
        notifyItemChanged(selectedPosition);
        if(listener != null) {
            listener.onSelectExerciseChange(previousPosition, position);
        }
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

        Button btnAiGuide;
        ExerciseItemViewHolder(View view) {
            super(view);
            container = view.findViewById(R.id.container);
            itemText = view.findViewById(R.id.exercise);
            itemNo = view.findViewById(R.id.item_number);
            btnOnTop = view.findViewById(R.id.ontop);
            btnDelete = view.findViewById(R.id.delete);
            btnAiGuide = view.findViewById(R.id.ai_guide);
        }
    }
}