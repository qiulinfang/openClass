package com.cosinetech.imates.ui.activities;

import android.os.Bundle;

import androidx.activity.EdgeToEdge;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.cherry.lib.doc.bean.DocEngine;
import com.cherry.lib.doc.bean.DocSourceType;
import com.cherry.lib.doc.widget.DocView;
import com.cosinetech.imates.R;

public class DocsViewerActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this);
        setContentView(R.layout.activity_docs_viewer);
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main), (v, insets) -> {
            Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom);
            return insets;
        });

        DocView docView = findViewById(R.id.doc_viewer);
        docView.openDoc(this, "1.docx", DocSourceType.ASSETS, DocEngine.MICROSOFT);
    }
}