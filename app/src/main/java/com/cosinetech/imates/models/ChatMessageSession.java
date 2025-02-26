package com.cosinetech.imates.models;

import java.util.UUID;

public class ChatMessageSession {
    public enum SessionType {
        USER_TALK_AI(0), // 用户创建的
        SYSTEM_TALK_AI(1), // 内置的Session, 不可删除或修改
        USER_TALK_TEACHER(2), // 用户和老师的对话
        USER_FAVOR(3);  // 用户收藏的搜索结果

        private final int value;

        SessionType(int value) {
            this.value = value;
        }

        public int getValue() {
            return value;
        }

        public static SessionType fromValue(int value) {
            for (SessionType type : values()) {
                if (type.value == value) {
                    return type;
                }
            }
            throw new IllegalArgumentException("Unknown SessionType value: " + value);
        }
    }

    public static final int MAX_SESSION_NAME_LENGTH = 15;

    public long id;  // 数据库自增的ID
    public String sessionId; //主键, 会话ID
    public String catalogId; //所属的ChatMessageCatalogue
    public String sessionName; // 会话名称
    public SessionType type; // 会话类型
    public String receiverId; // 接收方用户标识
    public long lastReadTime; // 最后一次阅读消息的时间戳
    public long createTime; // 创建时间
    public long updateTime; // 更新时间

    private ChatMessageSession() {
        this.sessionId = "";
        this.catalogId = "";
        this.sessionName = "";
        this.type = null;
        this.receiverId = "";
        this.lastReadTime = 0;
        this.createTime = 0;
        this.updateTime = 0;
    }

    public ChatMessageSession(String sid, String catalogId, String name,
                              SessionType type,
                              long lastReadTime, long createTime, long updateTime) {
        this.sessionId = sid;
        this.catalogId = catalogId;
        this.sessionName = name;
        this.type = type;
        this.lastReadTime = lastReadTime;
        this.createTime = createTime;
        this.updateTime = updateTime;
    }
}
