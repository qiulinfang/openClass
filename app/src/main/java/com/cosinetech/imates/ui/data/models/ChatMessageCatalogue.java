package com.cosinetech.imates.ui.data.models;

import com.cosinetech.imates.ApplicationModelShared;
import com.cosinetech.imates.R;

public class ChatMessageCatalogue {
    public final static String CATALOG_ID_DEFAULT = "0".repeat(32);
    public final static String CATALOG_ID_TEACHER = "3".repeat(32);
    public final static String CATALOG_ID_MY_FAVOR = "7".repeat(32);
    public enum CatalogueType {
        SYSTEM(0),

        USER_SUBJECT_BEGIN(1),
        USER_BIOLOGY(1),
        USER_MATH(2),

        USER_SUBJECT_END(16);

        private final int value;

        CatalogueType(int value) {
            this.value = value;
        }

        public int getValue() {
            return value;
        }

        public static CatalogueType fromValue(int value) {
            for (CatalogueType type : values()) {
                if (type.value == value) {
                    return type;
                }
            }
            throw new IllegalArgumentException("Unknown CatalogueType value: " + value);
        }
    }

    public long id;  // 数据库自增的ID
    public String catalogId; // 主键
    public String catalogName;
    public CatalogueType type;
    public long createTime;
    public long updateTime;

    private ChatMessageCatalogue() {
        this.catalogId = "";
        this.catalogName = "";
        this.type = null;
        this.createTime = 0;
        this.updateTime = 0;
    }

    public ChatMessageCatalogue(String catalogId, String name, CatalogueType type, long createTime, long updateTime) {
        this.catalogId = catalogId;
        this.catalogName = name;
        this.type = type;
        this.createTime = createTime;
        this.updateTime = updateTime;
    }

    public static final ChatMessageCatalogue CATEGORY_DEFAULT_SYSTEM = new ChatMessageCatalogue(CATALOG_ID_DEFAULT,
            ApplicationModelShared.getInstance().getString(R.string.chat_ai_catalog_default),
            ChatMessageCatalogue.CatalogueType.SYSTEM,
            Long.MAX_VALUE  - 100,
            Long.MAX_VALUE - 100);;

    public static final ChatMessageCatalogue CATEGORY_TEACHER_QA = new ChatMessageCatalogue(CATALOG_ID_TEACHER,
                    ApplicationModelShared.getInstance().getString(R.string.chat_ai_catalog_teacher),
                    ChatMessageCatalogue.CatalogueType.SYSTEM,
                    Long.MAX_VALUE,
                    Long.MAX_VALUE);

    public static final ChatMessageCatalogue CATEGORY_MY_FAVOR = new ChatMessageCatalogue(CATALOG_ID_MY_FAVOR,
            ApplicationModelShared.getInstance().getString(R.string.chat_ai_catalog_my_favor),
            ChatMessageCatalogue.CatalogueType.SYSTEM,
            Long.MAX_VALUE  - 200,
            Long.MAX_VALUE - 200);;
}
