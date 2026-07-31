// 镜像 · 日记画像系统 — 画像总览 Dashboard

import { ItemView, WorkspaceLeaf } from 'obsidian';
import type { PluginData, EmotionCategory } from '../types';
import { EMOTION_LABELS, DISCIPLINE_LABELS } from '../types';
import { getTheme, emotionColor, disciplineColor } from '../theme';

export const DASHBOARD_VIEW_TYPE = 'mirror-dashboard';

export class DashboardView extends ItemView {
	data: PluginData;
	private isRefreshing = false;

	constructor(leaf: WorkspaceLeaf, data: PluginData) {
		super(leaf);
		this.data = data;
	}

	getViewType(): string { return DASHBOARD_VIEW_TYPE; }
	getDisplayText(): string { return '画像总览'; }
	getIcon(): string { return 'layout-dashboard'; }

	updateData(data: PluginData): void {
		this.data = data;
		this.isRefreshing = false;
		this.render();
	}

	async onOpen(): Promise<void> { this.render(); }

	private render(): void {
		const container = this.containerEl.children[1] as HTMLElement;
		if (!container) return;
		const t = getTheme();
		container.empty();
		container.addClass('mirror-dashboard');
		container.style.cssText = `padding:20px;overflow-y:auto;height:100%;background:${t.bgPrimary};color:${t.textPrimary};`;

		// 头部
		const header = container.createDiv();
		header.style.cssText = `display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;`;
		header.createDiv({ text: '画像总览' }).style.cssText = `font-size:18px;font-weight:700;`;

		const refreshBtn = header.createEl('button', { text: this.isRefreshing ? '⏳ 刷新中...' : '⟳ 刷新洞察' });
		refreshBtn.style.cssText = `background:${this.isRefreshing ? t.bgTertiary : t.warmOrange};color:${this.isRefreshing ? t.textSecondary : '#fff'};border:none;padding:6px 14px;border-radius:6px;cursor:${this.isRefreshing ? 'not-allowed' : 'pointer'};font-size:12px;font-weight:600;`;
		refreshBtn.disabled = this.isRefreshing;
		refreshBtn.onclick = () => {
			if (!this.isRefreshing) {
				this.isRefreshing = true;
				this.render();
				const wsAny = this.app.workspace as unknown as { trigger: (name: string, ...args: unknown[]) => void };
				wsAny.trigger('mirror:refresh-analysis');
			}
		};

		this.renderInsightBanner(container, t);

		const grid = container.createDiv({ cls: 'mirror-dashboard-grid' });
		grid.style.cssText = `display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:20px;flex:1;min-height:0;`;

		this.renderEmotionCard(grid, t);
		this.renderRelationshipCard(grid, t);
		this.renderDisciplineCard(grid, t);
		this.renderPatternCard(grid, t);
	}

	private renderInsightBanner(container: HTMLElement, t: ReturnType<typeof getTheme>): void {
		const banner = container.createDiv();
		banner.style.cssText = `background:linear-gradient(135deg,${t.warmOrange}14,${t.warmOrange}04);border-left:3px solid ${t.warmOrange};border-radius:12px;padding:16px 20px;margin-bottom:8px;`;

		const questions = this.data.insightQuestions.filter(q => !q.acknowledged);
		if (questions.length > 0) {
			const q = questions[0]!;
			const hr = banner.createDiv();
			hr.style.cssText = `display:flex;align-items:center;gap:8px;margin-bottom:8px;`;
			hr.createSpan({ text: '◈' }).style.cssText = `color:${t.warmOrange};font-size:16px;`;
			const tag = hr.createSpan({ text: '主动提问' });
			tag.style.cssText = `font-size:11px;color:${t.warmOrange};background:${t.warmOrange}22;padding:2px 8px;border-radius:10px;`;

			banner.createDiv({ text: q.pattern }).style.cssText = `font-size:12px;color:${t.textSecondary};margin-bottom:6px;`;
			banner.createDiv({ text: q.question }).style.cssText = `font-size:15px;font-weight:600;line-height:1.6;margin-bottom:12px;`;

			const actions = banner.createDiv();
			actions.style.cssText = `display:flex;gap:8px;`;

			const correctBtn = actions.createEl('button', { text: '不对，不是这样' });
			correctBtn.style.cssText = `background:transparent;border:1px solid ${t.border};color:${t.textSecondary};padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px;`;
			correctBtn.onclick = () => {
				q.acknowledged = true;
				const wsAny = this.app.workspace as unknown as { trigger: (name: string, ...args: unknown[]) => void };
				wsAny.trigger('mirror:save-data');
				wsAny.trigger('mirror:open-correction', { original: q.question, dimension: q.relatedDimension });
				this.render();
			};

			const chatBtn = actions.createEl('button', { text: '展开聊聊' });
			chatBtn.style.cssText = `background:${t.warmOrange};color:#fff;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;`;
			chatBtn.onclick = () => {
				q.acknowledged = true;
				const wsAny = this.app.workspace as unknown as { trigger: (name: string, ...args: unknown[]) => void };
				wsAny.trigger('mirror:save-data');
				wsAny.trigger('mirror:open-chat', q);
				this.render();
			};
		} else {
			banner.createDiv({ text: '暂时没有新的洞察——继续写日记，画像会慢慢认识你。' })
				.style.cssText = `color:${t.textSecondary};font-size:14px;`;
		}
	}

	private renderEmotionCard(grid: HTMLElement, t: ReturnType<typeof getTheme>): void {
		const card = this.createCard(grid, '情绪趋势', t);
		const entries = this.data.emotionalTimeline.entries;
		if (entries.length === 0) {
			card.createDiv({ text: '还没有足够的日记数据' }).style.cssText = `color:${t.textMuted};font-size:13px;padding:20px;text-align:center;`;
			return;
		}

		const wrap = card.createDiv();
		wrap.style.cssText = `overflow-x:auto;padding-bottom:4px;`;

		const sparkline = wrap.createDiv();
		sparkline.style.cssText = `display:flex;align-items:flex-end;gap:2px;height:56px;min-width:${entries.length * 10}px;`;

		for (const entry of entries) {
			const ec = emotionColor(entry.dominantEmotion, t);
			const intensity = Object.values(entry.emotionDistribution).reduce((a,b)=>a+b,0) || 0.5;
			const h = Math.max(4, Math.min(56, intensity * 40 + 10));
			const bar = sparkline.createDiv();
			bar.style.cssText = `flex:1;min-width:4px;height:${h}px;background:${ec};border-radius:2px;opacity:0.85;`;
			bar.setAttribute('title', `${entry.date}\n${EMOTION_LABELS[entry.dominantEmotion]}${entry.systemNote ? '\n' + entry.systemNote : ''}`);
		}

		// 自动滚动到最新（最右）
		setTimeout(() => { wrap.scrollLeft = wrap.scrollWidth; }, 50);

		const legend = card.createDiv();
		legend.style.cssText = `display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;font-size:10px;`;
		const emotionTypes = new Set(entries.map(e => e.dominantEmotion));
		for (const et of emotionTypes) {
			const item = legend.createDiv();
			item.style.cssText = `display:flex;align-items:center;gap:3px;`;
			item.createSpan().style.cssText = `width:6px;height:6px;border-radius:50%;background:${emotionColor(et, t)};display:inline-block;`;
			item.createSpan({ text: EMOTION_LABELS[et] || et }).style.cssText = `color:${t.textSecondary};`;
			item.createSpan({ text: String(entries.filter(e => e.dominantEmotion === et).length) }).style.cssText = `color:${t.textMuted};`;
		}
	}

	private renderRelationshipCard(grid: HTMLElement, t: ReturnType<typeof getTheme>): void {
		const card = this.createCard(grid, '关系焦点', t);
		const people = Object.values(this.data.relationshipMap.people).sort((a,b)=>b.totalMentions-a.totalMentions).slice(0,5);
		if (people.length === 0) {
			card.createDiv({ text: '尚未识别到人际关系' }).style.cssText = `color:${t.textMuted};font-size:13px;padding:20px;text-align:center;`;
			return;
		}
		const list = card.createDiv();
		list.style.cssText = `display:flex;flex-direction:column;gap:10px;`;
		const allMentions = people.reduce((s,p)=>s+p.totalMentions,0) || 1;
		for (const person of people) {
			const row = list.createDiv();
			row.style.cssText = `display:flex;align-items:center;gap:10px;cursor:pointer;`;
			row.onclick = () => {
				const wsAny = this.app.workspace as unknown as { trigger: (name: string, ...args: unknown[]) => void };
				wsAny.trigger('mirror:open-relation-detail', person.name);
			};
			const avatar = row.createDiv({ text: person.name[0] });
			avatar.style.cssText = `width:32px;height:32px;border-radius:50%;background:${t.roseRed};color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;flex-shrink:0;`;
			const info = row.createDiv();
			info.createDiv({ text: person.name }).style.cssText = `font-size:13px;font-weight:500;`;
			const bar = info.createDiv();
			bar.style.cssText = `height:4px;background:${t.bgTertiary};border-radius:2px;margin-top:4px;overflow:hidden;`;
			bar.createDiv().style.cssText = `height:100%;width:${(person.totalMentions/allMentions)*100}%;background:${t.roseRed};border-radius:2px;`;
			row.createSpan({ text: getEmotionEmoji(person.emotionalTone) }).style.cssText = `font-size:16px;flex-shrink:0;`;
		}
	}

	private renderDisciplineCard(grid: HTMLElement, t: ReturnType<typeof getTheme>): void {
		const card = this.createCard(grid, '自我规训速览', t);
		const items = this.data.selfDisciplineItems.slice(0,3);
		if (items.length === 0) {
			card.createDiv({ text: '尚未识别到自我规训' }).style.cssText = `color:${t.textMuted};font-size:13px;padding:20px;text-align:center;`;
			return;
		}
		const list = card.createDiv();
		list.style.cssText = `display:flex;flex-direction:column;gap:12px;`;
		for (const item of items) {
			const row = list.createDiv();
			row.style.cssText = `display:flex;align-items:center;gap:10px;`;
			const dot = row.createSpan();
			dot.style.cssText = `width:8px;height:8px;border-radius:50%;background:${disciplineColor(item.status, t)};flex-shrink:0;`;
			if (item.status === 'repeated_unexecuted') dot.style.animation = 'mirror-pulse 2s infinite';
			row.createSpan({ text: item.instruction }).style.cssText = `font-size:13px;flex:1;`;
			row.createSpan({ text: DISCIPLINE_LABELS[item.status] }).style.cssText = `font-size:11px;color:${t.textMuted};`;
		}
	}

	private renderPatternCard(grid: HTMLElement, t: ReturnType<typeof getTheme>): void {
		const card = this.createCard(grid, '行为模式', t);
		const patterns = this.data.patterns.slice(0,3);
		if (patterns.length === 0) {
			card.createDiv({ text: '持续书写中，模式正在浮现...' }).style.cssText = `color:${t.textMuted};font-size:13px;padding:20px;text-align:center;`;
			return;
		}
		const list = card.createDiv();
		list.style.cssText = `display:flex;flex-direction:column;gap:14px;`;
		for (const p of patterns) {
			const item = list.createDiv();
			item.style.cssText = `padding:8px 0;`;
			item.createDiv({ text: p.title }).style.cssText = `font-size:14px;font-weight:600;margin-bottom:4px;`;
			item.createDiv({ text: p.description }).style.cssText = `font-size:12px;color:${t.textSecondary};line-height:1.5;margin-bottom:4px;`;
			item.createDiv({ text: p.evidence }).style.cssText = `font-size:11px;color:${t.textMuted};`;
		}
	}

	private createCard(grid: HTMLElement, title: string, t: ReturnType<typeof getTheme>): HTMLElement {
		const card = grid.createDiv({ cls: 'mirror-card' });
		card.style.cssText = `background:${t.bgCard};border:1px solid ${t.border};border-radius:12px;padding:20px;display:flex;flex-direction:column;overflow:hidden;`;
		card.createDiv({ text: title }).style.cssText = `font-size:14px;font-weight:600;margin-bottom:14px;color:${t.textPrimary};`;
		return card;
	}
}

function getEmotionEmoji(emotion: EmotionCategory): string {
	const m: Record<string,string> = {joy:'😊',sadness:'😢',anger:'😤',fear:'😨',surprise:'😲',disgust:'😒',calm:'😌',anxiety:'😰',hope:'🌟',disappointment:'😞',complex:'🤔'};
	return m[emotion] || '😶';
}
