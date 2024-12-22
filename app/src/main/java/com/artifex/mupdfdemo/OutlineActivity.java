package com.artifex.mupdfdemo;

import android.app.ListActivity;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.ListView;

import com.cosinetech.imates.R;

public class OutlineActivity extends ListActivity {
	OutlineItem mItems[];

	/** Called when the activity is first created. */
	@Override
	public void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);
		setContentView(R.layout.mupdf_outline); // 设置自定义布局

		// 初始化按钮并设置点击监听器
		Button btnExit = findViewById(R.id.btn_exit);
		btnExit.setOnClickListener(v -> {
			finish();
		});

		mItems = OutlineActivityData.get().items;
		setListAdapter(new OutlineAdapter(getLayoutInflater(),mItems));
		// Restore the position within the list from last viewing
		getListView().setSelection(OutlineActivityData.get().position);
		getListView().setDividerHeight(0);
		setResult(-1);
	}

	@Override
	protected void onListItemClick(ListView l, View v, int position, long id) {
		super.onListItemClick(l, v, position, id);
		OutlineActivityData.get().position = getListView().getFirstVisiblePosition();
		setResult(mItems[position].page);
		finish();
	}
}
