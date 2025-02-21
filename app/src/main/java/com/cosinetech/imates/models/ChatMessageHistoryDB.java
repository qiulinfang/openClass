package com.cosinetech.imates.models;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.locks.ReentrantReadWriteLock;
import android.annotation.SuppressLint;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

public class ChatMessageHistoryDB extends SQLiteOpenHelper {
    private static final String DATABASE_NAME = "chat_history.db";
    private static final int DATABASE_VERSION = 1;

    private final ReentrantReadWriteLock rwLock = new ReentrantReadWriteLock();
    private final ReentrantReadWriteLock.ReadLock readLock = rwLock.readLock();
    private final ReentrantReadWriteLock.WriteLock writeLock = rwLock.writeLock();

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
        writeLock.lock();
        try {
            db.execSQL(CREATE_TABLE_MESSAGE_CATALOGUE);
            db.execSQL(CREATE_TABLE_MESSAGE_SESSION);
            db.execSQL(CREATE_TABLE_MESSAGE_DETAIL);
        } finally {
            writeLock.unlock();
        }
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        writeLock.lock();
        try {
            db.execSQL("DROP TABLE IF EXISTS " + TABLE_MESSAGE_CATALOGUE);
            db.execSQL("DROP TABLE IF EXISTS " + TABLE_MESSAGE_SESSION);
            db.execSQL("DROP TABLE IF EXISTS " + TABLE_MESSAGE_DETAIL);
            onCreate(db);
        } finally {
            writeLock.unlock();
        }
    }

    // Message Catalogue Methods
    public long addMessageCatalogue(ChatMessageCatalogue catalogue) {
        writeLock.lock();
        try {
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
        } finally {
            writeLock.unlock();
        }
    }

    public int updateMessageCatalogue(ChatMessageCatalogue catalogue) {
        writeLock.lock();
        try {
            SQLiteDatabase db = this.getWritableDatabase();

            ContentValues values = new ContentValues();
            values.put(KEY_CATALOG_NAME, catalogue.catalogName);
            values.put(KEY_UPDATE_TIME, catalogue.updateTime);

            return db.update(TABLE_MESSAGE_CATALOGUE,
                    values,
                    KEY_CATALOG_ID + "=?",
                    new String[]{catalogue.catalogId});
        } finally {
            writeLock.unlock();
        }
    }

    public int deleteMessageCatalogue(String catalogId) {
        writeLock.lock();
        try {
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
        } finally {
            writeLock.unlock();
        }
    }

    public int deleteAllMessageCatalogue() {
        writeLock.lock();
        try {
            SQLiteDatabase db = this.getWritableDatabase();
            deleteAllMessageSession();
            return db.delete(TABLE_MESSAGE_CATALOGUE, null, null);
        } finally {
            writeLock.unlock();
        }
    }

    @SuppressLint("Range")
    public List<ChatMessageCatalogue> getAllMessageCatalogue() {
        readLock.lock();
        try {
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
        } finally {
            readLock.unlock();
        }
    }

    @SuppressLint("Range")
    public ChatMessageCatalogue getMessageCatalogue(String catalogId) {
        readLock.lock();
        try {
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
        } finally {
            readLock.unlock();
        }
    }

    // Message Session Methods
    public long addMessageSession(ChatMessageSession messageSession) {
        writeLock.lock();
        try {
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
        } finally {
            writeLock.unlock();
        }
    }

    public int updateMessageSession(ChatMessageSession messageSession) {
        writeLock.lock();
        try {
            SQLiteDatabase db = this.getWritableDatabase();

            ContentValues values = new ContentValues();
            values.put(KEY_SESSION_NAME, messageSession.sessionName);
            values.put(KEY_LAST_MESSAGE_TIME, messageSession.lastMessageTime);
            values.put(KEY_UPDATE_TIME, messageSession.updateTime);

            return db.update(TABLE_MESSAGE_SESSION,
                    values,
                    KEY_SESSION_ID + "=?",
                    new String[]{messageSession.sessionId});
        } finally {
            writeLock.unlock();
        }
    }

    public int deleteMessageSession(String sessionId) {
        writeLock.lock();
        try {
            SQLiteDatabase db = this.getWritableDatabase();

            // First delete all messages in this session
            db.delete(TABLE_MESSAGE_DETAIL,
                    KEY_SESSION_ID + "=?",
                    new String[]{sessionId});

            return db.delete(TABLE_MESSAGE_SESSION,
                    KEY_SESSION_ID + "=?",
                    new String[]{sessionId});
        } finally {
            writeLock.unlock();
        }
    }

    public int deleteAllMessageSession() {
        writeLock.lock();
        try {
            SQLiteDatabase db = this.getWritableDatabase();
            deleteAllChatMessageDetail();
            return db.delete(TABLE_MESSAGE_SESSION, null, null);
        } finally {
            writeLock.unlock();
        }
    }

    @SuppressLint("Range")
    public List<ChatMessageSession> getAllMessageSession(int type) {
        readLock.lock();
        try {
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
        } finally {
            readLock.unlock();
        }
    }

    @SuppressLint("Range")
    public ChatMessageSession getMessageSessionBySessionId(String sessionId) {
        readLock.lock();
        try {
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
        } finally {
            readLock.unlock();
        }
    }

    @SuppressLint("Range")
    public List<ChatMessageSession> getMessageSessionByCatalogId(String catalogId) {
        readLock.lock();
        try {
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
        } finally {
            readLock.unlock();
        }
    }

    // Message Detail Methods
    public long addChatMessageDetail(ChatMessage msg) {
        writeLock.lock();
        try {
            SQLiteDatabase db = this.getWritableDatabase();

            ContentValues values = new ContentValues();
            values.put(KEY_SESSION_ID, msg.sessionId);
            values.put(KEY_CONTENT, msg.content);
            values.put(KEY_TYPE, msg.type);
            values.put(KEY_IS_SELF, msg.isSelf ? 1 : 0);
            values.put(KEY_TIMESTAMP, msg.timestamp);

            return db.insert(TABLE_MESSAGE_DETAIL, null, values);
        } finally {
            writeLock.unlock();
        }
    }

    public int updateChatMessageDetail(ChatMessage msg) {
        writeLock.lock();
        try {
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
        } finally {
            writeLock.unlock();
        }
    }

    public int deleteChatMessageDetail(long dbId) {
        writeLock.lock();
        try {
            SQLiteDatabase db = this.getWritableDatabase();
            return db.delete(TABLE_MESSAGE_DETAIL,
                    KEY_ID + "=?",
                    new String[]{String.valueOf(dbId)});
        } finally {
            writeLock.unlock();
        }
    }

    @SuppressLint("Range")
    public List<ChatMessage> searchMessageDetail(String searchContent) {
        readLock.lock();
        try {
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
        } finally {
            readLock.unlock();
        }
    }

    public int deleteAllChatMessageDetail() {
        writeLock.lock();
        try {
            SQLiteDatabase db = this.getWritableDatabase();
            return db.delete(TABLE_MESSAGE_DETAIL, null, null);
        } finally {
            writeLock.unlock();
        }
    }

    @SuppressLint("Range")
    public List<ChatMessage> getAllChatMessageDetail() {
        readLock.lock();
        try {
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
        } finally {
            readLock.unlock();
        }
    }

    @SuppressLint("Range")
    public synchronized List<ChatMessage> getChatMessageDetail(String sessionId) {
        readLock.lock();
        try {
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
        } finally {
            readLock.unlock();
        }
    }

    @SuppressLint("Range")
    public List<ChatMessage> getChatMessageDetailSinceTime(String sessionId, long timestamp) {
        readLock.lock();
        try {
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
        } finally {
            readLock.unlock();
        }
    }

    // Additional Methods
    public ChatMessageCatalogue getMessageCatalogue(ChatMessage msg) {
        readLock.lock();
        try {
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
        } finally {
            readLock.unlock();
        }
    }
}

