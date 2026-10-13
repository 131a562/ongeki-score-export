(async () => {
const NET = "https://ongeki-net.com/ongeki-mobile";
const CONST_URL = "https://reiwa.f5.si/ongeki_record.json";
const DIFFS = [
{ id: 2, name: "EXPERT", key: "EXP" },
{ id: 3, name: "MASTER", key: "MAS" },
{ id: 10, name: "LUNATIC", key: "LUN" },
];
const RANKS = [
["SSS+", 1007500], ["SSS", 1000000], ["SS", 990000], ["S", 970000],
["AAA", 940000], ["AA", 900000], ["A", 850000], ["BBB", 800000],
["BB", 750000], ["B", 700000], ["C", 500000], ["D", 0],
];
const LAMPS = ["AB+", "AB", "FC", "CLEAR", "未游玩"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const num = (s) => +String(s || "").replace(/[,%\s]/g, "") || 0;
const norm = (s) => String(s).normalize("NFKC").replace(/\s+/g, " ").trim();
const floor3 = (x) => Math.floor(x * 1000 + 1e-6) / 1000;
if (location.hostname !== "ongeki-net.com") {
alert("请在登录后的オンゲキ-NET（ongeki-net.com）页面上执行。");
return;
}
const panel = document.createElement("div");
panel.style.cssText =
"position:fixed;inset:0;z-index:99999;background:#fff;color:#222;overflow:auto;" +
"padding:10px;font:13px/1.5 sans-serif;-webkit-text-size-adjust:100%;box-sizing:border-box";
document.body.appendChild(panel);
const log = (msg) => {
const p = document.createElement("div");
p.textContent = msg;
panel.appendChild(p);
};
const rankOf = (ts) => RANKS.find(([, b]) => ts >= b)[0];
function tsRating(c, s) {
const ts = s.technical_score;
let base;
if (ts >= 1010000) base = c + 2.0;
else if (ts >= 1007500) base = c + 1.75 + (ts - 1007500) / 10000;
else if (ts >= 1000000) base = c + 1.25 + (ts - 1000000) / 15000;
else if (ts >= 990000) base = c + 0.75 + (ts - 990000) / 20000;
else if (ts >= 970000) base = c + ((ts - 970000) * 0.75) / 20000;
else if (ts >= 900000) base = c - 4 + (ts - 900000) / 17500;
else if (ts >= 800000) base = c - 6 + (ts - 800000) / 50000;
else if (ts >= 500000) base = ((c - 6) * (ts - 500000)) / 300000;
else base = 0;
base = Math.max(0, floor3(base));
const rankBonus = ts >= 1007500 ? 0.3 : ts >= 1000000 ? 0.2 : ts >= 990000 ? 0.1 : 0;
const lampBonus = { "AB+": 0.35, AB: 0.3, FC: 0.1 }[s.lamp] || 0;
return floor3(base + rankBonus + lampBonus + (s.full_bell ? 0.05 : 0));
}
const psRating = (c, star) => floor3((Math.min(star, 5) * c * c) / 1000);
function parseDifficulty(doc, diff) {
const container = doc.querySelector(".container3") || doc.body;
if (!container) return [];
const songs = [];
let genre = "";
for (const el of container.querySelectorAll("div")) {
if (el.classList.contains("p_5") && el.classList.contains("f_20")) {
genre = el.textContent.trim();
} else if (el.classList.contains("basic_btn")) {
const title = el.querySelector(".music_label")?.textContent.trim() || "";
if (!title) continue;
const v = el.querySelectorAll(".score_value");
const has = (img) => !!el.querySelector(`img[src*='${img}']`);
const ts = num(v[2]?.textContent);
const abPlus = has("music_icon_abplus.png");
const ab = abPlus || has("music_icon_ab.png");
const fc = ab || has("music_icon_fc.png");
const played = v.length > 0 && (ts > 0 || num(v[1]?.textContent) > 0);
songs.push({
difficulty: diff.name,
diffKey: diff.key,
genre,
title,
idx: el.querySelector("[name=idx]")?.value || "",
level: el.querySelector(".score_level")?.textContent.trim() || "",
played,
technical_score: ts,
rank: played ? rankOf(ts) : "",
battle_score: num(v[1]?.textContent),
over_damage: num(v[0]?.textContent),
lamp: !played ? "未游玩" : abPlus ? "AB+" : ab ? "AB" : fc ? "FC" : "CLEAR",
full_bell: has("music_icon_fb.png"),
platinum_score: num(
el.querySelector(".platinum_high_score_text_block")?.textContent.split("/")[0]
),
platinum_star: num(
el.querySelector(".platinum_high_score_star_block .f_b")?.textContent
),
});
}
}
return songs;
}
log("正在读取谱面定数表 ...");
let constData = [];
try {
constData = await (await fetch(CONST_URL)).json();
log(`✓ 定数表：${constData.length} 个谱面`);
} catch (e) {
log(`× 定数表读取失败（${e}），将不显示定数与 rating。`);
}
const constIndex = new Map();
for (const m of constData) {
const k = norm(m.title) + "|" + m.diff;
if (!constIndex.has(k)) constIndex.set(k, []);
constIndex.get(k).push(m);
}
const latestVersion = constData.reduce(
(a, m) => (m.release_unix > a.t && m.version ? { t: m.release_unix, v: m.version } : a),
{ t: 0, v: "" }
).v;
async function findConst(s) {
let c = constIndex.get(norm(s.title) + "|" + s.diffKey) || [];
if (c.length > 1) {
const byGenre = c.filter((m) => norm(m.genre) === norm(s.genre));
if (byGenre.length) c = byGenre;
}
if (c.length > 1) {
const lv = parseFloat(s.level);
const plus = s.level.endsWith("+");
const byLevel = c.filter((m) => Math.floor(m.level) === lv && (m.level % 1 >= 0.5) === plus);
if (byLevel.length) c = byLevel;
}
if (c.length > 1 && s.idx) {
try {
const html = await (await fetch(`${NET}/record/musicDetail/?idx=${encodeURIComponent(s.idx)}`, { credentials: "include" })).text();
const doc = new DOMParser().parseFromString(html, "text/html");
const artist = norm((doc.querySelector("div.m_5.f_13.break")?.textContent || "").trim().split("\n")[0]);
const byArtist = c.filter((m) => artist && norm(m.artist) === artist);
if (byArtist.length) c = byArtist;
await sleep(500);
} catch (e) {}
}
if (c.length > 1) c = c.filter((m) => m.const > 0).concat(c.filter((m) => !(m.const > 0)));
return c[0];
}
const getDoc = async (url) => {
const res = await fetch(url, { credentials: "include" });
const doc = new DOMParser().parseFromString(await res.text(), "text/html");
return { res, doc };
};
const diagnose = ({ res, doc }) => {
const text = (doc.querySelector(".container3") || doc.body)?.textContent.replace(/\s+/g, " ").trim().slice(0, 200) || "";
return `URL=${res.url.replace(NET, "")} / HTTP ${res.status} / title=${doc.title} / container3=${!!doc.querySelector(".container3")} / basic_btn=${doc.querySelectorAll(".basic_btn").length} / 内容: ${text}`;
};
const diagnostics = [];
const fetchSongs = async (genre, diff) => {
const page = await getDoc(`${NET}/record/musicGenre/search/?genre=${genre}&diff=${diff.id}`);
const songs = parseDifficulty(page.doc, diff);
if (!songs.length) diagnostics.push(`[genre=${genre} ${diff.name}] ${diagnose(page)}`);
return songs;
};
const all = [];
let genres = null; // 「全部类型」读不到时，改成逐个类型读取
for (const diff of DIFFS) {
log(`正在获取 ${diff.name} ...`);
let songs = genres ? [] : await fetchSongs(99, diff);
if (!songs.length) {
if (!genres) {
const top = await getDoc(`${NET}/record/musicGenre/`);
const found = new Set();
top.doc.querySelectorAll("select[name=genre] option, input[name=genre]").forEach((o) => o.value && found.add(o.value));
top.doc.querySelectorAll("a[href*='genre=']").forEach((a) => {
const m = a.getAttribute("href").match(/genre=(\d+)/);
if (m) found.add(m[1]);
});
found.delete("99");
genres = [...found];
log(`「全部类型」没有读到成绩，改为逐个类型读取（找到 ${genres.length} 个类型）`);
if (!genres.length) diagnostics.push(`[类型列表] ${diagnose(top)}`);
}
for (const g of genres) {
await sleep(700);
songs.push(...(await fetchSongs(g, diff)));
}
}
log(`${songs.length ? "✓" : "×"} ${diff.name}：${songs.length} 个谱面`);
all.push(...songs);
await sleep(1000); // 别给服务器太大压力
}
if (!all.length) {
log("没有取到任何数据。可能是：未登录、处于维护时间（4:00–7:00）、当前账号无法查看成绩页，或页面结构不同。");
log("请把下面的诊断信息截图或复制发给开发者：");
const pre = document.createElement("textarea");
pre.readOnly = true;
pre.style.cssText = "width:100%;height:240px;font:12px monospace;box-sizing:border-box";
pre.value = [`location=${location.href}`, `UA=${navigator.userAgent}`, ...diagnostics.slice(0, 8)].join("\n\n");
panel.appendChild(pre);
const close = document.createElement("button");
close.textContent = "关闭";
close.style.cssText = "margin-top:8px;padding:8px 12px;font-size:14px";
close.onclick = () => panel.remove();
panel.appendChild(close);
return;
}
for (const s of all) {
const m = await findConst(s);
s.const = m && m.const > 0 ? m.const : null;
s.const_unknown = !m ? "无数据" : m.is_unknown ? "未确定" : "";
s.version = m?.version || "";
s.is_new = !!m && !!latestVersion && m.version === latestVersion;
s.is_bonus = !!m?.is_bonus;
s.rating = s.played && s.const ? tsRating(s.const, s) : 0;
s.ps_rating = s.const ? psRating(s.const, s.platinum_star) : 0;
s.frame = "";
delete s.diffKey;
delete s.idx;
}
const eligible = all.filter((s) => s.const && !s.is_bonus);
const byRating = (a, b) => b.rating - a.rating;
const new10 = eligible.filter((s) => s.is_new && s.rating > 0).sort(byRating).slice(0, 10);
const best50 = eligible.filter((s) => !s.is_new && s.rating > 0).sort(byRating).slice(0, 50);
const ps50 = eligible.filter((s) => s.ps_rating > 0).sort((a, b) => b.ps_rating - a.ps_rating).slice(0, 50);
new10.forEach((s, i) => (s.frame = `新曲${i + 1}`));
best50.forEach((s, i) => (s.frame = `B${i + 1}`));
ps50.forEach((s, i) => (s.frame += (s.frame ? " / " : "") + `P${i + 1}`));
const sum = (arr, k) => arr.reduce((a, s) => a + s[k], 0);
const ratingInfo = {
new10: sum(new10, "rating"),
best50: sum(best50, "rating"),
ps50: sum(ps50, "ps_rating"),
};
ratingInfo.total = (ratingInfo.new10 + ratingInfo.best50 + ratingInfo.ps50) / 50;
const levelKey = (lv) => parseFloat(lv) + (lv.endsWith("+") ? 0.5 : 0);
const levels = [...new Set(all.map((s) => s.level).filter(Boolean))]
.sort((a, b) => levelKey(b) - levelKey(a));
const summary = levels.map((lv) => {
const list = all.filter((s) => s.level === lv);
const played = list.filter((s) => s.played);
const row = {
level: lv,
total: list.length,
played: played.length,
"played%": ((played.length / list.length) * 100).toFixed(1),
};
for (const [r] of RANKS) row[r] = played.filter((s) => s.rank === r).length;
for (const l of LAMPS.slice(0, 3)) row[l] = played.filter((s) => s.lamp === l).length;
row.FB = played.filter((s) => s.full_bell).length;
row.avg_ts = played.length
? Math.round(played.reduce((a, s) => a + s.technical_score, 0) / played.length)
: 0;
return row;
});
const IMG = { W: 1080, PAD: 24, COLS: 3, GAP: 12, CH: 168, HEAD: 210, SEC: 64, MAX_CARDS: 150 };
IMG.CW = (IMG.W - IMG.PAD * 2 - IMG.GAP * (IMG.COLS - 1)) / IMG.COLS;
const FONT = `"Hiragino Sans","Hiragino Kaku Gothic ProN","PingFang SC","Noto Sans CJK JP","Microsoft YaHei",sans-serif`;
const C = {
bg: "#17161d", card: "#26242f", line: "#3a3745", fg: "#f3f1f8", muted: "#9d99ab", accent: "#ff5aa8",
EXPERT: "#e5484d", MASTER: "#9a5cf0", LUNATIC: "#d9d6e3",
"SSS+": "#ffd36b", SSS: "#ffc94a", SS: "#f0b43c", S: "#e3a53a",
"AB+": "#ff7ab8", AB: "#ffb347", FC: "#4fc3f7", FB: "#ffe066",
};
const DIFF_SHORT = { EXPERT: "EXP", MASTER: "MAS", LUNATIC: "LUN" };
function rrect(ctx, x, y, w, h, r) {
ctx.beginPath();
ctx.moveTo(x + r, y);
ctx.arcTo(x + w, y, x + w, y + h, r);
ctx.arcTo(x + w, y + h, x, y + h, r);
ctx.arcTo(x, y + h, x, y, r);
ctx.arcTo(x, y, x + w, y, r);
ctx.closePath();
}
function fit(ctx, text, maxW) {
if (ctx.measureText(text).width <= maxW) return text;
let t = text;
while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
return t + "…";
}
function pill(ctx, text, x, y, color, font = `700 20px ${FONT}`) {
ctx.font = font;
const w = ctx.measureText(text).width + 18;
rrect(ctx, x, y - 22, w, 30, 8);
ctx.fillStyle = color;
ctx.fill();
ctx.fillStyle = "#17161d";
ctx.fillText(text, x + 9, y);
return w;
}
function drawCard(ctx, s, label, x, y) {
const { CW, CH } = IMG;
rrect(ctx, x, y, CW, CH, 14);
ctx.fillStyle = C.card;
ctx.fill();
ctx.save();
ctx.clip();
ctx.fillStyle = C[s.difficulty] || C.muted;
ctx.fillRect(x, y, 8, CH);
ctx.restore();
const L = x + 24, R = x + CW - 16;
ctx.textBaseline = "alphabetic";
ctx.textAlign = "left";
ctx.font = `600 20px ${FONT}`;
ctx.fillStyle = C.muted;
ctx.fillText(label, L, y + 34);
ctx.font = `700 20px ${FONT}`;
const constText = `${DIFF_SHORT[s.difficulty] || ""} ${s.const != null ? s.const.toFixed(1) : s.level}${s.const_unknown ? "?" : ""}`;
const cw = ctx.measureText(constText).width + 18;
pill(ctx, constText, R - cw, y + 34, C[s.difficulty] || C.muted);
ctx.font = `700 28px ${FONT}`;
ctx.fillStyle = C.fg;
ctx.fillText(fit(ctx, s.title, CW - 40), L, y + 76);
if (s.played) {
ctx.font = `600 26px ${FONT}`;
ctx.fillStyle = C.fg;
const ts = s.technical_score.toLocaleString("en-US");
ctx.fillText(ts, L, y + 114);
const tw = ctx.measureText(ts).width;
ctx.font = `800 24px ${FONT}`;
ctx.fillStyle = C[s.rank] || C.muted;
ctx.fillText(s.rank, L + tw + 12, y + 114);
} else {
ctx.font = `600 24px ${FONT}`;
ctx.fillStyle = C.muted;
ctx.fillText("未游玩", L, y + 114);
}
let px = L;
if (s.played && C[s.lamp]) px += pill(ctx, s.lamp, px, y + 152, C[s.lamp]) + 8;
if (s.full_bell) pill(ctx, "FB", px, y + 152, C.FB);
ctx.textAlign = "right";
ctx.font = `800 34px ${FONT}`;
ctx.fillStyle = s.rating > 0 ? C.accent : C.muted;
ctx.fillText(s.rating > 0 ? s.rating.toFixed(3) : "—", R, y + 154);
ctx.textAlign = "left";
}
function drawImage(title, lines, sections) {
const { W, PAD, COLS, GAP, CH, HEAD, SEC, CW } = IMG;
const rowsOf = (n) => Math.ceil(n / COLS);
const H = HEAD + sections.reduce((h, sec) => h + SEC + rowsOf(sec.rows.length) * (CH + GAP), 0) + PAD + 36;
const cv = document.createElement("canvas");
cv.width = W;
cv.height = H;
const ctx = cv.getContext("2d");
ctx.fillStyle = C.bg;
ctx.fillRect(0, 0, W, H);
ctx.fillStyle = C.accent;
ctx.font = `800 22px ${FONT}`;
ctx.fillText("O.N.G.E.K.I. Re:Fresh", PAD, 48);
ctx.fillStyle = C.fg;
ctx.font = `800 56px ${FONT}`;
ctx.fillText(title, PAD, 116);
ctx.font = `500 24px ${FONT}`;
ctx.fillStyle = C.muted;
lines.forEach((t, i) => ctx.fillText(fit(ctx, t, W - PAD * 2), PAD, 156 + i * 32));
let y = HEAD;
for (const sec of sections) {
ctx.fillStyle = C.line;
ctx.fillRect(PAD, y + 8, W - PAD * 2, 2);
ctx.fillStyle = C.fg;
ctx.font = `800 28px ${FONT}`;
ctx.fillText(sec.name, PAD, y + 48);
if (sec.note) {
const nw = ctx.measureText(sec.name).width;
ctx.font = `500 22px ${FONT}`;
ctx.fillStyle = C.muted;
ctx.fillText(sec.note, PAD + nw + 16, y + 48);
}
y += SEC;
sec.rows.forEach((s, i) => {
drawCard(ctx, s, sec.label(s, i), PAD + (i % COLS) * (CW + GAP), y + Math.floor(i / COLS) * (CH + GAP));
});
y += rowsOf(sec.rows.length) * (CH + GAP);
}
ctx.font = `500 20px ${FONT}`;
ctx.fillStyle = C.muted;
ctx.fillText(`${new Date().toLocaleString("ja-JP")} · 定数来自第三方定数表，"?" 为未确定定数 · 仅 EXP/MAS/LUN 估算`, PAD, H - 24);
return cv.toDataURL("image/png");
}
const stamp = new Date().toISOString().slice(0, 10);
const b50Image = () =>
drawImage(
`Rating ${ratingInfo.total.toFixed(3)}`,
[
`新曲枠 ${new10.length}曲 合计 ${ratingInfo.new10.toFixed(3)}  ·  ベスト枠 ${best50.length}曲 合计 ${ratingInfo.best50.toFixed(3)}（平均 ${(best50.length ? ratingInfo.best50 / best50.length : 0).toFixed(3)}）`,
`P-SCORE枠 ${ps50.length}曲 合计 ${ratingInfo.ps50.toFixed(3)}  ·  估算值，与游戏内会有少许出入`,
],
[
{ name: "新曲枠", note: `${latestVersion} · 合计 ${ratingInfo.new10.toFixed(3)}`, rows: new10, label: (s, i) => `#${i + 1}` },
{ name: "ベスト枠", note: `合计 ${ratingInfo.best50.toFixed(3)}`, rows: best50, label: (s, i) => `#${i + 1}` },
]
);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const csvCell = (s) => (/[",\n]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s));
const toCsv = (rows, keys = Object.keys(rows[0])) =>
"﻿" + [keys, ...rows.map((r) => keys.map((k) => r[k] ?? ""))]
.map((r) => r.map(csvCell).join(",")).join("\r\n");
const saveUrl = (name, url) => {
const a = document.createElement("a");
a.href = url;
a.download = name;
document.body.appendChild(a);
a.click();
a.remove();
};
const download = (name, text, type) => saveUrl(name, URL.createObjectURL(new Blob([text], { type })));
const songKeys = ["frame", "const", "level", "difficulty", "title", "genre", "technical_score", "rank", "lamp", "full_bell", "rating", "platinum_star", "ps_rating", "version", "const_unknown", "battle_score", "over_damage", "platinum_score"];
const compactKeys = ["frame", "const", "difficulty", "title", "technical_score", "lamp", "rating"];
let shownRows = [];
let tab = "b50";
panel.innerHTML = "";
panel.style.background = "#f4f3f8";
const bar = document.createElement("div");
bar.style.cssText = "position:sticky;top:0;z-index:1;background:#f4f3f8;padding:4px 0 8px;display:flex;flex-wrap:wrap;gap:6px";
const mkBtn = (label, fn, parent = bar) => {
const b = document.createElement("button");
b.textContent = label;
b.style.cssText = "padding:9px 12px;font-size:15px;border:1px solid #cfcbdb;border-radius:8px;background:#fff;color:#222";
b.onclick = fn;
parent.appendChild(b);
return b;
};
const tabs = {};
for (const [k, label] of [["b50", "B50 图"], ["filter", "筛选图"], ["table", "表格"]]) {
tabs[k] = mkBtn(label, () => { tab = k; render(); });
}
mkBtn("关闭", () => panel.remove());
panel.appendChild(bar);
const filters = document.createElement("div");
const sel = (id, opts) => `<select id="${id}" style="font-size:16px;padding:4px">${opts}</select>`;
const group = (label, html) => `<label style="display:inline-flex;align-items:center;gap:4px;white-space:nowrap">${label} ${html}</label>`;
filters.innerHTML = [
group("定数", `<input id="oc-min" type="number" step="0.1" inputmode="decimal" placeholder="下限" style="width:64px;padding:4px;font-size:16px"> 〜 <input id="oc-max" type="number" step="0.1" inputmode="decimal" placeholder="上限" style="width:64px;padding:4px;font-size:16px">`),
group("等级", sel("oc-lv", `<option value="">全部</option>${levels.map((lv) => `<option>${esc(lv)}</option>`).join("")}`)),
group("难度", sel("oc-diff", `<option value="">全部</option>${DIFFS.map((d) => `<option>${d.name}</option>`).join("")}`)),
group("范围", sel("oc-frame", `<option value="">全部</option><option value="B">ベスト枠(B50)</option><option value="新曲">新曲枠</option><option value="P">P-SCORE枠</option>`)),
group("排序", sel("oc-sort", `<option value="rating">单曲rating</option><option value="const">定数</option><option value="ts">TS</option><option value="ps">P-rating</option>`)),
group("", `<input id="oc-played" type="checkbox"> 只看已游玩`),
].join("");
filters.style.cssText = "display:flex;flex-wrap:wrap;gap:8px 14px;padding:10px;background:#fff;border-radius:10px;margin-bottom:8px";
panel.appendChild(filters);
const $ = (id) => filters.querySelector("#" + id);
const view = document.createElement("div");
panel.appendChild(view);
const more = document.createElement("details");
more.style.cssText = "margin-top:12px;background:#fff;border-radius:10px;padding:10px";
more.innerHTML = "<summary><b>下载 / 各等级完成情况</b></summary>";
const moreBtns = document.createElement("div");
moreBtns.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;margin:8px 0";
more.appendChild(moreBtns);
mkBtn("全部成绩 CSV", () => download(`ongeki_scores_${stamp}.csv`, toCsv(all, songKeys), "text/csv"), moreBtns);
mkBtn("当前筛选 CSV", () => shownRows.length && download(`ongeki_filtered_${stamp}.csv`, toCsv(shownRows, songKeys), "text/csv"), moreBtns);
mkBtn("汇总 CSV", () => download(`ongeki_summary_${stamp}.csv`, toCsv(summary), "text/csv"), moreBtns);
mkBtn("JSON", () => download(`ongeki_scores_${stamp}.json`, JSON.stringify({ exported_at: new Date().toISOString(), rating: ratingInfo, summary, songs: all }, null, 1), "application/json"), moreBtns);
panel.appendChild(more);
const table = (rows, keys) =>
`<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;background:#fff"><table style="border-collapse:collapse;white-space:nowrap">` +
`<tr>${keys.map((k) => `<th style="border:1px solid #ccc;padding:2px 6px;background:#eee">${esc(k)}</th>`).join("")}</tr>` +
rows.map((r) => `<tr${r.frame && /^(B|新曲)/.test(r.frame) ? ' style="background:#fff4d6"' : ""}>${keys.map((k) => {
let v = r[k];
if (v === true) v = "✓";
else if (v === false || v == null) v = "";
else if ((k === "rating" || k === "ps_rating") && typeof v === "number") v = v.toFixed(3);
else if (k === "const" && typeof v === "number") v = v.toFixed(1);
return `<td style="border:1px solid #ccc;padding:2px 6px">${esc(v)}</td>`;
}).join("")}</tr>`).join("") +
`</table></div>`;
more.insertAdjacentHTML("beforeend", table(summary, Object.keys(summary[0])));
const showImage = (url, name) => {
view.innerHTML = "";
const tip = document.createElement("div");
tip.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:6px;color:#555";
tip.textContent = "长按图片可以保存；双指可以放大。";
mkBtn("保存图片", () => saveUrl(name, url), tip);
const img = new Image();
img.src = url;
img.alt = name;
img.style.cssText = "width:100%;height:auto;display:block;border-radius:10px";
view.append(tip, img);
};
let b50Url = null;
let timer = null;
function filterRows() {
const min = parseFloat($("oc-min").value);
const max = parseFloat($("oc-max").value);
const lv = $("oc-lv").value;
const diff = $("oc-diff").value;
const frame = $("oc-frame").value;
const onlyPlayed = $("oc-played").checked;
const sorters = {
rating: (a, b) => b.rating - a.rating || (b.const || 0) - (a.const || 0),
const: (a, b) => (b.const || 0) - (a.const || 0) || b.technical_score - a.technical_score,
ts: (a, b) => b.technical_score - a.technical_score,
ps: (a, b) => b.ps_rating - a.ps_rating,
};
shownRows = all
.filter((s) =>
(isNaN(min) || (s.const != null && s.const >= min - 1e-9)) &&
(isNaN(max) || (s.const != null && s.const <= max + 1e-9)) &&
(!lv || s.level === lv) &&
(!diff || s.difficulty === diff) &&
(!frame || s.frame.split(" / ").some((f) => f.startsWith(frame) && (frame !== "B" || /^B\d/.test(f)))) &&
(!onlyPlayed || s.played))
.sort(sorters[$("oc-sort").value]);
const desc = [];
if (!isNaN(min) || !isNaN(max)) desc.push(`定数 ${isNaN(min) ? "" : min.toFixed(1)}〜${isNaN(max) ? "" : max.toFixed(1)}`);
if (lv) desc.push(`Lv ${lv}`);
if (diff) desc.push(diff);
if (frame) desc.push($("oc-frame").selectedOptions[0].text);
if (onlyPlayed) desc.push("只看已游玩");
return desc;
}
function render() {
for (const [k, b] of Object.entries(tabs)) {
b.style.background = k === tab ? "#d1127a" : "#fff";
b.style.color = k === tab ? "#fff" : "#222";
}
filters.style.display = tab === "b50" ? "none" : "flex";
const desc = filterRows();
if (tab === "b50") {
b50Url = b50Url || b50Image();
showImage(b50Url, `ongeki_b50_${stamp}.png`);
} else if (tab === "filter") {
const played = shownRows.filter((s) => s.played);
const rows = shownRows.slice(0, IMG.MAX_CARDS);
const rankCount = ["SSS+", "SSS", "SS", "S"].map((r) => `${r} ${played.filter((s) => s.rank === r).length}`).join(" · ");
const url = drawImage(
"筛选结果",
[
`${desc.join(" · ") || "全部谱面"}  ·  ${shownRows.length} 谱面，已游玩 ${played.length}`,
`平均单曲rating ${(played.length ? sum(played, "rating") / played.length : 0).toFixed(3)}  ·  ${rankCount}`,
],
[{
name: "谱面",
note: shownRows.length > rows.length ? `只显示前 ${rows.length} 个，请缩小筛选范围` : "",
rows,
label: (s, i) => `${i + 1}${s.frame ? " · " + s.frame : ""}`,
}]
);
showImage(url, `ongeki_filtered_${stamp}.png`);
} else {
const played = shownRows.filter((s) => s.played);
view.innerHTML =
`<div style="margin:4px 0 6px"><b>${shownRows.length} 条</b>（已游玩 ${played.length}，平均单曲rating ${(played.length ? sum(played, "rating") / played.length : 0).toFixed(3)}）· 黄色 = 计入 rating</div>` +
table(shownRows, innerWidth >= 768 ? songKeys : compactKeys);
}
}
const rerender = () => {
clearTimeout(timer);
timer = setTimeout(render, 300);
};
filters.addEventListener("input", rerender);
filters.addEventListener("change", rerender);
render();
})().catch((e) => alert("出错了：" + e));
