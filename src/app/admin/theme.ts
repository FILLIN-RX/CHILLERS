import type { ThemeConfig } from 'antd';

export const adminTheme: ThemeConfig = {
  token: {
    colorPrimary: '#6c5ce7',
    colorInfo: '#6c5ce7',
    colorBgBase: '#0c0e14',
    colorBgContainer: '#141821',
    colorBgElevated: '#1a1f2b',
    colorBgLayout: '#0c0e14',
    colorBorder: '#242a38',
    colorBorderSecondary: '#1c2230',
    colorText: '#e6e9f0',
    colorTextSecondary: '#9aa3b5',
    colorTextTertiary: '#6b7488',
    colorTextQuaternary: '#3d4456',
    borderRadius: 10,
    fontSize: 14,
    wireframe: false,
  },
  components: {
    Layout: {
      siderBg: '#0f1219',
      headerBg: '#141821',
      bodyBg: '#0c0e14',
    },
    Menu: {
      darkItemBg: 'transparent',
      darkItemColor: '#8b93a7',
      darkItemHoverColor: '#e6e9f0',
      darkItemHoverBg: 'rgba(255,255,255,0.05)',
      darkItemSelectedBg: 'rgba(108,92,231,0.16)',
      darkItemSelectedColor: '#a99bf0',
      darkSubMenuItemBg: 'transparent',
      itemBorderRadius: 8,
      itemMarginInline: 8,
      activeBarBorderWidth: 0,
    },
    Button: {
      primaryShadow: 'none',
      fontWeight: 500,
      dangerShadow: 'none',
    },
    Table: {
      headerBg: '#121722',
      headerColor: '#8b93a7',
      headerSplitColor: 'transparent',
      rowHoverBg: 'rgba(108,92,231,0.07)',
      borderColor: '#1c2230',
      cellPaddingBlock: 12,
      cellFontSize: 13,
    },
    Card: {
      headerBg: 'transparent',
      headerFontSize: 15,
      bodyPadding: 20,
    },
    Tag: {
      defaultBg: '#1a1f2b',
      defaultColor: '#a5adc0',
    },
    Modal: {
      contentBg: '#141821',
      headerBg: '#141821',
    },
    Statistic: {
      contentFontSize: 26,
      titleFontSize: 13,
    },
    Segmented: {
      trackBg: '#121722',
      itemSelectedBg: '#1a1f2b',
      itemSelectedColor: '#e6e9f0',
    },
    Tabs: {
      itemSelectedColor: '#a99bf0',
      inkBarColor: '#6c5ce7',
    },
    Input: {
      activeShadow: 'none',
      hoverBorderColor: '#6c5ce7',
    },
    Select: {
      activeBorderColor: '#6c5ce7',
    },
    Pagination: {
      itemActiveBg: '#6c5ce7',
      itemActiveColor: '#fff',
    },
    Tooltip: {
      colorBgSpotlight: '#1a1f2b',
      colorTextLightSolid: '#e6e9f0',
    },
    Drawer: {
      colorBgElevated: '#141821',
    },
  },
};
