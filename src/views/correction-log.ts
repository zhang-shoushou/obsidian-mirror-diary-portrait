// 镜像 · 日记画像系统 — 纠正记录视图

import { ItemView, WorkspaceLeaf } from 'obsidian';
import type { PluginData } from '../types';
import { getTheme } from '../theme';

export const CORRECTION_VIEW_TYPE = 'mirror-correction-log';

export class CorrectionLogView extends ItemView {
	data: PluginData;

	constructor(leaf: WorkspaceLeaf, data: PluginData) {
		super(leaf);
		this.data = data;
	}

	getViewType(): string { return CORRECTION_VIEW_TYPE; }
	getDisplayText(): string { return '纠正记录'; }
	getIcon(): string { return 'pencil'; }

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

		container.createDiv({ text: '纠正记录' }).style.cssText = `font-size:18px;font-weight:600;margin-bottom:6px;`;
		container.createDiv({ text: '你对画像推断的每次纠正都被记录在这里，帮助画像更准确地理解你。' })
			.style.cssText = `font-size:12px;color:${t.textSecondary};margin-bottom:20px;`;

		const records = [...this.data.corrections].reverse();
		if (records.length === 0) {
			container.createDiv({ text: '还没有纠正记录——当画像的推断不够准确时，点击"不对"来纠正。' })
				.style.cssText = `color:${t.textMuted};text-align:center;padding:60px 0;font-size:14px;`;
			return;
		}

		for (const record of records) {
			const card = container.createDiv();
			card.style.cssText = `background:${t.bgCard};border:1px solid ${t.border};border-radius:10px;padding:16px;margin-bottom:12px;`;

			const meta = card.createDiv();
			meta.style.cssText = `display:flex;justify-content:space-between;margin-bottom:10px;`;
			meta.createDiv({ text: record.dimension }).style.cssText = `font-size:11px;color:${t.purple};background:${t.purple}22;padding:2px 8px;border-radius:8px;`;
			meta.createDiv({ text: record.timestamp.slice(0,16).replace('T',' ') }).style.cssText = `font-size:11px;color:${t.textMuted};`;

			const orig = card.createDiv();
			orig.createDiv({ text: '画像推断' }).style.cssText = `font-size:11px;color:${t.textMuted};margin-bottom:4px;`;
			orig.createDiv({ text: record.originalInference }).style.cssText = `font-size:13px;color:${t.textSecondary};line-height:1.5;margin-bottom:10px;`;

			const corr = card.createDiv();
			corr.createDiv({ text: '你的纠正' }).style.cssText = `font-size:11px;color:${t.warmOrange};margin-bottom:4px;`;
			corr.createDiv({ text: record.userCorrection }).style.cssText = `font-size:13px;color:${t.textPrimary};line-height:1.5;`;
		}
	}
}
