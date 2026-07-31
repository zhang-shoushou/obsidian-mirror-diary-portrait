// ============================================================
// 镜像 · 日记画像系统 — 日记解析器
// ============================================================

import { TFile } from 'obsidian';
import type {
	DiaryEntry,
	EmotionWord,
	EmotionCategory,
	SelfDisciplineMention,
} from './types';

// ---- 情绪词库 ----

const EMOTION_DICT: Record<EmotionCategory, string[]> = {
	joy: ['开心', '快乐', '高兴', '兴奋', '欢欣', '喜悦', '愉快', '幸福', '舒心', '畅快', '美好', '满足', '充实', '享受', '期待', '向往', '憧憬', '充满希望'],
	sadness: ['难过', '伤心', '悲伤', '哭泣', '泪', '忧伤', '低落', '沮丧', '消沉', '黯淡', '沉重', '压抑', '心疼', '遗憾', '惋惜', '怀念', '思念', '孤独', '寂寞', '空虚'],
	anger: ['愤怒', '生气', '恼火', '烦躁', '不耐烦', '暴躁', '发火', '怨恨', '不满', '想骂人', '憋屈', '窝火', '气愤', '受不了', '忍无可忍'],
	fear: ['害怕', '恐惧', '担心', '担忧', '焦虑', '紧张', '不安', '忐忑', '恐慌', '畏惧', '退缩', '逃避', '失眠', '噩梦', '心惊'],
	surprise: ['惊讶', '意外', '震惊', '没想到', '居然', '不敢相信', '突然', '奇迹', '出乎意料'],
	disgust: ['厌恶', '反感', '讨厌', '恶心', '嫌弃', '不屑', '鄙夷', '看不惯'],
	calm: ['平静', '安宁', '宁静', '安静', '坦然', '从容', '淡定', '放松', '平和', '安稳', '踏实', '聆听', '感受', '观察', '觉察'],
	anxiety: ['焦虑', '紧张', '不安', '忧虑', '烦躁', '急躁', '坐立不安', '心慌', '着急', '慌乱'],
	hope: ['希望', '期待', '憧憬', '梦想', '相信', '向前看', '会好的', '加油', '努力', '成长', '改变', '尝试', '学习', '进步'],
	disappointment: ['失望', '失落', '灰心', '泄气', '绝望', '放弃', '算了', '无望', '不如意', '不顺'],
	complex: ['矛盾', '纠结', '说不清', '复杂', '又爱又恨', '百感交集', '五味杂陈', '哭笑不得'],
};

// ---- 中文人名：两字或三字，以常见姓氏开头 ----
const SURNAMES = '李王张刘陈杨赵黄周吴徐孙胡朱高林何郭马罗梁宋郑谢韩唐冯于董萧程曹袁邓许傅沈曾彭吕苏卢蒋蔡贾丁魏薛叶阎余潘杜戴夏钟汪田任姜范方石姚谭廖邹熊金陆郝孔白崔康毛邱秦江史顾侯邵孟龙万段雷钱汤尹黎易常武乔贺赖龚文';

// ---- 需过滤的非人名模式 ----
const NON_NAME_PATTERNS = [
	/^(这个|那个|什么|怎么|为什么|一个|可以|应该|已经|因为|所以|但是|虽然|如果|忽然|然后|或者|而且|不过|每天|今天|昨天|明天|现在|当时|以前|以后|开始|继续|可能|一定|觉得|以为|没有|不是|还是|就是|只是|一起|一下|一点|很多|特别|非常|比较)/,
	/^(自己|别人|他们|我们|大家|有人|没人|任何|一些|部分|全部|其他)/,
	/^(工作|时间|东西|事情|问题|关系|感觉|时候|地方|公司|项目|技术|数据|代码|功能|系统|配置|环境|开发|测试|上线|部署)/,
];

// ---- 称呼模式：XX哥/XX姐/XX总/XX老师/XX叔/XX姨 ----
const ADDRESS_PATTERN = /([^\s，。！？\n]{1,3})(哥|姐|总|老师|叔|姨|爷|奶|弟|妹|兄|同学|同事|朋友|前辈|领导|经理)/g;

// ---- 自我规训指令模式 ----
const DISCIPLINE_PATTERNS = [
	// "不要XXX" - 但排除后面跟着技术/工作类术语
	/不要(?:急着|再|总是|一直|轻易|随便|过度|太|这么)[^，。；！？\n]{2,25}/g,
	// "别XXX" - 排除"别人/别名/别称/别急"等
	/别(?:想|说|怕|慌|急)[^，。；！？\n]{2,20}/g,
	// "不能再XXX"
	/不能再[^，。；！？\n]{2,25}/g,
	// "要XXX才行"
	/要[^，。；！？\n]{2,25}才行/g,
	// "提醒自己XXX"
	/提醒自己[^，。；！？\n]{2,30}/g,
	// "该XXX了" - 自我催促
	/该[^，。；！？\n]{2,25}了/g,
	// "要XXX"
	/要(?:学会|记得|注意|坚持|改掉|克制|控制|管理)[^，。；！？\n]{2,20}/g,
	// "不能XXX"
	/不能(?:再|继续|这样|老是)[^，。；！？\n]{2,20}/g,
];

// ---- 解析函数 ----

export function parseDiaryEntry(file: TFile, content: string): DiaryEntry {
	const frontmatter = extractFrontmatter(content);
	const bodyOnly = stripFrontmatter(content);

	const date = extractDate(file, frontmatter);
	const tags = extractTags(frontmatter, bodyOnly);
	const emotionWords = detectEmotions(bodyOnly);
	const mentionedNames = detectNamesImproved(bodyOnly);
	const selfDisciplineInstructions = detectSelfDiscipline(bodyOnly, date);

	return {
		path: file.path,
		filename: file.basename,
		date,
		tags,
		content: bodyOnly,
		frontmatter,
		wordCount: bodyOnly.length,
		emotionWords,
		mentionedNames,
		selfDisciplineInstructions,
	};
}

function extractFrontmatter(content: string): Record<string, unknown> {
	const match = content.match(/^---\n([\s\S]*?)\n---/);
	if (!match) return {};

	const fm: Record<string, unknown> = {};
	const lines = match[1]!.split('\n');
	for (const line of lines) {
		const kv = line.match(/^(\w[\w-]*):\s*(.*)/);
		if (kv) {
			const key = kv[1]!;
			let value: unknown = (kv[2] || '').trim();
			if (value && (value as string).startsWith('[') && (value as string).endsWith(']')) {
				value = (value as string)
					.slice(1, -1)
					.split(',')
					.map((s) => s.trim().replace(/^["']|["']$/g, ''));
			}
			fm[key] = value;
		}
	}
	return fm;
}

function stripFrontmatter(content: string): string {
	return content.replace(/^---\n[\s\S]*?\n---\n?/, '');
}

function extractDate(file: TFile, fm: Record<string, unknown>): string {
	if (fm.date) return String(fm.date);
	if (fm.created) return String(fm.created);

	const nameMatch = file.basename.match(/(\d{4}-\d{2}-\d{2})/);
	if (nameMatch) return nameMatch[1]!;

	const pathMatch = file.path.match(/(\d{4}-\d{2}-\d{2})/);
	if (pathMatch) return pathMatch[1]!;

	const mtime = new Date(file.stat.mtime);
	return `${mtime.getFullYear()}-${String(mtime.getMonth() + 1).padStart(2, '0')}-${String(mtime.getDate()).padStart(2, '0')}`;
}

function extractTags(fm: Record<string, unknown>, body: string): string[] {
	const tags = new Set<string>();

	if (fm.tags) {
		if (Array.isArray(fm.tags)) {
			for (const t of fm.tags) tags.add(String(t));
		} else {
			String(fm.tags).split(/[,\s]+/).forEach((t: string) => { if (t) tags.add(t); });
		}
	}

	const inlineMatches = body.match(/#([\w\u4e00-\u9fff-]+)/g);
	if (inlineMatches) {
		for (const m of inlineMatches) tags.add(m.slice(1));
	}

	return [...tags];
}

function detectEmotions(text: string): EmotionWord[] {
	const results: EmotionWord[] = [];

	for (const [category, words] of Object.entries(EMOTION_DICT)) {
		for (const word of words) {
			const count = (text.match(new RegExp(word, 'g')) || []).length;
			if (count > 0) {
				results.push({
					word,
					category: category as EmotionCategory,
					confidence: Math.min(count * 0.3, 1.0),
				});
			}
		}
	}

	return results.sort((a, b) => b.confidence - a.confidence);
}

// ---- 改进版人名识别 ----
function detectNamesImproved(text: string): string[] {
	const names = new Set<string>();

	// 方式1：称呼模式（XX哥/XX姐等）
	const addressMatches = text.matchAll(ADDRESS_PATTERN);
	for (const m of addressMatches) {
		const fullMatch = m[0]; // e.g. "代哥"
		if (fullMatch.length >= 2 && fullMatch.length <= 5) {
			names.add(fullMatch);
		}
	}

	// 方式2：常见姓氏 + 1-2字的双字/三字人名
	// 匹配形如"王莽""董贤""孔光"这样的两字/三字中国式人名
	const namePattern = new RegExp(`[${SURNAMES}][\\u4e00-\\u9fff]{1,2}`, 'g');
	const surnameMatches = text.match(namePattern);
	if (surnameMatches) {
		for (const m of surnameMatches) {
			// 过滤
			if (m.length < 2) continue;
			if (isNonName(m)) continue;
			names.add(m);
		}
	}

	// 方式3：在邻近上下文中找姓名（如"跟XXX聊""和XXX说""XXX告诉我"）
	const contextPatterns = [
		/[和跟与同找约见了][^\s，。！？\n]{1,4}(?:聊|说|谈|见|吃|玩|去|看|帮忙|打电话|发消息|视频)/g,
	];
	for (const pattern of contextPatterns) {
		const contextMatches = text.matchAll(pattern);
		for (const m of contextMatches) {
			const full = m[0];
			if (full.length >= 3 && full.length <= 6) {
				const possibleName = full.slice(1, -1);
				// 检查是否像人名
				if (possibleName.length >= 2 && possibleName.length <= 3) {
					if (!isNonName(possibleName)) {
						names.add(possibleName);
					}
				}
			}
		}
	}

	// 限制数量
	return [...names].slice(0, 40);
}

function isNonName(text: string): boolean {
	for (const pattern of NON_NAME_PATTERNS) {
		if (pattern.test(text)) return true;
	}

	// 排除纯数字/纯英文/纯标点
	if (/^[\d\w_\s.@#$%&*()+\-=[\]{};:'"\\|,.<>/?]+$/.test(text)) return true;

	// 排除常见非人名词汇
	const commonWords = [
		'可以', '应该', '需要', '可能', '不过', '因为', '所以', '但是', '虽然',
		'如果', '然后', '之后', '之前', '之后', '现在', '以前', '以后',
		'开始', '结束', '继续', '进行', '完成', '结果', '过程', '情况',
		'问题', '方法', '方式', '方向', '方面', '部分', '全部', '其他',
		'时间', '时候', '地方', '东西', '事情', '感觉', '觉得',
		'工作', '公司', '项目', '技术', '数据', '代码', '功能', '系统',
		'了解', '知道', '明白', '理解', '认识', '发现', '看到', '听到',
		'今天', '明天', '昨天', '每天', '早上', '晚上', '下午', '上午',
		'一个', '这个', '那个', '什么', '怎么', '为什么',
	];
	if (commonWords.includes(text)) return true;

	return false;
}

// ---- 改进版自我规训检测 ----
function detectSelfDiscipline(text: string, date: string): SelfDisciplineMention[] {
	const results: SelfDisciplineMention[] = [];
	const seen = new Set<string>();

	for (const pattern of DISCIPLINE_PATTERNS) {
		const matches = text.match(pattern);
		if (matches) {
			for (const m of matches) {
				const trimmed = m.trim();

				// 去重
				if (seen.has(trimmed)) continue;
				seen.add(trimmed);

				// 过滤：只保留看起来像自我规训的
				if (!isDisciplineLike(trimmed)) continue;

				const idx = text.indexOf(m);
				const contextStart = Math.max(0, idx - 30);
				const contextEnd = Math.min(text.length, idx + m.length + 30);
				const context = text.slice(contextStart, contextEnd).replace(/\n/g, ' ');

				results.push({
					instruction: trimmed,
					date,
					context,
				});
			}
		}
	}

	return results;
}

function isDisciplineLike(text: string): boolean {
	// 过滤明显的非规训内容
	const noisePatterns = [
		/别名/, /别人/, /别称/, /别急/,     // "别"开头的常见非规训
		/别忘了/,                              // 这其实是提醒不是规训
		/不要问/, /不要说/,                     // 对话中的引用
		/不能再等/,                             // 日常表达
		/[A-Za-z]/,                            // 包含英文很可能是技术术语
		/[|/]/,                                // 包含管道符等很可能是代码/配置
		/映射/, /识别/, /文件/, /数据/,        // 技术术语
		/文档/, /配置/, /功能/, /接口/,
		/别名/, /分类/, /类型/, /level/,
	];

	for (const p of noisePatterns) {
		if (p.test(text)) return false;
	}

	// 必须包含常见的自我规训关键词之一
	const positivePatterns = [
		/不要/, /要[学会记得注意坚持改掉克制控制管理]/, /不能再/,
		/提醒自己/, /该[^不]+了/,
	];

	for (const p of positivePatterns) {
		if (p.test(text)) return true;
	}

	return false;
}

// ---- 工具函数 ----

export function getWeekLabel(dateStr: string): string {
	const d = new Date(dateStr);
	if (isNaN(d.getTime())) return '1970-W01';
	const startOfYear = new Date(d.getFullYear(), 0, 1);
	const weekNum = Math.ceil(
		((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7,
	);
	return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

export function formatDate(dateStr: string): string {
	const d = new Date(dateStr);
	if (isNaN(d.getTime())) return dateStr;
	return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}
