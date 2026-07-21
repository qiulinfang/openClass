import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Platform,
  Modal,
} from 'react-native';

interface CalendarModalProps {
  visible: boolean;
  onClose: () => void;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}

const PRIMARY_COLOR = '#4F46E5';

export function CalendarModal({
  visible,
  onClose,
  selectedDate,
  onSelectDate,
}: CalendarModalProps) {
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth()); // 0-11

  // Keep calendar view in sync when visible changes or selectedDate is updated
  useEffect(() => {
    if (visible) {
      const baseDate = selectedDate ? new Date(selectedDate) : new Date();
      if (!isNaN(baseDate.getTime())) {
        setCalendarYear(baseDate.getFullYear());
        setCalendarMonth(baseDate.getMonth());
      }
    }
  }, [visible, selectedDate]);

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfWeek = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const handleSelectDay = (day: number) => {
    const monthStr = String(calendarMonth + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `${calendarYear}-${monthStr}-${dayStr}`;
    onSelectDate(dateStr);
    onClose();
  };

  const changeCalendarMonth = (direction: number) => {
    let nextMonth = calendarMonth + direction;
    let nextYear = calendarYear;
    if (nextMonth < 0) {
      nextMonth = 11;
      nextYear -= 1;
    } else if (nextMonth > 11) {
      nextMonth = 0;
      nextYear += 1;
    }
    setCalendarMonth(nextMonth);
    setCalendarYear(nextYear);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.calendarModalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          style={styles.calendarCard}
          activeOpacity={1}
        >
          <View style={styles.calendarHeader}>
            <TouchableOpacity
              style={styles.calendarMonthNavBtn}
              onPress={() => changeCalendarMonth(-1)}
            >
              <Text style={styles.calendarMonthNavText}>◀</Text>
            </TouchableOpacity>

            <Text style={styles.calendarHeaderTitle}>
              {calendarYear}年 {calendarMonth + 1}月
            </Text>

            <TouchableOpacity
              style={styles.calendarMonthNavBtn}
              onPress={() => changeCalendarMonth(1)}
            >
              <Text style={styles.calendarMonthNavText}>▶</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.calendarGrid}>
            {['日', '一', '二', '三', '四', '五', '六'].map(w => (
              <View key={w} style={styles.calendarGridHeaderCell}>
                <Text style={styles.calendarGridHeaderCellText}>{w}</Text>
              </View>
            ))}
            {(() => {
              const daysInMonth = getDaysInMonth(calendarYear, calendarMonth);
              const firstDay = getFirstDayOfWeek(calendarYear, calendarMonth);
              const calendarDays = [];
              for (let i = 0; i < firstDay; i++) {
                calendarDays.push(null);
              }
              for (let i = 1; i <= daysInMonth; i++) {
                calendarDays.push(i);
              }
              return calendarDays.map((day, index) => {
                const monthStr = String(calendarMonth + 1).padStart(2, '0');
                const dayStr = day ? String(day).padStart(2, '0') : '';
                const dateStr = day ? `${calendarYear}-${monthStr}-${dayStr}` : '';
                const isSelected = !!day && selectedDate === dateStr;
                const todayObj = new Date();
                const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
                const isToday = !!day && dateStr === todayStr;
                return (
                  <TouchableOpacity
                    key={index}
                    disabled={!day}
                    style={[
                      styles.calendarDayCell,
                      isToday ? styles.todayCalendarDayCell : null,
                      isSelected ? styles.selectedCalendarDayCell : null
                    ]}
                    onPress={() => day && handleSelectDay(day)}
                  >
                    {day && (
                      <Text style={[
                        styles.calendarDayCellText,
                        isToday ? styles.todayCalendarDayCellText : null,
                        isSelected ? styles.selectedCalendarDayCellText : null
                      ]}>
                        {day}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              });
            })()}
          </View>

          <View style={styles.calendarFooter}>
            <TouchableOpacity
              style={styles.calendarFooterBtn}
              onPress={() => {
                const today = new Date();
                const todayStr = today.toISOString().slice(0, 10);
                onSelectDate(todayStr);
                onClose();
              }}
            >
              <Text style={[styles.calendarFooterBtnText, { color: PRIMARY_COLOR, fontWeight: '600' }]}>
                回到今天
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.calendarFooterBtn}
              onPress={onClose}
            >
              <Text style={styles.calendarFooterBtnText}>取消</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  calendarModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarCard: {
    width: 320,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  calendarMonthNavBtn: {
    padding: 8,
  },
  calendarMonthNavText: {
    fontSize: 16,
    color: '#4B5563',
    fontWeight: 'bold',
  },
  calendarHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarGridHeaderCell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  calendarGridHeaderCellText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  calendarDayCell: {
    width: `${100 / 7}%`,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    marginVertical: 2,
  },
  selectedCalendarDayCell: {
    backgroundColor: PRIMARY_COLOR,
  },
  todayCalendarDayCell: {
    borderWidth: 1.5,
    borderColor: PRIMARY_COLOR,
    backgroundColor: '#EEF2FF',
  },
  calendarDayCellText: {
    fontSize: 14,
    color: '#374151',
  },
  selectedCalendarDayCellText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  todayCalendarDayCellText: {
    color: PRIMARY_COLOR,
    fontWeight: '600',
  },
  calendarFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    borderTopWidth: 1,
    borderColor: '#F3F4F6',
    paddingTop: 12,
    gap: 12,
  },
  calendarFooterBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  calendarFooterBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#4B5563',
  },
});
