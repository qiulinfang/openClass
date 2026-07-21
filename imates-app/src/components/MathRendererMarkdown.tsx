import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Markdown from 'react-native-markdown-display';

interface MathRendererProps {
  content: string;
  markdownStyle?: any;
  textColor?: string;
}

/**
 * WebView-free message renderer shared by Web and iOS.
 * It keeps AI content visible even when embedded browser scripts are blocked.
 */
export function MathRenderer({
  content,
  markdownStyle,
  textColor = '#0F172A',
}: MathRendererProps) {
  const resolvedStyle = useMemo(() => {
    const overrides = markdownStyle || {};
    return {
      ...baseMarkdownStyle,
      ...overrides,
      body: {
        ...baseMarkdownStyle.body,
        color: textColor,
        ...overrides.body,
      },
      text: {
        ...baseMarkdownStyle.text,
        color: textColor,
        ...overrides.text,
      },
      paragraph: {
        ...baseMarkdownStyle.paragraph,
        ...overrides.paragraph,
      },
    };
  }, [markdownStyle, textColor]);

  return (
    <View style={styles.container}>
      <Markdown style={resolvedStyle}>{content || ''}</Markdown>
    </View>
  );
}

const baseMarkdownStyle = {
  body: {
    fontSize: 15,
    lineHeight: 24,
  },
  text: {
    fontSize: 15,
    lineHeight: 24,
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 8,
  },
  heading1: {
    fontSize: 22,
    lineHeight: 30,
    marginTop: 8,
    marginBottom: 8,
  },
  heading2: {
    fontSize: 20,
    lineHeight: 28,
    marginTop: 8,
    marginBottom: 8,
  },
  heading3: {
    fontSize: 18,
    lineHeight: 26,
    marginTop: 6,
    marginBottom: 6,
  },
  bullet_list: {
    marginVertical: 4,
  },
  ordered_list: {
    marginVertical: 4,
  },
  code_inline: {
    backgroundColor: '#EEF0F6',
    borderColor: '#D8DCE8',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  code_block: {
    backgroundColor: '#F6F7FA',
    borderColor: '#D8DCE8',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  fence: {
    backgroundColor: '#F6F7FA',
    borderColor: '#D8DCE8',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  link: {
    color: '#5145CD',
  },
};

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    width: '100%',
    minWidth: 0,
  },
});
