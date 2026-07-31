// ============================================================
// 镜像 · 日记画像系统 — 主入口
// ============================================================

import {
	Notice,
	Plugin,
	TFile,
	Modal,
	App,
	WorkspaceLeaf,
} from 'obsidian';
import {
	DEFAULT_SETTINGS,
	MirrorPluginSettings,
	MirrorSettingTab,
} from './settings';
import { parseDiaryEntry } from './parser';
import { runFullAnalysis } from './analysis';
import { loadData, saveData, addCorrection, DEFAULT_DATA } from './store';
import { runAIAnalysis } from './ai-analysis';
import type { PluginData, InsightQuestion } from './types';

import { DashboardView, DASHBOARD_VIEW_TYPE } from './views/dashboard';
import { RelationshipGraphView, RELATION_VIEW_TYPE } from './views/relationship-graph';
import { EmotionalTimelineView, TIMELINE_VIEW_TYPE } from './views/emotional-timeline';
import { InsightChatView, CHAT_VIEW_TYPE } from './views/insight-chat';
import { DisciplineBoardView, DISCIPLINE_VIEW_TYPE } from './views/discipline-board';
import { CorrectionLogView, CORRECTION_VIEW_TYPE } from './views/correction-log';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEventCallback = (...args: any[]) => void;

export default class MirrorPlugin extends Plugin {
	settings!: MirrorPluginSettings;
	data!: PluginData;

	async onload() {
		await this.loadSettings();
		this.data = await loadData(() => this.loadData());

		// ---- 注册视图 ----
		this.registerView(DASHBOARD_VIEW_TYPE, (leaf) => new DashboardView(leaf, this.data));
		this.registerView(RELATION_VIEW_TYPE, (leaf) => new RelationshipGraphView(leaf, this.data));
		this.registerView(TIMELINE_VIEW_TYPE, (leaf) => new EmotionalTimelineView(leaf, this.data));
		this.registerView(CHAT_VIEW_TYPE, (leaf) => new InsightChatView(leaf, this, this.data));
		this.registerView(DISCIPLINE_VIEW_TYPE, (leaf) => new DisciplineBoardView(leaf, this.data));
		this.registerView(CORRECTION_VIEW_TYPE, (leaf) => new CorrectionLogView(leaf, this.data));

		// ---- 自定义事件（通过 workspace.on 的动态类型） ----
		const ws = this.app.workspace as unknown as {
			on: (name: string, callback: AnyEventCallback) => void;
			trigger: (name: string, ...args: unknown[]) => void;
			onLayoutReady: (callback: () => void) => void;
		};

		ws.on('mirror:open-relation-detail', (async (personName: string) => {
			await this.activateView(RELATION_VIEW_TYPE);
			setTimeout(() => {
				const leaves = this.app.workspace.getLeavesOfType(RELATION_VIEW_TYPE);
				const rv = leaves[0]?.view as RelationshipGraphView | undefined;
				if (rv) {
					rv.updateData(this.data);
					rv.selectPerson(personName);
				}
			}, 400);
		}) as AnyEventCallback);

		ws.on('mirror:open-chat', ((q: InsightQuestion) => {
				this.activateView(CHAT_VIEW_TYPE);
				const view = this.app.workspace.getActiveViewOfType(InsightChatView);
				if (view) view.setInitialQuestion(q);
			}),
		);

		ws.on('mirror:open-correction', ((payload: { original: string; dimension: string }) => {
			new CorrectionModal(this.app, (correction: string) => {
				this.data = addCorrection(this.data, payload.original, correction, payload.dimension);
				this.savePluginData();
				new Notice('感谢你的纠正——画像会更准确地理解你。');
			}).open();
		}) as AnyEventCallback);

		// ---- 左侧栏按钮 ----
		this.addRibbonIcon('scan-eye', '打开画像总览', () => {
			this.activateView(DASHBOARD_VIEW_TYPE);
		});

		// ---- 状态栏 ----
		const statusBar = this.addStatusBarItem();
		statusBar.setText('镜像 · 画像');
		statusBar.onclick = () => this.activateView(DASHBOARD_VIEW_TYPE);

		// ---- 命令 ----
		this.addCommand({
			id: 'mirror-open-dashboard',
			name: '打开画像总览',
			callback: () => this.activateView(DASHBOARD_VIEW_TYPE),
		});

		this.addCommand({
			id: 'mirror-open-relations',
			name: '打开关系网络',
			callback: () => this.activateView(RELATION_VIEW_TYPE),
		});

		this.addCommand({
			id: 'mirror-open-timeline',
			name: '打开情绪时间线',
			callback: () => this.activateView(TIMELINE_VIEW_TYPE),
		});

		this.addCommand({
			id: 'mirror-open-chat',
			name: '与画像对话',
			callback: () => this.activateView(CHAT_VIEW_TYPE),
		});

		this.addCommand({
			id: 'mirror-open-discipline',
			name: '打开自我规训看板',
			callback: () => this.activateView(DISCIPLINE_VIEW_TYPE),
		});

		this.addCommand({
			id: 'mirror-analyze-now',
			name: '立即分析日记',
			callback: async () => {
				await this.scanAndAnalyze();
				new Notice('画像已更新');
			},
		});

		this.addCommand({
			id: 'mirror-open-corrections',
			name: '打开纠正记录',
			callback: () => this.activateView(CORRECTION_VIEW_TYPE),
		});

		// ---- 文件监听 ----
		this.registerEvent(
			this.app.vault.on('modify', async (file) => {
				if (file instanceof TFile && this.settings.autoAnalyze) {
					await this.handleFileChange(file);
				}
			}),
		);

		this.registerEvent(
			this.app.vault.on('create', async (file) => {
				if (file instanceof TFile && this.settings.autoAnalyze) {
					await this.handleFileChange(file);
				}
			}),
		);

		// ---- 设置面板 ----
		this.addSettingTab(new MirrorSettingTab(this.app, this));

		// 初次加载时分析
		await this.scanAndAnalyze();
	}

	async onunload() {}

	async loadSettings() {
		const saved = (await this.loadData()) as Partial<MirrorPluginSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
	}

	async savePluginSettings() {
		await this.saveData(this.settings as unknown as Record<string, unknown>);
	}

	async savePluginData() {
		await saveData(
			(data) => this.saveData(data),
			this.data,
		);
		this.refreshAllViews();
	}

	private async handleFileChange(file: TFile): Promise<void> {
		const folderPath = this.settings.diaryFolderPath;
		if (folderPath && !file.path.startsWith(folderPath)) return;
		if (file.extension !== 'md') return;

		const content = await this.app.vault.read(file);
		const entry = parseDiaryEntry(file, content);

		const idx = this.data.entries.findIndex(e => e.path === file.path);
		if (idx >= 0) {
			this.data.entries[idx] = entry;
		} else {
			this.data.entries.push(entry);
		}

		if (this.settings.aiEnhancedAnalysis && this.settings.deepseekApiKey) {
			this.data = await runAIAnalysis(this.settings.deepseekApiKey, this.data);
		} else {
			this.data = runFullAnalysis(this.data);
		}

		const newQuestions = this.data.insightQuestions.filter(q => !q.acknowledged);
		if (newQuestions.length > 0 && newQuestions.length <= 10 && this.settings.notifyOnInsight) {
			new Notice(`画像发现了 ${newQuestions.length} 个新洞察`);
		}

		await this.savePluginData();
	}

	private async scanAndAnalyze(): Promise<void> {
		const folderPath = this.settings.diaryFolderPath;
		let files: TFile[];

		if (folderPath) {
			const folder = this.app.vault.getAbstractFileByPath(folderPath);
			if (!folder) return;
			files = this.app.vault.getMarkdownFiles().filter(f => f.path.startsWith(folderPath));
		} else {
			files = this.app.vault.getMarkdownFiles();
		}

		let changed = false;
		for (const file of files) {
			const existing = this.data.entries.find(e => e.path === file.path);
			if (existing && existing.filename === file.basename) continue;

			const content = await this.app.vault.read(file);
			const entry = parseDiaryEntry(file, content);

			const idx = this.data.entries.findIndex(e => e.path === file.path);
			if (idx >= 0) {
				this.data.entries[idx] = entry;
			} else {
				this.data.entries.push(entry);
			}
			changed = true;
		}

		if (changed || (this.data.relationshipMap.people && Object.keys(this.data.relationshipMap.people).length === 0)) {
			if (this.settings.aiEnhancedAnalysis && this.settings.deepseekApiKey) {
				this.data = await runAIAnalysis(this.settings.deepseekApiKey, this.data);
			} else {
				this.data = runFullAnalysis(this.data);
			}
		}

		await this.savePluginData();
	}

	private async activateView(viewType: string) {
		const { workspace } = this.app;
		const existing = workspace.getLeavesOfType(viewType);
		if (existing.length > 0) {
			workspace.revealLeaf(existing[0]!);
			return;
		}

		const leaf = workspace.getRightLeaf(false);
		if (leaf) {
			await leaf.setViewState({ type: viewType, active: true });
			workspace.revealLeaf(leaf);
		}
	}

	private refreshAllViews(): void {
		const viewTypes = [
			DASHBOARD_VIEW_TYPE,
			RELATION_VIEW_TYPE,
			TIMELINE_VIEW_TYPE,
			CHAT_VIEW_TYPE,
			DISCIPLINE_VIEW_TYPE,
			CORRECTION_VIEW_TYPE,
		];

		for (const viewType of viewTypes) {
			const leaves = this.app.workspace.getLeavesOfType(viewType);
			for (const leaf of leaves) {
				const view = leaf.view as { updateData?: (data: PluginData) => void } | null;
				if (view?.updateData) {
					view.updateData(this.data);
				}
			}
		}
	}
}

// ---- 纠正弹窗 ----

class CorrectionModal extends Modal {
	private onSubmit: (correction: string) => void;

	constructor(app: App, onSubmit: (correction: string) => void) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h3', { text: '纠正画像推断' });
		contentEl.createEl('p', {
			text: '请告诉画像，你真实的感受或情况是怎样的？',
			cls: 'setting-item-description',
		});

		const textarea = contentEl.createEl('textarea');
		textarea.style.cssText = `width:100%;height:100px;padding:10px;border-radius:6px;border:1px solid #2a2a35;background:#22222c;color:#e8e8f0;font-size:13px;resize:vertical;margin-bottom:12px;`;
		textarea.setAttribute('placeholder', '那是怎样的？');

		const btnRow = contentEl.createDiv();
		btnRow.style.cssText = `display:flex;justify-content:flex-end;gap:8px;`;

		const cancelBtn = btnRow.createEl('button', { text: '取消' });
		cancelBtn.onclick = () => this.close();

		const submitBtn = btnRow.createEl('button', { text: '提交纠正' });
		submitBtn.style.cssText = `background:#f5a623;color:#0f0f12;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-weight:600;`;
		submitBtn.onclick = () => {
			const val = textarea.value.trim();
			if (val) {
				this.onSubmit(val);
				this.close();
			}
		};
	}

	onClose() {
		this.contentEl.empty();
	}
}
