package com.cosinetech.imates.notes;

import android.content.Context;
import android.graphics.Bitmap;
import android.util.AttributeSet;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ListView;

import com.cosinetech.imates.R;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;

import java.util.ArrayList;
import java.util.List;

public class NoteView extends LinearLayout {
    private ListView noteListView;
    private WebView webView;
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

        webView = view.findViewById(R.id.webView);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());
        webView.addJavascriptInterface(new JavaScriptInterface(context), "Android");
        webView.loadUrl("file:///android_asset/editor.html");


        noteListView = view.findViewById(R.id.noteListView);
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
            selectedNote.getContent();

        });

        newNoteButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                currentNoteId = -1;

            }
        });

        saveNoteButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                String title = etTitle.getText().toString().trim();
                StringBuffer contentBuilder = new StringBuffer();


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


    // JavaScript interface for communication
    private class JavaScriptInterface {
        private Context context;

        JavaScriptInterface(Context context) {
            this.context = context;
        }

        @JavascriptInterface
        public void saveContent(String content) {
            Log.d("NOTE", content);
        }

        @JavascriptInterface
        public void loadContent() {
            String content = "asdfsdf";
            webView.post(() -> webView.evaluateJavascript(
                    "setLoadedContent('" + content.replace("'", "\\'") + "');",
                    null
            ));
        }
    }

}
