package com.cosinetech.imates.fragments;

import android.annotation.SuppressLint;
import android.os.Bundle;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import android.widget.Toast;

import com.cosinetech.imates.R;
import com.cosinetech.imates.models.Chapter;
import com.github.barteksc.pdfviewer.PDFView;
import com.github.barteksc.pdfviewer.util.FitPolicy;
import com.github.spareyaya.SimpleRatingView;
import com.google.gson.Gson;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;

/**
 * A simple {@link Fragment} subclass.
 * Use the {@link FragmentPreviewLesson#newInstance} factory method to
 * create an instance of this fragment.
 */
public class FragmentPreviewLesson extends Fragment {

    // TODO: Rename parameter arguments, choose names that match
    // the fragment initialization parameters, e.g. ARG_ITEM_NUMBER
    private static final String KEY_PREVIEW_SECTION_NAME = "PREVIEW_SECTION_NAME";
    private static final String ARG_PARAM2 = "param2";

    // TODO: Rename and change types of parameters
    private String mPreviewSectionName;
    private String mParam2;

    private Chapter mPreviewSchemas;

    public FragmentPreviewLesson() {
        // Required empty public constructor
    }

    /**
     * Use this factory method to create a new instance of
     * this fragment using the provided parameters.
     *
     * @param param1 Parameter 1.
     * @param param2 Parameter 2.
     * @return A new instance of fragment FragmentPreviewLesson.
     */
    // TODO: Rename and change types and number of parameters
    public static FragmentPreviewLesson newInstance(String param1, String param2) {
        FragmentPreviewLesson fragment = new FragmentPreviewLesson();
        Bundle args = new Bundle();
        args.putString(KEY_PREVIEW_SECTION_NAME, param1);
        args.putString(ARG_PARAM2, param2);
        fragment.setArguments(args);
        return fragment;
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (getArguments() != null) {
            mPreviewSectionName = getArguments().getString(KEY_PREVIEW_SECTION_NAME);
            mParam2 = getArguments().getString(ARG_PARAM2);
        }
    }

    @Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container,
                             Bundle savedInstanceState) {
        // Inflate the layout for this fragment
        return inflater.inflate(R.layout.fragment_preview_lession, container, false);
    }

    @SuppressLint("ClickableViewAccessibility")
    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        TextView textPreview = view.findViewById(R.id.label);
        textPreview.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                getParentFragmentManager().popBackStack();
            }
        });

        TextView textPreviewSectionName = view.findViewById(R.id.preview_section_name);
        textPreviewSectionName.setText(mPreviewSectionName);

        SimpleRatingView ratingView = view.findViewById(R.id.rating);
        ratingView.setOnRatingChangeListener((oldRating, newRating) ->  {
            Toast.makeText(getContext(), "oldRating:" + oldRating + " newRating:" + newRating, Toast.LENGTH_SHORT).show();
        });

        SimpleRatingView ratingDifficult = view.findViewById(R.id.rating_difficulty);
        ratingDifficult.setOnRatingChangeListener((oldRating, newRating) -> {
            Toast.makeText(getContext(), "diff: oldRating:" + oldRating + " newRating:" + newRating, Toast.LENGTH_SHORT).show();
        });
        StringBuilder newstringBuilder = new StringBuilder();
        InputStream inputStream = null;
        try {
            inputStream = getResources().getAssets().open("learn_schema.json");
            InputStreamReader isr = new InputStreamReader(inputStream);
            BufferedReader reader = new BufferedReader(isr);
            String jsonLine;
            while ((jsonLine = reader.readLine()) != null) {
                newstringBuilder.append(jsonLine);
            }
            reader.close();
            isr.close();
            inputStream.close();
        } catch (IOException e) {
            e.printStackTrace();
        }

        String json =  newstringBuilder .toString();
        Gson gson = new Gson();
        mPreviewSchemas = gson.fromJson(json, Chapter.class);

        PDFView pdfView = view.findViewById(R.id.pdfView);
        pdfView.fromAsset("biology/chapter5/text_book.pdf")
                //.pages(0, 2, 1, 3, 3, 3) // all pages are displayed by default
//                .enableSwipe(true) // allows to block changing pages using swipe
//                .swipeHorizontal(false)
                .enableDoubletap(true)
//                .defaultPage(0)
//                // allows to draw something on the current page, usually visible in the middle of the screen
//                //.onDraw(onDrawListener)
//                // allows to draw something on all pages, separately for every page. Called only for visible pages
////                .onDrawAll(onDrawListener)
////                .onLoad(onLoadCompleteListener) // called after document is loaded and starts to be rendered
////                .onPageChange(onPageChangeListener)
////                .onPageScroll(onPageScrollListener)
////                .onError(onErrorListener)
////                .onPageError(onPageErrorListener)
////                .onRender(onRenderListener) // called after document is rendered for the first time
//                // called on single tap, return true if handled, false to toggle scroll handle visibility
////                .onTap(onTapListener)
////                .onLongPress(onLongPressListener)
//                .enableAnnotationRendering(false) // render annotations (such as comments, colors or forms)
//                .password(null)
//                .scrollHandle(null)
//                .enableAntialiasing(true) // improve rendering a little bit on low-res screens
//                // spacing between pages in dp. To define spacing color, set view background
//                .spacing(0)
//                .autoSpacing(false) // add dynamic spacing to fit each page on its own on the screen
//                ///.linkHandler(DefaultLinkHandler)
                .pageFitPolicy(FitPolicy.WIDTH) // mode to fit pages in the view
//                .fitEachPage(false) // fit each page to the view, else smaller pages are scaled relative to largest page.
//                .pageSnap(false) // snap pages to screen boundaries
//                .pageFling(false) // make a fling change only a single page like ViewPager
//                .nightMode(false) // toggle night mode

                .swipeHorizontal(true)
                .pageSnap(true)
                .autoSpacing(true)
                .pageFling(true)
                .load();
    }
}