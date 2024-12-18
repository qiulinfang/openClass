package com.cosinetech.imates.pdfui;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;

import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.cosinetech.imates.R;
import com.cosinetech.imates.pdfui.tree.TreeAdapter;
import com.cosinetech.imates.pdfui.tree.TreeNodeData;
import com.cosinetech.imates.util.WindowUtils;

import java.util.List;

public class PDFCatelogueActivity extends AppCompatActivity implements TreeAdapter.TreeEvent {
    RecyclerView recyclerView;
    Button btn_back;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowUtils.hideSystemUI(this);
        WindowUtils.setFullScreenMode(this);
        //UIUtils.initWindowStyle(getWindow(), getSupportActionBar());
        setContentView(R.layout.activity_catelogue);

        initView();//初始化控件
        setEvent();//设置事件
        loadData();//加载数据
    }

    /**
     * 初始化控件
     */
    private void initView() {
        btn_back = findViewById(com.xhh.pdfui.R.id.btn_back);
        recyclerView = findViewById(com.xhh.pdfui.R.id.rv_tree);
    }

    /**
     * 设置事件
     */
    private void setEvent() {
        btn_back.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                PDFCatelogueActivity.this.finish();
            }
        });
    }

    /**
     * 加载数据
     */
    private void loadData() {
        //从intent中获得传递的数据
        Intent intent = getIntent();
        List<TreeNodeData> catelogues = (List<TreeNodeData>) intent.getSerializableExtra("catelogues");

        //使用RecyclerView加载数据
        LinearLayoutManager llm = new LinearLayoutManager(this);
        llm.setOrientation(LinearLayoutManager.VERTICAL);
        recyclerView.setLayoutManager(llm);
        TreeAdapter adapter = new TreeAdapter(this, catelogues);
        adapter.setTreeEvent(this);
        recyclerView.setAdapter(adapter);
    }


    /**
     * 点击tree item，带回Pdf页码到前一个页面
     *
     * @param data tree节点数据
     */
    @Override
    public void onSelectTreeNode(TreeNodeData data) {
        Intent intent = new Intent();
        intent.putExtra("pageNum", data.getPageNum());
        setResult(Activity.RESULT_OK, intent);
        finish();
    }
}
