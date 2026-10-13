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
function parseDifficulty(html, diff) {
const doc = new DOMParser().parseFromString(html, "text/html");
const container = doc.querySelector(".container3");
if (!container) return null; // 未登录 / 无权限 / 维护中
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
const all = [];
for (const diff of DIFFS) {
log(`正在获取 ${diff.name} ...`);
const res = await fetch(`${NET}/record/musicGenre/search/?genre=99&diff=${diff.id}`, {
credentials: "include",
});
const songs = parseDifficulty(await res.text(), diff);
if (songs === null) {
log(`× ${diff.name} 获取失败：未登录、处于维护时间（4:00–7:00），或当前账号无法查看该页面。`);
continue;
}
log(`✓ ${diff.name}：${songs.length} 个谱面`);
all.push(...songs);
await sleep(1000); // 别给服务器太大压力
}
if (!all.length) {
log("没有取到任何数据。");
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
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const csvCell = (s) => (/[",\n]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s));
const toCsv = (rows, keys = Object.keys(rows[0])) =>
"﻿" + [keys, ...rows.map((r) => keys.map((k) => r[k] ?? ""))]
.map((r) => r.map(csvCell).join(",")).join("\r\n");
const download = (name, text, type) => {
const a = document.createElement("a");
a.href = URL.createObjectURL(new Blob([text], { type }));
a.download = name;
a.click();
};
const stamp = new Date().toISOString().slice(0, 10);
const songKeys = ["frame", "const", "level", "difficulty", "title", "genre", "technical_score", "rank", "lamp", "full_bell", "rating", "platinum_star", "ps_rating", "version", "const_unknown", "battle_score", "over_damage", "platinum_score"];
const compactKeys = ["frame", "const", "difficulty", "title", "technical_score", "lamp", "rating"];
let shownRows = [];
panel.innerHTML = "";
const bar = document.createElement("div");
bar.style.cssText = "position:sticky;top:0;background:#fff;padding:6px 0;border-bottom:1px solid #ccc";
const btn = (label, fn) => {
const b = document.createElement("button");
b.textContent = label;
b.style.cssText = "margin:0 6px 6px 0;padding:8px 10px;font-size:14px";
b.onclick = fn;
bar.appendChild(b);
};
btn("下载全部成绩 CSV", () => download(`ongeki_scores_${stamp}.csv`, toCsv(all, songKeys), "text/csv"));
btn("下载当前筛选 CSV", () => shownRows.length && download(`ongeki_filtered_${stamp}.csv`, toCsv(shownRows, songKeys), "text/csv"));
btn("下载汇总 CSV", () => download(`ongeki_summary_${stamp}.csv`, toCsv(summary), "text/csv"));
btn("下载 JSON", () =>
download(`ongeki_scores_${stamp}.json`, JSON.stringify({ exported_at: new Date().toISOString(), rating: ratingInfo, summary, songs: all }, null, 1), "application/json"));
btn("关闭", () => panel.remove());
const filters = document.createElement("div");
filters.innerHTML = `
定数 <input id="oc-min" type="number" step="0.1" placeholder="下限" style="width:64px;padding:4px;font-size:16px">
〜 <input id="oc-max" type="number" step="0.1" placeholder="上限" style="width:64px;padding:4px;font-size:16px">
&nbsp;等级 <select id="oc-lv" style="padding:4px"><option value="">全部</option>${levels.map((lv) => `<option>${esc(lv)}</option>`).join("")}</select>
&nbsp;难度 <select id="oc-diff" style="padding:4px"><option value="">全部</option>${DIFFS.map((d) => `<option>${d.name}</option>`).join("")}</select>
&nbsp;范围 <select id="oc-frame" style="padding:4px"><option value="">全部</option><option value="B">ベスト枠(B50)</option><option value="新曲">新曲枠</option><option value="P">P-SCORE枠</option></select>
&nbsp;排序 <select id="oc-sort" style="padding:4px"><option value="rating">单曲rating</option><option value="const">定数</option><option value="ts">TS</option><option value="ps">P-rating</option></select>
&nbsp;<label><input id="oc-played" type="checkbox"> 只看已游玩</label>
&nbsp;<label><input id="oc-allcols" type="checkbox"${innerWidth >= 768 ? " checked" : ""}> 显示全部列</label>`;
filters.style.cssText = "line-height:2.4";
for (const el of filters.querySelectorAll("select")) el.style.fontSize = "16px";
bar.appendChild(filters);
panel.appendChild(bar);
const $ = (id) => filters.querySelector("#" + id);
const table = (rows, keys) =>
`<div style="overflow-x:auto;-webkit-overflow-scrolling:touch"><table style="border-collapse:collapse;margin:8px 0;white-space:nowrap">` +
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
const ratingBox = document.createElement("div");
ratingBox.style.cssText = "margin:8px 0;padding:8px;background:#f4f4ff;border-radius:6px";
ratingBox.innerHTML =
`<b>估算 Rating：${ratingInfo.total.toFixed(3)}</b>` +
`<br>新曲枠(${esc(latestVersion)}) ${new10.length}曲 合计 ${ratingInfo.new10.toFixed(3)}` +
` ／ ベスト枠 ${best50.length}曲 合计 ${ratingInfo.best50.toFixed(3)}（平均 ${(best50.length ? ratingInfo.best50 / best50.length : 0).toFixed(3)}）` +
` ／ P-SCORE枠 ${ps50.length}曲 合计 ${ratingInfo.ps50.toFixed(3)}` +
`<br><small>仅基于 EXPERT/MASTER/LUNATIC 计算；定数来自第三方定数表，"未确定"的定数可能不准，结果与游戏内会有少许出入。</small>`;
const sumBox = document.createElement("details");
sumBox.innerHTML = "<summary><b>各等级完成情况</b>（点击展开）</summary>" + table(summary, Object.keys(summary[0]));
const listBox = document.createElement("div");
panel.append(ratingBox, sumBox, listBox);
const render = () => {
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
const played = shownRows.filter((s) => s.played);
listBox.innerHTML =
`<b>歌曲明细：${shownRows.length} 条（已游玩 ${played.length}，平均单曲rating ${(played.length ? sum(played, "rating") / played.length : 0).toFixed(3)}）</b>` +
`<small>　黄色底色 = 计入 rating 的新曲枠/ベスト枠</small>` +
table(shownRows, $("oc-allcols").checked ? songKeys : compactKeys);
};
filters.addEventListener("input", render);
filters.addEventListener("change", render);
render();
})().catch((e) => alert("出错了：" + e));
