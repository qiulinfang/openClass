package com.cosinetech.imates.notes;

import android.content.Context;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.PopupWindow;

import com.cosinetech.imates.R;

public class NotePopupWindow extends PopupWindow {
    private NoteView noteView;

    public NotePopupWindow(Context context) {
        super(context);
        noteView = new NoteView(context);
        setContentView(noteView);
        setWidth(ViewGroup.LayoutParams.MATCH_PARENT);
        setHeight(ViewGroup.LayoutParams.MATCH_PARENT);
        setFocusable(true);

        Button btnExit = noteView.findViewById(R.id.btn_exit);
        btnExit.setOnClickListener(v-> {
            dismiss();
        });
    }
}


