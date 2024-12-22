package com.cosinetech.imates.notes;

import android.content.Context;
import android.view.ViewGroup;
import android.widget.PopupWindow;

import com.cosinetech.imates.widgets.SwipeListView;

public class NotePopupWindow extends PopupWindow {
    private NoteView noteView;

    public NotePopupWindow(Context context) {
        super(context);
        noteView = new NoteView(context);
        setContentView(noteView);
        setWidth(ViewGroup.LayoutParams.MATCH_PARENT);
        setHeight(ViewGroup.LayoutParams.MATCH_PARENT);
        setFocusable(true);
    }
}


