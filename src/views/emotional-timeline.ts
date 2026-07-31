// 镜像 · 日记画像系统 — 情绪时间线视图

import { ItemView, WorkspaceLeaf } from 'obsidian';
import type { PluginData, TimelineEntry, Milestone, TurningPoint } from '../types';
import { EMOTION_LABELS } from '../types';
import { getTheme } from '../theme';

export const TIMELINE_VIEW_TYPE = 'mirror-emotional-timeline';

export class EmotionalTimelineView extends ItemView {
	data: PluginData;

	constructor(leaf: WorkspaceLeaf, data: PluginData) {
		super(leaf);
		this.data = data;
	}

	getViewType(): string { return TIMELINE_VIEW_TYPE; }
	getDisplayText(): string { return '情绪时间线'; }
	getIcon(): string { return 'clock'; }

	updateData(data: PluginData): void {
		this.data = data;
		this.render();
	}

	async onOpen(): Promise<void> { this.render(); }

	private render(): void {
		const container = this.containerEl.children[1] as HTMLElement;
		if (!container) return;
		const t = getTheme();
		container.empty();
		container.style.cssText = `padding:20px;overflow-y:auto;height:100%;background:${t.bgPrimary};color:${t.textPrimary};`;

		const timeline = this.data.emotionalTimeline;
		const allItems: Array<{type:'milestone';data:Milestone}|{type:'turning_point';data:TurningPoint}|{type:'entry';data:TimelineEntry}> = [];
		for (const m of timeline.milestones) allItems.push({type:'milestone', data:m});
		for (const tp of timeline.turningPoints) allItems.push({type:'turning_point', data:tp});
		for (const e of timeline.entries) allItems.push({type:'entry', data:e});
		allItems.sort((a,b) => {
			const da = 'date' in a.data ? a.data.date : '';
			const db = 'date' in b.data ? b.data.date : '';
			return db.localeCompare(da);
		});

		if (allItems.length === 0) {
			container.createDiv({text:'还没有日记数据——开始写第一篇日记吧。'})
				.style.cssText = `color:${t.textSecondary};text-align:center;padding:60px 0;`;
			return;
		}

		const timelineEl = container.createDiv();
		timelineEl.style.cssText = `position:relative;padding-left:30px;`;

		for (const item of allItems) {
			if (item.type === 'milestone') this.renderMilestone(timelineEl, item.data, t);
			else if (item.type === 'turning_point') this.renderTurningPoint(timelineEl, item.data, t);
			else this.renderTimelineEntry(timelineEl, item.data, t);
		}
	}

	private renderTimelineEntry(parent: HTMLElement, entry: TimelineEntry, t: ReturnType<typeof getTheme>): void {
		const row = parent.createDiv();
		row.style.cssText = `position:relative;padding:12px 16px;margin-bottom:6px;border-left:2px solid ${t.border};`;
		row.createSpan().style.cssText = `position:absolute;left:-6px;top:16px;width:10px;height:10px;border-radius:50%;background:${t.textMuted};`;
		row.createDiv({text:entry.date}).style.cssText = `font-size:11px;color:${t.textMuted};margin-bottom:4px;`;
		row.createDiv({text:`${EMOTION_LABELS[entry.dominantEmotion]} — ${entry.diaryExcerpt}`}).style.cssText = `font-size:13px;line-height:1.6;`;
		if (entry.systemNote) row.createDiv({text:entry.systemNote}).style.cssText = `font-size:11px;color:${t.purple};margin-top:4px;`;
	}

	private renderTurningPoint(parent: HTMLElement, tp: TurningPoint, t: ReturnType<typeof getTheme>): void {
		const row = parent.createDiv();
		row.style.cssText = `position:relative;padding:14px 16px;margin-bottom:8px;border-left:3px solid ${t.roseRed};background:${t.bgCard};border-radius:8px;`;
		row.createSpan().style.cssText = `position:absolute;left:-9px;top:18px;width:16px;height:16px;border-radius:50%;background:${t.roseRed};box-shadow:0 0 12px ${t.roseRed}66;`;
		const h = row.createDiv();
		h.style.cssText = `display:flex;align-items:center;gap:6px;margin-bottom:6px;`;
		h.createSpan({text:'↺'}).style.cssText = `font-size:16px;color:${t.roseRed};`;
		h.createSpan({text:tp.title}).style.cssText = `font-size:14px;font-weight:600;color:${t.roseRed};`;
		row.createDiv({text:tp.date}).style.cssText = `font-size:11px;color:${t.textMuted};margin-bottom:4px;`;
		row.createDiv({text:`${tp.before} → ${tp.after}`}).style.cssText = `font-size:12px;color:${t.textSecondary};line-height:1.5;`;
	}

	private renderMilestone(parent: HTMLElement, ms: Milestone, t: ReturnType<typeof getTheme>): void {
		const row = parent.createDiv();
		row.style.cssText = `position:relative;padding:14px 16px;margin-bottom:8px;border-left:3px solid ${t.warmOrange};background:${t.bgCard};border-radius:8px;`;
		row.createSpan().style.cssText = `position:absolute;left:-9px;top:18px;width:16px;height:16px;border-radius:50%;background:${t.warmOrange};box-shadow:0 0 12px ${t.warmOrange}66;`;
		const h = row.createDiv();
		h.style.cssText = `display:flex;align-items:center;gap:6px;margin-bottom:6px;`;
		h.createSpan({text:ms.icon||'🏔'}).style.cssText = `font-size:16px;`;
		h.createSpan({text:ms.title}).style.cssText = `font-size:14px;font-weight:600;color:${t.warmOrange};`;
		row.createDiv({text:ms.date}).style.cssText = `font-size:11px;color:${t.textMuted};margin-bottom:4px;`;
		row.createDiv({text:ms.description}).style.cssText = `font-size:12px;color:${t.textSecondary};line-height:1.5;`;
	}
}
