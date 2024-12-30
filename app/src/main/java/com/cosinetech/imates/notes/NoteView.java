package com.cosinetech.imates.notes;

import android.content.Context;
import android.graphics.Bitmap;
import android.util.AttributeSet;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.AdapterView;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import com.cosinetech.imates.R;
import com.cosinetech.imates.adapters.SwipeAdapter;
import com.cosinetech.imates.util.ImageUtils;
import com.cosinetech.imates.util.StringUtils;
import com.cosinetech.imates.views.SwipeListView;
import com.sendtion.xrichtext.RichTextEditor;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

public class NoteView extends LinearLayout {
    private SwipeListView noteListView;
    private RichTextEditor xRichText;
    private EditText etTitle;
    private Button newNoteButton;
    private Button saveNoteButton;
    private NoteManager noteManager;
    private SwipeAdapter  adapter;
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
        adapter = new SwipeAdapter(getContext(), noteListView.getRightViewWidth(),
                new SwipeAdapter.IOnItemRightClickListener() {
                    @Override
                    public void onRightClick(View v, int position) {
                        Note note = noteManager.getNoteByPosition(position);
                        deleteNoteFiles(note);
                        noteManager.deleteNoteByPosition(position);
                        refreshNoteList();
                    }
                }, noteTitles);
        noteListView.setAdapter(adapter);
        noteListView.setOnItemClickListener(new AdapterView.OnItemClickListener() {
            @Override
            public void onItemClick(AdapterView<?> parent, View view, int position, long id) {
                currentNoteId = noteManager.getNoteByPosition(position).getId();
                Note selectedNote = noteManager.getNoteById(currentNoteId);
                etTitle.setText(selectedNote.getTitle());
                xRichText.clearAllLayout();
                List<String> textList = StringUtils.cutStringByImgTag(selectedNote.getContent());
                for (int i = 0; i < textList.size(); i++) {
                    String text = textList.get(i);
                    if (text.contains("<img")) {
                        String imagePath = StringUtils.getImgSrc(text);
                        xRichText.measure(0,0);
                        Bitmap bitmap = ImageUtils.getDecodeBitmap(imagePath);//ImageUtils.getSmallBitmap(imagePath, width, height);
                        if (bitmap != null){
                            xRichText.addImageViewAtIndex(xRichText.getLastIndex(), imagePath);
                        } else {
                            xRichText.addEditTextAtIndex(xRichText.getLastIndex(), text);
                        }
                        xRichText.addEditTextAtIndex(xRichText.getLastIndex(), "");
                    }
                    else {
                        xRichText.addEditTextAtIndex(xRichText.getLastIndex(), text);
                    }
                }
            }
        });

        newNoteButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                currentNoteId = -1;
                xRichText.clearAllLayout();
                xRichText.addEditTextAtIndex(0, "");
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

    private void deleteNoteFiles(Note note) {
        List<String> textList = StringUtils.cutStringByImgTag(note.getContent());
        for (int i = 0; i < textList.size(); i++) {
            String text = textList.get(i);
            if (text.contains("<img")) {
                String imagePath = StringUtils.getImgSrc(text);
                try {
                    File file = new File(imagePath);
                    file.deleteOnExit();
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        }
    }

    public void refreshNoteList() {
        List<String> noteTitles = new ArrayList<>(noteManager.getNoteTitles());
        adapter.clear();
        adapter.addAll(noteTitles);
        adapter.notifyDataSetChanged();
    }
}
