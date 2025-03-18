package com.cosinetech.imates.models;

import android.annotation.SuppressLint;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import java.io.File;
import java.lang.reflect.Constructor;
import java.util.ArrayList;
import java.util.List;

public class ChatMessageHistoryDB extends SQLiteOpenHelper {
    private static final String DATABASE_NAME = "chat_history_v16.db";
    private static final int DATABASE_VERSION = 1;

    // Table Names
    private static final String TABLE_MESSAGE_CATALOGUE = "message_catalogue";
    private static final String TABLE_MESSAGE_SESSION = "message_session";
    private static final String TABLE_MESSAGE_DETAIL = "message_detail";

    // Message Catalogue Table Columns
    private static final String CATALOGUE_ID = "id"; // 自增ID
    private static final String CATALOGUE_CATALOG_ID = "catalog_id"; // 主键
    private static final String CATALOGUE_NAME = "catalog_name";
    private static final String CATALOGUE_TYPE = "type";
    private static final String CATALOGUE_CREATE_TIME = "create_time";
    private static final String CATALOGUE_UPDATE_TIME = "update_time";

    // Message Session Table Columns
    private static final String SESSION_ID = "id"; // 自增ID
    private static final String SESSION_SESSION_ID = "session_id"; // 主键
    private static final String SESSION_CATALOG_ID = "catalog_id"; // 外键
    private static final String SESSION_NAME = "session_name";
    private static final String SESSION_TYPE = "type";
    private static final String SESSION_RECEIVER_ID = "receiver_id"; // 新增字段
    private static final String SESSION_LAST_READ_TIME = "last_read_time"; // 改名
    private static final String SESSION_CREATE_TIME = "create_time";
    private static final String SESSION_UPDATE_TIME = "update_time";

    // Message Detail Table Columns
    private static final String MESSAGE_ID = "id"; // 自增ID
    private static final String MESSAGE_MESSAGE_ID = "message_id"; // 主键
    private static final String MESSAGE_SESSION_ID = "session_id"; // 外键
    private static final String MESSAGE_CONTENT = "content";
    private static final String MESSAGE_TYPE = "type";
    private static final String MESSAGE_STATUS = "status"; // 新增字段
    private static final String MESSAGE_IS_SELF = "is_self";
    private static final String MESSAGE_TIMESTAMP = "timestamp";

    // Create Table Statements
    private static final String CREATE_TABLE_MESSAGE_CATALOGUE = "CREATE TABLE "
            + TABLE_MESSAGE_CATALOGUE + "("
            + CATALOGUE_ID + " INTEGER PRIMARY KEY AUTOINCREMENT,"
            + CATALOGUE_CATALOG_ID + " TEXT UNIQUE,"
            + CATALOGUE_NAME + " TEXT,"
            + CATALOGUE_TYPE + " INTEGER,"
            + CATALOGUE_CREATE_TIME + " INTEGER,"
            + CATALOGUE_UPDATE_TIME + " INTEGER"
            + ")";

    private static final String CREATE_TABLE_MESSAGE_SESSION = "CREATE TABLE "
            + TABLE_MESSAGE_SESSION + "("
            + SESSION_ID + " INTEGER PRIMARY KEY AUTOINCREMENT,"
            + SESSION_SESSION_ID + " TEXT UNIQUE,"
            + SESSION_CATALOG_ID + " TEXT,"
            + SESSION_NAME + " TEXT,"
            + SESSION_TYPE + " INTEGER,"
            + SESSION_RECEIVER_ID + " TEXT,"  // 新增字段
            + SESSION_LAST_READ_TIME + " INTEGER,"
            + SESSION_CREATE_TIME + " INTEGER,"
            + SESSION_UPDATE_TIME + " INTEGER"
            + ")";

    private static final String CREATE_TABLE_MESSAGE_DETAIL = "CREATE TABLE "
            + TABLE_MESSAGE_DETAIL + "("
            + MESSAGE_ID + " INTEGER PRIMARY KEY AUTOINCREMENT,"
            + MESSAGE_MESSAGE_ID + " TEXT UNIQUE,"
            + MESSAGE_SESSION_ID + " TEXT,"
            + MESSAGE_CONTENT + " TEXT,"
            + MESSAGE_TYPE + " INTEGER,"
            + MESSAGE_STATUS + " INTEGER DEFAULT 0," // 新增字段
            + MESSAGE_IS_SELF + " INTEGER,"
            + MESSAGE_TIMESTAMP + " INTEGER"
            + ")";

    private static ChatMessageHistoryDB instance;

    public static ChatMessageHistoryDB getInstance(Context context, String userId) {
        if (instance == null) {
            String dbPath = userId + "_" + DATABASE_NAME;
            instance = new ChatMessageHistoryDB(context.getApplicationContext(), dbPath);
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

        Cursor cursor = db.query(TABLE_MESSAGE_CATALOGUE,
                new String[]{CATALOGUE_ID},
                CATALOGUE_CATALOG_ID + "=?",
                new String[]{catalogue.catalogId},
                null, null, null);

        if (cursor != null && cursor.moveToFirst()) {
            cursor.close();
            return -1;
        }

        ContentValues values = new ContentValues();
        values.put(CATALOGUE_CATALOG_ID, catalogue.catalogId);
        values.put(CATALOGUE_NAME, catalogue.catalogName);
        values.put(CATALOGUE_TYPE, catalogue.type.getValue());
        values.put(CATALOGUE_CREATE_TIME, catalogue.createTime);
        values.put(CATALOGUE_UPDATE_TIME, catalogue.updateTime);

        return db.insert(TABLE_MESSAGE_CATALOGUE, null, values);
    }

    public synchronized int updateMessageCatalogue(ChatMessageCatalogue catalogue) {
        SQLiteDatabase db = this.getWritableDatabase();

        ContentValues values = new ContentValues();
        values.put(CATALOGUE_NAME, catalogue.catalogName);
        values.put(CATALOGUE_TYPE, catalogue.type.getValue());
        values.put(CATALOGUE_UPDATE_TIME, catalogue.updateTime);

        return db.update(TABLE_MESSAGE_CATALOGUE,
                values,
                CATALOGUE_CATALOG_ID + "=?",
                new String[]{catalogue.catalogId});
    }

    public synchronized int deleteMessageCatalogue(String catalogId) {
        SQLiteDatabase db = this.getWritableDatabase();

        // First delete all associated sessions
        Cursor sessionCursor = db.query(TABLE_MESSAGE_SESSION,
                new String[]{SESSION_SESSION_ID},
                SESSION_CATALOG_ID + "=?",
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
                CATALOGUE_CATALOG_ID + "=?",
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
        String selectQuery = "SELECT * FROM " + TABLE_MESSAGE_CATALOGUE + " ORDER BY " + CATALOGUE_UPDATE_TIME + " DESC";

        SQLiteDatabase db = this.getReadableDatabase();
        Cursor cursor = db.rawQuery(selectQuery, null);

        if (cursor.moveToFirst()) {
            do {
                ChatMessageCatalogue catalogue = createChatMessageCatalogue();
                catalogue.id = cursor.getLong(cursor.getColumnIndex(CATALOGUE_ID));
                catalogue.catalogId = cursor.getString(cursor.getColumnIndex(CATALOGUE_CATALOG_ID));
                catalogue.catalogName = cursor.getString(cursor.getColumnIndex(CATALOGUE_NAME));
                catalogue.type = ChatMessageCatalogue.CatalogueType.fromValue(cursor.getInt(cursor.getColumnIndex(CATALOGUE_TYPE)));
                catalogue.createTime = cursor.getLong(cursor.getColumnIndex(CATALOGUE_CREATE_TIME));
                catalogue.updateTime = cursor.getLong(cursor.getColumnIndex(CATALOGUE_UPDATE_TIME));
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
                CATALOGUE_CATALOG_ID + "=?",
                new String[]{catalogId},
                null, null, null);

        ChatMessageCatalogue catalogue = null;
        if (cursor != null && cursor.moveToFirst()) {
            catalogue = createChatMessageCatalogue();
            catalogue.id = cursor.getLong(cursor.getColumnIndex(CATALOGUE_ID));
            catalogue.catalogId = cursor.getString(cursor.getColumnIndex(CATALOGUE_CATALOG_ID));
            catalogue.catalogName = cursor.getString(cursor.getColumnIndex(CATALOGUE_NAME));
            catalogue.type = ChatMessageCatalogue.CatalogueType.fromValue(cursor.getInt(cursor.getColumnIndex(CATALOGUE_TYPE)));
            catalogue.createTime = cursor.getLong(cursor.getColumnIndex(CATALOGUE_CREATE_TIME));
            catalogue.updateTime = cursor.getLong(cursor.getColumnIndex(CATALOGUE_UPDATE_TIME));
            cursor.close();
        }
        return catalogue;
    }

    // Message Session Methods
    public synchronized long addMessageSession(ChatMessageSession session) {
        SQLiteDatabase db = this.getWritableDatabase();

        Cursor cursor = db.query(TABLE_MESSAGE_SESSION,
                new String[]{SESSION_ID},
                SESSION_SESSION_ID + "=?",
                new String[]{session.sessionId},
                null, null, null);

        if (cursor != null && cursor.moveToFirst()) {
            cursor.close();
            return -1;
        }

        ContentValues values = new ContentValues();
        values.put(SESSION_SESSION_ID, session.sessionId);
        values.put(SESSION_CATALOG_ID, session.catalogId);
        values.put(SESSION_NAME, session.sessionName);
        values.put(SESSION_TYPE, session.type.getValue());
        values.put(SESSION_RECEIVER_ID, session.receiverId); // 新增字段
        values.put(SESSION_LAST_READ_TIME, session.lastReadTime); // 改名
        values.put(SESSION_CREATE_TIME, session.createTime);
        values.put(SESSION_UPDATE_TIME, session.updateTime);

        return db.insert(TABLE_MESSAGE_SESSION, null, values);
    }

    public synchronized int updateMessageSession(ChatMessageSession session) {
        SQLiteDatabase db = this.getWritableDatabase();

        ContentValues values = new ContentValues();
        values.put(SESSION_NAME, session.sessionName);
        values.put(SESSION_RECEIVER_ID, session.receiverId); // 新增字段
        values.put(SESSION_LAST_READ_TIME, session.lastReadTime); // 改名
        values.put(SESSION_UPDATE_TIME, session.updateTime);

        return db.update(TABLE_MESSAGE_SESSION,
                values,
                SESSION_SESSION_ID + "=?",
                new String[]{session.sessionId});
    }

    public synchronized int updateMessageSessionName(String sessionId, String name, long updateTime) {
        SQLiteDatabase db = this.getWritableDatabase();

        ContentValues values = new ContentValues();
        values.put(SESSION_NAME, name);
        values.put(SESSION_UPDATE_TIME, updateTime);

        return db.update(TABLE_MESSAGE_SESSION,
                values,
                SESSION_SESSION_ID + "=?",
                new String[]{sessionId});
    }

    public synchronized int updateMessageSessionLastReadTime(String sessionId, long readTime, long updateTime) {
        SQLiteDatabase db = this.getWritableDatabase();

        ContentValues values = new ContentValues();
        values.put(SESSION_LAST_READ_TIME, readTime);
        values.put(SESSION_UPDATE_TIME, updateTime);

        return db.update(TABLE_MESSAGE_SESSION,
                values,
                SESSION_SESSION_ID + "=?",
                new String[]{sessionId});
    }

    public synchronized int deleteMessageSession(String sessionId) {
        SQLiteDatabase db = this.getWritableDatabase();

        // First delete all messages in this session
        db.delete(TABLE_MESSAGE_DETAIL,
                MESSAGE_SESSION_ID + "=?",
                new String[]{sessionId});

        return db.delete(TABLE_MESSAGE_SESSION,
                SESSION_SESSION_ID + "=?",
                new String[]{sessionId});
    }

    public synchronized int deleteAllMessageSession() {
        SQLiteDatabase db = this.getWritableDatabase();
        deleteAllChatMessageDetail();
        return db.delete(TABLE_MESSAGE_SESSION, null, null);
    }

    public synchronized int clearMessageSession(String sessionId) {
        SQLiteDatabase db = this.getWritableDatabase();
        return db.delete(TABLE_MESSAGE_DETAIL,
                MESSAGE_SESSION_ID + "=?",
                new String[]{sessionId});
    }

    @SuppressLint("Range")
    public synchronized List<ChatMessageSession> getAllMessageSession(int type) {
        List<ChatMessageSession> sessions = new ArrayList<>();
        SQLiteDatabase db = this.getReadableDatabase();

        Cursor cursor = db.query(TABLE_MESSAGE_SESSION,
                null,
                SESSION_TYPE + "=?",
                new String[]{String.valueOf(type)},
                null, null, SESSION_UPDATE_TIME + " DESC");

        if (cursor.moveToFirst()) {
            do {
                ChatMessageSession session = createChatMessageSession();
                session.id = cursor.getLong(cursor.getColumnIndex(SESSION_ID));
                session.sessionId = cursor.getString(cursor.getColumnIndex(SESSION_SESSION_ID));
                session.catalogId = cursor.getString(cursor.getColumnIndex(SESSION_CATALOG_ID));
                session.sessionName = cursor.getString(cursor.getColumnIndex(SESSION_NAME));
                session.type = ChatMessageSession.SessionType.fromValue(cursor.getInt(cursor.getColumnIndex(SESSION_TYPE)));
                session.receiverId = cursor.getString(cursor.getColumnIndex(SESSION_RECEIVER_ID)); // 新增字段
                session.lastReadTime = cursor.getLong(cursor.getColumnIndex(SESSION_LAST_READ_TIME)); // 改名
                session.createTime = cursor.getLong(cursor.getColumnIndex(SESSION_CREATE_TIME));
                session.updateTime = cursor.getLong(cursor.getColumnIndex(SESSION_UPDATE_TIME));
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
                SESSION_SESSION_ID + "=?",
                new String[]{sessionId},
                null, null, null);

        ChatMessageSession session = null;
        if (cursor != null && cursor.moveToFirst()) {
            session = createChatMessageSession();
            session.id = cursor.getLong(cursor.getColumnIndex(SESSION_ID));
            session.sessionId = cursor.getString(cursor.getColumnIndex(SESSION_SESSION_ID));
            session.catalogId = cursor.getString(cursor.getColumnIndex(SESSION_CATALOG_ID));
            session.sessionName = cursor.getString(cursor.getColumnIndex(SESSION_NAME));
            session.type = ChatMessageSession.SessionType.fromValue(cursor.getInt(cursor.getColumnIndex(SESSION_TYPE)));
            session.receiverId = cursor.getString(cursor.getColumnIndex(SESSION_RECEIVER_ID)); // 新增字段
            session.lastReadTime = cursor.getLong(cursor.getColumnIndex(SESSION_LAST_READ_TIME)); // 改名
            session.createTime = cursor.getLong(cursor.getColumnIndex(SESSION_CREATE_TIME));
            session.updateTime = cursor.getLong(cursor.getColumnIndex(SESSION_UPDATE_TIME));
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
                SESSION_CATALOG_ID + "=?",
                new String[]{catalogId},
                null, null, SESSION_UPDATE_TIME + " DESC");

        if (cursor.moveToFirst()) {
            do {
                ChatMessageSession session = createChatMessageSession();
                session.id = cursor.getLong(cursor.getColumnIndex(SESSION_ID));
                session.sessionId = cursor.getString(cursor.getColumnIndex(SESSION_SESSION_ID));
                session.catalogId = cursor.getString(cursor.getColumnIndex(SESSION_CATALOG_ID));
                session.sessionName = cursor.getString(cursor.getColumnIndex(SESSION_NAME));
                session.type = ChatMessageSession.SessionType.fromValue(cursor.getInt(cursor.getColumnIndex(SESSION_TYPE)));
                session.receiverId = cursor.getString(cursor.getColumnIndex(SESSION_RECEIVER_ID)); // 新增字段
                session.lastReadTime = cursor.getLong(cursor.getColumnIndex(SESSION_LAST_READ_TIME)); // 改名
                session.createTime = cursor.getLong(cursor.getColumnIndex(SESSION_CREATE_TIME));
                session.updateTime = cursor.getLong(cursor.getColumnIndex(SESSION_UPDATE_TIME));
                sessions.add(session);
            } while (cursor.moveToNext());
        }
        cursor.close();
        return sessions;
    }

    // Message Detail Methods
    public synchronized long addChatMessageDetail(ChatMessage msg) {
        SQLiteDatabase db = this.getWritableDatabase();

        Cursor cursor = db.query(TABLE_MESSAGE_DETAIL,
                new String[]{MESSAGE_ID},
                MESSAGE_MESSAGE_ID + "=?",
                new String[]{msg.messageId},
                null, null, null);

        if (cursor != null && cursor.moveToFirst()) {
            cursor.close();
            return -1;
        }

        ContentValues values = new ContentValues();
        values.put(MESSAGE_MESSAGE_ID, msg.messageId);
        values.put(MESSAGE_SESSION_ID, msg.sessionId);
        values.put(MESSAGE_CONTENT, msg.content);
        values.put(MESSAGE_TYPE, msg.type.getValue());
        values.put(MESSAGE_STATUS, msg.status); // 新增字段
        values.put(MESSAGE_IS_SELF, msg.isSelf ? 1 : 0);
        values.put(MESSAGE_TIMESTAMP, msg.timestamp);

        return db.insert(TABLE_MESSAGE_DETAIL, null, values);
    }

    public synchronized int updateChatMessageDetail(String msgId, int status, String content, long timestamp) {
        SQLiteDatabase db = this.getWritableDatabase();

        ContentValues values = new ContentValues();
        values.put(MESSAGE_CONTENT, content);
        values.put(MESSAGE_STATUS, status);
        values.put(MESSAGE_TIMESTAMP, timestamp);

        return db.update(TABLE_MESSAGE_DETAIL,
                values,
                MESSAGE_MESSAGE_ID + "=?",
                new String[]{msgId});
    }
    public synchronized int deleteChatMessageDetail(String messageId) {
        SQLiteDatabase db = this.getWritableDatabase();
        return db.delete(TABLE_MESSAGE_DETAIL,
                MESSAGE_MESSAGE_ID + "=?",
                new String[]{messageId});
    }

    public synchronized int deleteAllChatMessageDetail() {
        SQLiteDatabase db = this.getWritableDatabase();
        return db.delete(TABLE_MESSAGE_DETAIL, null, null);
    }

    @SuppressLint("Range")
    private void populateChatMessageFromCursor(ChatMessage msg, Cursor cursor) {
        msg.id = cursor.getLong(cursor.getColumnIndex(MESSAGE_ID));
        msg.messageId = cursor.getString(cursor.getColumnIndex(MESSAGE_MESSAGE_ID));
        msg.sessionId = cursor.getString(cursor.getColumnIndex(MESSAGE_SESSION_ID));
        msg.content = cursor.getString(cursor.getColumnIndex(MESSAGE_CONTENT));
        msg.type = ChatMessage.MessageType.fromValue(cursor.getInt(cursor.getColumnIndex(MESSAGE_TYPE)));
        msg.status = cursor.getInt(cursor.getColumnIndex(MESSAGE_STATUS)); // 新增字段
        msg.isSelf = cursor.getInt(cursor.getColumnIndex(MESSAGE_IS_SELF)) == 1;
        msg.timestamp = cursor.getLong(cursor.getColumnIndex(MESSAGE_TIMESTAMP));
    }

    @SuppressLint("Range")
    public synchronized List<ChatMessage> searchMessageDetail(String searchContent) {
        List<ChatMessage> detailList = new ArrayList<>();
        SQLiteDatabase db = this.getReadableDatabase();

        String selectQuery = "SELECT * FROM " + TABLE_MESSAGE_DETAIL +
                " WHERE " + MESSAGE_CONTENT + " LIKE ? ";
        String[] selectionArgs = new String[]{"%" + searchContent + "%"};
        Cursor cursor = db.rawQuery(selectQuery, selectionArgs);

        if (cursor.moveToFirst()) {
            do {
                ChatMessage msg = createChatMessage();
                populateChatMessageFromCursor(msg, cursor);
                detailList.add(msg);
            } while (cursor.moveToNext());
        }
        cursor.close();
        return detailList;
    }

    @SuppressLint("Range")
    public synchronized List<ChatMessage> getAllChatMessageDetail() {
        List<ChatMessage> messages = new ArrayList<>();
        String selectQuery = "SELECT * FROM " + TABLE_MESSAGE_DETAIL;

        SQLiteDatabase db = this.getReadableDatabase();
        Cursor cursor = db.rawQuery(selectQuery, null);

        if (cursor.moveToFirst()) {
            do {
                ChatMessage msg = createChatMessage();
                populateChatMessageFromCursor(msg, cursor);
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
                MESSAGE_SESSION_ID + "=?",
                new String[]{sessionId},
                null, null, MESSAGE_TIMESTAMP + " ASC");

        if (cursor.moveToFirst()) {
            do {
                ChatMessage msg = createChatMessage();
                populateChatMessageFromCursor(msg, cursor);
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
                MESSAGE_SESSION_ID + "=? AND " + MESSAGE_TIMESTAMP + ">?",
                new String[]{sessionId, String.valueOf(timestamp)},
                null, null, MESSAGE_TIMESTAMP + " ASC");

        if (cursor.moveToFirst()) {
            do {
                ChatMessage msg = createChatMessage();
                populateChatMessageFromCursor(msg, cursor);
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

    private ChatMessage createChatMessage() {
        try {
            Constructor<ChatMessage> constructor = ChatMessage.class.getDeclaredConstructor();
            constructor.setAccessible(true);
            return constructor.newInstance();
        } catch (Exception e) {
            return new ChatMessage("", false, ChatMessage.MessageType.TEXT, "", 0);
        }
    }

    private ChatMessageSession createChatMessageSession() {
        try {
            Constructor<ChatMessageSession> constructor = ChatMessageSession.class.getDeclaredConstructor();
            constructor.setAccessible(true);
            return constructor.newInstance();
        } catch (Exception e) {
            return new ChatMessageSession("", "", "", ChatMessageSession.SessionType.USER_TALK_AI, 0, 0, 0);
        }
    }

    private ChatMessageCatalogue createChatMessageCatalogue() {
        try {
            Constructor<ChatMessageCatalogue> constructor = ChatMessageCatalogue.class.getDeclaredConstructor();
            constructor.setAccessible(true);
            return constructor.newInstance();
        } catch (Exception e) {
            return new ChatMessageCatalogue("", "", ChatMessageCatalogue.CatalogueType.SYSTEM, 0, 0);
        }
    }
}