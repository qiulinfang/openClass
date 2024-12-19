package com.cosinetech.imates.notes;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import androidx.fragment.app.Fragment;

public class NoteFragment extends Fragment {
    private NoteView noteView;

    @Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container, Bundle savedInstanceState) {
        noteView = new NoteView(getContext());
        return noteView;
    }
}
