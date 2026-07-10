import React from 'react';
import { StyleSheet, Text, View, ViewProps } from 'react-native';
import { Colors } from '@/constants/Colors';

interface BadgeProps extends ViewProps {
  text: string;
}

export function Badge({ text, style, ...props }: BadgeProps) {
  return (
    <View style={[styles.badge, style]} {...props}>
      <Text style={styles.badgeText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 99,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 2,
  },
  badgeText: {
    color: Colors.text.light,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
