// 镜像 · 日记画像系统 — 与画像对话视图（DeepSeek 驱动）

import { ItemView, WorkspaceLeaf, requestUrl } from 'obsidian';
import type MirrorPlugin from '../main';
import type { PluginData, InsightQuestion } from '../types';
import { EMOTION_LABELS } from '../types';
import { getTheme } from '../theme';

export const CHAT_VIEW_TYPE = 'mirror-insight-chat';

interface ChatMessage {
	role: 'system' | 'user' | 'insight' | 'assistant';
	content: string;
	timestamp: string;
	hasCorrectBtn?: boolean;
}

export class InsightChatView extends ItemView {
	data: PluginData;
	private plugin: MirrorPlugin;
	private messages: ChatMessage[] = [];
	private initialQuestion: InsightQuestion | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: MirrorPlugin, data: PluginData) {
		super(leaf);
		this.plugin = plugin;
		this.data = data;
	}

	getViewType(): string { return CHAT_VIEW_TYPE; }
	getDisplayText(): string { return '与画像对话'; }
	getIcon(): string { return 'message-circle'; }

	updateData(data: PluginData): void { this.data = data; }

	setInitialQuestion(q: InsightQuestion): void {
		this.initialQuestion = q;
		this.messages = [];
		if (q) {
			this.messages.push({
				role: 'insight', content: `${q.pattern}\n\n${q.question}`,
				timestamp: q.createdAt, hasCorrectBtn: true,
			});
		}
		this.render();
	}

	async onOpen(): Promise<void> { this.render(); }

	private render(): void {
		const container = this.containerEl.children[1] as HTMLElement;
		if (!container) return;
		const t = getTheme();
		container.empty();
		container.style.cssText = `display:flex;flex-direction:column;height:100%;background:${t.bgPrimary};`;

		const messagesEl = container.createDiv({ cls: 'mirror-chat-messages' });
		messagesEl.style.cssText = `flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:12px;`;

		for (const msg of this.messages) this.renderMessage(messagesEl, msg, t);

		if (this.messages.length === 0) {
			const welcome = messagesEl.createDiv();
			welcome.style.cssText = `text-align:center;padding:40px 0;`;
			const apiOk = this.plugin.settings.deepseekApiKey.length > 0;
			welcome.createDiv({ text: apiOk ? '问画像任何关于你自己日记的问题...' : '请在插件设置中填入 DeepSeek API Key' })
				.style.cssText = `color:${t.textSecondary};font-size:14px;margin-bottom:16px;`;
			if (!apiOk) {
				const configBtn = welcome.createEl('button', { text: '去设置' });
				configBtn.style.cssText = `background:${t.warmOrange};color:#fff;border:none;padding:8px 20px;border-radius:6px;cursor:pointer;font-size:13px;`;
			}
		}

		const inputArea = container.createDiv({ cls: 'mirror-chat-input' });
		inputArea.style.cssText = `padding:16px 20px;border-top:1px solid ${t.border};background:${t.bgCard};`;

		const hints = inputArea.createDiv();
		hints.style.cssText = `display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;`;
		for (const hint of ['我最近是不是对谁特别冷淡？','我是从什么时候开始不失眠的？','帮我回顾一下这一个月的成长']) {
			const hintBtn = hints.createEl('button', { text: hint });
			hintBtn.style.cssText = `font-size:11px;padding:4px 10px;border-radius:12px;border:1px solid ${t.border};background:transparent;color:${t.textSecondary};cursor:pointer;`;
			hintBtn.onclick = () => this.askQuestion(hint);
		}

		const inputRow = inputArea.createDiv();
		inputRow.style.cssText = `display:flex;gap:8px;`;
		const input = inputRow.createEl('input', { attr: { placeholder: '问我关于你自己的任何事...' } });
		input.style.cssText = `flex:1;padding:8px 14px;border-radius:8px;border:1px solid ${t.border};background:${t.bgTertiary};color:${t.textPrimary};font-size:13px;outline:none;`;
		const sendBtn = inputRow.createEl('button', { text: '发送' });
		sendBtn.style.cssText = `padding:8px 16px;border-radius:8px;border:none;background:${t.warmOrange};color:#fff;font-size:13px;font-weight:600;cursor:pointer;`;
		sendBtn.onclick = () => { const q = input.value.trim(); if (q) { this.askQuestion(q); input.value = ''; } };
		input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && input.value.trim()) { this.askQuestion(input.value.trim()); input.value = ''; } });
	}

	private askQuestion(question: string): void {
		const apiKey = this.plugin.settings.deepseekApiKey;
		if (!apiKey) {
			this.messages.push({ role: 'system', content: '请先在插件设置中填入 DeepSeek API Key。', timestamp: new Date().toISOString() });
			this.render(); return;
		}
		this.messages.push({ role: 'user', content: question, timestamp: new Date().toISOString() });
		const idx = this.messages.length;
		this.messages.push({ role: 'assistant', content: '思考中...', timestamp: new Date().toISOString() });
		this.render(); this.scrollToBottom();

		this.callDeepSeek(apiKey, this.buildSystemPrompt(), this.buildChatHistory(), question)
			.then(answer => {
				this.messages[idx] = { role: 'assistant', content: answer, timestamp: new Date().toISOString(), hasCorrectBtn: true };
				this.render(); this.scrollToBottom();
			})
			.catch(err => {
				this.messages[idx] = { role: 'system', content: `调用失败：${err.message || '网络错误'}`, timestamp: new Date().toISOString() };
				this.render();
			});
	}

	private buildSystemPrompt(): string {
		const entries = this.data.emotionalTimeline.entries;
		const people = Object.values(this.data.relationshipMap.people);
		const disciplines = this.data.selfDisciplineItems;
		const patterns = this.data.patterns;
		const questions = this.data.insightQuestions.filter(q => !q.acknowledged);
		const topPeople = people.sort((a,b)=>b.totalMentions-a.totalMentions).slice(0,5)
			.map(p=>`${p.name}(${p.totalMentions}次, ${EMOTION_LABELS[p.emotionalTone]||p.emotionalTone})`).join('; ');
		const disciplineSummary = disciplines.map(d=>`"${d.instruction}" (${d.status==='persisting'?'坚持中':d.status==='repeated_unexecuted'?'反复未执行':'已内化'})`).join('; ');
		const patternSummary = patterns.map(p=>p.title).join('; ');
		const recentDiaries = entries.slice(-5).map(e=>`${e.date}: ${e.diaryExcerpt.slice(0,100)}`).join('\n');
		const corrections = this.data.corrections.slice(-5).map(c =>
			`推断: "${c.originalInference.slice(0,50)}..." → 纠正: "${c.userCorrection.slice(0,50)}..."`
		).join('\n');

		return `你是"镜像"，一个温柔、有洞察力的日记画像系统。你的角色不是输出冷冰冰的结论，而是温柔地揭示用户日记中的模式，邀请用户参与解读自己的内心世界。

你的风格：说话像深夜书桌旁的朋友，温柔而克制；不给出绝对判断，用提问引导你自己思考；引用你日记中的具体细节；回答简洁（2-5句话优先）；用中文回答。绝对不要用第三人称（他/她/用户/ta），这是你和日记主人的直接对话。

=== 用户日记画像 ===
总日记数：${entries.length}篇
重要人际关系：${topPeople||'暂无'}
自我规训：${disciplineSummary||'暂无'}
行为模式：${patternSummary||'暂无'}
未回答的洞察：${questions.map(q=>q.question).join('\n')||'无'}

=== 用户历史纠正（请参考，不要重复被纠正过的推断） ===
${corrections||'暂无'}

最近5篇日记摘要：
${recentDiaries}`;
	}

	private buildChatHistory(): Array<{ role: string; content: string }> {
		return this.messages.filter(m=>m.role==='user'||m.role==='assistant'||m.role==='insight')
			.slice(-10).map(m=>({role:m.role==='insight'?'assistant':m.role,content:m.content}));
	}

	private async callDeepSeek(apiKey:string,systemPrompt:string,history:Array<{role:string;content:string}>,userQuestion:string):Promise<string>{
		const messages=[{role:'system',content:systemPrompt},...history,{role:'user',content:userQuestion}];
		const response=await requestUrl({url:'https://api.deepseek.com/v1/chat/completions',method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},body:JSON.stringify({model:'deepseek-chat',messages,temperature:0.7,max_tokens:2000})});
		const data=response.json as {choices:Array<{message:{content:string}}>};
		if(!data.choices||data.choices.length===0)throw new Error('API 返回为空');
		return data.choices[0]!.message.content;
	}

	private scrollToBottom():void{setTimeout(()=>{const msgs=this.containerEl.querySelector('.mirror-chat-messages');if(msgs)msgs.scrollTop=msgs.scrollHeight;},100);}

	private renderMessage(parent:HTMLElement,msg:ChatMessage,t:ReturnType<typeof getTheme>):void{
		const row=parent.createDiv();
		const isUser=msg.role==='user';
		row.style.cssText=`display:flex;flex-direction:${isUser?'row-reverse':'row'};align-items:flex-start;gap:10px;`;
		const avatarBg=isUser?t.warmOrange:msg.role==='insight'?t.purple:t.bgTertiary;
		const avatar=row.createDiv();
		avatar.style.cssText=`width:32px;height:32px;border-radius:50%;background:${avatarBg};color:${isUser?'#fff':t.textPrimary};display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;`;
		avatar.textContent=isUser?'我':'◈';
		const bubbleBg=isUser?t.warmOrange:msg.role==='insight'?t.bgTertiary:t.bgCard;
		const bubble=row.createDiv();
		bubble.style.cssText=`max-width:70%;padding:12px 16px;border-radius:12px;background:${bubbleBg};color:${isUser?'#fff':t.textPrimary};font-size:13px;line-height:1.6;white-space:pre-wrap;`;
		if(msg.role==='insight'){const tag=bubble.createDiv({text:'主动提问'});tag.style.cssText=`font-size:10px;color:${t.purple};margin-bottom:4px;`;}
		else if(msg.role==='assistant'&&msg.content==='思考中...'){bubble.createDiv({text:'◈ 思考中...'}).style.cssText=`color:${t.warmOrange};animation:mirror-pulse 1.5s infinite;`;return;}
		bubble.createDiv({text:msg.content});
		if(msg.hasCorrectBtn){
			const actions=bubble.createDiv();
			actions.style.cssText=`margin-top:8px;display:flex;gap:6px;`;
			const correctBtn=actions.createEl('button',{text:'不对'});
			correctBtn.style.cssText=`font-size:10px;padding:2px 8px;border-radius:4px;border:1px solid ${t.border};background:transparent;color:${t.textMuted};cursor:pointer;`;
			correctBtn.onclick=()=>{
				const wsAny3=this.app.workspace as unknown as {trigger:(name:string,...args:unknown[])=>void};
				wsAny3.trigger('mirror:open-correction',{original:msg.content,dimension:'chat'});
			};
		}
	}
}
