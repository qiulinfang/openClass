package com.cosinetech.imates.models;

import android.annotation.SuppressLint;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import java.util.ArrayList;
import java.util.List;

public class ChatMessageHistoryDB extends SQLiteOpenHelper {

    private static final String DATABASE_NAME = "chat_message_history.db";
    private static final int DATABASE_VERSION = 1;

    // MessageCatalogue table
    private static final String TABLE_CATALOGUE = "message_catalogue";
    private static final String COLUMN_DATE = "date";
    private static final String COLUMN_SUBJECT = "subject";
    private static final String COLUMN_SESSION_ID = "session_id";

    // MessageDetail table
    private static final String TABLE_DETAIL = "message_detail";
    private static final String COLUMN_CONTENT = "content";
    private static final String COLUMN_TYPE = "type";
    private static final String COLUMN_IS_SELF = "is_self";
    private static final String COLUMN_TIMESTAMP = "timestamp";

    public ChatMessageHistoryDB(Context context) {
        super(context, DATABASE_NAME, null, DATABASE_VERSION);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        String createCatalogueTable = "CREATE TABLE " + TABLE_CATALOGUE + "("
                + COLUMN_DATE + " TEXT, "
                + COLUMN_SUBJECT + " TEXT, "
                + COLUMN_SESSION_ID + " TEXT, "
                + "PRIMARY KEY (" + COLUMN_DATE + ", " + COLUMN_SUBJECT + "))";

        String createDetailTable = "CREATE TABLE " + TABLE_DETAIL + "("
                + COLUMN_DATE + " TEXT, "
                + COLUMN_SUBJECT + " TEXT, "
                + COLUMN_CONTENT + " TEXT, "
                + COLUMN_SESSION_ID + " TEXT, "
                + COLUMN_TYPE + " INTEGER, "
                + COLUMN_IS_SELF + " INTEGER, "
                + COLUMN_TIMESTAMP + " INTEGER UNIQUE)";

        db.execSQL(createCatalogueTable);
        db.execSQL(createDetailTable);
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        db.execSQL("DROP TABLE IF EXISTS " + TABLE_CATALOGUE);
        db.execSQL("DROP TABLE IF EXISTS " + TABLE_DETAIL);
        onCreate(db);
    }

    // MessageCatalogue CRUD operations

    public long addMessageCatalogue(MessageCatalogue catalogue) {
        SQLiteDatabase db = this.getWritableDatabase();
        ContentValues values = new ContentValues();
        values.put(COLUMN_DATE, catalogue.date);
        values.put(COLUMN_SUBJECT, catalogue.subject);
        values.put(COLUMN_SESSION_ID, catalogue.sessionId);
        return db.insert(TABLE_CATALOGUE, null, values);
    }

    public MessageCatalogue getMessageCatalogue(String date, String subject) {
        SQLiteDatabase db = this.getReadableDatabase();
        Cursor cursor = db.query(TABLE_CATALOGUE,
                new String[]{COLUMN_DATE, COLUMN_SUBJECT, COLUMN_SESSION_ID},
                COLUMN_DATE + "=? AND " + COLUMN_SUBJECT + "=?",
                new String[]{date, subject}, null, null, null);

        if (cursor != null && cursor.moveToFirst()) {
            MessageCatalogue catalogue = new MessageCatalogue();
            catalogue.date = cursor.getString(cursor.getColumnIndex(COLUMN_DATE));
            catalogue.subject = cursor.getString(cursor.getColumnIndex(COLUMN_SUBJECT));
            catalogue.sessionId = cursor.getString(cursor.getColumnIndex(COLUMN_SESSION_ID));
            cursor.close();
            return catalogue;
        }
        return null;
    }

    public int updateMessageCatalogue(MessageCatalogue catalogue) {
        SQLiteDatabase db = this.getWritableDatabase();
        ContentValues values = new ContentValues();
        values.put(COLUMN_SESSION_ID, catalogue.sessionId);
        return db.update(TABLE_CATALOGUE, values,
                COLUMN_DATE + "=? AND " + COLUMN_SUBJECT + "=?",
                new String[]{catalogue.date, catalogue.subject});
    }

    public void deleteMessageCatalogue(String date, String subject) {
        SQLiteDatabase db = this.getWritableDatabase();
        db.delete(TABLE_CATALOGUE,
                COLUMN_DATE + "=? AND " + COLUMN_SUBJECT + "=?",
                new String[]{date, subject});
    }

    // MessageDetail CRUD operations

    public long addMessageDetail(MessageDetail detail) {
        SQLiteDatabase db = this.getWritableDatabase();
        ContentValues values = new ContentValues();
        values.put(COLUMN_DATE, detail.date);
        values.put(COLUMN_SUBJECT, detail.subject);
        values.put(COLUMN_CONTENT, detail.content);
        values.put(COLUMN_SESSION_ID, detail.sessionId);
        values.put(COLUMN_TYPE, detail.type);
        values.put(COLUMN_IS_SELF, detail.isSelf);
        values.put(COLUMN_TIMESTAMP, detail.timestamp);
        return db.insert(TABLE_DETAIL, null, values);
    }

    public MessageDetail getMessageDetail(long timestamp) {
        SQLiteDatabase db = this.getReadableDatabase();
        Cursor cursor = db.query(TABLE_DETAIL,
                new String[]{COLUMN_DATE, COLUMN_SUBJECT, COLUMN_CONTENT, COLUMN_SESSION_ID, COLUMN_TYPE, COLUMN_IS_SELF, COLUMN_TIMESTAMP},
                COLUMN_TIMESTAMP + "=?",
                new String[]{String.valueOf(timestamp)}, null, null, null);

        if (cursor != null && cursor.moveToFirst()) {
            MessageDetail detail = new MessageDetail();
            detail.date = cursor.getString(cursor.getColumnIndex(COLUMN_DATE));
            detail.subject = cursor.getString(cursor.getColumnIndex(COLUMN_SUBJECT));
            detail.content = cursor.getString(cursor.getColumnIndex(COLUMN_CONTENT));
            detail.sessionId = cursor.getString(cursor.getColumnIndex(COLUMN_SESSION_ID));
            detail.type = cursor.getInt(cursor.getColumnIndex(COLUMN_TYPE));
            detail.isSelf = cursor.getInt(cursor.getColumnIndex(COLUMN_IS_SELF));
            detail.timestamp = cursor.getLong(cursor.getColumnIndex(COLUMN_TIMESTAMP));
            cursor.close();
            return detail;
        }
        return null;
    }

    public int updateMessageDetail(MessageDetail detail) {
        SQLiteDatabase db = this.getWritableDatabase();
        ContentValues values = new ContentValues();
        values.put(COLUMN_DATE, detail.date);
        values.put(COLUMN_SUBJECT, detail.subject);
        values.put(COLUMN_CONTENT, detail.content);
        values.put(COLUMN_SESSION_ID, detail.sessionId);
        values.put(COLUMN_TYPE, detail.type);
        values.put(COLUMN_IS_SELF, detail.isSelf);
        return db.update(TABLE_DETAIL, values,
                COLUMN_TIMESTAMP + "=?",
                new String[]{String.valueOf(detail.timestamp)});
    }

    public void deleteMessageDetail(long timestamp) {
        SQLiteDatabase db = this.getWritableDatabase();
        db.delete(TABLE_DETAIL,
                COLUMN_TIMESTAMP + "=?",
                new String[]{String.valueOf(timestamp)});
    }

    // Easy add method for MessageDetail
    public long easyAddMessageDetail(MessageDetail detail) {
        SQLiteDatabase db = this.getWritableDatabase();
        db.beginTransaction();
        long result = -1;
        try {
            // Check if the MessageCatalogue entry exists
            MessageCatalogue existingCatalogue = getMessageCatalogue(detail.date, detail.subject);
            if (existingCatalogue == null) {
                // If it doesn't exist, create a new MessageCatalogue entry
                MessageCatalogue newCatalogue = new MessageCatalogue();
                newCatalogue.date = detail.date;
                newCatalogue.subject = detail.subject;
                newCatalogue.sessionId = detail.sessionId;
                addMessageCatalogue(newCatalogue);
            }

            // Add the MessageDetail
            result = addMessageDetail(detail);

            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
        return result;
    }

    // New method: Get all MessageCatalogue entries
    public List<MessageCatalogue> getAllMessageCatalogue() {
        List<MessageCatalogue> catalogueList = new ArrayList<>();
        String selectQuery = "SELECT * FROM " + TABLE_CATALOGUE;

        SQLiteDatabase db = this.getReadableDatabase();
        Cursor cursor = db.rawQuery(selectQuery, null);

        if (cursor.moveToFirst()) {
            do {
                MessageCatalogue catalogue = new MessageCatalogue();
                catalogue.date = cursor.getString(cursor.getColumnIndex(COLUMN_DATE));
                catalogue.subject = cursor.getString(cursor.getColumnIndex(COLUMN_SUBJECT));
                catalogue.sessionId = cursor.getString(cursor.getColumnIndex(COLUMN_SESSION_ID));
                catalogueList.add(catalogue);
            } while (cursor.moveToNext());
        }

        cursor.close();
        return catalogueList;
    }

    // New method: Get MessageDetail entries by date and type
    @SuppressLint("Range")
    public List<MessageDetail> getMessageDetail(String date, String type) {
        List<MessageDetail> detailList = new ArrayList<>();
        SQLiteDatabase db = this.getReadableDatabase();

        String selectQuery = "SELECT * FROM " + TABLE_DETAIL +
                " WHERE " + COLUMN_DATE + " = ? AND " + COLUMN_TYPE + " = ?";
        Cursor cursor = db.rawQuery(selectQuery, new String[]{date, type});

        if (cursor.moveToFirst()) {
            do {
                MessageDetail detail = new MessageDetail();
                detail.date = cursor.getString(cursor.getColumnIndex(COLUMN_DATE));
                detail.subject = cursor.getString(cursor.getColumnIndex(COLUMN_SUBJECT));
                detail.content = cursor.getString(cursor.getColumnIndex(COLUMN_CONTENT));
                detail.sessionId = cursor.getString(cursor.getColumnIndex(COLUMN_SESSION_ID));
                detail.type = cursor.getInt(cursor.getColumnIndex(COLUMN_TYPE));
                detail.isSelf = cursor.getInt(cursor.getColumnIndex(COLUMN_IS_SELF));
                detail.timestamp = cursor.getLong(cursor.getColumnIndex(COLUMN_TIMESTAMP));
                detailList.add(detail);
            } while (cursor.moveToNext());
        }

        cursor.close();
        return detailList;
    }
}

