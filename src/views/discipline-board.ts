// 镜像 · 日记画像系统 — 自我规训看板

import { ItemView, WorkspaceLeaf } from 'obsidian';
import type { PluginData, SelfDisciplineItem, DisciplineStatus } from '../types';
import { DISCIPLINE_LABELS } from '../types';
import { getTheme, disciplineColor } from '../theme';

export const DISCIPLINE_VIEW_TYPE = 'mirror-discipline-board';
const COLUMNS: DisciplineStatus[] = ['persisting', 'repeated_unexecuted', 'internalized'];

export class DisciplineBoardView extends ItemView {
	data: PluginData;

	constructor(leaf: WorkspaceLeaf, data: PluginData) {
		super(leaf);
		this.data = data;
	}

	getViewType(): string { return DISCIPLINE_VIEW_TYPE; }
	getDisplayText(): string { return '自我规训看板'; }
	getIcon(): string { return 'list-checks'; }

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
		container.style.cssText = `padding:20px;display:flex;gap:20px;height:100%;background:${t.bgPrimary};color:${t.textPrimary};overflow-x:auto;`;

		for (const status of COLUMNS) {
			const col = container.createDiv();
			col.style.cssText = `flex:1;min-width:280px;display:flex;flex-direction:column;`;
			const color = disciplineColor(status, t);

			const header = col.createDiv();
			header.style.cssText = `padding:12px 16px;background:${color}22;border-left:3px solid ${color};border-radius:8px 8px 0 0;margin-bottom:12px;`;
			header.createDiv({ text: DISCIPLINE_LABELS[status] }).style.cssText = `font-size:14px;font-weight:600;color:${color};`;
			header.createDiv({ text: `${this.data.selfDisciplineItems.filter(i => i.status === status).length} 项` })
				.style.cssText = `font-size:11px;color:${t.textMuted};margin-top:2px;`;

			const items = this.data.selfDisciplineItems.filter(i => i.status === status);
			if (items.length === 0) {
				const emptyText = status === 'persisting' ? '没有正在坚持的规训' :
					status === 'repeated_unexecuted' ? '没有反复出现但未执行的规训' : '没有已内化的规训';
				col.createDiv({ text: emptyText }).style.cssText = `color:${t.textMuted};font-size:12px;text-align:center;padding:40px 0;`;
			}

			for (const item of items) {
				const card = col.createDiv();
				card.style.cssText = `background:${t.bgCard};border:1px solid ${t.border};border-radius:10px;padding:16px;margin-bottom:12px;`;
				if (status === 'repeated_unexecuted') card.style.animation = 'mirror-pulse-card 3s infinite';

				card.createDiv({ text: item.instruction }).style.cssText = `font-size:14px;font-weight:600;margin-bottom:10px;`;

				const chart = card.createDiv();
				chart.style.cssText = `display:flex;align-items:flex-end;gap:4px;height:40px;margin-bottom:8px;`;
				const weeks = item.weeklyExecution.slice(-5);
				for (const w of weeks) {
					const bar = chart.createDiv();
					bar.style.cssText = `flex:1;height:${Math.max(4,w.executionRate*0.4)}px;background:${color};border-radius:2px;opacity:0.8;`;
					bar.setAttribute('title', `${w.week}: ${w.executionRate}%`);
				}
				if (weeks.length === 0) chart.createDiv({ text: '暂无数据' }).style.cssText = `font-size:11px;color:${t.textMuted};`;

				card.createDiv({ text: `提及 ${item.totalMentions} 次` }).style.cssText = `font-size:11px;color:${t.textMuted};margin-bottom:6px;`;

				if (item.insight) {
					const insight = card.createDiv();
					insight.style.cssText = `padding:8px 10px;background:${t.bgTertiary};border-radius:6px;border-left:2px solid ${color};font-size:11px;color:${t.textSecondary};line-height:1.5;margin-top:6px;`;
					insight.createSpan({ text: item.insight });
				}
			}
		}
	}
}
