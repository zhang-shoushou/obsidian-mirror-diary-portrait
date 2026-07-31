// 镜像 · 日记画像系统 — 设置面板

import { App, PluginSettingTab, Setting } from 'obsidian';
import type MirrorPlugin from './main';

export interface MirrorPluginSettings {
	diaryFolderPath: string;
	autoAnalyze: boolean;
	notifyOnInsight: boolean;
	deepseekApiKey: string;
	aiEnhancedAnalysis: boolean;
}

export const DEFAULT_SETTINGS: MirrorPluginSettings = {
	diaryFolderPath: '',
	autoAnalyze: true,
	notifyOnInsight: true,
	deepseekApiKey: '',
	aiEnhancedAnalysis: true,
};

export class MirrorSettingTab extends PluginSettingTab {
	plugin: MirrorPlugin;

	constructor(app: App, plugin: MirrorPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: '镜像 · 日记画像系统' });

		new Setting(containerEl)
			.setName('日记文件夹路径')
			.setDesc('指定存放日记的文件夹路径，留空则扫描整个 vault')
			.addText(text => text
				.setPlaceholder('例如: 日记（留空扫描全部）')
				.setValue(this.plugin.settings.diaryFolderPath)
				.onChange(async (value) => {
					this.plugin.settings.diaryFolderPath = value;
					await this.plugin.savePluginSettings();
				}));

		new Setting(containerEl)
			.setName('启用自动分析')
			.setDesc('当日记文件变化时自动分析更新画像')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoAnalyze)
				.onChange(async (value) => {
					this.plugin.settings.autoAnalyze = value;
					await this.plugin.savePluginSettings();
				}));

		new Setting(containerEl)
			.setName('发现洞察时通知')
			.setDesc('当画像发现新的模式时弹窗通知')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.notifyOnInsight)
				.onChange(async (value) => {
					this.plugin.settings.notifyOnInsight = value;
					await this.plugin.savePluginSettings();
				}));

		containerEl.createEl('h3', { text: 'DeepSeek AI 配置' });

		new Setting(containerEl)
			.setName('DeepSeek API Key')
			.setDesc('在 https://platform.deepseek.com 获取。对话和分析功能需要此项。')
			.addText(text => {
				text.setPlaceholder('sk-...')
					.setValue(this.plugin.settings.deepseekApiKey)
					.onChange(async (value) => {
						this.plugin.settings.deepseekApiKey = value;
						await this.plugin.savePluginSettings();
					});
				text.inputEl.type = 'password';
			});

		new Setting(containerEl)
			.setName('AI 增强分析')
			.setDesc('使用 DeepSeek 优化画像内容（关系洞察、情绪笔记、主动提问），准确性更高但会消耗 API 额度')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.aiEnhancedAnalysis)
				.onChange(async (value) => {
					this.plugin.settings.aiEnhancedAnalysis = value;
					await this.plugin.savePluginSettings();
				}));
	}
}
