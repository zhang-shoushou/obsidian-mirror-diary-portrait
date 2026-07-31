// ============================================================
// 镜像 · 日记画像系统 — 核心数据类型
// ============================================================

/** 日记条目的解析结果 */
export interface DiaryEntry {
	path: string;
	filename: string;
	date: string;           // YYYY-MM-DD
	tags: string[];
	content: string;
	frontmatter: Record<string, unknown>;
	wordCount: number;
	emotionWords: EmotionWord[];
	mentionedNames: string[];
	selfDisciplineInstructions: SelfDisciplineMention[];
}

/** 情绪词检测结果 */
export interface EmotionWord {
	word: string;
	category: EmotionCategory;
	confidence: number;
}

export type EmotionCategory =
	| 'joy'
	| 'sadness'
	| 'anger'
	| 'fear'
	| 'surprise'
	| 'disgust'
	| 'calm'
	| 'anxiety'
	| 'hope'
	| 'disappointment'
	| 'complex';

/** 自我规训指令的提及 */
export interface SelfDisciplineMention {
	instruction: string;   // 规训文本，如"不要急着给答案"
	date: string;
	context: string;       // 周围上下文
}

// ---- 关系网络 ----

export interface RelationshipMap {
	people: Record<string, PersonProfile>;
	lastUpdated: string;
}

export interface PersonProfile {
	name: string;
	firstMention: string;
	lastMention: string;
	totalMentions: number;
	weeklyFrequency: FrequencyRecord[];
	emotionalTone: EmotionCategory;
	emotionalDistance: number;  // 0=亲密, 1=疏远
	mentions: PersonMention[];
}

export interface PersonMention {
	date: string;
	context: string;
	emotionAtTime: EmotionCategory;
}

export interface FrequencyRecord {
	week: string;   // YYYY-Www
	count: number;
}

// ---- 情绪时间线 ----

export interface EmotionalTimeline {
	entries: TimelineEntry[];
	milestones: Milestone[];
	turningPoints: TurningPoint[];
}

export interface TimelineEntry {
	date: string;
	dominantEmotion: EmotionCategory;
	emotionDistribution: Record<EmotionCategory, number>;
	triggerEvents: string[];
	diaryExcerpt: string;
	systemNote: string;
	type: 'normal' | 'milestone' | 'turning_point';
	evidence: string;
}

export interface Milestone {
	date: string;
	title: string;
	description: string;
	icon: string;  // emoji
}

export interface TurningPoint {
	date: string;
	title: string;
	before: string;
	after: string;
	evidence: string;
}

// ---- 行为模式 ----

export interface BehaviorPattern {
	id: string;
	title: string;
	description: string;
	evidence: string;
	detectedAt: string;
	category: 'stress_response' | 'conflict_style' | 'work_habit' | 'social_pattern' | 'other';
	occurrences: number;
}

// ---- 自我规训 ----

export type DisciplineStatus = 'persisting' | 'repeated_unexecuted' | 'internalized';

export interface SelfDisciplineItem {
	instruction: string;
	status: DisciplineStatus;
	firstMention: string;
	lastMention: string;
	totalMentions: number;
	weeklyExecution: WeeklyExecution[];
	insight?: string;
	evidence?: string;
}

export interface WeeklyExecution {
	week: string;
	executionRate: number;  // 0-100
}

// ---- 画像主动提问 ----

export interface InsightQuestion {
	id: string;
	pattern: string;
	question: string;
	relatedDimension: 'relationship' | 'emotion' | 'discipline' | 'pattern';
	createdAt: string;
	acknowledged: boolean;
}

// ---- 纠正记录 ----

export interface CorrectionRecord {
	id: string;
	originalInference: string;
	userCorrection: string;
	timestamp: string;
	dimension: string;
}

// ---- 图像快照 ----

export interface PortraitSnapshot {
	timestamp: string;
	relationshipMap: RelationshipMap;
	emotionalTimeline: EmotionalTimeline;
	patterns: BehaviorPattern[];
	selfDisciplineItems: SelfDisciplineItem[];
	insightQuestions: InsightQuestion[];
}

// ---- 存储结构 ----

export interface PluginData {
	diaryFolderPath: string;
	entries: DiaryEntry[];
	relationshipMap: RelationshipMap;
	emotionalTimeline: EmotionalTimeline;
	patterns: BehaviorPattern[];
	selfDisciplineItems: SelfDisciplineItem[];
	insightQuestions: InsightQuestion[];
	corrections: CorrectionRecord[];
	milestones: Milestone[];
	turningPoints: TurningPoint[];
	snapshots: PortraitSnapshot[];
	lastAnalyzedPath: string;
}

// ---- 配色常量 ----

export const COLORS = {
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
} as const;

export const EMOTION_LABELS: Record<EmotionCategory, string> = {
	joy: '喜悦',
	sadness: '悲伤',
	anger: '愤怒',
	fear: '恐惧',
	surprise: '惊讶',
	disgust: '厌恶',
	calm: '平静',
	anxiety: '焦虑',
	hope: '期待',
	disappointment: '失望',
	complex: '复杂',
};

export const EMOTION_COLORS: Record<EmotionCategory, string> = {
	joy: COLORS.mintGreen,
	sadness: COLORS.skyBlue,
	anger: COLORS.roseRed,
	fear: COLORS.amber,
	surprise: COLORS.purple,
	disgust: COLORS.amber,
	calm: COLORS.skyBlue,
	anxiety: COLORS.amber,
	hope: COLORS.mintGreen,
	disappointment: COLORS.roseRed,
	complex: COLORS.roseRed,
};

export const DISCIPLINE_COLORS: Record<DisciplineStatus, string> = {
	persisting: COLORS.mintGreen,
	repeated_unexecuted: COLORS.amber,
	internalized: COLORS.skyBlue,
};

export const DISCIPLINE_LABELS: Record<DisciplineStatus, string> = {
	persisting: '坚持中',
	repeated_unexecuted: '反复出现但未执行',
	internalized: '已内化',
};
