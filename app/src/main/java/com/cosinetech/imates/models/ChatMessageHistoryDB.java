package com.cosinetech.imates.models;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import android.annotation.SuppressLint;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

public class ChatMessageHistoryDB extends SQLiteOpenHelper {
    private static final String DATABASE_NAME = "chat_history.db";
    private static final int DATABASE_VERSION = 1;

    // Table Names
    private static final String TABLE_MESSAGE_CATALOGUE = "message_catalogue";
    private static final String TABLE_MESSAGE_SESSION = "message_session";
    private static final String TABLE_MESSAGE_DETAIL = "message_detail";

    // Common Columns
    private static final String KEY_ID = "id";
    private static final String KEY_CREATE_TIME = "create_time";
    private static final String KEY_UPDATE_TIME = "update_time";

    // Message Catalogue Table Columns
    private static final String KEY_CATALOG_ID = "catalog_id";
    private static final String KEY_CATALOG_NAME = "catalog_name";

    // Message Session Table Columns
    private static final String KEY_SESSION_ID = "session_id";
    private static final String KEY_SESSION_NAME = "session_name";
    private static final String KEY_TYPE = "type";
    private static final String KEY_LAST_MESSAGE_TIME = "last_message_time";

    // Message Detail Table Columns
    private static final String KEY_CONTENT = "content";
    private static final String KEY_IS_SELF = "is_self";
    private static final String KEY_TIMESTAMP = "timestamp";

    // Create Table Statements
    private static final String CREATE_TABLE_MESSAGE_CATALOGUE = "CREATE TABLE "
            + TABLE_MESSAGE_CATALOGUE + "("
            + KEY_ID + " INTEGER PRIMARY KEY AUTOINCREMENT,"
            + KEY_CATALOG_ID + " TEXT UNIQUE,"
            + KEY_CATALOG_NAME + " TEXT,"
            + KEY_CREATE_TIME + " INTEGER,"
            + KEY_UPDATE_TIME + " INTEGER"
            + ")";

    private static final String CREATE_TABLE_MESSAGE_SESSION = "CREATE TABLE "
            + TABLE_MESSAGE_SESSION + "("
            + KEY_ID + " INTEGER PRIMARY KEY AUTOINCREMENT,"
            + KEY_SESSION_ID + " TEXT UNIQUE,"
            + KEY_CATALOG_ID + " TEXT,"
            + KEY_SESSION_NAME + " TEXT,"
            + KEY_TYPE + " INTEGER,"
            + KEY_LAST_MESSAGE_TIME + " INTEGER,"
            + KEY_CREATE_TIME + " INTEGER,"
            + KEY_UPDATE_TIME + " INTEGER"
            + ")";

    private static final String CREATE_TABLE_MESSAGE_DETAIL = "CREATE TABLE "
            + TABLE_MESSAGE_DETAIL + "("
            + KEY_ID + " INTEGER PRIMARY KEY AUTOINCREMENT,"
            + KEY_SESSION_ID + " TEXT,"
            + KEY_CONTENT + " TEXT,"
            + KEY_TYPE + " INTEGER,"
            + KEY_IS_SELF + " INTEGER,"
            + KEY_TIMESTAMP + " INTEGER"
            + ")";

    private static ChatMessageHistoryDB instance;
    public static ChatMessageHistoryDB getInstance(Context context, File userPath) {
        if (instance == null) {
            String dbName = userPath.getAbsolutePath()+ "/" + DATABASE_NAME;
            instance = new ChatMessageHistoryDB(context.getApplicationContext(), dbName);
        }
        return instance;
    }

    private ChatMessageHistoryDB(Context context, String dbName) {
        super(context, dbName, null, DATABASE_VERSION);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL(CREATE_TABLE_MESSAGE_CATALOGUE);
        db.execSQL(CREATE_TABLE_MESSAGE_SESSION);
        db.execSQL(CREATE_TABLE_MESSAGE_DETAIL);
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        db.execSQL("DROP TABLE IF EXISTS " + TABLE_MESSAGE_CATALOGUE);
        db.execSQL("DROP TABLE IF EXISTS " + TABLE_MESSAGE_SESSION);
        db.execSQL("DROP TABLE IF EXISTS " + TABLE_MESSAGE_DETAIL);
        onCreate(db);
    }

    // Message Catalogue Methods
    public synchronized long addMessageCatalogue(ChatMessageCatalogue catalogue) {
        SQLiteDatabase db = this.getWritableDatabase();

        // Check if exists
        Cursor cursor = db.query(TABLE_MESSAGE_CATALOGUE,
                new String[]{KEY_ID},
                KEY_CATALOG_ID + "=?",
                new String[]{catalogue.catalogId},
                null, null, null);

        if (cursor != null && cursor.moveToFirst()) {
            cursor.close();
            return -1; // Already exists
        }

        ContentValues values = new ContentValues();
        values.put(KEY_CATALOG_ID, catalogue.catalogId);
        values.put(KEY_CATALOG_NAME, catalogue.catalogName);
        values.put(KEY_CREATE_TIME, catalogue.createTime);
        values.put(KEY_UPDATE_TIME, catalogue.updateTime);

        return db.insert(TABLE_MESSAGE_CATALOGUE, null, values);
    }

    public synchronized int updateMessageCatalogue(ChatMessageCatalogue catalogue) {
        SQLiteDatabase db = this.getWritableDatabase();

        ContentValues values = new ContentValues();
        values.put(KEY_CATALOG_NAME, catalogue.catalogName);
        values.put(KEY_UPDATE_TIME, catalogue.updateTime);

        return db.update(TABLE_MESSAGE_CATALOGUE,
                values,
                KEY_CATALOG_ID + "=?",
                new String[]{catalogue.catalogId});
    }

    public synchronized int deleteMessageCatalogue(String catalogId) {
        SQLiteDatabase db = this.getWritableDatabase();

        // First delete all associated sessions
        Cursor sessionCursor = db.query(TABLE_MESSAGE_SESSION,
                new String[]{KEY_SESSION_ID},
                KEY_CATALOG_ID + "=?",
                new String[]{catalogId},
                null, null, null);

        if (sessionCursor != null) {
            while (sessionCursor.moveToNext()) {
                String sessionId = sessionCursor.getString(0);
                deleteMessageSession(sessionId);
            }
            sessionCursor.close();
        }

        return db.delete(TABLE_MESSAGE_CATALOGUE,
                KEY_CATALOG_ID + "=?",
                new String[]{catalogId});
    }

    public synchronized int deleteAllMessageCatalogue() {
        SQLiteDatabase db = this.getWritableDatabase();
        deleteAllMessageSession();
        return db.delete(TABLE_MESSAGE_CATALOGUE, null, null);
    }

    @SuppressLint("Range")
    public synchronized List<ChatMessageCatalogue> getAllMessageCatalogue() {
        List<ChatMessageCatalogue> catalogues = new ArrayList<>();
        String selectQuery = "SELECT * FROM " + TABLE_MESSAGE_CATALOGUE;

        SQLiteDatabase db = this.getReadableDatabase();
        Cursor cursor = db.rawQuery(selectQuery, null);

        if (cursor.moveToFirst()) {
            do {
                ChatMessageCatalogue catalogue = new ChatMessageCatalogue();
                catalogue.id = cursor.getLong(cursor.getColumnIndex(KEY_ID));
                catalogue.catalogId = cursor.getString(cursor.getColumnIndex(KEY_CATALOG_ID));
                catalogue.catalogName = cursor.getString(cursor.getColumnIndex(KEY_CATALOG_NAME));
                catalogue.createTime = cursor.getLong(cursor.getColumnIndex(KEY_CREATE_TIME));
                catalogue.updateTime = cursor.getLong(cursor.getColumnIndex(KEY_UPDATE_TIME));
                catalogues.add(catalogue);
            } while (cursor.moveToNext());
        }
        cursor.close();
        return catalogues;
    }

    @SuppressLint("Range")
    public synchronized ChatMessageCatalogue getMessageCatalogue(String catalogId) {
        SQLiteDatabase db = this.getReadableDatabase();

        Cursor cursor = db.query(TABLE_MESSAGE_CATALOGUE,
                null,
                KEY_CATALOG_ID + "=?",
                new String[]{catalogId},
                null, null, null);

        ChatMessageCatalogue catalogue = null;
        if (cursor != null && cursor.moveToFirst()) {
            catalogue = new ChatMessageCatalogue();
            catalogue.id = cursor.getLong(cursor.getColumnIndex(KEY_ID));
            catalogue.catalogId = cursor.getString(cursor.getColumnIndex(KEY_CATALOG_ID));
            catalogue.catalogName = cursor.getString(cursor.getColumnIndex(KEY_CATALOG_NAME));
            catalogue.createTime = cursor.getLong(cursor.getColumnIndex(KEY_CREATE_TIME));
            catalogue.updateTime = cursor.getLong(cursor.getColumnIndex(KEY_UPDATE_TIME));
            cursor.close();
        }
        return catalogue;
    }

    // Message Session Methods
    public synchronized long addMessageSession(ChatMessageSession messageSession) {
        SQLiteDatabase db = this.getWritableDatabase();

        // Check if exists
        Cursor cursor = db.query(TABLE_MESSAGE_SESSION,
                new String[]{KEY_ID},
                KEY_SESSION_ID + "=?",
                new String[]{messageSession.sessionId},
                null, null, null);

        if (cursor != null && cursor.moveToFirst()) {
            cursor.close();
            return -1; // Already exists
        }

        ContentValues values = new ContentValues();
        values.put(KEY_SESSION_ID, messageSession.sessionId);
        values.put(KEY_CATALOG_ID, messageSession.catalogId);
        values.put(KEY_SESSION_NAME, messageSession.sessionName);
        values.put(KEY_TYPE, messageSession.type);
        values.put(KEY_LAST_MESSAGE_TIME, messageSession.lastMessageTime);
        values.put(KEY_CREATE_TIME, messageSession.createTime);
        values.put(KEY_UPDATE_TIME, messageSession.updateTime);

        return db.insert(TABLE_MESSAGE_SESSION, null, values);
    }

    public synchronized int updateMessageSession(ChatMessageSession messageSession) {
        SQLiteDatabase db = this.getWritableDatabase();

        ContentValues values = new ContentValues();
        values.put(KEY_SESSION_NAME, messageSession.sessionName);
        values.put(KEY_LAST_MESSAGE_TIME, messageSession.lastMessageTime);
        values.put(KEY_UPDATE_TIME, messageSession.updateTime);

        return db.update(TABLE_MESSAGE_SESSION,
                values,
                KEY_SESSION_ID + "=?",
                new String[]{messageSession.sessionId});
    }

    public synchronized int deleteMessageSession(String sessionId) {
        SQLiteDatabase db = this.getWritableDatabase();

        // First delete all messages in this session
        db.delete(TABLE_MESSAGE_DETAIL,
                KEY_SESSION_ID + "=?",
                new String[]{sessionId});

        return db.delete(TABLE_MESSAGE_SESSION,
                KEY_SESSION_ID + "=?",
                new String[]{sessionId});
    }

    public synchronized int deleteAllMessageSession() {
        SQLiteDatabase db = this.getWritableDatabase();
        deleteAllChatMessageDetail();
        return db.delete(TABLE_MESSAGE_SESSION, null, null);
    }

    @SuppressLint("Range")
    public synchronized List<ChatMessageSession> getAllMessageSession(int type) {
        List<ChatMessageSession> sessions = new ArrayList<>();
        SQLiteDatabase db = this.getReadableDatabase();

        Cursor cursor = db.query(TABLE_MESSAGE_SESSION,
                null,
                KEY_TYPE + "=?",
                new String[]{String.valueOf(type)},
                null, null, null);

        if (cursor.moveToFirst()) {
            do {
                ChatMessageSession session = new ChatMessageSession();
                session.id = cursor.getLong(cursor.getColumnIndex(KEY_ID));
                session.sessionId = cursor.getString(cursor.getColumnIndex(KEY_SESSION_ID));
                session.catalogId = cursor.getString(cursor.getColumnIndex(KEY_CATALOG_ID));
                session.sessionName = cursor.getString(cursor.getColumnIndex(KEY_SESSION_NAME));
                session.type = cursor.getInt(cursor.getColumnIndex(KEY_TYPE));
                session.lastMessageTime = cursor.getLong(cursor.getColumnIndex(KEY_LAST_MESSAGE_TIME));
                session.createTime = cursor.getLong(cursor.getColumnIndex(KEY_CREATE_TIME));
                session.updateTime = cursor.getLong(cursor.getColumnIndex(KEY_UPDATE_TIME));
                sessions.add(session);
            } while (cursor.moveToNext());
        }
        cursor.close();
        return sessions;
    }

    @SuppressLint("Range")
    public synchronized ChatMessageSession getMessageSessionBySessionId(String sessionId) {
        SQLiteDatabase db = this.getReadableDatabase();

        Cursor cursor = db.query(TABLE_MESSAGE_SESSION,
                null,
                KEY_SESSION_ID + "=?",
                new String[]{sessionId},
                null, null, null);

        ChatMessageSession session = null;
        if (cursor != null && cursor.moveToFirst()) {
            session = new ChatMessageSession();
            session.id = cursor.getLong(cursor.getColumnIndex(KEY_ID));
            session.sessionId = cursor.getString(cursor.getColumnIndex(KEY_SESSION_ID));
            session.catalogId = cursor.getString(cursor.getColumnIndex(KEY_CATALOG_ID));
            session.sessionName = cursor.getString(cursor.getColumnIndex(KEY_SESSION_NAME));
            session.type = cursor.getInt(cursor.getColumnIndex(KEY_TYPE));
            session.lastMessageTime = cursor.getLong(cursor.getColumnIndex(KEY_LAST_MESSAGE_TIME));
            session.createTime = cursor.getLong(cursor.getColumnIndex(KEY_CREATE_TIME));
            session.updateTime = cursor.getLong(cursor.getColumnIndex(KEY_UPDATE_TIME));
            cursor.close();
        }
        return session;
    }

    @SuppressLint("Range")
    public synchronized List<ChatMessageSession> getMessageSessionByCatalogId(String catalogId) {
        List<ChatMessageSession> sessions = new ArrayList<>();
        SQLiteDatabase db = this.getReadableDatabase();

        Cursor cursor = db.query(TABLE_MESSAGE_SESSION,
                null,
                KEY_CATALOG_ID + "=?",
                new String[]{String.valueOf(catalogId)},
                null, null, null);

        if (cursor.moveToFirst()) {
            do {
                ChatMessageSession session = new ChatMessageSession();
                session.id = cursor.getLong(cursor.getColumnIndex(KEY_ID));
                session.sessionId = cursor.getString(cursor.getColumnIndex(KEY_SESSION_ID));
                session.catalogId = cursor.getString(cursor.getColumnIndex(KEY_CATALOG_ID));
                session.sessionName = cursor.getString(cursor.getColumnIndex(KEY_SESSION_NAME));
                session.type = cursor.getInt(cursor.getColumnIndex(KEY_TYPE));
                session.lastMessageTime = cursor.getLong(cursor.getColumnIndex(KEY_LAST_MESSAGE_TIME));
                session.createTime = cursor.getLong(cursor.getColumnIndex(KEY_CREATE_TIME));
                session.updateTime = cursor.getLong(cursor.getColumnIndex(KEY_UPDATE_TIME));
                sessions.add(session);
            } while (cursor.moveToNext());
        }
        cursor.close();
        return sessions;
    }

    // Message Detail Methods
    public synchronized long addChatMessageDetail(ChatMessage msg) {
        SQLiteDatabase db = this.getWritableDatabase();

        ContentValues values = new ContentValues();
        values.put(KEY_SESSION_ID, msg.sessionId);
        values.put(KEY_CONTENT, msg.content);
        values.put(KEY_TYPE, msg.type);
        values.put(KEY_IS_SELF, msg.isSelf ? 1 : 0);
        values.put(KEY_TIMESTAMP, msg.timestamp);

        return db.insert(TABLE_MESSAGE_DETAIL, null, values);
    }

    public synchronized int updateChatMessageDetail(ChatMessage msg) {
        SQLiteDatabase db = this.getWritableDatabase();

        ContentValues values = new ContentValues();
        values.put(KEY_CONTENT, msg.content);
        values.put(KEY_TYPE, msg.type);
        values.put(KEY_IS_SELF, msg.isSelf ? 1 : 0);
        values.put(KEY_TIMESTAMP, msg.timestamp);

        return db.update(TABLE_MESSAGE_DETAIL,
                values,
                KEY_ID + "=?",
                new String[]{String.valueOf(msg.id)});
    }

    public synchronized int deleteChatMessageDetail(long dbId) {
        SQLiteDatabase db = this.getWritableDatabase();
        return db.delete(TABLE_MESSAGE_DETAIL,
                KEY_ID + "=?",
                new String[]{String.valueOf(dbId)});
    }

    @SuppressLint("Range")
    public synchronized List<ChatMessage> searchMessageDetail(String searchContent) {
        List<ChatMessage> detailList = new ArrayList<>();
        SQLiteDatabase db = this.getReadableDatabase();

        String selectQuery = "SELECT * FROM " + TABLE_MESSAGE_DETAIL +
                " WHERE " + KEY_CONTENT + " LIKE ? ";
        String selectionArg = "%" + searchContent + "%";
        Cursor cursor = db.rawQuery(selectQuery, null);

        if (cursor.moveToFirst()) {
            do {
                ChatMessage msg = new ChatMessage();
                msg.id = cursor.getLong(cursor.getColumnIndex(KEY_ID));
                msg.sessionId = cursor.getString(cursor.getColumnIndex(KEY_SESSION_ID));
                msg.content = cursor.getString(cursor.getColumnIndex(KEY_CONTENT));
                msg.type = cursor.getInt(cursor.getColumnIndex(KEY_TYPE));
                msg.isSelf = cursor.getInt(cursor.getColumnIndex(KEY_IS_SELF)) == 1;
                msg.timestamp = cursor.getLong(cursor.getColumnIndex(KEY_TIMESTAMP));
                detailList.add(msg);
            } while (cursor.moveToNext());
        }
        cursor.close();
        return detailList;
    }

    public synchronized int deleteAllChatMessageDetail() {
        SQLiteDatabase db = this.getWritableDatabase();
        return db.delete(TABLE_MESSAGE_DETAIL, null, null);
    }

    @SuppressLint("Range")
    public synchronized List<ChatMessage> getAllChatMessageDetail() {
        List<ChatMessage> messages = new ArrayList<>();
        String selectQuery = "SELECT * FROM " + TABLE_MESSAGE_DETAIL;

        SQLiteDatabase db = this.getReadableDatabase();
        Cursor cursor = db.rawQuery(selectQuery, null);

        if (cursor.moveToFirst()) {
            do {
                ChatMessage msg = new ChatMessage();
                msg.id = cursor.getLong(cursor.getColumnIndex(KEY_ID));
                msg.sessionId = cursor.getString(cursor.getColumnIndex(KEY_SESSION_ID));
                msg.content = cursor.getString(cursor.getColumnIndex(KEY_CONTENT));
                msg.type = cursor.getInt(cursor.getColumnIndex(KEY_TYPE));
                msg.isSelf = cursor.getInt(cursor.getColumnIndex(KEY_IS_SELF)) == 1;
                msg.timestamp = cursor.getLong(cursor.getColumnIndex(KEY_TIMESTAMP));
                messages.add(msg);
            } while (cursor.moveToNext());
        }
        cursor.close();
        return messages;
    }

    @SuppressLint("Range")
    public synchronized List<ChatMessage> getChatMessageDetail(String sessionId) {
        List<ChatMessage> messages = new ArrayList<>();
        SQLiteDatabase db = this.getReadableDatabase();

        Cursor cursor = db.query(TABLE_MESSAGE_DETAIL,
                null,
                KEY_SESSION_ID + "=?",
                new String[]{sessionId},
                null, null, KEY_TIMESTAMP + " ASC");

        if (cursor.moveToFirst()) {
            do {
                ChatMessage msg = new ChatMessage();
                msg.id = cursor.getLong(cursor.getColumnIndex(KEY_ID));
                msg.sessionId = cursor.getString(cursor.getColumnIndex(KEY_SESSION_ID));
                msg.content = cursor.getString(cursor.getColumnIndex(KEY_CONTENT));
                msg.type = cursor.getInt(cursor.getColumnIndex(KEY_TYPE));
                msg.isSelf = cursor.getInt(cursor.getColumnIndex(KEY_IS_SELF)) == 1;
                msg.timestamp = cursor.getLong(cursor.getColumnIndex(KEY_TIMESTAMP));
                messages.add(msg);
            } while (cursor.moveToNext());
        }
        cursor.close();
        return messages;
    }

    @SuppressLint("Range")
    public synchronized List<ChatMessage> getChatMessageDetailSinceTime(String sessionId, long timestamp) {
        List<ChatMessage> messages = new ArrayList<>();
        SQLiteDatabase db = this.getReadableDatabase();

        Cursor cursor = db.query(TABLE_MESSAGE_DETAIL,
                null,
                KEY_SESSION_ID + "=? AND " + KEY_TIMESTAMP + ">?",
                new String[]{sessionId, String.valueOf(timestamp)},
                null, null, KEY_TIMESTAMP + " ASC");

        if (cursor.moveToFirst()) {
            do {
                ChatMessage msg = new ChatMessage();
                msg.id = cursor.getLong(cursor.getColumnIndex(KEY_ID));
                msg.sessionId = cursor.getString(cursor.getColumnIndex(KEY_SESSION_ID));
                msg.content = cursor.getString(cursor.getColumnIndex(KEY_CONTENT));
                msg.type = cursor.getInt(cursor.getColumnIndex(KEY_TYPE));
                msg.isSelf = cursor.getInt(cursor.getColumnIndex(KEY_IS_SELF)) == 1;
                msg.timestamp = cursor.getLong(cursor.getColumnIndex(KEY_TIMESTAMP));
                messages.add(msg);
            } while (cursor.moveToNext());
        }
        cursor.close();
        return messages;
    }

    // Additional Methods
    public synchronized ChatMessageCatalogue getMessageCatalogue(ChatMessage msg) {
        if (msg == null || msg.sessionId == null) {
            return null;
        }

        // First get the session to get catalogId
        ChatMessageSession session = getMessageSessionBySessionId(msg.sessionId);
        if (session == null) {
            return null;
        }

        // Then get the catalogue using catalogId
        return getMessageCatalogue(session.catalogId);
    }
}

