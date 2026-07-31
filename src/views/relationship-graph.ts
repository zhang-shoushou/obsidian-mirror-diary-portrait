// 镜像 · 日记画像系统 — 关系网络视图

import { ItemView, WorkspaceLeaf } from 'obsidian';
import type { PluginData, PersonProfile } from '../types';
import { EMOTION_LABELS } from '../types';
import { getTheme, relationColor } from '../theme';

export const RELATION_VIEW_TYPE = 'mirror-relation-graph';

export class RelationshipGraphView extends ItemView {
	data: PluginData;
	private panelEl: HTMLElement | null = null;
	private canvasEl: HTMLElement | null = null;
	private nodesContainer: HTMLElement | null = null;
	private selectedName: string | null = null;
	private scale = 1;
	private panX = 0;
	private panY = 0;
	private initialDistance = 0;

	constructor(leaf: WorkspaceLeaf, data: PluginData) {
		super(leaf);
		this.data = data;
	}

	getViewType(): string { return RELATION_VIEW_TYPE; }
	getDisplayText(): string { return '关系网络'; }
	getIcon(): string { return 'git-branch'; }

	updateData(data: PluginData): void {
		this.data = data;
		this.render();
	}

	selectPerson(name: string): void {
		const person = this.data.relationshipMap.people[name];
		if (person) {
			this.selectedName = name;
			this.showPersonDetail(person);
		}
	}

	async onOpen(): Promise<void> { this.render(); }

	private isMobile(): boolean {
		return activeDocument.body.clientWidth < 600;
	}

	private applyTransform(): void {
		if (this.nodesContainer) {
			this.nodesContainer.style.transform = `scale(${this.scale}) translate(${this.panX}px, ${this.panY}px)`;
		}
	}

	private zoomIn(): void {
		this.scale = Math.min(3, this.scale + 0.15);
		this.applyTransform();
	}

	private zoomOut(): void {
		this.scale = Math.max(0.2, this.scale - 0.15);
		this.applyTransform();
	}

	private zoomReset(): void {
		const people = Object.values(this.data.relationshipMap.people);
		this.scale = Math.max(0.3, Math.min(1, 500 / (people.length * 60)));
		this.panX = 0;
		this.panY = 0;
		this.applyTransform();
	}

	private setupDragPan(): void {
		if (!this.canvasEl) return;
		let dragging = false;
		let sx = 0, sy = 0;

		this.canvasEl.style.cursor = 'grab';

		this.canvasEl.addEventListener('mousedown', (e: MouseEvent) => {
			if (e.button === 0) {
				dragging = true;
				sx = e.clientX - this.panX;
				sy = e.clientY - this.panY;
				this.canvasEl!.style.cursor = 'grabbing';
				e.preventDefault();
			}
		});

		this.canvasEl.addEventListener('mousemove', (e: MouseEvent) => {
			if (dragging) {
				this.panX = e.clientX - sx;
				this.panY = e.clientY - sy;
				this.applyTransform();
			}
		});

		const stop = () => {
			dragging = false;
			if (this.canvasEl) this.canvasEl.style.cursor = 'grab';
		};
		this.canvasEl.addEventListener('mouseup', stop);
		this.canvasEl.addEventListener('mouseleave', stop);
	}

	private render(): void {
		const container = this.containerEl.children[1] as HTMLElement;
		if (!container) return;
		const t = getTheme();
		container.empty();
		container.style.cssText = `display:flex;height:100%;background:${t.bgPrimary};position:relative;`;

		this.canvasEl = container.createDiv({ cls: 'mirror-graph-canvas' });
		this.canvasEl.style.cssText = `flex:1;overflow:hidden;position:relative;`;

		// 缩放工具栏
		const toolbar = this.canvasEl.createDiv();
		toolbar.style.cssText = `position:absolute;bottom:16px;right:16px;display:flex;gap:4px;z-index:150;`;
		const btnStyle = `width:32px;height:32px;border-radius:8px;border:1px solid ${t.border};background:${t.bgCard};color:${t.textPrimary};font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;`;

		const zb = toolbar.createEl('button', { text: '+' });
		zb.style.cssText = btnStyle;
		zb.onclick = () => this.zoomIn();

		const zob = toolbar.createEl('button', { text: '−' });
		zob.style.cssText = btnStyle;
		zob.onclick = () => this.zoomOut();

		const rb = toolbar.createEl('button', { text: '⟲' });
		rb.style.cssText = `${btnStyle}font-size:14px;`;
		rb.setAttribute('title', '重置缩放');
		rb.onclick = () => this.zoomReset();

		// 内层节点容器
		this.nodesContainer = this.canvasEl.createDiv({ cls: 'mirror-graph-nodes' });
		this.nodesContainer.style.cssText = `position:absolute;inset:0;transform-origin:center center;transition:transform 0.2s ease;`;

		// 滚轮缩放
		this.canvasEl.addEventListener('wheel', (e: WheelEvent) => {
			e.preventDefault();
			if (e.deltaY < 0) this.zoomIn();
			else this.zoomOut();
		}, { passive: false });

		// 拖拽平移
		this.setupDragPan();

		if (this.isMobile()) {
			this.panelEl = null;
			this.setupMobileZoom();
		} else {
			this.panelEl = container.createDiv({ cls: 'mirror-graph-panel' });
			this.panelEl.style.cssText = `width:0;overflow:hidden;background:${t.bgCard};border-left:1px solid ${t.border};transition:width 0.25s ease;`;
		}

		this.renderNodes(t);
	}

	private setupMobileZoom(): void {
		if (!this.canvasEl) return;
		this.canvasEl.addEventListener('touchstart', (e: TouchEvent) => {
			if (e.touches.length === 2) {
				this.initialDistance = Math.hypot(
					e.touches[0]!.clientX - e.touches[1]!.clientX,
					e.touches[0]!.clientY - e.touches[1]!.clientY,
				);
			}
		}, { passive: true });
		this.canvasEl.addEventListener('touchmove', (e: TouchEvent) => {
			if (e.touches.length === 2) {
				const d = Math.hypot(
					e.touches[0]!.clientX - e.touches[1]!.clientX,
					e.touches[0]!.clientY - e.touches[1]!.clientY,
				);
				if (this.initialDistance > 0 && d > 0) {
					this.scale = Math.max(0.2, Math.min(3, this.scale * (d / this.initialDistance)));
					this.applyTransform();
				}
			}
		}, { passive: true });
		this.canvasEl.addEventListener('touchend', () => { this.initialDistance = 0; }, { passive: true });
	}

	private renderNodes(t: ReturnType<typeof getTheme>): void {
		if (!this.nodesContainer) return;
		this.nodesContainer.empty();

		const people = Object.values(this.data.relationshipMap.people);
		if (people.length === 0) {
			this.nodesContainer.style.cssText = `position:absolute;inset:0;display:flex;align-items:center;justify-content:center;`;
			this.nodesContainer.createDiv({ text: '还没有足够的人际关系数据——继续写日记吧。' })
				.style.cssText = `color:${t.textSecondary};font-size:14px;text-align:center;`;
			return;
		}

		this.zoomReset();

		const sorted = [...people].sort((a, b) => b.totalMentions - a.totalMentions);
		const maxMentions = sorted[0]?.totalMentions || 1;
		const angleStep = (Math.PI * 2) / people.length;

		// 预先存所有坐标用于画连线
		const positions: Array<{ x: number; y: number; color: string; width: number }> = [];
		const cx = 50, cy = 50; // 中心点 "我"

		for (let i = 0; i < sorted.length; i++) {
			const person = sorted[i]!;
			const r = person.emotionalDistance * 150 + 25;
			const angle = i * angleStep;
			const x = cx + r * Math.cos(angle);
			const y = cy + r * Math.sin(angle);
			const color = relationColor(person.emotionalTone, t);
			const width = Math.max(1, 3 - person.emotionalDistance * 2);

			positions.push({ x, y, color, width });
		}

		// 画连线（CSS div 线段，从中心连到每个节点）
		for (const pos of positions) {
			const dx = pos.x - cx;
			const dy = pos.y - cy;
			const len = Math.sqrt(dx * dx + dy * dy);
			const angle = Math.atan2(dy, dx) * (180 / Math.PI);
			const lineW = Math.max(1, pos.width);

			const line = this.nodesContainer.createDiv();
			line.style.cssText = `position:absolute;left:${cx}%;top:${cy}%;width:${len}%;height:${lineW}px;background:${pos.color};opacity:0.35;transform-origin:0 50%;transform:rotate(${angle}deg);pointer-events:none;z-index:0;border-radius:1px;`;
			if (pos.width < 2) {
				line.style.background = `repeating-linear-gradient(90deg, ${pos.color}44 0px, ${pos.color}44 4px, transparent 4px, transparent 8px)`;
			}
		}

		// 画节点
		for (let i = 0; i < sorted.length; i++) {
			const person = sorted[i]!;
			const pos = positions[i]!;
			const size = Math.max(40, Math.min(72, 16 + (person.totalMentions / maxMentions) * 40));
			const color = relationColor(person.emotionalTone, t);

			const node = this.nodesContainer.createDiv({ cls: 'mirror-graph-node' });
			node.style.cssText = `position:absolute;left:${pos.x}%;top:${pos.y}%;width:${size}px;height:${size}px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;color:#fff;font-size:${Math.max(11, size/4)}px;font-weight:600;cursor:pointer;transform:translate(-50%,-50%);box-shadow:0 2px 12px ${color}44;z-index:${Math.round(person.totalMentions) + 10};`;
			node.textContent = person.name.slice(0, 3);
			node.setAttribute('title', `${person.name}\n提及${person.totalMentions}次 · ${EMOTION_LABELS[person.emotionalTone]}`);
			node.onclick = (e) => { e.stopPropagation(); this.showPersonDetail(person); };
			node.onmouseenter = () => { node.style.transition = 'transform 0.2s'; node.style.transform = 'translate(-50%,-50%) scale(1.15)'; };
			node.onmouseleave = () => { node.style.transform = 'translate(-50%,-50%) scale(1)'; };
		}

		// 中心节点 "我"
		const selfNode = this.nodesContainer.createDiv({ cls: 'mirror-graph-self', text: '我' });
		selfNode.style.cssText = `position:absolute;left:${cx}%;top:${cy}%;width:50px;height:50px;border-radius:50%;background:${t.warmOrange};display:flex;align-items:center;justify-content:center;color:#0f0f12;font-size:13px;font-weight:700;transform:translate(-50%,-50%);box-shadow:0 0 20px ${t.warmOrange}44;z-index:200;`;

		if (this.selectedName) {
			const targetPerson = people.find(p => p.name === this.selectedName);
			if (targetPerson) setTimeout(() => this.showPersonDetail(targetPerson), 200);
		}
	}

	private showPersonDetail(person: PersonProfile): void {
		this.selectedName = person.name;
		if (this.isMobile()) {
			this.showMobileDetail(person);
		} else {
			this.showDesktopDetail(person);
		}
	}

	private showDesktopDetail(person: PersonProfile): void {
		const t = getTheme();
		if (!this.panelEl || !this.canvasEl) return;
		this.panelEl.style.width = '320px';
		this.panelEl.style.padding = '20px';
		this.panelEl.style.overflowY = 'auto';
		this.canvasEl.style.flex = '0 1 auto';
		this.canvasEl.style.minWidth = '0';
		this.panelEl.empty();
		this.renderDetailContent(this.panelEl, person, t, () => this.hideDesktopPanel());
	}

	private hideDesktopPanel(): void {
		if (!this.panelEl || !this.canvasEl) return;
		this.selectedName = null;
		this.panelEl.style.width = '0';
		this.panelEl.style.padding = '0';
		this.panelEl.style.overflow = 'hidden';
		this.panelEl.empty();
		this.canvasEl.style.flex = '1';
		this.canvasEl.style.minWidth = '';
	}

	private showMobileDetail(person: PersonProfile): void {
		const container = this.containerEl.children[1] as HTMLElement;
		if (!container) return;
		const t = getTheme();

		const overlay = container.createDiv({ cls: 'mirror-mobile-overlay' });
		overlay.style.cssText = `position:absolute;inset:0;background:rgba(0,0,0,0.6);z-index:200;display:flex;align-items:flex-start;justify-content:center;`;
		overlay.onclick = (e) => {
			if (e.target === overlay) { overlay.remove(); this.selectedName = null; }
		};

		const panel = overlay.createDiv();
		panel.style.cssText = `width:90%;max-height:85%;margin-top:10%;background:${t.bgCard};border-radius:16px;overflow-y:auto;padding:20px;box-shadow:0 8px 40px rgba(0,0,0,0.5);`;
		panel.onclick = (e) => { e.stopPropagation(); };

		this.renderDetailContent(panel, person, t, () => { overlay.remove(); this.selectedName = null; });
	}

	private renderDetailContent(panel: HTMLElement, person: PersonProfile, t: ReturnType<typeof getTheme>, onClose: () => void): void {
		const closeBtn = panel.createEl('button', { text: '✕' });
		closeBtn.style.cssText = `position:absolute;top:12px;right:16px;background:transparent;border:none;color:${t.textMuted};font-size:18px;cursor:pointer;z-index:1;`;
		closeBtn.onclick = onClose;

		const header = panel.createDiv();
		header.style.cssText = `display:flex;align-items:center;gap:12px;margin-bottom:20px;margin-top:8px;padding-right:32px;`;
		const avatar = header.createDiv({ text: person.name[0] });
		avatar.style.cssText = `width:48px;height:48px;border-radius:50%;background:${relationColor(person.emotionalTone, t)};color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:600;flex-shrink:0;`;
		const info = header.createDiv();
		info.style.cssText = `min-width:0;`;
		info.createDiv({ text: person.name }).style.cssText = `font-size:16px;font-weight:600;color:${t.textPrimary};overflow:hidden;text-overflow:ellipsis;`;
		info.createDiv({ text: `提及 ${person.totalMentions} 次 · ${person.lastMention}` }).style.cssText = `font-size:12px;color:${t.textMuted};margin-top:4px;`;

		const toneTag = panel.createDiv({ text: `情感基调: ${EMOTION_LABELS[person.emotionalTone]}` });
		toneTag.style.cssText = `display:inline-block;font-size:12px;color:${relationColor(person.emotionalTone,t)};background:${relationColor(person.emotionalTone,t)}22;padding:4px 10px;border-radius:12px;margin-bottom:16px;`;

		panel.createDiv({ text: '提及时间线' }).style.cssText = `font-size:13px;font-weight:600;margin-bottom:10px;color:${t.textPrimary};`;

		const mentions = [...person.mentions].reverse().slice(0, 15);
		if (mentions.length === 0) {
			panel.createDiv({ text: '暂无提及记录' }).style.cssText = `color:${t.textMuted};font-size:12px;padding:8px 0;`;
		}
		for (const m of mentions) {
			const row = panel.createDiv();
			row.style.cssText = `padding:8px 0;border-bottom:1px solid ${t.border};`;
			row.createDiv({ text: m.date }).style.cssText = `font-size:11px;color:${t.textMuted};margin-bottom:3px;`;
			row.createDiv({ text: m.context }).style.cssText = `font-size:12px;color:${t.textSecondary};line-height:1.5;word-break:break-word;`;
		}

		if (person.totalMentions >= 3) {
			const insight = panel.createDiv();
			insight.style.cssText = `margin-top:16px;padding:12px;background:${t.bgTertiary};border-radius:8px;border-left:3px solid ${t.purple};word-break:break-word;`;
			insight.createDiv({ text: '画像洞察' }).style.cssText = `font-size:11px;color:${t.purple};margin-bottom:4px;`;
			insight.createDiv({ text: `你与${person.name}的连接正在发生变化——ta在你的世界里出现了${person.totalMentions}次。` })
				.style.cssText = `font-size:12px;color:${t.textSecondary};line-height:1.5;`;
		}
	}
}
