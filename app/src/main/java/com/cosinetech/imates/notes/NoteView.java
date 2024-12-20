package com.cosinetech.imates.notes;

import android.content.Context;
import android.graphics.Bitmap;
import android.util.AttributeSet;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ListView;

import com.cosinetech.imates.R;
import com.cosinetech.imates.util.ImageUtils;
import com.cosinetech.imates.util.ScreenUtils;
import com.cosinetech.imates.util.StringUtils;
import com.sendtion.xrichtext.RichTextEditor;

import java.util.ArrayList;
import java.util.List;

public class NoteView extends LinearLayout {
    private ListView noteListView;
    private RichTextEditor xRichText;
    private EditText etTitle;
    private Button newNoteButton;
    private Button saveNoteButton;
    private NoteManager noteManager;
    private ArrayAdapter<String> adapter;
    private int currentNoteId = -1;

    public NoteView(Context context) {
        super(context);
        init(context);
    }

    public NoteView(Context context, AttributeSet attrs) {
        super(context, attrs);
        init(context);
    }

    public NoteView(Context context, AttributeSet attrs, int defStyleAttr) {
        super(context, attrs, defStyleAttr);
        init(context);
    }

    private void init(Context context) {
        View view = LayoutInflater.from(context).inflate(R.layout.note_view_layout, this, true);
        noteListView = view.findViewById(R.id.noteListView);
        xRichText = view.findViewById(R.id.text_area);
        newNoteButton = view.findViewById(R.id.newNoteButton);
        saveNoteButton = view.findViewById(R.id.saveNoteButton);
        etTitle = view.findViewById(R.id.et_title);

        noteManager = new NoteManager(context);
        List<String> noteTitles = noteManager.getNoteTitles();

        adapter = new ArrayAdapter<>(context, android.R.layout.simple_list_item_1, noteTitles);
        noteListView.setAdapter(adapter);

        noteListView.setOnItemClickListener((parent, view1, position, id) -> {
            currentNoteId = noteManager.getNoteByPosition(position).getId();
            Note selectedNote = noteManager.getNoteById(currentNoteId);
            xRichText.clearAllLayout();
            List<String> textList = StringUtils.cutStringByImgTag(selectedNote.getContent());
            for (int i = 0; i < textList.size(); i++) {
                String text = textList.get(i);
                if (text.contains("<img")) {
                    String imagePath = StringUtils.getImgSrc(text);
//                    int width = ScreenUtils.getScreenWidth(this);
//                    int height = ScreenUtils.getScreenHeight(this);
                    xRichText.measure(0,0);
                    Bitmap bitmap = ImageUtils.getDecodeBitmap(imagePath);//ImageUtils.getSmallBitmap(imagePath, width, height);
//                    int width = bitmap.getWidth();
//                    int height = bitmap.getHeight();
                    if (bitmap != null){
                        xRichText.addImageViewAtIndex(xRichText.getLastIndex(), imagePath);
                    } else {
                        xRichText.addEditTextAtIndex(xRichText.getLastIndex(), text);
                    }
                    xRichText.addEditTextAtIndex(xRichText.getLastIndex(), text);
                }
            }
        });

        newNoteButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                currentNoteId = -1;
                xRichText.clearAllLayout();
            }
        });

        saveNoteButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                String title = etTitle.getText().toString().trim();
                List<RichTextEditor.EditData> editList = xRichText.buildEditData();
                StringBuffer contentBuilder = new StringBuffer();
                for (RichTextEditor.EditData itemData : editList) {
                    if (itemData.inputStr != null) {
                        contentBuilder.append(itemData.inputStr);
                    } else if (itemData.imagePath != null) {
                        contentBuilder.append("<img src=\"").append(itemData.imagePath).append("\"/>");
                    }
                }

                String content = contentBuilder.toString();
                if (currentNoteId == -1) {
                    long id = noteManager.addNote(content, title);
                    currentNoteId = (int) id;
                } else {
                    noteManager.updateNote(currentNoteId, content, title);
                }
                refreshNoteList();
            }
        });
    }

    public void refreshNoteList() {
        List<String> noteTitles = new ArrayList<>(noteManager.getNoteTitles());
        adapter.clear();
        adapter.addAll(noteTitles);
        adapter.notifyDataSetChanged();
    }
}
