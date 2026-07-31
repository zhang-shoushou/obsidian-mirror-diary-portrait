// ============================================================
// 镜像 · 日记画像系统 — 分析引擎
// ============================================================

import type {
	DiaryEntry,
	RelationshipMap,
	PersonProfile,
	EmotionalTimeline,
	TimelineEntry,
	EmotionCategory,
	BehaviorPattern,
	SelfDisciplineItem,
	SelfDisciplineMention,
	InsightQuestion,
	WeeklyExecution,
	DisciplineStatus,
	PluginData,
	TurningPoint,
} from './types';
import { getWeekLabel } from './parser';

// ============================================================
// 关系网络分析
// ============================================================

export function analyzeRelationships(entries: DiaryEntry[]): RelationshipMap {
	const people: Record<string, PersonProfile> = {};

	for (const entry of entries) {
		for (const name of entry.mentionedNames) {
			if (!people[name]) {
				people[name] = {
					name,
					firstMention: entry.date,
					lastMention: entry.date,
					totalMentions: 0,
					weeklyFrequency: [],
					emotionalTone: 'calm',
					emotionalDistance: 0.5,
					mentions: [],
				};
			}

			const person = people[name]!;
			person!.totalMentions++;
			person!.lastMention = entry.date;

			const idx = entry.content.indexOf(name);
			const contextStart = Math.max(0, idx - 40);
			const contextEnd = Math.min(entry.content.length, idx + name.length + 40);
			const context = entry.content.slice(contextStart, contextEnd).replace(/\n/g, ' ');

			const contextEmotions = entry.emotionWords.filter(
				(ew) => entry.content.indexOf(ew.word) >= contextStart && entry.content.indexOf(ew.word) <= contextEnd,
			);
			const dominantEmotion: EmotionCategory = contextEmotions.length > 0
				? contextEmotions.sort((a, b) => b.confidence - a.confidence)[0]!.category
				: entry.emotionWords.length > 0
					? entry.emotionWords[0]!.category
					: 'calm';

			person.mentions.push({
				date: entry.date,
				context,
				emotionAtTime: dominantEmotion,
			});

			person.emotionalTone = dominantEmotion;
		}
	}

	// 计算每周频率和情感距离
	for (const person of Object.values(people)) {
		const weekMap = new Map<string, number>();
		const totalDays = entries.length;
		let daysWithMention = 0;

		for (const entry of entries) {
			if (entry.mentionedNames.includes(person.name)) {
				daysWithMention++;
				const week = getWeekLabel(entry.date);
				weekMap.set(week, (weekMap.get(week) || 0) + 1);
			}
		}

		person.weeklyFrequency = [...weekMap.entries()]
			.map(([week, count]) => ({ week, count }))
			.sort((a, b) => a.week.localeCompare(b.week));

		person.emotionalDistance = Math.max(0, 1 - (daysWithMention / Math.max(totalDays, 1)) * 2);
	}

	return {
		people,
		lastUpdated: new Date().toISOString(),
	};
}

// ============================================================
// 情绪时间线分析
// ============================================================

export function analyzeEmotionalTimeline(entries: DiaryEntry[], data: PluginData): EmotionalTimeline {
	const timelineEntries: TimelineEntry[] = entries.map((entry) => {
		const emotionCounts: Record<string, number> = {};
		for (const ew of entry.emotionWords) {
			emotionCounts[ew.category] = (emotionCounts[ew.category] || 0) + ew.confidence;
		}

		const distribution = {} as Record<EmotionCategory, number>;
		for (const [cat, count] of Object.entries(emotionCounts)) {
			distribution[cat as EmotionCategory] = count;
		}

		const sorted = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1]);
		const dominantEmotion: EmotionCategory = sorted.length > 0 ? (sorted[0]![0] as EmotionCategory) : 'calm';

		const triggerEvents = extractTriggerEvents(entry.content);
		const diaryExcerpt = entry.content.slice(0, 80).replace(/\n/g, ' ');

		const systemNote = generateEmotionNote(entry, dominantEmotion);

		return {
			date: entry.date,
			dominantEmotion,
			emotionDistribution: distribution,
			triggerEvents,
			diaryExcerpt,
			systemNote,
			type: 'normal',
			evidence: `检测到${entry.emotionWords.length}个情绪词，主导：${dominantEmotion}`,
		};
	});

	const turningPoints = detectTurningPoints(timelineEntries);

	for (const tp of turningPoints) {
		const entry = timelineEntries.find((e) => e.date === tp.date);
		if (entry) entry.type = 'turning_point';
	}

	return {
		entries: timelineEntries,
		milestones: data.milestones || [],
		turningPoints,
	};
}

function extractTriggerEvents(text: string): string[] {
	const events: string[] = [];
	const patterns = [
		/今天[^。！？\n]{2,30}[。！？]/g,
		/发生了[^。！？\n]{2,30}[。！？]/g,
		/[和跟与][^\s]{1,3}[^。！？\n]{2,20}[。！？]/g,
	];

	for (const pattern of patterns) {
		const matches = text.match(pattern);
		if (matches) {
			for (const m of matches) {
				if (m.length > 5 && m.length < 40 && !events.includes(m.trim())) {
					events.push(m.trim());
				}
			}
		}
	}

	return events.slice(0, 3);
}

function generateEmotionNote(entry: DiaryEntry, dominant: EmotionCategory): string {
	const hasSelfDiscipline = entry.selfDisciplineInstructions.length > 0;
	const hasNames = entry.mentionedNames.length > 0;
	const wordCount = entry.wordCount;

	if (dominant === 'calm' && wordCount > 500) {
		return '这篇日记篇幅较长，基调平静——你在认真梳理自己。';
	}
	if (dominant === 'anxiety' && hasSelfDiscipline) {
		return '你有觉察到自己正在焦虑，并尝试给自己指引。';
	}
	if (dominant === 'joy' && hasNames) {
		return '这一天你和他人的连接带来了快乐。';
	}
	if (dominant === 'sadness') {
		return '这一天的情绪底色是悲伤，你在允许自己感受。';
	}
	if (hasSelfDiscipline) {
		const firstInstr = entry.selfDisciplineInstructions[0]!;
		return `你在提醒自己${firstInstr.instruction}——你在努力与自己和解。`;
	}

	return '';
}

function detectTurningPoints(entries: TimelineEntry[]): TurningPoint[] {
	const turningPoints: TurningPoint[] = [];

	for (let i = 1; i < entries.length; i++) {
		const prev = entries[i - 1];
		const curr = entries[i];
		if (!prev || !curr) continue;

		if (prev.dominantEmotion !== curr.dominantEmotion) {
			const prevIntensity = Object.values(prev.emotionDistribution).reduce((a, b) => a + b, 0);
			const currIntensity = Object.values(curr.emotionDistribution).reduce((a, b) => a + b, 0);

			if (Math.abs(currIntensity - prevIntensity) > 1.5) {
				turningPoints.push({
					date: curr.date,
					title: `情绪转折：从${prev.dominantEmotion}到${curr.dominantEmotion}`,
					before: `${prev.dominantEmotion}（强度 ${prevIntensity.toFixed(1)}）`,
					after: `${curr.dominantEmotion}（强度 ${currIntensity.toFixed(1)}）`,
					evidence: `情绪强度变化 ${Math.abs(currIntensity - prevIntensity).toFixed(1)}`,
				});
			}
		}
	}

	return turningPoints;
}

// ============================================================
// 行为模式识别
// ============================================================

export function analyzePatterns(entries: DiaryEntry[], existingPatterns: BehaviorPattern[]): BehaviorPattern[] {
	const newPatterns: BehaviorPattern[] = [];

	const stressEntries = entries.filter((e) =>
		e.emotionWords.some((ew) => ew.category === 'anxiety' || ew.category === 'fear'),
	);
	if (stressEntries.length >= 3) {
		const avgWords = stressEntries.reduce((s, e) => s + e.wordCount, 0) / stressEntries.length;
		const overallAvg = entries.reduce((s, e) => s + e.wordCount, 0) / entries.length;

		if (avgWords > overallAvg * 1.3) {
			newPatterns.push({
				id: `stress-response-${Date.now()}`,
				title: '压力下的长篇书写',
				description: '在感到焦虑或恐惧的日子里，你的日记字数明显增加——写作可能是你应对压力的方式。',
				evidence: `压力日记平均 ${Math.round(avgWords)} 字 vs 总体平均 ${Math.round(overallAvg)} 字（增加 ${Math.round((avgWords / overallAvg - 1) * 100)}%）`,
				detectedAt: new Date().toISOString(),
				category: 'stress_response',
				occurrences: stressEntries.length,
			});
		}
	}

	const sdEntries = entries.filter((e) => e.selfDisciplineInstructions.length > 0);
	if (sdEntries.length >= 4) {
		newPatterns.push({
			id: `self-discipline-${Date.now()}`,
			title: '频繁的自我指引',
			description: '你在日记中经常给自己写下指令——你是一个有很强自我觉察意识的人，但同时也在对自己提出很多要求。',
			evidence: `${sdEntries.length}/${entries.length} 篇日记包含自我规训内容（${Math.round((sdEntries.length / entries.length) * 100)}%）`,
			detectedAt: new Date().toISOString(),
			category: 'work_habit',
			occurrences: sdEntries.length,
		});
	}

	return [...existingPatterns, ...newPatterns];
}

// ============================================================
// 自我规训追踪
// ============================================================

export function analyzeSelfDiscipline(
	entries: DiaryEntry[],
	existingItems: SelfDisciplineItem[],
): SelfDisciplineItem[] {
	const instructionMap = new Map<string, SelfDisciplineMention[]>();

	for (const entry of entries) {
		for (const sm of entry.selfDisciplineInstructions) {
			const key = normalizeInstruction(sm.instruction);
			if (!instructionMap.has(key)) instructionMap.set(key, []);
			instructionMap.get(key)!.push(sm);
		}
	}

	const items: SelfDisciplineItem[] = [];
	const existingMap = new Map(existingItems.map((ei) => [normalizeInstruction(ei.instruction), ei]));

	for (const [key, mentions] of instructionMap) {
		const sorted = mentions.sort((a, b) => a.date.localeCompare(b.date));
		const firstItem = sorted[0];
		const lastItem = sorted[sorted.length - 1];
		if (!firstItem || !lastItem) continue;

		const instruction = firstItem.instruction;

		const weekMap = new Map<string, { mentioned: boolean }>();
		for (const m of sorted) {
			const week = getWeekLabel(m.date);
			if (!weekMap.has(week)) weekMap.set(week, { mentioned: true });
		}

		const weeklyExecution: WeeklyExecution[] = [...weekMap.entries()]
			.map(([week, _data]) => ({
				week,
				executionRate: 100,
			}))
			.sort((a, b) => a.week.localeCompare(b.week));

		const status = determineDisciplineStatus(sorted);

		const existing = existingMap.get(key);
		let insight = existing?.insight;

		if (status === 'repeated_unexecuted' && !insight) {
			insight = `这个指令你已经写下${sorted.length}次了——是什么在阻碍你？`;
		} else if (status === 'persisting' && !insight) {
			insight = '你正在持续践行这个承诺。';
		} else if (status === 'internalized' && !insight) {
			insight = '这个指令已经成为你的一部分，不再需要刻意提醒。';
		}

		items.push({
			instruction,
			status,
			firstMention: firstItem.date,
			lastMention: lastItem.date,
			totalMentions: sorted.length,
			weeklyExecution,
			insight,
			evidence: existing?.evidence,
		});
	}

	return items;
}

function normalizeInstruction(instruction: string): string {
	return instruction.replace(/[，。！？、\s]/g, '');
}

function determineDisciplineStatus(mentions: SelfDisciplineMention[]): DisciplineStatus {
	const firstMention = mentions[0];
	const lastMention = mentions[mentions.length - 1];
	if (!firstMention || !lastMention) return 'persisting';

	const firstDate = new Date(firstMention!.date);
	const lastDate = new Date(lastMention!.date);
	if (isNaN(firstDate.getTime()) || isNaN(lastDate.getTime())) return 'persisting';

	const daysSpan = (lastDate.getTime() - firstDate.getTime()) / 86400000;

	if (daysSpan > 30 && mentions.length >= 2) {
		const lastMentionDaysAgo = (new Date().getTime() - lastDate.getTime()) / 86400000;
		if (lastMentionDaysAgo > 14) return 'internalized';
	}

	if (mentions.length >= 3 && daysSpan > 14) {
		return 'repeated_unexecuted';
	}

	return 'persisting';
}

// ============================================================
// 主动提问生成
// ============================================================

export function generateInsightQuestions(data: PluginData): InsightQuestion[] {
	const questions: InsightQuestion[] = [];

	const people = Object.values(data.relationshipMap.people);
	for (const person of people) {
		if (person.totalMentions >= 3) {
			const recentWeeks = person.weeklyFrequency.slice(-3);
			const olderWeeks = person.weeklyFrequency.slice(-6, -3);
			const recentAvg = recentWeeks.reduce((s, w) => s + w.count, 0) / Math.max(recentWeeks.length, 1);
			const olderAvg = olderWeeks.reduce((s, w) => s + w.count, 0) / Math.max(olderWeeks.length, 1);

			if (recentAvg === 0 && olderAvg > 0) {
				questions.push({
					id: `rel-drop-${person.name}-${Date.now()}`,
					pattern: `${person.name}的提及频率下降`,
					question: `你之前频繁提到${person.name}，但最近很少出现了——ta从你的世界里淡出了，还是在你的心里更清晰了？`,
					relatedDimension: 'relationship',
					createdAt: new Date().toISOString(),
					acknowledged: false,
				});
			}
		}
	}

	for (const item of data.selfDisciplineItems) {
		if (item.status === 'repeated_unexecuted' && item.totalMentions >= 3) {
			questions.push({
				id: `sd-stuck-${Date.now()}`,
				pattern: '反复写下但未执行的指令',
				question: `"${item.instruction}"——你已经对自己说了${item.totalMentions}次。你觉得你在等什么？`,
				relatedDimension: 'discipline',
				createdAt: new Date().toISOString(),
				acknowledged: false,
			});
			break;
		}
	}

	if (data.emotionalTimeline.entries.length >= 5) {
		const recent = data.emotionalTimeline.entries.slice(-5);
		const calmDays = recent.filter((e) => e.dominantEmotion === 'calm').length;
		if (calmDays >= 4) {
			questions.push({
				id: `emotion-calm-${Date.now()}`,
				pattern: '持续的平静',
				question: '最近你的日记很平静——这是真正的安宁，还是你不再对自己倾诉了？',
				relatedDimension: 'emotion',
				createdAt: new Date().toISOString(),
				acknowledged: false,
			});
		}
	}

	return questions;
}

// ============================================================
// 全量分析入口
// ============================================================

export function runFullAnalysis(data: PluginData): PluginData {
	const entries = data.entries;

	data.relationshipMap = analyzeRelationships(entries);
	data.emotionalTimeline = analyzeEmotionalTimeline(entries, data);
	data.patterns = analyzePatterns(entries, data.patterns);
	data.selfDisciplineItems = analyzeSelfDiscipline(entries, data.selfDisciplineItems);
	data.insightQuestions = generateInsightQuestions(data);

	return data;
}
