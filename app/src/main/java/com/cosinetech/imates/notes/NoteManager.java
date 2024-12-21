package com.cosinetech.imates.notes;

import android.content.Context;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

public class NoteManager {
    private NoteDatabaseHelper dbHelper;
    private List<Note> noteList;
    private List<String> noteTitles;

    public NoteManager(Context context) {
        dbHelper = new NoteDatabaseHelper(context);
        noteList = new ArrayList<>();
        noteTitles = new ArrayList<>();
        loadNotes();
    }

    private void loadNotes() {
        noteList = dbHelper.getAllNotes();
        noteTitles.clear();
        for (Note note : noteList) {
            noteTitles.add(note.getTitle());
        }
    }

    public List<String> getNoteTitles() {
        return noteTitles;
    }

    public Note getNoteById(int id) {
        return dbHelper.getNote(id);
    }

    public Note getNoteByPosition(int position) {
        return noteList.get(position);
    }

    public long addNote(String content, String title) {
        if(title.trim().isEmpty()) {
            title = generateTitle(content);
        }
        Note newNote = new Note(0, title, content);
        long id = dbHelper.addNote(newNote);
        newNote.setId((int) id);
        noteList.add(newNote);
        noteTitles.add(title);
        return id;
    }

    public void updateNote(int id, String content, String title) {
        if(title.isEmpty()) {
            title = generateTitle(content);
        }
        Note updatedNote = new Note(id, title, content);
        dbHelper.updateNote(updatedNote);
        int position = findNotePositionById(id);
        if (position != -1) {
            noteList.set(position, updatedNote);
            noteTitles.set(position, title);
        }
    }

    private String generateTitle(String content) {
        //return content.length() > 20 ? content.substring(0, 20) + "..." : content;
        // 获取当前日期和时间
        Date now = new Date();

        // 格式化日期和时间
        SimpleDateFormat dateTimeFormat = new SimpleDateFormat("yyyyMMddHHmmss");
        return dateTimeFormat.format(now);
    }

    private int findNotePositionById(int id) {
        for (int i = 0; i < noteList.size(); i++) {
            if (noteList.get(i).getId() == id) {
                return i;
            }
        }
        return -1;
    }
}

