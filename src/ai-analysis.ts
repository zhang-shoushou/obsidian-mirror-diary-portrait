// ============================================================
// 镜像 · 日记画像系统 — 全量 AI 分析（DeepSeek 驱动）
// ============================================================

import { requestUrl } from 'obsidian';
import type {
	PluginData,
	InsightQuestion,
	RelationshipMap,
	PersonProfile,
	EmotionalTimeline,
	TimelineEntry,
	TurningPoint,
	BehaviorPattern,
	SelfDisciplineItem,
	EmotionCategory,
	DisciplineStatus,
	WeeklyExecution,
} from './types';

const API_URL = 'https://api.deepseek.com/v1/chat/completions';

async function callDeepSeek(apiKey: string, systemPrompt: string, userPrompt: string, maxTokens = 4000): Promise<string> {
	const response = await requestUrl({
		url: API_URL,
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model: 'deepseek-chat',
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: userPrompt },
			],
			temperature: 0.7,
			max_tokens: maxTokens,
		}),
	});

	const data = response.json as { choices: Array<{ message: { content: string } }> };
	if (!data.choices || data.choices.length === 0) {
		throw new Error('API 返回为空');
	}
	return data.choices[0]!.message.content;
}

// ============================================================
// 全量 AI 分析：发送日记原文，让模型提取一切
// ============================================================

export async function runAIAnalysis(apiKey: string, data: PluginData): Promise<PluginData> {
	if (!apiKey || data.entries.length === 0) return data;

	// 准备日记数据（截取前800字）
	const diaryList = data.entries.map(e => ({
		date: e.date,
		content: e.content.slice(0, 800).replace(/\n+/g, '\n').trim(),
	}));

	// 分批处理，每批最多15篇
	const batchSize = 15;
	const batches: Array<typeof diaryList> = [];
	for (let i = 0; i < diaryList.length; i += batchSize) {
		batches.push(diaryList.slice(i, i + batchSize));
	}

	// 收集所有批次的分析结果
	const allResults: AIMergedResult = {
		relationships: [],
		emotions: [],
		patterns: [],
		disciplines: [],
		questions: [],
		milestones: [],
		turningPoints: [],
	};

	for (let i = 0; i < batches.length; i++) {
		const batch = batches[i]!;
		try {
			const batchResult = await analyzeBatch(apiKey, batch, i, batches.length);
			mergeResults(allResults, batchResult);
		} catch (e) {
			console.error(`AI batch ${i} failed:`, e);
		}
	}

	// 将 AI 结果转换为 PluginData 结构
	data = applyAIAnalysis(data, allResults);
	return data;
}

// ---- 单批分析 ----

interface AIMergedResult {
	relationships: AIRelation[];
	emotions: AIEmotion[];
	patterns: AIPattern[];
	disciplines: AIDiscipline[];
	questions: AIQuestion[];
	milestones: AIMilestone[];
	turningPoints: AITurningPoint[];
}

interface AIRelation {
	name: string;
	totalMentions: number;
	emotionalTone: string;
	emotionalDistance: number;
	summary: string;
}

interface AIEmotion {
	date: string;
	dominantEmotion: string;
	note: string;
	isMilestone: boolean;
	isTurningPoint: boolean;
}

interface AIPattern {
	title: string;
	description: string;
	evidence: string;
	category: string;
}

interface AIDiscipline {
	instruction: string;
	status: string;
	insight: string;
}

interface AIQuestion {
	pattern: string;
	question: string;
	relatedDimension: string;
}

interface AIMilestone {
	date: string;
	title: string;
	description: string;
	icon: string;
}

interface AITurningPoint {
	date: string;
	title: string;
	before: string;
	after: string;
	evidence: string;
}

async function analyzeBatch(
	apiKey: string,
	batch: Array<{ date: string; content: string }>,
	batchIndex: number,
	totalBatches: number,
): Promise<AIMergedResult> {
	const systemPrompt = `你是一个温柔而有洞察力的日记画像分析系统。你分析用户的日记原文，提取深层的心理画像。

请从日记中提取以下信息，以纯 JSON 格式返回。
人称要求：所有分析必须用第二人称"你"来称呼用户，用第一人称"我"来称呼系统。比如"你面对压力时..."而不是"用户/ta面对压力时..."。这是你和用户的直接对话。（不要包含 markdown 代码块标记，只返回 JSON 对象）：

{
  "relationships": [
    { "name": "人名", "totalMentions": 数字, "emotionalTone": "joy/sadness/anger/fear/calm/anxiety/hope/disappointment/complex", "emotionalDistance": 0-1的数字(0亲密1疏远), "summary": "你们关系的简短描述（30字内）" }
  ],
  "emotions": [
    { "date": "日期", "dominantEmotion": "joy/sadness/anger/fear/calm/anxiety/hope/disappointment/complex", "note": "温柔的情绪解读（30字内）", "isMilestone": true/false, "isTurningPoint": true/false }
  ],
  "patterns": [
    { "title": "模式名称", "description": "具体描述（50字内）", "evidence": "数据证据", "category": "stress_response/conflict_style/work_habit/social_pattern/other" }
  ],
  "disciplines": [
    { "instruction": "自我规训指令文本", "status": "persisting/repeated_unexecuted/internalized", "insight": "洞察（30字内）" }
  ],
  "questions": [
    { "pattern": "发现的模式", "question": "温柔的提问", "relatedDimension": "relationship/emotion/discipline/pattern" }
  ],
  "milestones": [
    { "date": "日期", "title": "里程碑标题", "description": "描述（30字内）", "icon": "emoji" }
  ],
  "turningPoints": [
    { "date": "日期", "title": "转折描述", "before": "之前状态", "after": "之后状态", "evidence": "证据" }
  ]
}

分析原则：
- 人名识别：只看日记中用户真实生活里有互动的人（如"代哥""娟娟""妈妈""同事"）。绝对不要识别：历史人物（如冯异、王莽、董贤）、书中角色、公众人物、公司名、地名、技术术语。只有用户和ta之间有真实对话、见面、情感互动的人才是关系。
- 情绪判断：不只看情绪词，要看整篇日记的基调和弦外之音
- 模式发现：关注重复出现的行为模式、思维习惯、应对方式
- 里程碑：真正重要的事件节点，如"开始读书""失眠结束""关系转折"
- 提问要有深度，像深夜书桌旁的朋友在跟你聊天，温柔但不迎合
- 只分析这些日记中实际出现的内容，不要编造
- 中文`;

	const userPrompt = `请分析以下日记（第${batchIndex + 1}/${totalBatches}批）：

${batch.map(e => `--- ${e.date} ---
${e.content}
`).join('\n')}

请返回完整的 JSON 分析结果。`;

	const result = await callDeepSeek(apiKey, systemPrompt, userPrompt, 4000);
	return parseAIResult(result);
}

function parseAIResult(text: string): AIMergedResult {
	// 清理可能的 markdown 代码块标记
	let cleaned = text
		.replace(/```json\s*/gi, '')
		.replace(/```\s*/g, '')
		.trim();

	// 找到第一个 { 和最后一个 }
	const start = cleaned.indexOf('{');
	const end = cleaned.lastIndexOf('}');
	if (start >= 0 && end > start) {
		cleaned = cleaned.slice(start, end + 1);
	}

	try {
		return JSON.parse(cleaned) as AIMergedResult;
	} catch {
		return {
			relationships: [],
			emotions: [],
			patterns: [],
			disciplines: [],
			questions: [],
			milestones: [],
			turningPoints: [],
		};
	}
}

function mergeResults(target: AIMergedResult, source: AIMergedResult): void {
	target.relationships.push(...source.relationships);
	target.emotions.push(...source.emotions);
	target.patterns.push(...source.patterns);
	target.disciplines.push(...source.disciplines);
	target.questions.push(...source.questions);
	target.milestones.push(...source.milestones);
	target.turningPoints.push(...source.turningPoints);
}

// ---- 将 AI 结果应用到 PluginData ----

function applyAIAnalysis(data: PluginData, result: AIMergedResult): PluginData {
	// ---- 关系网络 ----
	const people: Record<string, PersonProfile> = {};
	for (const r of result.relationships) {
		if (!r.name || r.name.length < 2) continue;

		const lastMention = data.entries
			.filter(e => e.content.includes(r.name))
			.pop();

		people[r.name] = {
			name: r.name,
			firstMention: data.entries[0]?.date || '',
			lastMention: lastMention?.date || data.entries[data.entries.length - 1]?.date || '',
			totalMentions: r.totalMentions || 1,
			weeklyFrequency: [],
			emotionalTone: (r.emotionalTone || 'calm') as EmotionCategory,
			emotionalDistance: r.emotionalDistance ?? 0.5,
			mentions: [{ date: lastMention?.date || '', context: r.summary || '', emotionAtTime: (r.emotionalTone || 'calm') as EmotionCategory }],
		};
	}
	data.relationshipMap = { people, lastUpdated: new Date().toISOString() };

	// ---- 情绪时间线 ----
	const timelineEntries: TimelineEntry[] = [];
	for (const diary of data.entries) {
		const aiEmotion = result.emotions.find(e => e.date === diary.date);
		timelineEntries.push({
			date: diary.date,
			dominantEmotion: (aiEmotion?.dominantEmotion || 'calm') as EmotionCategory,
			emotionDistribution: { [aiEmotion?.dominantEmotion || 'calm']: 1 } as Record<EmotionCategory, number>,
			triggerEvents: [],
			diaryExcerpt: diary.content.slice(0, 80),
			systemNote: aiEmotion?.note || '',
			type: aiEmotion?.isTurningPoint ? 'turning_point' : aiEmotion?.isMilestone ? 'milestone' : 'normal',
			evidence: '',
		});
	}

	const turningPoints: TurningPoint[] = result.turningPoints.map(tp => ({
		date: tp.date,
		title: tp.title,
		before: tp.before,
		after: tp.after,
		evidence: tp.evidence,
	}));

	const milestones = result.milestones.map(ms => ({
		date: ms.date,
		title: ms.title,
		description: ms.description,
		icon: ms.icon || '🏔',
	}));

	data.emotionalTimeline = { entries: timelineEntries, milestones, turningPoints };

	// ---- 行为模式 ----
	data.patterns = result.patterns.map((p, i) => ({
		id: `ai-pattern-${Date.now()}-${i}`,
		title: p.title,
		description: p.description,
		evidence: p.evidence || '',
		detectedAt: new Date().toISOString(),
		category: (p.category || 'other') as BehaviorPattern['category'],
		occurrences: 1,
	}));

	// ---- 自我规训 ----
	data.selfDisciplineItems = result.disciplines.map(d => ({
		instruction: d.instruction,
		status: (d.status || 'persisting') as DisciplineStatus,
		firstMention: data.entries[0]?.date || '',
		lastMention: data.entries[data.entries.length - 1]?.date || '',
		totalMentions: 1,
		weeklyExecution: [] as WeeklyExecution[],
		insight: d.insight || '',
	}));

	// ---- 洞察提问 ----
	const questions: InsightQuestion[] = result.questions.map(q => ({
		id: `ai-q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
		pattern: q.pattern,
		question: q.question,
		relatedDimension: (q.relatedDimension || 'pattern') as InsightQuestion['relatedDimension'],
		createdAt: new Date().toISOString(),
		acknowledged: false,
	}));
	data.insightQuestions = questions;

	return data;
}
