package com.jack.md.table.test.adapter;

import android.content.Context;
import android.text.TextUtils;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.jack.md.table.test.Constants;
import com.jack.md.table.test.R;
import com.jack.md.table.test.databinding.VoiceItemBinding;
import com.jack.md.table.test.listener.CommonListener;
import com.jack.md.table.test.model.VoiceItem;
import com.jack.md.table.test.utils.GithubImageDestinationProcessor;

import org.commonmark.ext.gfm.tables.TableBlock;
import org.commonmark.node.FencedCodeBlock;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import io.noties.markwon.AbstractMarkwonPlugin;
import io.noties.markwon.Markwon;
import io.noties.markwon.MarkwonConfiguration;
import io.noties.markwon.MarkwonVisitor;
import io.noties.markwon.ext.strikethrough.StrikethroughPlugin;
import io.noties.markwon.ext.tasklist.TaskListPlugin;
import io.noties.markwon.html.HtmlPlugin;
import io.noties.markwon.image.ImagesPlugin;
import io.noties.markwon.recycler.MarkwonAdapter;
import io.noties.markwon.recycler.SimpleEntry;
import io.noties.markwon.recycler.table.TableEntry;
import io.noties.markwon.recycler.table.TableEntryPlugin;

public class VoiceListAdapter extends RecyclerView.Adapter<VoiceListAdapter.VoiceViewHolder> {
    private final String TAG = VoiceListAdapter.class.getSimpleName();
    private Context context;
    private List<VoiceItem> items;
    private CommonListener listener;
    
    public VoiceListAdapter(Context context, CommonListener listener) {
        this.context = context;
        this.listener = listener;
        this.items = new ArrayList<>();
    }

    @NonNull
    @Override
    public VoiceViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        VoiceItemBinding binding = VoiceItemBinding.inflate(LayoutInflater.from(context), parent, false);
        return new VoiceViewHolder(binding);
    }

    @Override
    public void onBindViewHolder(@NonNull VoiceViewHolder holder, int position) {
        VoiceItem data = items.get(position);
        holder.bind(data, position);
    }

    @Override
    public int getItemCount() {
        return items.size();
    }

    // 添加数据的方法
    public void setItems(List<VoiceItem> newItems) {
        this.items.clear();
        if (newItems != null) {
            this.items.addAll(newItems);
        }
        notifyDataSetChanged();
    }

    public void addItem(VoiceItem item) {
        this.items.add(item);
        notifyItemInserted(items.size() - 1);
    }

    public void addItems(List<VoiceItem> newItems) {
        int startPosition = items.size();
        this.items.addAll(newItems);
        notifyItemRangeInserted(startPosition, newItems.size());
    }

    public void removeItem(int position) {
        if (position >= 0 && position < items.size()) {
            this.items.remove(position);
            notifyItemRemoved(position);
        }
    }

    public List<VoiceItem> getItems() {
        return items;
    }

    // ViewHolder 内部类
    public class VoiceViewHolder extends RecyclerView.ViewHolder {
        private VoiceItemBinding binding;

        public VoiceViewHolder(@NonNull VoiceItemBinding binding) {
            super(binding.getRoot());
            this.binding = binding;
        }

        public void bind(VoiceItem data, int position) {
            binding.setData(data);
            binding.setHandler(listener);
            binding.setPos(position);

            final Markwon markwon = Markwon.builder(context)
                    .usePlugin(ImagesPlugin.create())
                    .usePlugin(TableEntryPlugin.create(context))
                    .usePlugin(HtmlPlugin.create())
                    .usePlugin(StrikethroughPlugin.create())
                    .usePlugin(TaskListPlugin.create(context))
                    .usePlugin(new AbstractMarkwonPlugin() {
                        @Override
                        public void configureConfiguration(@NonNull MarkwonConfiguration.Builder builder) {
                            builder.imageDestinationProcessor(new GithubImageDestinationProcessor());
                        }

                        @Override
                        public void configureVisitor(@NonNull MarkwonVisitor.Builder builder) {
                            builder.on(FencedCodeBlock.class, (visitor, fencedCodeBlock) -> {
                                // we actually won't be applying code spans here, as our custom view will
                                // draw background and apply mono typeface
                                //
                                // NB the `trim` operation on literal (as code will have a new line at the end)
                                final CharSequence code = visitor.configuration()
                                        .syntaxHighlight()
                                        .highlight(fencedCodeBlock.getInfo(), fencedCodeBlock.getLiteral().trim());
                                visitor.builder().append(code);
                            });
                        }
                    })
                    .build();
            final MarkwonAdapter adapter = MarkwonAdapter.builderTextViewIsRoot(R.layout.adapter_node)
                    .include(FencedCodeBlock.class, SimpleEntry.create(R.layout.adapter_node_code_block, R.id.text_view))
                    .include(TableBlock.class, TableEntry.create(builder -> {
                        builder
                                .tableLayout(R.layout.adapter_node_table_block, R.id.table_layout)
                                .textLayoutIsRoot(R.layout.view_table_entry_cell);
                    }))
                    .build();

            binding.recyclerView.setLayoutManager(new LinearLayoutManager(context));
            binding.recyclerView.setAdapter(adapter);
            adapter.setMarkdown(markwon, data.text);

            binding.executePendingBindings();
        }
    }
}
