// ============================================================
// 镜像 · 日记画像系统 — 主题感知颜色工具
// ============================================================

export interface ThemeColors {
	bgPrimary: string;
	bgCard: string;
	bgTertiary: string;
	border: string;
	textPrimary: string;
	textSecondary: string;
	textMuted: string;
	warmOrange: string;
	roseRed: string;
	skyBlue: string;
	mintGreen: string;
	amber: string;
	purple: string;
}

const DARK: ThemeColors = {
	bgPrimary: '#0f0f12',
	bgCard: '#1a1a22',
	bgTertiary: '#22222c',
	border: '#2a2a35',
	textPrimary: '#e8e8f0',
	textSecondary: '#9a9ab0',
	textMuted: '#6a6a80',
	warmOrange: '#f5a623',
	roseRed: '#e85d75',
	skyBlue: '#5ac8fa',
	mintGreen: '#34c759',
	amber: '#ff9500',
	purple: '#af52de',
};

const LIGHT: ThemeColors = {
	bgPrimary: '#fafafc',
	bgCard: '#ffffff',
	bgTertiary: '#f0f0f5',
	border: '#e0e0e8',
	textPrimary: '#1a1a2e',
	textSecondary: '#6a6a80',
	textMuted: '#9a9ab0',
	warmOrange: '#e8960e',
	roseRed: '#d44a60',
	skyBlue: '#3aa8e0',
	mintGreen: '#28a745',
	amber: '#e68a00',
	purple: '#8b3fc0',
};

export function getTheme(): ThemeColors {
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
	if (typeof activeDocument !== 'undefined' && activeDocument?.body?.classList?.contains('theme-dark')) {
		return DARK;
	}
	return LIGHT;
}

/** 情绪色 */
export function emotionColor(emotion: string, theme: ThemeColors): string {
	const darkMap: Record<string, string> = {
		joy: '#34c759', sadness: '#5ac8fa', anger: '#e85d75', fear: '#ff9500',
		surprise: '#af52de', disgust: '#ff9500', calm: '#5ac8fa', anxiety: '#ff9500',
		hope: '#34c759', disappointment: '#e85d75', complex: '#e85d75',
	};
	const lightMap: Record<string, string> = {
		joy: '#28a745', sadness: '#3aa8e0', anger: '#d44a60', fear: '#e68a00',
		surprise: '#8b3fc0', disgust: '#e68a00', calm: '#3aa8e0', anxiety: '#e68a00',
		hope: '#28a745', disappointment: '#d44a60', complex: '#d44a60',
	};
	if (theme === DARK) return darkMap[emotion] || theme.textMuted;
	return lightMap[emotion] || theme.textMuted;
}

/** 关系色 */
export function relationColor(emotion: string, theme: ThemeColors): string {
	switch(emotion) {
		case 'joy': case 'hope': return theme.mintGreen;
		case 'sadness': case 'disappointment': return theme.skyBlue;
		case 'anger': case 'disgust': return theme.amber;
		case 'fear': case 'anxiety': return theme.roseRed;
		case 'complex': return theme.roseRed;
		default: return theme.skyBlue;
	}
}

/** 规训色 */
export function disciplineColor(status: string, theme: ThemeColors): string {
	switch(status) {
		case 'persisting': return theme.mintGreen;
		case 'repeated_unexecuted': return theme.amber;
		case 'internalized': return theme.skyBlue;
		default: return theme.textMuted;
	}
}
