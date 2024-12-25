package com.cosinetech.imates.models;

import android.annotation.SuppressLint;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import androidx.annotation.NonNull;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.locks.ReentrantReadWriteLock;

public class ChatMessageHistoryDB extends SQLiteOpenHelper {

    private static final String DATABASE_NAME = "chat_message_history.db";
    private static final int DATABASE_VERSION = 1;

    // MessageCatalogue table
    private static final String TABLE_CATALOGUE = "message_catalogue";
    private static final String COLUMN_DATE = "date";
    private static final String COLUMN_TAG = "tag"; // Changed from COLUMN_SUBJECT
    private static final String COLUMN_SESSION_ID = "session_id";

    // MessageDetail table
    private static final String TABLE_DETAIL = "message_detail";
    private static final String COLUMN_CONTENT = "content";
    private static final String COLUMN_TYPE = "type";
    private static final String COLUMN_IS_SELF = "is_self";
    private static final String COLUMN_TIMESTAMP = "timestamp";

    private static ChatMessageHistoryDB instance;
    private final ReentrantReadWriteLock rwLock = new ReentrantReadWriteLock();
    private final ReentrantReadWriteLock.ReadLock readLock = rwLock.readLock();
    private final ReentrantReadWriteLock.WriteLock writeLock = rwLock.writeLock();
    private SQLiteDatabase database;

    public static synchronized ChatMessageHistoryDB getInstance(Context context, String userId) {
        if (instance == null) {
            String dbName = userId + DATABASE_NAME;
            instance = new ChatMessageHistoryDB(context.getApplicationContext(), dbName);
        }
        return instance;
    }

    private ChatMessageHistoryDB(Context context, String dbName) {
        super(context, dbName, null, DATABASE_VERSION);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        String createCatalogueTable = "CREATE TABLE " + TABLE_CATALOGUE + "("
                + COLUMN_DATE + " TEXT, "
                + COLUMN_TAG + " TEXT, " // Changed from COLUMN_SUBJECT
                + COLUMN_SESSION_ID + " TEXT, "
                + "PRIMARY KEY (" + COLUMN_DATE + ", " + COLUMN_TAG + "))"; // Changed from COLUMN_SUBJECT

        String createDetailTable = "CREATE TABLE " + TABLE_DETAIL + "("
                + COLUMN_DATE + " TEXT, "
                + COLUMN_TAG + " TEXT, " // Changed from COLUMN_SUBJECT
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

    private SQLiteDatabase getDatabase() {
        if (database == null || !database.isOpen()) {
            database = getWritableDatabase();
        }
        return database;
    }

    // MessageCatalogue CRUD operations

    public synchronized long addMessageCatalogue(ChatMessageCatalogue catalogue) { // Changed parameter type
        writeLock.lock();
        try {
            SQLiteDatabase db = getDatabase();
            db.beginTransaction();
            try {
                ContentValues values = new ContentValues();
                values.put(COLUMN_DATE, catalogue.date);
                values.put(COLUMN_TAG, catalogue.tag); // Changed from COLUMN_SUBJECT
                values.put(COLUMN_SESSION_ID, catalogue.sessionId);
                long id = db.insert(TABLE_CATALOGUE, null, values);
                db.setTransactionSuccessful();
                return id;
            } finally {
                db.endTransaction();
            }
        } finally {
            writeLock.unlock();
        }
    }

    @SuppressLint("Range")
    public synchronized ChatMessageCatalogue getMessageCatalogue(String date, String tag) { // Changed parameter type and return type
        readLock.lock();
        try {
            SQLiteDatabase db = getDatabase();
            Cursor cursor = db.query(TABLE_CATALOGUE,
                    new String[]{COLUMN_DATE, COLUMN_TAG, COLUMN_SESSION_ID}, // Changed from COLUMN_SUBJECT
                    COLUMN_DATE + "=? AND " + COLUMN_TAG + "=?", // Changed from COLUMN_SUBJECT
                    new String[]{date, tag}, null, null, null);

            ChatMessageCatalogue catalogue = null; // Changed type
            if (cursor != null && cursor.moveToFirst()) {
                catalogue = new ChatMessageCatalogue(); // Changed type
                catalogue.date = cursor.getString(cursor.getColumnIndex(COLUMN_DATE));
                catalogue.tag = cursor.getString(cursor.getColumnIndex(COLUMN_TAG)); // Changed from COLUMN_SUBJECT
                catalogue.sessionId = cursor.getString(cursor.getColumnIndex(COLUMN_SESSION_ID));
                cursor.close();
            }
            return catalogue;
        } finally {
            readLock.unlock();
        }
    }

    public synchronized int updateMessageCatalogue(ChatMessageCatalogue catalogue) { // Changed parameter type
        writeLock.lock();
        try {
            SQLiteDatabase db = getDatabase();
            db.beginTransaction();
            try {
                ContentValues values = new ContentValues();
                values.put(COLUMN_SESSION_ID, catalogue.sessionId);
                int rowsAffected = db.update(TABLE_CATALOGUE, values,
                        COLUMN_DATE + "=? AND " + COLUMN_TAG + "=?", // Changed from COLUMN_SUBJECT
                        new String[]{catalogue.date, catalogue.tag}); // Changed from catalogue.subject
                db.setTransactionSuccessful();
                return rowsAffected;
            } finally {
                db.endTransaction();
            }
        } finally {
            writeLock.unlock();
        }
    }

    public synchronized void deleteMessageCatalogue(String date, String tag) { // Changed parameter type
        writeLock.lock();
        try {
            SQLiteDatabase db = getDatabase();
            db.beginTransaction();
            try {
                db.delete(TABLE_CATALOGUE,
                        COLUMN_DATE + "=? AND " + COLUMN_TAG + "=?", // Changed from COLUMN_SUBJECT
                        new String[]{date, tag}); // Changed from subject
                db.setTransactionSuccessful();
            } finally {
                db.endTransaction();
            }
        } finally {
            writeLock.unlock();
        }
    }

    // MessageDetail CRUD operations

    public synchronized long addMessageDetail(ChatMessage detail) { // Changed parameter type
        writeLock.lock();
        try {
            SQLiteDatabase db = getDatabase();
            db.beginTransaction();
            try {
                ContentValues values = getContentValues(detail);
                long id = db.insert(TABLE_DETAIL, null, values);
                db.setTransactionSuccessful();
                return id;
            } finally {
                db.endTransaction();
            }
        } finally {
            writeLock.unlock();
        }
    }

    @NonNull
    private static ContentValues getContentValues(ChatMessage detail) {
        ContentValues values = new ContentValues();
        values.put(COLUMN_DATE, detail.date);
        values.put(COLUMN_TAG, detail.tag); // Changed from COLUMN_SUBJECT
        values.put(COLUMN_CONTENT, detail.content);
        values.put(COLUMN_SESSION_ID, detail.sessionId);
        values.put(COLUMN_TYPE, detail.type);
        values.put(COLUMN_IS_SELF, detail.isSelf ? 1 : 0); // Changed to boolean
        values.put(COLUMN_TIMESTAMP, detail.timestamp);
        return values;
    }

    @SuppressLint("Range")
    public synchronized ChatMessage getMessageDetail(long timestamp) { // Changed return type
        readLock.lock();
        try {
            SQLiteDatabase db = getDatabase();
            Cursor cursor = db.query(TABLE_DETAIL,
                    new String[]{COLUMN_DATE, COLUMN_TAG, COLUMN_CONTENT, COLUMN_SESSION_ID, COLUMN_TYPE, COLUMN_IS_SELF, COLUMN_TIMESTAMP}, // Changed from COLUMN_SUBJECT
                    COLUMN_TIMESTAMP + "=?",
                    new String[]{String.valueOf(timestamp)}, null, null, null);

            ChatMessage detail = null; // Changed type
            if (cursor != null && cursor.moveToFirst()) {
                detail = new ChatMessage(cursor.getString(cursor.getColumnIndex(COLUMN_CONTENT)),
                        cursor.getInt(cursor.getColumnIndex(COLUMN_IS_SELF)) == 1,
                        cursor.getInt(cursor.getColumnIndex(COLUMN_TYPE)),
                        true,
                        cursor.getString(cursor.getColumnIndex(COLUMN_SESSION_ID)),
                        cursor.getString(cursor.getColumnIndex(COLUMN_TAG)), // Changed from COLUMN_SUBJECT
                        cursor.getLong(cursor.getColumnIndex(COLUMN_TIMESTAMP)));
                cursor.close();
            }
            return detail;
        } finally {
            readLock.unlock();
        }
    }

    public synchronized int updateMessageDetail(ChatMessage detail) { // Changed parameter type
        writeLock.lock();
        try {
            SQLiteDatabase db = getDatabase();
            db.beginTransaction();
            try {
                ContentValues values = new ContentValues();
                values.put(COLUMN_DATE, detail.date);
                values.put(COLUMN_TAG, detail.tag); // Changed from COLUMN_SUBJECT
                values.put(COLUMN_CONTENT, detail.content);
                values.put(COLUMN_SESSION_ID, detail.sessionId);
                values.put(COLUMN_TYPE, detail.type);
                values.put(COLUMN_IS_SELF, detail.isSelf ? 1 : 0); // Changed to boolean
                int rowsAffected = db.update(TABLE_DETAIL, values,
                        COLUMN_TIMESTAMP + "=?",
                        new String[]{String.valueOf(detail.timestamp)});
                db.setTransactionSuccessful();
                return rowsAffected;
            } finally {
                db.endTransaction();
            }
        } finally {
            writeLock.unlock();
        }
    }

    public synchronized void deleteMessageDetail(long timestamp) {
        writeLock.lock();
        try {
            SQLiteDatabase db = getDatabase();
            db.beginTransaction();
            try {
                db.delete(TABLE_DETAIL,
                        COLUMN_TIMESTAMP + "=?",
                        new String[]{String.valueOf(timestamp)});
                db.setTransactionSuccessful();
            } finally {
                db.endTransaction();
            }
        } finally {
            writeLock.unlock();
        }
    }

    public long easyAddMessageDetail(ChatMessage detail) {
        writeLock.lock();
        try {
            SQLiteDatabase db = this.getWritableDatabase();
            db.beginTransaction();
            try {
                // Check if the MessageCatalogue entry exists
                ChatMessageCatalogue existingCatalogue = getMessageCatalogue(detail.date, detail.tag);
                if (existingCatalogue == null) {
                    // If it doesn't exist, create a new MessageCatalogue entry
                    ChatMessageCatalogue newCatalogue = new ChatMessageCatalogue();
                    newCatalogue.date = detail.date;
                    newCatalogue.tag = detail.tag;
                    newCatalogue.sessionId = detail.sessionId;
                    addMessageCatalogue(newCatalogue);
                }

                // Add the MessageDetail
                long result = addMessageDetail(detail);
                db.setTransactionSuccessful();
                return result;
            } finally {
                db.endTransaction();
            }
        } finally {
            writeLock.unlock();
        }
    }

    public List<String> getAllMessageTags() {
        readLock.lock();
        try {
            List<String> tags = new ArrayList<>();
            String selectQuery = "SELECT DISTINCT " + COLUMN_TAG + " FROM " + TABLE_CATALOGUE;

            SQLiteDatabase db = this.getReadableDatabase();
            Cursor cursor = db.rawQuery(selectQuery, null);

            if (cursor.moveToFirst()) {
                do {
                    @SuppressLint("Range") String tag = cursor.getString(cursor.getColumnIndex(COLUMN_TAG));
                    tags.add(tag);
                } while (cursor.moveToNext());
            }

            cursor.close();
            return tags;
        } finally {
            readLock.unlock();
        }
    }

    @SuppressLint("Range")
    public List<ChatMessageCatalogue> getMessageCatalogueByTag(String tag) {
        readLock.lock();
        try {
            List<ChatMessageCatalogue> catalogueList = new ArrayList<>();
            String selectQuery = "SELECT * FROM " + TABLE_CATALOGUE +
                    " WHERE " + COLUMN_TAG + "  = ?";

            SQLiteDatabase db = this.getReadableDatabase();
            Cursor cursor = db.rawQuery(selectQuery, new String[]{tag});

            if (cursor.moveToFirst()) {
                do {
                    ChatMessageCatalogue catalogue = new ChatMessageCatalogue();
                    catalogue.date = cursor.getString(cursor.getColumnIndex(COLUMN_DATE));
                    catalogue.tag = cursor.getString(cursor.getColumnIndex(COLUMN_TAG));
                    catalogue.sessionId = cursor.getString(cursor.getColumnIndex(COLUMN_SESSION_ID));
                    catalogueList.add(catalogue);
                } while (cursor.moveToNext());
            }

            cursor.close();
            return catalogueList;
        } finally {
            readLock.unlock();
        }
    }

    @SuppressLint("Range")
    public List<ChatMessage> getMessageDetail(String date, String tag) {
        readLock.lock();
        try {
            List<ChatMessage> detailList = new ArrayList<>();
            SQLiteDatabase db = this.getReadableDatabase();

            String selectQuery = "SELECT * FROM " + TABLE_DETAIL +
                    " WHERE " + COLUMN_DATE + " = ? AND " + COLUMN_TAG + " = ?";
            Cursor cursor = db.rawQuery(selectQuery, new String[]{date, tag});

            if (cursor.moveToFirst()) {
                do {
                    String content = cursor.getString(cursor.getColumnIndex(COLUMN_CONTENT));
                    String sessionId = cursor.getString(cursor.getColumnIndex(COLUMN_SESSION_ID));
                    int type = cursor.getInt(cursor.getColumnIndex(COLUMN_TYPE));
                    boolean isSelf = cursor.getInt(cursor.getColumnIndex(COLUMN_IS_SELF)) == 1;
                    long timestamp = cursor.getLong(cursor.getColumnIndex(COLUMN_TIMESTAMP));
                    ChatMessage detail = new ChatMessage(content, isSelf, type, true, sessionId, tag, timestamp);
                    detailList.add(detail);
                } while (cursor.moveToNext());
            }

            cursor.close();
            return detailList;
        } finally {
            readLock.unlock();
        }
    }
}

