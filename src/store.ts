// ============================================================
// 镜像 · 日记画像系统 — 数据存储
// ============================================================

import type { PluginData, PortraitSnapshot, CorrectionRecord } from './types';

export const DEFAULT_DATA: PluginData = {
	diaryFolderPath: '',
	entries: [],
	relationshipMap: { people: {}, lastUpdated: '' },
	emotionalTimeline: { entries: [], milestones: [], turningPoints: [] },
	patterns: [],
	selfDisciplineItems: [],
	insightQuestions: [],
	corrections: [],
	milestones: [],
	turningPoints: [],
	snapshots: [],
	lastAnalyzedPath: '',
};

export async function loadData(loadFn: () => Promise<Record<string, unknown> | null>): Promise<PluginData> {
	const raw = await loadFn();
	if (!raw) return { ...DEFAULT_DATA };
	return { ...DEFAULT_DATA, ...(raw as Partial<PluginData>) } as PluginData;
}

export async function saveData(
	saveFn: (data: Record<string, unknown>) => Promise<void>,
	data: PluginData,
): Promise<void> {
	// 创建快照（每5次分析保存一次，取模比对）
	const snapshotCount = data.snapshots.length;
	if (snapshotCount === 0 || data.entries.length % 5 === 0) {
		const snapshot: PortraitSnapshot = {
			timestamp: new Date().toISOString(),
			relationshipMap: JSON.parse(JSON.stringify(data.relationshipMap)),
			emotionalTimeline: JSON.parse(JSON.stringify(data.emotionalTimeline)),
			patterns: JSON.parse(JSON.stringify(data.patterns)),
			selfDisciplineItems: JSON.parse(JSON.stringify(data.selfDisciplineItems)),
			insightQuestions: JSON.parse(JSON.stringify(data.insightQuestions)),
		};
		data.snapshots.push(snapshot);

		// 保留最近20个快照
		if (data.snapshots.length > 20) {
			data.snapshots = data.snapshots.slice(-20);
		}
	}

	await saveFn(data as unknown as Record<string, unknown>);
}

export function addCorrection(
	data: PluginData,
	original: string,
	correction: string,
	dimension: string,
): PluginData {
	const record: CorrectionRecord = {
		id: `corr-${Date.now()}`,
		originalInference: original,
		userCorrection: correction,
		timestamp: new Date().toISOString(),
		dimension,
	};
	data.corrections.push(record);

	// 保留最近100条纠正记录
	if (data.corrections.length > 100) {
		data.corrections = data.corrections.slice(-100);
	}

	return data;
}
