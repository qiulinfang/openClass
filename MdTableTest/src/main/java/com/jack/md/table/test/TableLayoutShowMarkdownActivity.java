package com.jack.md.table.test;

import android.os.Bundle;
import android.view.View;

import androidx.appcompat.app.AppCompatActivity;
import androidx.databinding.DataBindingUtil;
import androidx.recyclerview.widget.LinearLayoutManager;

import com.jack.md.table.test.adapter.VoiceListAdapter;
import com.jack.md.table.test.databinding.ActivityTablelayoutShowMarkdownBinding;
import com.jack.md.table.test.listener.CommonListener;
import com.jack.md.table.test.model.VoiceItem;
import com.jack.md.table.test.utils.ExecutorUtils;
import com.jack.md.table.test.utils.FileUtils;

import java.util.ArrayList;
import java.util.List;

public class TableLayoutShowMarkdownActivity extends AppCompatActivity implements CommonListener {
    private ActivityTablelayoutShowMarkdownBinding uiBinding;
    private VoiceListAdapter voiceListAdapter;
    private int voiceId = 0;
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        uiBinding = DataBindingUtil.setContentView(this, R.layout.activity_tablelayout_show_markdown);

        uiBinding.recyclerView.setLayoutManager(new LinearLayoutManager(this));
        voiceListAdapter = new VoiceListAdapter(this, this);
        uiBinding.recyclerView.setAdapter(voiceListAdapter);

        loadData();
    }

    private void loadData() {
        ExecutorUtils.getExecutor().execute(()->{
            FileUtils.readAll("simulate.data.flow.txt", false, this::textCallBack);
//            if (voiceId < 1) { //模拟插入数据
//                try {
//                    Thread.sleep(1000);
//                } catch (Exception err){}
//                voiceId ++;
//                loadData();
//            }
        });
    }

    public void textCallBack(String text) {
        runOnUiThread(()->{
            boolean res = false;
            List<VoiceItem> items = voiceListAdapter.getItems();
            
            // 查找是否已存在相同id的项目
            for (int i = items.size()-1; i >= 0; i--) {
                if (items.get(i).id == voiceId) {
                    // 更新现有项目的文本
                    VoiceItem existingItem = items.get(i);
                    existingItem.text += text;
                    // 通知适配器该位置的数据已更新
                    voiceListAdapter.notifyItemChanged(i);
                    res = true;
                    break;
                }
            }
            
            if (!res) {
                // 创建新项目
                VoiceItem item = new VoiceItem();
                item.id = voiceId;
                item.type = Constants.ROBOT;
                item.text = text;
                // 使用适配器的方法添加项目
                voiceListAdapter.addItem(item);
            }
        });
    }

    public void reloadDataBtnClick(View view) {
        // 使用适配器的方法清空数据
        voiceListAdapter.setItems(new ArrayList<>());
        voiceId = 0;
        loadData();
    }
}