package com.cosinetech.imates.ui.adapters;

import android.content.Context;
import android.graphics.Color;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseExpandableListAdapter;
import android.widget.ExpandableListView;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.appcompat.widget.PopupMenu;

import com.cosinetech.imates.R;
import com.cosinetech.imates.ui.data.models.ChatMessageCatalogue;
import com.cosinetech.imates.ui.data.models.ChatMessageHistoryDB;
import com.cosinetech.imates.ui.data.models.ChatMessageSession;
import com.cosinetech.imates.utils.AppUtils;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class ChatExpandableListAdapter extends BaseExpandableListAdapter {
    private Context context;
    private List<ChatMessageCatalogue> catalogues;
    private Map<String, List<ChatMessageSession>> sessionMap;
    private String selectedSessionId;
    private OnItemActionListener actionListener;

    private final ExpandableListView mView;

    public interface OnItemActionListener {
        void onEditCatalogue(ChatMessageCatalogue catalogue);
        void onDeleteCatalogue(ChatMessageCatalogue catalogue);
        void onEditSession(ChatMessageSession session);
        void onDeleteSession(ChatMessageSession session);
        void onClearSession(ChatMessageSession session);
    }

    public ChatExpandableListAdapter(Context context, ExpandableListView view) {
        this.context = context;
        this.catalogues = new ArrayList<>();
        this.sessionMap = new HashMap<>();
        this.mView = view;
    }

    public void setOnItemActionListener(OnItemActionListener listener) {
        this.actionListener = listener;
    }

    public void setData(List<ChatMessageCatalogue> catalogues) {
        this.catalogues = catalogues;
        this.sessionMap.clear();

        ChatMessageHistoryDB db = ChatMessageHistoryDB.getInstance(context, AppUtils.getUserId());
        for (ChatMessageCatalogue catalogue : catalogues) {
            List<ChatMessageSession> sessions = db.getMessageSessionByCatalogId(catalogue.catalogId);
            sessionMap.put(catalogue.catalogId, sessions);
        }
        notifyDataSetChanged();
    }

    public void setSelectedSessionId(String sessionId) {
        this.selectedSessionId = sessionId;
        notifyDataSetChanged();
    }

    @Override
    public int getGroupCount() {
        return catalogues.size();
    }

    @Override
    public int getChildrenCount(int groupPosition) {
        String catalogId = catalogues.get(groupPosition).catalogId;
        return sessionMap.get(catalogId).size();
    }

    @Override
    public Object getGroup(int groupPosition) {
        return catalogues.get(groupPosition);
    }

    @Override
    public Object getChild(int groupPosition, int childPosition) {
        String catalogId = catalogues.get(groupPosition).catalogId;
        return sessionMap.get(catalogId).get(childPosition);
    }

    @Override
    public long getGroupId(int groupPosition) {
        return groupPosition;
    }

    @Override
    public long getChildId(int groupPosition, int childPosition) {
        return childPosition;
    }

    @Override
    public boolean hasStableIds() {
        return true;
    }

    @Override
    public View getGroupView(int groupPosition, boolean isExpanded, View convertView, ViewGroup parent) {
        ViewHolder holder;
        if (convertView == null) {
            convertView = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_catalogue, parent, false);
            holder = new ViewHolder();
            holder.textView = convertView.findViewById(R.id.text_catalogue);
            holder.moreButton = convertView.findViewById(R.id.btn_more_catalogue);
            holder.arrowView = convertView.findViewById(R.id.arrow_view);
            convertView.setTag(holder);
        } else {
            holder = (ViewHolder) convertView.getTag();
        }

        final ChatMessageCatalogue catalogue = catalogues.get(groupPosition);
        holder.textView.setText(catalogue.catalogName);

        // 显示更多按钮
        if(catalogue.type != ChatMessageCatalogue.CatalogueType.SYSTEM) {
            holder.moreButton.setVisibility(View.VISIBLE);
            holder.moreButton.setOnClickListener(v -> showCataloguePopupMenu(v, catalogue));
        }

        if(isExpanded) {
            holder.arrowView.setImageResource(R.drawable.chat_ai_ic_arrow_down);
        } else {
            holder.arrowView.setImageResource(R.drawable.chat_ai_ic_arrow_right);
        }

        return convertView;
    }

    @Override
    public View getChildView(int groupPosition, int childPosition, boolean isLastChild,
                             View convertView, ViewGroup parent) {
        ViewHolder holder;
        if (convertView == null) {
            convertView = LayoutInflater.from(context).inflate(R.layout.item_session, parent, false);
            holder = new ViewHolder();
            holder.textView = convertView.findViewById(R.id.text_session);
            holder.moreButton = convertView.findViewById(R.id.btn_more_session);
            convertView.setTag(holder);
        } else {
            holder = (ViewHolder) convertView.getTag();
        }

        String catalogId = catalogues.get(groupPosition).catalogId;
        final ChatMessageSession session = sessionMap.get(catalogId).get(childPosition);

        holder.textView.setText(session.sessionName);

        // 设置选中状态的背景
        if (session.sessionId.equals(selectedSessionId)) {
            convertView.setBackgroundColor(context.getResources().getColor(R.color.selected_background));
            holder.moreButton.setVisibility(View.VISIBLE);
            if(!mView.isGroupExpanded(groupPosition)) {
                mView.expandGroup(groupPosition);
            }
        } else {
            convertView.setBackgroundColor(Color.TRANSPARENT);
            holder.moreButton.setVisibility(View.GONE);
        }

        holder.moreButton.setOnClickListener(v -> showSessionPopupMenu(v, session));

        return convertView;
    }

    private void showCataloguePopupMenu(View view, ChatMessageCatalogue catalogue) {
        PopupMenu popup = new PopupMenu(view.getContext(), view);
        popup.inflate(R.menu.chat_ai_menu_catalogue);
        popup.setOnMenuItemClickListener(item -> {
            if (item.getItemId() == R.id.action_edit_catalogue) {
                if (actionListener != null) {
                    actionListener.onEditCatalogue(catalogue);
                }
                return true;
            } else if (item.getItemId() == R.id.action_delete_catalogue) {
                if (actionListener != null) {
                    actionListener.onDeleteCatalogue(catalogue);
                }
                return true;
            }
            return false;
        });
        popup.show();
    }

    private void showSessionPopupMenu(View view, ChatMessageSession session) {
        PopupMenu popup = new PopupMenu(context, view);

        if(session.type == ChatMessageSession.SessionType.SYSTEM_TALK_AI) {
            popup.inflate(R.menu.chat_ai_menu_sys_session);
        } else {
            popup.inflate(R.menu.chat_ai_menu_session);
        }
        popup.setOnMenuItemClickListener(item -> {
            if (item.getItemId() == R.id.action_edit_session) {
                if (actionListener != null) {
                    actionListener.onEditSession(session);
                }
                return true;
            } else if (item.getItemId() == R.id.action_delete_session) {
                if (actionListener != null) {
                    actionListener.onDeleteSession(session);
                }
                return true;
            } else if(item.getItemId() == R.id.action_clear_session) {
                if (actionListener != null) {
                    actionListener.onClearSession(session);
                }
            }
            return false;
        });
        popup.show();
    }

    // 添加增量更新方法
    public void addCatalogue(ChatMessageCatalogue catalogue) {
        if (!catalogues.contains(catalogue)) {
            catalogues.add(catalogue);
            sessionMap.put(catalogue.catalogId, new ArrayList<>());
            notifyDataSetChanged();
        }
    }

    public void updateCatalogue(ChatMessageCatalogue catalogue) {
        int position = -1;
        for (int i = 0; i < catalogues.size(); i++) {
            if (catalogues.get(i).catalogId.equals(catalogue.catalogId)) {
                position = i;
                break;
            }
        }
        if (position != -1) {
            catalogues.set(position, catalogue);
            notifyDataSetChanged();
            //notifyGroupChanged(position);
        }
    }

    public void removeCatalogue(String catalogId) {
        int position = -1;
        for (int i = 0; i < catalogues.size(); i++) {
            if (catalogues.get(i).catalogId.equals(catalogId)) {
                position = i;
                break;
            }
        }
        if (position != -1) {
            catalogues.remove(position);
            sessionMap.remove(catalogId);
            notifyDataSetChanged();
        }
    }

    public void addSession(ChatMessageSession session) {
        List<ChatMessageSession> sessions = sessionMap.get(session.catalogId);
        if (sessions != null && !sessions.contains(session)) {
            sessions.add(session);
            selectedSessionId = session.sessionId;
            int groupPosition = getCataloguePosition(session.catalogId);
            if (groupPosition != -1) {
                notifyDataSetChanged();
                //notifyChildrenChanged(groupPosition);
            }
        }
    }

    public void updateSession(ChatMessageSession session) {
        List<ChatMessageSession> sessions = sessionMap.get(session.catalogId);
        if (sessions != null) {
            int groupPosition = getCataloguePosition(session.catalogId);
            int childPosition = -1;
            for (int i = 0; i < sessions.size(); i++) {
                if (sessions.get(i).sessionId.equals(session.sessionId)) {
                    childPosition = i;
                    break;
                }
            }
            if (childPosition != -1) {
                sessions.set(childPosition, session);
                notifyDataSetChanged();
                //notifyChildChanged(groupPosition, childPosition);
            }
        }
    }

    public void removeSession(ChatMessageSession session) {
        List<ChatMessageSession> sessions = sessionMap.get(session.catalogId);
        if (sessions != null) {
            int groupPosition = getCataloguePosition(session.catalogId);
            if (sessions.removeIf(s -> s.sessionId.equals(session.sessionId))) {
                notifyDataSetChanged();
                //notifyChildrenChanged(groupPosition);
            }
        }
    }

    private int getCataloguePosition(String catalogId) {
        for (int i = 0; i < catalogues.size(); i++) {
            if (catalogues.get(i).catalogId.equals(catalogId)) {
                return i;
            }
        }
        return -1;
    }

    private static class ViewHolder {
        TextView textView;
        ImageView arrowView;
        ImageView moreButton;
    }

    @Override
    public boolean isChildSelectable(int groupPosition, int childPosition) {
        return true;
    }
}