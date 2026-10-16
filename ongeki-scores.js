(async () => {
const NET = "https://ongeki-net.com/ongeki-mobile";
const CONST_URL = "https://reiwa.f5.si/ongeki_record.json";
const SYNC_URL_RAW = "https://otoge-sync.131a562-index01.workers.dev"; // build.js 替换为 config.json 的 syncUrl
const SYNC_URL = /^https?:\/\//.test(SYNC_URL_RAW) ? SYNC_URL_RAW : "";
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
const psRating = (c, star) => (Math.min(star, 5) * c * c) / 1000;
const tsUnits = (r) => Math.round(r * 1000) * 100;
const psUnits = (c, star) => Math.min(star, 5) * Math.round(c * 10) ** 2;
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
jacketSrc: [...el.querySelectorAll("img")].map((i) => i.getAttribute("src") || "").find((src) => src && !/music_icon_|icon|star/i.test(src)) || "",
level: el.querySelector(".score_level")?.textContent.trim() || "",
played,
technical_score: ts,
rank: played ? rankOf(ts) : "",
battle_score: num(v[1]?.textContent),
over_damage: num(v[0]?.textContent),
lamp: !played ? "未游玩" : ts >= 1010000 && ab ? "AB+" : ab ? "AB" : fc ? "FC" : "CLEAR",
full_bell: has("music_icon_fb.png"),
platinum_score: num(
el.querySelector(".platinum_high_score_text_block")?.textContent.split("/")[0]
),
platinum_max: num(
el.querySelector(".platinum_high_score_text_block")?.textContent.split("/")[1]
),
platinum_star_text: el.querySelector(".platinum_high_score_star_block")?.textContent.trim() || "",
});
if (!sampleHtml && el.querySelector("[class*=platinum]")) sampleHtml = el.outerHTML;
}
}
for (const s of songs) {
s.platinum_star = s.platinum_max > 0
? [94, 95, 96, 97, 98].filter((t) => s.platinum_score * 100 >= s.platinum_max * t).length
: Math.min(5, +(s.platinum_star_text.match(/\d+/) || [0])[0]);
delete s.platinum_star_text;
}
return songs;
}
let sampleHtml = ""; // 调试用：一首歌在成绩页上的原始 HTML
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
const entry = c.length > 1
? { title: s.title, diff: s.diffKey, level: s.level, genre: s.genre, idx: s.idx, jacket: s.jacketSrc,
candidates: c.map((m) => `id ${m.id} / ${m.genre} / Lv${m.level} / ${m.const} / ${m.artist} / img ${m.img}`) }
: null;
if (c.length > 1 && /^\d+$/.test(s.idx || "")) {
const byId = c.filter((m) => String(m.id) === s.idx);
if (byId.length === 1) { c = byId; entry.by = "id"; }
}
if (c.length > 1 && s.jacketSrc) {
const byImg = c.filter((m) => m.img && s.jacketSrc.includes(m.img));
if (byImg.length === 1) { c = byImg; entry.by = "jacket"; }
}
if (c.length > 1 && s.idx) {
try {
const html = await (await fetch(`${NET}/record/musicDetail/?idx=${encodeURIComponent(s.idx)}`, { credentials: "include" })).text();
const doc = new DOMParser().parseFromString(html, "text/html");
const artistEl = doc.querySelector("div.m_5.f_13.break");
const artist = norm((artistEl?.textContent || "").trim().split("\n")[0]);
let byArtist = c.filter((m) => artist && norm(m.artist) === artist);
if (!byArtist.length) byArtist = c.filter((m) => artist && (norm(m.artist).includes(artist) || artist.includes(norm(m.artist))));
if (byArtist.length) c = byArtist;
entry.artist = artist;
if (c.length === 1) entry.by = "artist";
if (!artistEl) entry.detailHtml = (doc.querySelector(".container3") || doc.body)?.innerHTML.replace(/\s+/g, " ").slice(0, 1500);
await sleep(500);
} catch (e) {
entry.error = String(e);
}
}
if (c.length > 1) c = c.filter((m) => m.const > 0).concat(c.filter((m) => !(m.const > 0)));
const ambiguous = new Set(c.filter((m) => m.const > 0).map((m) => m.const)).size > 1;
if (entry) {
entry.chosen = c[0] ? `${c[0].genre} / ${c[0].const} / ${c[0].artist}` : null;
entry.ambiguous = ambiguous;
matchLog.push(entry);
}
return c[0] && { ...c[0], ambiguous };
}
const matchLog = []; // 调试用：同名曲的匹配过程
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
const charts = [];
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
charts.push(...songs);
await sleep(1000); // 别给服务器太大压力
}
if (!charts.length) {
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
log("正在读取游戏内 Rating ...");
let official = null;
let playerName = "";
for (const path of ["/home/playerDataDetail/", "/home/"]) {
try {
const { doc } = await getDoc(NET + path);
playerName = playerName || (doc.querySelector(".name_block span")?.textContent || "").trim();
const block = doc.querySelector(".rating_new_block .rating_field") || doc.querySelector(".rating_field");
const value = parseFloat(block?.querySelector("[class^='rating_']")?.textContent || block?.textContent || "");
if (value > 0) {
const max = parseFloat((block.querySelector(".f_11")?.textContent || "").replace(/[^\d.]/g, ""));
official = { rating: value, max: max > 0 ? max : null };
break;
}
} catch (e) {}
}
log(official ? `✓ 游戏内 Rating：${official.rating.toFixed(3)}` : "× 没有读到游戏内 Rating，只显示估算值");
for (const s of charts) {
const m = await findConst(s);
s.const = m && m.const > 0 ? m.const : null;
s.const_unknown = !m ? "无数据" : m.ambiguous ? "同名未区分" : m.is_unknown ? "未确定" : "";
s.version = m?.version || "";
s.img = m?.img || "";
s.artist = m?.artist || ""; // 同名曲在历史记录里用艺术家区分
s.is_new = !!m && !!latestVersion && m.version === latestVersion;
s.is_bonus = !!m?.is_bonus;
s.rating = s.played && s.const ? tsRating(s.const, s) : 0;
s.ps_rating = s.const ? psRating(s.const, s.platinum_star) : 0;
s.frame = "";
delete s.diffKey;
delete s.idx;
delete s.jacketSrc;
}
const hiddenDiffs = new Set(DIFFS.filter((d) => d.hidden).map((d) => d.name));
const all = charts.filter((s) => !hiddenDiffs.has(s.difficulty)); // 筛选图 / 表格 / 汇总只显示 EXP/MAS/LUN
const eligible = charts.filter((s) => s.const && !s.is_bonus);
const byRating = (a, b) => b.rating - a.rating;
const new10 = eligible.filter((s) => s.is_new && s.rating > 0).sort(byRating).slice(0, 10);
const best50 = eligible.filter((s) => !s.is_new && s.rating > 0).sort(byRating).slice(0, 50);
const ps50 = eligible.filter((s) => s.ps_rating > 0).sort((a, b) => b.ps_rating - a.ps_rating).slice(0, 50);
new10.forEach((s, i) => (s.frame = `N${i + 1}`));
best50.forEach((s, i) => (s.frame = `B${i + 1}`));
ps50.forEach((s, i) => (s.frame += (s.frame ? " / " : "") + `P${i + 1}`));
const sum = (arr, k) => arr.reduce((a, s) => a + s[k], 0);
const units = {
new10: new10.reduce((a, s) => a + tsUnits(s.rating), 0),
best50: best50.reduce((a, s) => a + tsUnits(s.rating), 0),
ps50: ps50.reduce((a, s) => a + psUnits(s.const, s.platinum_star), 0),
};
const ratingInfo = {
new10: units.new10 / 1e5,
best50: units.best50 / 1e5,
ps50: units.ps50 / 1e5,
part: {
new10: Math.floor(units.new10 / 5000) / 1000,
best50: Math.floor(units.best50 / 5000) / 1000,
ps50: Math.floor(units.ps50 / 5000) / 1000,
},
exact: (units.new10 + units.best50 + units.ps50) / 50 / 1e5,
};
ratingInfo.total = (Math.floor(units.new10 / 5000) + Math.floor(units.best50 / 5000) + Math.floor(units.ps50 / 5000)) / 1000;
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
const JACKET_URL = "https://reiwa.f5.si/jackets/ongeki/";
const IMG = { W: 1800, PAD: 28, COLS: 5, GAP: 10, CH: 124, HEAD: 168, SEC: 44, FOOT: 40, MAX_CARDS: 150 };
IMG.CW = Math.floor((IMG.W - IMG.PAD * 2 - IMG.GAP * (IMG.COLS - 1)) / IMG.COLS);
const FONT = `"Hiragino Sans","Hiragino Kaku Gothic ProN","PingFang SC","Noto Sans CJK JP","Microsoft YaHei",sans-serif`;
const C = {
bg: "#16151c", card: "#24222d", line: "#3a3745", fg: "#f3f1f8", muted: "#9d99ab", accent: "#ff5aa8", plat: "#7fe0ff",
BASIC: "#3fbf6f", ADVANCED: "#f2a33a", EXPERT: "#e5484d", MASTER: "#9a5cf0", LUNATIC: "#e8e5f0",
"SSS+": "#ffd36b", SSS: "#ffc94a", SS: "#f0b43c", S: "#e3a53a",
"AB+": "#ff7ab8", AB: "#ffb347", FC: "#4fc3f7", FB: "#ffe066", star: "#ffd36b",
};
const DIFF_SHORT = { BASIC: "BAS", ADVANCED: "ADV", EXPERT: "EXP", MASTER: "MAS", LUNATIC: "LUN" };
const f = (w, px) => `${w} ${px}px ${FONT}`;
const jacketCache = new Map();
function loadJacket(id) {
if (!id) return Promise.resolve(null);
if (!jacketCache.has(id)) {
jacketCache.set(id, new Promise((resolve) => {
const img = new Image();
img.crossOrigin = "anonymous";
const t = setTimeout(() => resolve(null), 10000);
img.onload = () => { clearTimeout(t); resolve(img); };
img.onerror = () => { clearTimeout(t); resolve(null); };
img.src = JACKET_URL + id + ".webp";
}));
}
return jacketCache.get(id);
}
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
function pill(ctx, text, x, y, color, px = 12, ink = "#16151c") {
ctx.font = f(800, px);
const w = ctx.measureText(text).width + px;
rrect(ctx, x, y - px - 2, w, px + 7, 4);
ctx.fillStyle = color;
ctx.fill();
ctx.fillStyle = ink;
ctx.fillText(text, x + px / 2, y + 1);
return w;
}
function constPill(ctx, s, x, y, color, px = 12) {
const ink = "#16151c";
const head = `${DIFF_SHORT[s.difficulty] || ""} `;
let intPart = "?", tail = "";
if (s.const != null) {
const [i, d] = s.const.toFixed(1).split(".");
intPart = i;
tail = "." + d;
}
if (s.const_unknown) tail += "?";
const plus = s.level.endsWith("+");
const big = f(800, px), small = f(800, Math.round(px * 0.75));
ctx.font = big;
const wHead = ctx.measureText(head + intPart).width, wTail = ctx.measureText(tail).width;
ctx.font = small;
const wPlus = plus ? ctx.measureText("+").width + 1 : 0;
const w = wHead + wPlus + wTail + px;
rrect(ctx, x, y - px - 2, w, px + 7, 4);
ctx.fillStyle = color;
ctx.fill();
ctx.fillStyle = ink;
let tx = x + px / 2;
ctx.font = big;
ctx.fillText(head + intPart, tx, y + 1);
tx += wHead;
if (plus) {
ctx.font = small;
ctx.fillText("+", tx, y + 1 - px * 0.42); // 右上角
tx += wPlus;
}
ctx.font = big;
ctx.fillText(tail, tx, y + 1);
return w;
}
function drawStars(ctx, n, right, baseline, size = 11, gap = 2) {
const total = 5 * size + 4 * gap;
for (let i = 0; i < 5; i++) {
const cx = right - total + i * (size + gap) + size / 2, cy = baseline - size / 2;
ctx.beginPath();
for (let k = 0; k < 10; k++) {
const r = k % 2 ? size * 0.22 : size / 2;
const a = -Math.PI / 2 + (k * Math.PI) / 5;
ctx[k ? "lineTo" : "moveTo"](cx + r * Math.cos(a), cy + r * Math.sin(a));
}
ctx.closePath();
ctx.fillStyle = i < Math.min(n, 5) ? C.star : C.line;
ctx.fill();
}
return total;
}
function drawCard(ctx, s, label, x, y, jacket, mode) {
const { CW, CH } = IMG;
rrect(ctx, x, y, CW, CH, 10);
ctx.fillStyle = C.card;
ctx.fill();
ctx.save();
rrect(ctx, x, y, CW, CH, 10);
ctx.clip();
if (jacket) ctx.drawImage(jacket, x, y, CH, CH);
else {
ctx.fillStyle = C.line;
ctx.fillRect(x, y, CH, CH);
ctx.fillStyle = C.muted;
ctx.font = f(700, 14);
ctx.textAlign = "center";
ctx.fillText("NO IMAGE", x + CH / 2, y + CH / 2 + 5);
ctx.textAlign = "left";
}
ctx.fillStyle = C[s.difficulty] || C.muted;
ctx.fillRect(x, y + CH - 6, CH, 6);
ctx.restore();
ctx.font = f(800, 13);
const lw = ctx.measureText(label).width + 12;
rrect(ctx, x + 4, y + 4, lw, 20, 5);
ctx.fillStyle = "rgba(0,0,0,.72)";
ctx.fill();
ctx.fillStyle = "#fff";
ctx.fillText(label, x + 10, y + 19);
const L = x + CH + 10, R = x + CW - 10, TW = R - L;
ctx.textAlign = "left";
const text = (t, tx, ty, font, color, maxW) => {
ctx.font = font;
ctx.fillStyle = color;
const s2 = maxW != null ? fit(ctx, t, Math.max(0, maxW)) : t;
if (maxW == null || maxW > 12) ctx.fillText(s2, tx, ty);
return ctx.measureText(s2).width;
};
const textR = (t, ty, font, color, maxW) => { // 右对齐，返回宽度
ctx.font = font;
const s2 = fit(ctx, t, maxW);
const w = ctx.measureText(s2).width;
if (maxW > 12) {
ctx.fillStyle = color;
ctx.fillText(s2, R - w, ty);
}
return w;
};
let cx = L + constPill(ctx, s, L, y + 19, C[s.difficulty] || C.muted) + 8;
const pRank = mode === "ps" ? "" : (s.frame.match(/P\d+/) || [""])[0];
if (pRank) textR(pRank, y + 19, f(700, 12), C.plat, R - cx);
text(s.title, L, y + 42, f(700, 16), C.fg, TW);
const sub = mode === "ps"
? (s.rating > 0 ? `R ${s.rating.toFixed(3)}` : "")
: (s.ps_rating > 0 ? `P ${fmtPs(s.ps_rating)}` : "");
if (s.played) {
cx = L + text(s.technical_score.toLocaleString("en-US"), L, y + 66, f(800, 18), C.fg);
cx += 5 + text(s.rank, cx + 5, y + 66, f(800, 14), C[s.rank] || C.muted);
} else {
cx = L + text("未游玩", L, y + 66, f(700, 15), C.muted);
}
if (sub) textR(sub, y + 66, f(600, 12), mode === "ps" ? C.accent : C.plat, R - cx - 8);
const starW = drawStars(ctx, s.platinum_star, R, y + 89);
cx = L;
if (s.played) {
for (const [t, c] of [[C[s.lamp] ? s.lamp : "", C[s.lamp]], [s.full_bell ? "FB" : "", C.FB]]) {
if (!t) continue;
ctx.font = f(800, 11);
if (cx + ctx.measureText(t).width + 11 > R - starW - 6) break;
cx += pill(ctx, t, cx, y + 89, c, 11) + 4;
}
}
const main = mode === "ps" ? s.ps_rating : s.rating;
const mainW = textR(main > 0 ? (mode === "ps" ? fmtPs(main) : main.toFixed(3)) : "—", y + 115, f(800, 22),
main > 0 ? (mode === "ps" ? C.plat : C.accent) : C.muted, TW);
const ps = s.platinum_score
? `PS ${s.platinum_score.toLocaleString("en-US")}${s.platinum_max ? "/" + s.platinum_max.toLocaleString("en-US") : ""}`
: "PS —";
text(ps, L, y + 114, f(600, 11), C.muted, TW - mainW - 8);
}
const SIDE = { CW: 206, CH: 62, GAP: 6, COLS: 2, MARGIN: 24 };
SIDE.W = SIDE.CW * SIDE.COLS + SIDE.GAP * (SIDE.COLS - 1);
function drawPCard(ctx, s, label, x, y, jacket) {
const { CW, CH } = SIDE;
rrect(ctx, x, y, CW, CH, 8);
ctx.fillStyle = C.card;
ctx.fill();
ctx.save();
rrect(ctx, x, y, CW, CH, 8);
ctx.clip();
if (jacket) ctx.drawImage(jacket, x, y, CH, CH);
else { ctx.fillStyle = C.line; ctx.fillRect(x, y, CH, CH); }
ctx.fillStyle = C[s.difficulty] || C.muted;
ctx.fillRect(x, y + CH - 4, CH, 4);
ctx.restore();
ctx.font = f(800, 11);
const lw = ctx.measureText(label).width + 8;
rrect(ctx, x + 3, y + 3, lw, 16, 4);
ctx.fillStyle = "rgba(0,0,0,.72)";
ctx.fill();
ctx.fillStyle = "#fff";
ctx.fillText(label, x + 7, y + 15);
const L = x + CH + 8, R = x + CW - 8;
ctx.font = f(700, 13);
ctx.fillStyle = C.fg;
ctx.fillText(fit(ctx, s.title, R - L), L, y + 18);
const pw = constPill(ctx, s, L, y + 37, C[s.difficulty] || C.muted, 10);
if (s.platinum_max) {
ctx.font = f(600, 10);
ctx.fillStyle = C.muted;
const pct = ((s.platinum_score / s.platinum_max) * 100).toFixed(1) + "%";
const w = ctx.measureText(pct).width;
if (L + pw + 6 + w <= R) ctx.fillText(pct, R - w, y + 37);
}
drawStars(ctx, s.platinum_star, L + 53, y + 56, 9, 2);
ctx.font = f(800, 15);
ctx.fillStyle = C.plat;
const t = fmtPs(s.ps_rating);
ctx.fillText(t, R - ctx.measureText(t).width, y + 57);
}
async function drawImage(title, subtitle, stats, sections, side) {
const { PAD, COLS, GAP, CH, HEAD, SEC, FOOT, CW } = IMG;
const mainRight = IMG.W - PAD; // 主区域（大卡片）的右边界
const sideX = mainRight + SIDE.MARGIN;
const W = side ? sideX + SIDE.W + PAD : IMG.W;
const rowsOf = (n) => Math.max(1, Math.ceil(n / COLS));
const mainH = sections.reduce((h, sec) => h + SEC + rowsOf(sec.rows.length) * (CH + GAP), 0);
const sideH = side ? SEC + Math.ceil(side.rows.length / SIDE.COLS) * (SIDE.CH + SIDE.GAP) : 0;
const H = HEAD + Math.max(mainH, sideH) + FOOT;
const jackets = new Map();
await Promise.all([...sections.flatMap((sec) => sec.rows), ...(side ? side.rows : [])]
.map(async (s) => jackets.set(s, await loadJacket(s.img))));
const cv = document.createElement("canvas");
cv.width = W;
cv.height = H;
const ctx = cv.getContext("2d");
ctx.fillStyle = C.bg;
ctx.fillRect(0, 0, W, H);
ctx.textBaseline = "alphabetic";
ctx.fillStyle = C.accent;
ctx.font = f(800, 16);
ctx.fillText("O.N.G.E.K.I. Re:Fresh", PAD, 42);
ctx.fillStyle = C.fg;
ctx.font = f(800, 52);
ctx.fillText(title, PAD, 100);
ctx.font = f(500, 15);
ctx.fillStyle = C.muted;
ctx.fillText(fit(ctx, subtitle, 700), PAD, 132);
const boxW = 200, boxGap = 10;
stats.forEach(([label, value, note], i) => {
const bx = W - PAD - (stats.length - i) * (boxW + boxGap) + boxGap;
rrect(ctx, bx, 26, boxW, 112, 10);
ctx.fillStyle = C.card;
ctx.fill();
ctx.fillStyle = C.muted;
ctx.font = f(700, 14);
ctx.fillText(label, bx + 14, 52);
ctx.fillStyle = C.fg;
ctx.font = f(800, 30);
ctx.fillText(fit(ctx, value, boxW - 28), bx + 14, 92);
ctx.fillStyle = C.muted;
ctx.font = f(500, 13);
ctx.fillText(fit(ctx, note, boxW - 28), bx + 14, 122);
});
if (side) {
ctx.fillStyle = C.line;
ctx.fillRect(sideX, HEAD + 6, SIDE.W, 1);
ctx.fillStyle = C.fg;
ctx.font = f(800, 20);
ctx.fillText(side.name, sideX, HEAD + 34);
if (side.note) {
const nw = ctx.measureText(side.name).width;
ctx.font = f(500, 13);
ctx.fillStyle = C.muted;
ctx.fillText(fit(ctx, side.note, SIDE.W - nw - 10), sideX + nw + 10, HEAD + 34);
}
if (!side.rows.length) {
ctx.font = f(500, 14);
ctx.fillStyle = C.muted;
ctx.fillText("还没有拿到☆的谱面", sideX, HEAD + SEC + 30);
}
side.rows.forEach((s, i) => {
drawPCard(ctx, s, side.label(s, i), sideX + (i % SIDE.COLS) * (SIDE.CW + SIDE.GAP),
HEAD + SEC + Math.floor(i / SIDE.COLS) * (SIDE.CH + SIDE.GAP), jackets.get(s));
});
}
let y = HEAD;
for (const sec of sections) {
ctx.fillStyle = C.line;
ctx.fillRect(PAD, y + 6, mainRight - PAD, 1);
ctx.fillStyle = C.fg;
ctx.font = f(800, 20);
ctx.fillText(sec.name, PAD, y + 34);
if (sec.note) {
const nw = ctx.measureText(sec.name).width;
ctx.font = f(500, 15);
ctx.fillStyle = C.muted;
ctx.fillText(sec.note, PAD + nw + 14, y + 34);
}
y += SEC;
if (!sec.rows.length) {
ctx.font = f(500, 15);
ctx.fillStyle = C.muted;
ctx.fillText("没有符合条件的谱面", PAD, y + 40);
}
sec.rows.forEach((s, i) => {
drawCard(ctx, s, sec.label(s, i), PAD + (i % COLS) * (CW + GAP), y + Math.floor(i / COLS) * (CH + GAP), jackets.get(s), sec.mode || "ts");
});
y += rowsOf(sec.rows.length) * (CH + GAP);
}
ctx.font = f(500, 13);
ctx.fillStyle = C.muted;
ctx.fillText(fit(ctx,
`${new Date().toLocaleString("ja-JP")}  ·  估算值（仅 EXP/MAS/LUN），与游戏内会有少许出入  ·  定数・曲绘：reiwa.f5.si（定数后带 "?" 为未确定）`,
W - PAD * 2), PAD, H - 16);
try {
const blob = await new Promise((resolve, reject) => {
try {
cv.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
} catch (e) {
reject(e);
}
});
return { blob, url: URL.createObjectURL(blob) };
} catch (e) {
if (jackets.size) {
for (const k of jacketCache.keys()) jacketCache.set(k, Promise.resolve(null));
return drawImage(title, subtitle, stats, sections, side);
}
throw e;
}
}
const stamp = new Date().toISOString().slice(0, 10);
const fmtPs = (v) => v.toFixed(5).replace(/(\.\d{3}\d*?)0+$/, "$1");
const avg = (arr, k) => (arr.length ? sum(arr, k) / arr.length : 0);
const ratingStats = () => [
["NEW10", `+${ratingInfo.part.new10.toFixed(3)}`, `${new10.length}曲 平均 ${avg(new10, "rating").toFixed(3)} · 合计 ${ratingInfo.new10.toFixed(3)}`],
["BEST50", `+${ratingInfo.part.best50.toFixed(3)}`, `${best50.length}曲 平均 ${avg(best50, "rating").toFixed(3)} · 合计 ${ratingInfo.best50.toFixed(3)}`],
["P-SCORE50", `+${ratingInfo.part.ps50.toFixed(3)}`, `${ps50.length}曲 · 合计 ${fmtPs(ratingInfo.ps50)}`],
];
const b50Image = () =>
drawImage(
official ? `Rating ${official.rating.toFixed(3)}` : `Rating ${ratingInfo.total.toFixed(3)}`,
official
? `游戏内 Rating（オンゲキ-NET）${official.max ? ` · MAX ${official.max.toFixed(3)}` : ""} · 本工具计算 ${ratingInfo.total.toFixed(3)}${ratingInfo.total === official.rating ? "（一致）" : `（差 ${(ratingInfo.total - official.rating > 0 ? "+" : "") + (ratingInfo.total - official.rating).toFixed(3)}）`}`
: `新曲枠 ${ratingInfo.part.new10.toFixed(3)} + ベスト枠 ${ratingInfo.part.best50.toFixed(3)} + P-SCORE枠 ${ratingInfo.part.ps50.toFixed(3)}（各枠合计 ÷ 50 后截断）`,
ratingStats(),
[
{ name: "BEST50", note: `平均 ${avg(best50, "rating").toFixed(3)} · 最低 ${best50.length ? best50[best50.length - 1].rating.toFixed(3) : "—"}`, rows: best50, label: (s, i) => `B${i + 1}` },
{ name: "NEW10", note: `${latestVersion} · 平均 ${avg(new10, "rating").toFixed(3)}`, rows: new10, label: (s, i) => `N${i + 1}` },
],
{ name: "P-SCORE50", note: `合计 ${fmtPs(ratingInfo.ps50)} · 最低 ${ps50.length ? fmtPs(ps50[ps50.length - 1].ps_rating) : "—"}`, rows: ps50, label: (s, i) => `P${i + 1}` }
);
const pad2 = (n) => String(n).padStart(2, "0");
const nowStr = () => {
const d = new Date();
return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};
const normTime = (s) => {
const m = (s || "").match(/(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})/);
return m ? `${m[1]}/${pad2(m[2])}/${pad2(m[3])} ${pad2(m[4])}:${m[5]}` : null;
};
const timeMs = (t) => {
const m = t.match(/(\d+)\/(\d+)\/(\d+) (\d+):(\d+)/);
return new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5]).getTime();
};
const byTime = (a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0);
const chartKey = (title, diff) => norm(title) + "|" + diff;
const HIST_V = 4;
const emptyHist = () => ({ v: HIST_V, game: "ongeki", name: "", since: "", obs: [], snaps: [] });
const playId = (o) => `${o.t}|${norm(o.n)}|${o.d}|${o.s}`;
const obsId = (o) => (o.src === "p" ? "p|" + playId(o) : [o.t, o.k, o.s, o.src].join("|") +
(o.l != null ? "|l" + o.l : "") + (o.fb != null ? "|fb" + o.fb : "") + (o.ps != null ? "|ps" + o.ps + "/" + o.st : ""));
function migrateHist(h) {
if (!h || !h.obs || h.v !== HIST_V) return emptyHist();
return h;
}
const LAMP_RANK = { "": 0, FC: 1, AB: 2, "AB+": 3 };
const lampOf = (s) => (s.lamp === "AB+" || s.lamp === "AB" || s.lamp === "FC" ? s.lamp : "");
const sameTitleCount = new Map();
for (const s of all) sameTitleCount.set(chartKey(s.title, s.difficulty), (sameTitleCount.get(chartKey(s.title, s.difficulty)) || 0) + 1);
const isSameTitle = (title, diff) => (sameTitleCount.get(chartKey(title, diff)) || 0) > 1;
const histKeyOf = (s) => (isSameTitle(s.title, s.difficulty)
? `${chartKey(s.title, s.difficulty)}|${norm(s.artist || s.genre || "")}` : chartKey(s.title, s.difficulty));
const chartByKey = new Map(all.map((s) => [histKeyOf(s), s]));
const nameOfKey = (k, n) => {
const extra = String(k).split("|")[2];
if (extra == null) return n;
return `${n}（${extra === "?" ? "版本未知" : chartByKey.get(k)?.artist || extra}）`;
};
const canonKey = (k, same) => {
const [, diff, extra] = String(k).split("|");
if (extra != null || !diff) return k;
const versions = all.filter((c) => chartKey(c.title, c.difficulty) === k);
if (versions.length < 2) return k;
const played = versions.filter((c) => c.played || c.platinum_star > 0);
if (played.length === 1) return histKeyOf(played[0]);
const hit = same ? played.filter(same) : [];
return hit.length === 1 ? histKeyOf(hit[0]) : k + "|?";
};
function normalizeKeys(h) {
h.obs.forEach((o) => { o.k = canonKey(o.k, (c) => c.technical_score === o.s); });
h.snaps.forEach((s) => ["best", "news"].forEach((f) => (s[f] || []).forEach((e) => { e[0] = canonKey(e[0], (c) => c.technical_score === e[2]); })));
h.snaps.forEach((s) => {
const used = new Set();
(s.ps || []).forEach((e) => {
const k2 = canonKey(e[0], (c) => c.platinum_star === e[2]);
if (!k2.endsWith("|?") && !used.has(k2)) { used.add(k2); e[0] = k2; }
});
});
return h;
}
let playlogSample = ""; // 调试用：プレイ履歴第一条的原始 HTML
function parsePlaylog(doc) {
const items = [...doc.querySelectorAll(".container3 > .m_10")];
if (items.length) playlogSample = items[0].outerHTML.replace(/\s+/g, " ").slice(0, 3000);
return items.map((el) => {
const t = normTime(el.querySelector("span.f_r.h_10")?.textContent);
const n = (el.querySelector(".m_5.l_h_10.break")?.textContent || "").replace(/[\n\t]/g, "").trim();
const hay = [el, ...el.querySelectorAll("[class], img")]
.map((x) => `${x.className || ""} ${x.getAttribute?.("src") || ""}`).join(" ").toLowerCase();
const dm = hay.match(/(lunatic|master|expert|advanced|basic)/);
let s = 0;
for (const x of el.querySelectorAll("[class*=technical]")) {
const v = num((x.textContent.match(/\d{1,3}(,\d{3})+|\d{6,7}/) || [""])[0]);
if (v > 0 && v <= 1010000) { s = v; break; }
}
if (!t || !n || !dm || !s) return null;
const d = dm[1].toUpperCase();
if (!DIFFS.some((x) => x.name === d)) return null; // 只记 EXP/MAS/LUN
let k = chartKey(n, d);
if (isSameTitle(n, d)) {
const srcs = [...el.querySelectorAll("img")].map((i) => i.getAttribute("src") || "").join(" ");
const hit = all.filter((c) => chartKey(c.title, c.difficulty) === k && c.img && srcs.includes(c.img));
k = hit.length === 1 ? histKeyOf(hit[0]) : k + "|?";
}
const o = { t, k, n, d, s, src: "p" };
const icon = (name) => !!el.querySelector(`img[src*='music_icon_${name}.png']`);
if (icon("fc") || icon("ab") || icon("abplus")) {
const ab = icon("ab") || icon("abplus");
o.l = s >= 1010000 && ab ? "AB+" : ab ? "AB" : "FC";
o.fb = icon("fb") ? 1 : 0;
}
if (/new_?record/i.test(el.innerHTML)) o.nr = 1;
return o;
}).filter(Boolean);
}
const blankState = () => ({ s: 0, l: "", fb: 0, ps: 0, pm: 0, st: 0, has: { l: false, fb: false, ps: false } });
function absorb(state, o) {
const ch = [];
const next = { ...state, has: { ...state.has } };
if (o.s > state.s) { ch.push({ type: "ts", from: state.s, to: o.s }); next.s = o.s; }
if (o.l != null) {
if (state.has.l && LAMP_RANK[o.l] > LAMP_RANK[state.l]) ch.push({ type: "lamp", from: state.l, to: o.l });
if (LAMP_RANK[o.l] > LAMP_RANK[next.l]) next.l = o.l;
next.has.l = true;
}
if (next.s >= 1010000 && next.l === "AB") {
if (state.has.l) ch.push({ type: "lamp", from: "AB", to: "AB+" });
next.l = "AB+";
}
if (o.fb != null) {
if (state.has.fb && o.fb && !state.fb) ch.push({ type: "fb" });
if (o.fb) next.fb = 1;
next.has.fb = true;
}
if (o.ps != null) {
if (state.has.ps && o.st > state.st) ch.push({ type: "star", from: state.st, to: o.st });
else if (state.has.ps && o.ps > state.ps) ch.push({ type: "ps", from: state.ps, to: o.ps }); // ☆没变的プラチナスコア提升
if (o.ps > next.ps) { next.ps = o.ps; next.pm = o.pm || next.pm; }
if (o.st > next.st) next.st = o.st;
next.has.ps = true;
}
return { next, ch };
}
const isRatingChange = (c) => c.type !== "ps";
const firstChanges = (st) => [
{ type: "ts", from: null, to: st.s },
...(st.l ? [{ type: "lamp", from: null, to: st.l }] : []),
...(st.fb ? [{ type: "fb", from: null }] : []),
...(st.st ? [{ type: "star", from: null, to: st.st }] : []),
];
function derive(hist) {
const state = {}, pb = {}, scanned = new Set(), fresh = new Set(), updates = [];
const base = hist.since || "";
hist.obs.slice().sort(byTime).forEach((o) => {
const before = state[o.k];
if (!before && base && o.t > base) fresh.add(o.k);
const known = scanned.has(o.k) || fresh.has(o.k);
if (o.src === "b") scanned.add(o.k);
if (!before) {
state[o.k] = absorb(blankState(), o).next;
if (fresh.has(o.k) || (o.src === "p" && o.nr)) updates.push({ ...o, before: null, after: state[o.k], changes: firstChanges(state[o.k]) });
} else {
const { next, ch } = absorb(before, o);
state[o.k] = next;
if (ch.some(isRatingChange) && (known || (o.src === "p" && o.nr))) updates.push({ ...o, before, after: next, changes: ch });
}
pb[o.k] = state[o.k].s;
});
return { state, pb, updates };
}
function mergeHist(a, b) {
const out = emptyHist();
out.name = b.name || a.name;
out.resetAt = [a.resetAt || "", b.resetAt || ""].sort().pop();
const sinces = [a.since, b.since].filter(Boolean).sort();
out.since = sinces[0] || "";
if (out.resetAt && out.resetAt > out.since) out.since = out.resetAt;
const seen = new Set();
[...a.obs, ...b.obs].forEach((o) => {
const id = obsId(o);
if (!seen.has(id)) { seen.add(id); out.obs.push(o); }
});
out.obs = out.obs.filter((o) => o.t >= out.since).sort(byTime);
const snaps = new Map();
[...a.snaps, ...b.snaps].forEach((s) => snaps.set(s.t, s));
out.snaps = [...snaps.values()].filter((s) => s.t >= out.since).sort(byTime);
return out;
}
const tsMilliOf = (k, st) => {
const c = chartByKey.get(k);
if (!c || !c.const || !st) return null;
const lamp = st.l === "AB+" && st.s < 1010000 ? "AB" : st.l || "CLEAR";
return Math.round(tsRating(c.const, { technical_score: st.s, lamp, full_bell: !!st.fb }) * 1000);
};
const psUnitsOf = (k, st) => {
const c = chartByKey.get(k);
return c && c.const && st ? psUnits(c.const, st.st || 0) : null;
};
const sameSnap = (a, b) => a && b && a.r === b.r && a.c === b.c &&
JSON.stringify([a.best, a.news, a.ps]) === JSON.stringify([b.best, b.news, b.ps]);
function applyUpdate(hist, plays) {
const t = nowStr();
if (playerName) hist.name = playerName;
hist.v = HIST_V;
if (!hist.since) hist.since = t; // 起点：这次的成绩扫描和快照就是历史的开始
const ids = new Set(hist.obs.map(obsId));
plays.forEach((o) => { if (!ids.has(obsId(o))) { ids.add(obsId(o)); hist.obs.push(o); } });
const { state } = derive(hist);
for (const s of all) {
if (!s.played) continue;
const k = histKeyOf(s);
const o = { t, k, n: s.title, d: s.difficulty, s: s.technical_score, l: lampOf(s), fb: s.full_bell ? 1 : 0,
ps: s.platinum_score || 0, pm: s.platinum_max || 0, st: s.platinum_star || 0, src: "b" };
const old = state[k];
if (!old) { hist.obs.push(o); continue; }
const { ch } = absorb(old, o);
if (ch.length || !old.has.l || !old.has.fb || !old.has.ps) hist.obs.push(o);
}
hist.obs.sort(byTime);
const row = (s) => [histKeyOf(s), s.title, s.technical_score, Math.round(s.rating * 1000), lampOf(s), s.full_bell ? 1 : 0];
const snap = {
t,
r: official ? official.rating : ratingInfo.total,
c: ratingInfo.total,
n10: Math.round(avg(new10, "rating") * 10000) / 10000,
b50: Math.round(avg(best50, "rating") * 10000) / 10000,
p: ratingInfo.part.ps50,
parts: [ratingInfo.part.new10, ratingInfo.part.best50, ratingInfo.part.ps50].map((x) => Math.round(x * 1000)),
best: best50.map(row),
news: new10.map(row),
ps: ps50.map((s) => [histKeyOf(s), s.title, s.platinum_star, psUnits(s.const, s.platinum_star)]),
};
const last = hist.snaps[hist.snaps.length - 1];
if (!(sameSnap(last, snap) && last.t.slice(0, 10) === t.slice(0, 10))) hist.snaps.push(snap);
return hist;
}
function accountImpact(hist, updates) {
const snaps = hist.snaps;
const out = new Map();
const tsUnitsOfRow = (e) => {
if (e[3] != null) return e[3] * 100;
const c = chartByKey.get(e[0]);
if (!c || !c.const) return 0;
const same = c.technical_score === e[2];
return Math.round(tsRating(c.const, { technical_score: e[2], lamp: same ? c.lamp : "CLEAR", full_bell: same && c.full_bell }) * 1000) * 100;
};
const fromSnap = (s) => ({
news: new Map(s.news.map((e) => [e[0], tsUnitsOfRow(e)])),
best: new Map(s.best.map((e) => [e[0], tsUnitsOfRow(e)])),
ps: s.ps ? new Map(s.ps.map((e) => [e[0], e[3]])) : null,
});
const part = (m) => Math.floor([...m.values()].reduce((a, v) => a + v, 0) / 5000); // 0.001 单位
const parts = (st) => [part(st.news), part(st.best), st.ps ? part(st.ps) : 0];
const units = (st) => [st.news, st.best, st.ps].reduce((a, m) => a + (m ? [...m.values()].reduce((x, v) => x + v, 0) : 0), 0);
const put = (m, k, v, cap) => {
const was = m.has(k);
if (!was || v > m.get(k)) m.set(k, v);
if (m.size > cap) {
let low = null, lowV = Infinity;
m.forEach((x, kk) => { if (x < lowV || (x === lowV && kk === k)) { low = kk; lowV = x; } });
m.delete(low);
}
return { entered: !was && m.has(k), inFrame: m.has(k) };
};
let si = -1, st = null;
updates.slice().sort(byTime).forEach((u) => {
while (si + 1 < snaps.length && snaps[si + 1].t < u.t) { si++; st = snaps[si].best?.length || snaps[si].news?.length ? fromSnap(snaps[si]) : null; }
const c = chartByKey.get(u.k);
if (!st) { out.set(u, { noSnap: true }); return; }
if (!c || !c.const) { out.set(u, { noConst: true }); return; }
if (c.is_bonus) { out.set(u, { bonus: true }); return; }
const p0 = parts(st), u0 = units(st);
const frameName = c.is_new ? "NEW10" : "BEST50";
const res = { frame: frameName };
if (u.changes.some((x) => x.type === "ts" || x.type === "lamp" || x.type === "fb")) {
Object.assign(res, put(c.is_new ? st.news : st.best, u.k, tsMilliOf(u.k, u.after) * 100, c.is_new ? 10 : 50));
}
if (u.changes.some((x) => x.type === "star")) {
if (st.ps) {
const r = put(st.ps, u.k, psUnitsOf(u.k, u.after), 50);
res.pEntered = r.entered;
res.pIn = r.inFrame;
} else res.pUnknown = true;
}
const p1 = parts(st);
res.dParts = p1.map((x, i) => x - p0[i]);
res.delta = res.dParts.reduce((a, x) => a + x, 0); // 账号 Rating 显示值的变化（0.001 单位）
res.exact = (units(st) - u0) / 50 / 1e5;
out.set(u, res);
});
return out;
}
const GOOD = "#7ee0a0";
function impactText(im) {
if (!im || im.noSnap) return ["之前没有快照，无法推算账号 Rating", C.line];
if (im.noConst) return ["定数未知，无法推算账号 Rating", C.muted];
if (im.bonus) return ["ボーナストラック，不计入 Rating", C.muted];
const bits = [];
if (im.inFrame != null) bits.push(im.entered ? "进入 " + im.frame : im.inFrame ? im.frame + " 内提升" : "未进入 " + im.frame);
if (im.pIn != null) bits.push(im.pEntered ? "进入 P-SCORE50" : im.pIn ? "P-SCORE50 内提升" : "未进入 P-SCORE50");
if (im.pUnknown) bits.push("P-SCORE 影响未知（旧快照）");
const head = bits.join(" · ");
if (im.delta > 0) return [head + " · 账号 Rating +" + (im.delta / 1000).toFixed(3) + "（推算）", GOOD];
if (im.exact > 0) return [head + " · 账号 Rating 不变（+" + im.exact.toFixed(5) + "，未进位，推算）", C.muted];
return [head + " · 账号 Rating 不变（推算）", C.muted];
}
function changeText(u) {
const parts = [];
for (const c of u.changes) {
if (c.type === "ts") parts.push(c.from != null ? `${c.from.toLocaleString("en-US")} → ${c.to.toLocaleString("en-US")}（+${(c.to - c.from).toLocaleString("en-US")}）` : `${c.to.toLocaleString("en-US")}（首次）`);
else if (c.type === "lamp") parts.push(c.from === null ? c.to : `${c.from || "CLEAR"}→${c.to}`);
else if (c.type === "fb") parts.push(c.from === null ? "FB" : "+FB");
else if (c.type === "star") parts.push(c.from === null ? `☆${c.to}` : `☆${c.from}→☆${c.to}`);
else if (c.type === "ps") parts.push(`PS +${(c.to - c.from).toLocaleString("en-US")}`);
}
return parts.join(" · ");
}
const histKey = () => "ongeki-hist:" + (playerName || "_");
const loadLocalHist = () => {
try {
return migrateHist(JSON.parse(localStorage.getItem(histKey()) || "null"));
} catch (e) {
return emptyHist();
}
};
const saveLocalHist = (h) => {
try { localStorage.setItem(histKey(), JSON.stringify(h)); return true; } catch (e) { return false; }
};
const SYNC_GAME = "ongeki";
const cleanAccount = (s) => s.normalize("NFKC").replace(/[a-z]/g, (c) => c.toUpperCase()).trim()
.replace(/[\\/:*?"<>|#%\u0000-\u001f]+/g, "_").replace(/\s+/g, " ").replace(/^\.+/, "").slice(0, 40);
const b64enc = (str) => {
const bytes = new TextEncoder().encode(str);
let bin = "";
for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
return btoa(bin);
};
const b64dec = (b64) => {
const bin = atob(b64.replace(/\s/g, ""));
const bytes = new Uint8Array(bin.length);
for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
return new TextDecoder().decode(bytes);
};
const syncFetch = async (acc, suffix, init) => {
let res;
try {
res = await fetch(SYNC_URL.replace(/\/+$/, "") + "/" + SYNC_GAME + "/" + encodeURIComponent(acc) + (suffix || ""),
Object.assign({ cache: "no-store" }, init));
} catch (e) {
throw new Error("连不上同步服务");
}
if (res.status === 401 || res.status === 403 || res.status >= 500) throw new Error("同步服务出错（HTTP " + res.status + "）");
return res;
};
const syncGet = async (acc) => {
const res = await syncFetch(acc);
if (res.status === 404) return { data: null, sha: null };
if (!res.ok) throw new Error("读取失败 HTTP " + res.status);
const j = await res.json();
let text;
if (j.encoding === "base64" && j.content) text = b64dec(j.content);
else {
const raw = await syncFetch(acc, "/raw");
if (!raw.ok) throw new Error("读取失败 HTTP " + raw.status);
text = await raw.text();
}
try { return { data: JSON.parse(text), sha: j.sha }; } catch (e) { throw new Error("云端数据损坏"); }
};
const syncPut = async (acc, data, sha) => {
const body = { message: "update " + SYNC_GAME + "/" + acc + " " + nowStr(), content: b64enc(JSON.stringify(data)) };
if (sha) body.sha = sha;
const res = await syncFetch(acc, "", { method: "PUT", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
if (res.status === 409 || res.status === 422) return false;
if (!res.ok) throw new Error("写入失败 HTTP " + res.status);
return true;
};
const syncMerge = async (acc, local) => {
for (let attempt = 0; attempt < 3; attempt++) {
const { data, sha } = await syncGet(acc);
const merged = data && data.obs ? mergeHist(normalizeKeys(migrateHist(data)), local) : local;
if (data && JSON.stringify(data) === JSON.stringify(merged)) return merged;
if (await syncPut(acc, merged, sha)) return merged;
}
throw new Error("多次写入冲突，请稍后再试");
};
const ACC_KEY = "ongeki-accounts"; // 这台设备上「オンゲキ玩家名 → 同步用的名字」
const loadAccounts = () => { try { return JSON.parse(localStorage.getItem(ACC_KEY) || "{}"); } catch (e) { return {}; } };
const saveAccounts = (a) => { try { localStorage.setItem(ACC_KEY, JSON.stringify(a)); } catch (e) {} };
const askAccount = async () => {
for (;;) {
const input = prompt(
"历史记录要同步到云端的哪个名字？\n每个人请用不同的名字；换手机时填相同的名字即可接着同步。\n点「取消」= 只保存在本机",
cleanAccount(playerName || ""));
if (input == null) return null;
const acc = cleanAccount(input);
if (!acc) continue;
const { data } = await syncGet(acc);
if (data && data.name && playerName && data.name !== playerName &&
!confirm(`「${acc}」里已经有玩家「${data.name}」的记录。\n确定要把你的记录也存进去吗？（不是同一个人的话请换一个名字）`)) continue;
return acc;
}
};
let syncNote = "";
let hist = emptyHist();
async function recordAndSync(forceAsk, reset) {
let plays = [];
let playNote = "";
try {
log("正在读取プレイ履歴 ...");
plays = parsePlaylog((await getDoc(NET + "/record/playlog/")).doc);
if (!plays.length) playNote = "（プレイ履歴未能解析，只用成绩扫描）";
} catch (e) {
playNote = "（プレイ履歴读取失败）";
}
const local = reset ? emptyHist() : normalizeKeys(loadLocalHist());
if (reset) local.resetAt = nowStr(); // 重开的时间：合并时起点以它为准（见 mergeHist）
if (!local.since) log("历史记录从这次开始：保存当前全部已游玩谱面的成绩作为起点（之前的游玩不记）");
const lastQuery = [...local.snaps.map((x) => x.t), ...local.obs.filter((o) => o.src === "b").map((o) => o.t)].sort().pop() || "";
plays = lastQuery ? plays.filter((o) => o.t >= lastQuery) : [];
hist = applyUpdate(local, plays);
syncNote = (saveLocalHist(hist) ? "历史记录已保存在本机" : "本机存储空间不足，历史记录未保存") + playNote;
if (!SYNC_URL) return;
const accounts = loadAccounts();
const me = playerName || "_";
let acc = forceAsk ? undefined : accounts[me];
try {
if (acc === undefined) {
await syncFetch("_ping"); // 先确认连得上，连不上就不弹窗询问（抛出的错误会显示在「历史」页）
acc = await askAccount();
accounts[me] = acc;
saveAccounts(accounts);
}
if (!acc) { syncNote += "（未开启云端同步）"; return; }
log("正在同步历史记录 ...");
hist = await syncMerge(acc, hist);
saveLocalHist(hist);
syncNote = "历史记录已同步（" + SYNC_GAME + "/" + acc + "）" + playNote;
} catch (e) {
syncNote = "同步失败：" + e.message + "。已保存在本机，下次运行会重试" + playNote;
}
}
await recordAndSync(false);
const HW = 1200, HP = 32;
const signed = (x, digits = 3) => (x >= 0 ? "+" : "−") + Math.abs(x).toFixed(digits);
const newCanvas = (w, h) => {
const cv = document.createElement("canvas");
cv.width = w;
cv.height = h;
const ctx = cv.getContext("2d");
if (!ctx) throw new Error(`浏览器无法创建这么大的图片（${w}×${h}）`);
ctx.fillStyle = C.bg;
ctx.fillRect(0, 0, w, h);
ctx.textBaseline = "alphabetic";
return { cv, ctx };
};
const toImage = (cv) => new Promise((resolve, reject) => {
try {
cv.toBlob((b) => (b ? resolve({ blob: b, url: URL.createObjectURL(b) }) : reject(new Error("toBlob failed"))), "image/png");
} catch (e) {
reject(e);
}
});
function histStat(ctx, label, value, right, color, big) {
ctx.textAlign = "right";
ctx.fillStyle = C.muted;
ctx.font = f(700, 14);
ctx.fillText(label, right, 52);
ctx.fillStyle = color;
ctx.font = f(800, big ? 46 : 32);
ctx.fillText(value, right, 100);
ctx.textAlign = "left";
}
function histSection(ctx, label, y, color) {
ctx.fillStyle = C.line;
ctx.fillRect(HP, y, HW - HP * 2, 1);
ctx.fillStyle = color;
ctx.font = f(800, 20);
ctx.fillText(label, HP, y + 32);
}
function diffBadge(ctx, d, x, y, extra) {
return pill(ctx, (DIFF_SHORT[d] || d) + (extra ? " " + extra : ""), x, y, C[d] || C.muted, 13);
}
function lineChart(ctx, x, y, w, h, series, opt) {
const pts = series.flatMap((s) => s.pts);
if (!pts.length) return;
let t0 = Math.min(...pts.map((p) => p[0])), t1 = Math.max(...pts.map((p) => p[0]));
let v0 = Math.min(...pts.map((p) => p[1])), v1 = Math.max(...pts.map((p) => p[1]));
if (t1 - t0 < 864e5) { t0 -= 432e5; t1 += 432e5; }
const span = Math.max(v1 - v0, opt.minSpan);
const mid = (v0 + v1) / 2;
v0 = mid - span * 0.6;
v1 = mid + span * 0.6;
if (opt.maxV != null) v1 = Math.min(v1, opt.maxV);
const L = x + 90, R = x + w - 16, T = y + 16, B = y + h - 70;
const X = (t) => L + ((t - t0) / (t1 - t0)) * (R - L);
const Y = (v) => B - ((v - v0) / (v1 - v0)) * (B - T);
rrect(ctx, x, y, w, h, 12);
ctx.fillStyle = C.card;
ctx.fill();
ctx.font = f(500, 14);
ctx.textAlign = "right";
for (let i = 0; i <= 4; i++) {
const v = v0 + ((v1 - v0) * i) / 4;
ctx.strokeStyle = "rgba(255,255,255,0.08)";
ctx.lineWidth = 1;
ctx.beginPath(); ctx.moveTo(L, Y(v)); ctx.lineTo(R, Y(v)); ctx.stroke();
ctx.fillStyle = C.muted;
ctx.fillText(opt.fmt(v), L - 10, Y(v) + 5);
}
(opt.refs || []).forEach((r) => {
if (r.v < v0 || r.v > v1) return;
ctx.strokeStyle = "rgba(255,211,107,0.35)";
ctx.setLineDash([6, 6]);
ctx.beginPath(); ctx.moveTo(L, Y(r.v)); ctx.lineTo(R, Y(r.v)); ctx.stroke();
ctx.setLineDash([]);
ctx.fillStyle = C["SSS+"];
ctx.textAlign = "left";
ctx.fillText(r.label, L + 6, Y(r.v) - 5);
ctx.textAlign = "right";
});
ctx.textAlign = "center";
ctx.fillStyle = C.muted;
const ticks = Math.min(6, Math.max(2, Math.round((t1 - t0) / 864e5) + 1));
for (let i = 0; i < ticks; i++) {
const t = t0 + ((t1 - t0) * i) / (ticks - 1);
const d = new Date(t);
ctx.fillText(`${d.getMonth() + 1}/${d.getDate()}`, X(t), B + 24);
}
ctx.textAlign = "left";
series.forEach((s) => {
if (!s.pts.length) return;
ctx.strokeStyle = s.color;
ctx.fillStyle = s.color;
ctx.lineWidth = s.width || 3;
if (s.line !== false) {
ctx.beginPath();
s.pts.forEach((p, i) => {
if (i === 0) ctx.moveTo(X(p[0]), Y(p[1]));
else if (s.step) { ctx.lineTo(X(p[0]), Y(s.pts[i - 1][1])); ctx.lineTo(X(p[0]), Y(p[1])); }
else ctx.lineTo(X(p[0]), Y(p[1]));
});
if (s.step) ctx.lineTo(R, Y(s.pts[s.pts.length - 1][1]));
ctx.stroke();
}
if (s.dots !== false) s.pts.forEach((p) => { ctx.beginPath(); ctx.arc(X(p[0]), Y(p[1]), s.dot || 4, 0, Math.PI * 2); ctx.fill(); });
});
let lx = L;
series.forEach((s) => {
if (!s.label) return;
ctx.fillStyle = s.color;
ctx.fillRect(lx, y + h - 22, 18, 4);
ctx.fillStyle = C.fg;
ctx.font = f(500, 14);
ctx.fillText(s.label, lx + 24, y + h - 15);
lx += 40 + ctx.measureText(s.label).width;
});
}
function ratingPair(u) {
const a = u.after;
const b = u.before && {
...u.before,
l: u.before.has.l ? u.before.l : a.l,
fb: u.before.has.fb ? u.before.fb : a.fb,
st: u.before.has.ps ? u.before.st : a.st,
};
const hasStar = u.changes.some((c) => c.type === "star");
return {
r0: b ? tsMilliOf(u.k, b) : null, r1: tsMilliOf(u.k, a),
p0: hasStar && b ? psUnitsOf(u.k, b) : null, p1: hasStar ? psUnitsOf(u.k, a) : null,
};
}
function drawRatingChange(ctx, right, y, u, size = 14) {
const { r0, r1, p0, p1 } = ratingPair(u);
let x = right;
const seg = (text, color, weight = 500) => {
ctx.font = f(weight, size);
ctx.fillStyle = color;
const w = ctx.measureText(text).width;
ctx.fillText(text, x - w, y);
x -= w + 8;
};
if (r1 == null) { seg("定数未知", C.muted); return right - x; }
if (p1 != null) {
const d = p0 != null ? p1 - p0 : null;
if (d != null) seg((d > 0 ? "+" : "±") + fmtPs(Math.abs(d) / 1e5), d > 0 ? GOOD : C.muted, 800);
seg(fmtPs(p1 / 1e5), C.plat, 800);
seg("P " + (p0 != null ? fmtPs(p0 / 1e5) + " →" : "→"), C.muted);
x -= 10;
}
if (p1 != null && !u.changes.some((c) => c.type === "ts" || c.type === "lamp" || c.type === "fb")) return right - x;
const d = r0 != null ? r1 - r0 : null;
if (d != null) seg((d > 0 ? "+" : "±") + (Math.abs(d) / 1000).toFixed(3), d > 0 ? GOOD : C.muted, 800);
seg((r1 / 1000).toFixed(3), C.accent, 800);
seg("Rating " + (r0 != null ? (r0 / 1000).toFixed(3) + " →" : "→"), C.muted);
return right - x;
}
async function drawTrend() {
const { updates } = derive(hist);
const impact = accountImpact(hist, updates);
const snaps = hist.snaps;
const last = snaps[snaps.length - 1], prev = snaps[snaps.length - 2];
const rows = []; // {side:'L'|'R', d, n, color, right, sub}
let upMore = 0;
if (last && prev) {
const toMap = (s) => new Map([...s.best, ...s.news].map((e) => [e[0], e]));
const a = toMap(prev), b = toMap(last);
const ups = [];
b.forEach((e, k) => {
const o = a.get(k);
if (!o) { rows.push({ side: "L", e, color: GOOD, right: "新进" + (e[3] != null ? " " + (e[3] / 1000).toFixed(3) : " " + e[2].toLocaleString("en-US")) }); return; }
const why = [];
if (e[2] > o[2]) why.push("+" + (e[2] - o[2]).toLocaleString("en-US"));
if (e[4] != null && o[4] != null && LAMP_RANK[e[4]] > LAMP_RANK[o[4]]) why.push(`${o[4] || "CLEAR"}→${e[4]}`);
if (e[5] && o[5] === 0) why.push("+FB");
const dr = e[3] != null && o[3] != null ? e[3] - o[3] : null;
if (why.length || dr > 0) ups.push({ e, dr, why });
});
ups.sort((p, q) => (q.dr || 0) - (p.dr || 0));
upMore = Math.max(0, ups.length - 10);
ups.slice(0, 10).forEach(({ e, dr, why }) => rows.push({
side: "L", e, color: dr == null || dr > 0 ? C["SSS+"] : C.muted,
right: dr == null ? e[2].toLocaleString("en-US")
: dr > 0 ? `${((e[3] - dr) / 1000).toFixed(3)} → ${(e[3] / 1000).toFixed(3)}（+${(dr / 1000).toFixed(3)}）`
: `${(e[3] / 1000).toFixed(3)}（rating 不变）`,
sub: why.join(" · "),
}));
a.forEach((e, k) => {
if (!b.has(k)) rows.push({ side: "R", e, color: "#ff8a8a", right: "移出" + (e[3] != null ? " " + (e[3] / 1000).toFixed(3) : " " + e[2].toLocaleString("en-US")) });
});
if (prev.ps && last.ps) {
const pa = new Map(prev.ps.map((e) => [e[0], e])), pb2 = new Map(last.ps.map((e) => [e[0], e]));
pb2.forEach((e, k) => {
const o = pa.get(k);
if (!o) rows.push({ side: "L", e, p: true, color: GOOD, right: `新进 ☆${e[2]} P ${fmtPs(e[3] / 1e5)}` });
else if (e[2] > o[2]) rows.push({ side: "L", e, p: true, color: C.plat, right: `☆${o[2]}→☆${e[2]}  P ${fmtPs(o[3] / 1e5)} → ${fmtPs(e[3] / 1e5)}` });
});
pa.forEach((e, k) => { if (!pb2.has(k)) rows.push({ side: "R", e, p: true, color: "#ff8a8a", right: `移出 P ${fmtPs(e[3] / 1e5)}` }); });
}
}
const recent = updates.slice(-20).reverse();
const ROW = 34, SUBROW = 20, PB_ROW = 58;
const colRows = (side) => rows.filter((r) => r.side === side).reduce((a, r) => a + ROW + (r.sub ? SUBROW : 0), 0);
const changeH = Math.max(colRows("L") + (upMore ? ROW : 0), colRows("R"), ROW);
const H = 150 + 380 + 30 + 86 + changeH + 30 + 64 + Math.max(recent.length, 1) * PB_ROW + 50;
const { cv, ctx } = newCanvas(HW, H);
ctx.fillStyle = C.accent;
ctx.font = f(800, 16);
ctx.fillText("O.N.G.E.K.I.  RATING HISTORY", HP, 42);
ctx.fillStyle = C.fg;
ctx.font = f(800, 42);
ctx.fillText(fit(ctx, playerName || hist.name || "", 520), HP, 96);
const line = snaps.filter((s) => s.r).map((s) => [timeMs(s.t), s.r]).sort((a, b) => a[0] - b[0]);
const days = new Map();
for (const [ms, r] of line) {
const d = new Date(ms);
days.set(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).getTime(), r);
}
const daily = [...days.entries()];
if (line.length) {
const now = line[line.length - 1][1];
const base30 = [...line].reverse().find((pt) => pt[0] <= Date.now() - 30 * 864e5) || line[0];
histStat(ctx, "RATING", now.toFixed(3), HW - HP, C["SSS+"], true);
histStat(ctx, "30 天", signed(now - base30[1]), HW - HP - 230, C.plat);
histStat(ctx, "累计", signed(now - line[0][1]), HW - HP - 400, C.accent);
}
ctx.fillStyle = C.muted;
ctx.font = f(500, 14);
ctx.fillText(line.length ? `${daily.length} 天的记录（${new Date(line[0][0]).toLocaleDateString("ja-JP")} – ${new Date(line[line.length - 1][0]).toLocaleDateString("ja-JP")}）` : "", HP, 128);
let y = 150;
lineChart(ctx, HP, y, HW - HP * 2, 360, [
{ label: "RATING（游戏内，每天）", color: C["SSS+"], pts: daily, width: 4 },
], { minSpan: 0.05, fmt: (v) => v.toFixed(3) });
if (daily.length === 1) {
ctx.fillStyle = C.muted;
ctx.font = f(500, 16);
ctx.textAlign = "center";
ctx.fillText("目前只有 1 天的记录，以后每天运行一次就能连成线", HW / 2, y + 60);
ctx.textAlign = "left";
}
y += 380;
histSection(ctx, "B50 / P-SCORE50 变化" + (prev ? `（对比 ${prev.t}）` : ""), y, C.accent);
if (prev) {
const dr = Math.round((last.r - prev.r) * 1000);
ctx.textAlign = "right";
ctx.font = f(800, 18);
ctx.fillStyle = dr > 0 ? GOOD : dr < 0 ? "#ff8a8a" : C.muted;
ctx.fillText(`账号 Rating ${prev.r.toFixed(3)} → ${last.r.toFixed(3)}　${dr > 0 ? "+" : dr < 0 ? "−" : "±"}${(Math.abs(dr) / 1000).toFixed(3)}`, HW - HP, y + 32);
if (prev.parts && last.parts) {
const fmt = (d) => (d > 0 ? "+" : d < 0 ? "−" : "±") + (Math.abs(d) / 1000).toFixed(3);
ctx.font = f(500, 14);
ctx.fillStyle = C.muted;
ctx.fillText(["NEW10", "BEST50", "P-SCORE50"].map((name, i) => `${name} ${fmt(last.parts[i] - prev.parts[i])}`).join("　·　"), HW - HP, y + 56);
}
ctx.textAlign = "left";
}
y += 86;
const colW = (HW - HP * 2 - 24) / 2;
const rowText = (x, yy, r) => {
const d = r.e[0].split("|")[1]; // 键 = 曲名|难度[|艺术家]
let bw = diffBadge(ctx, d, x, yy);
if (r.p) bw += 4 + pill(ctx, "P", x + bw + 4, yy, C.plat, 13);
ctx.font = f(700, 15);
const rw = ctx.measureText(r.right).width;
ctx.fillStyle = C.fg;
ctx.font = f(500, 16);
ctx.fillText(fit(ctx, nameOfKey(r.e[0], r.e[1]), colW - bw - rw - 24), x + bw + 8, yy);
ctx.textAlign = "right";
ctx.fillStyle = r.color;
ctx.font = f(700, 15);
ctx.fillText(r.right, x + colW - 6, yy);
if (r.sub) {
ctx.fillStyle = C.muted;
ctx.font = f(500, 13);
ctx.fillText(r.sub, x + colW - 6, yy + SUBROW);
}
ctx.textAlign = "left";
return ROW + (r.sub ? SUBROW : 0);
};
ctx.font = f(700, 15);
if (!prev) {
ctx.fillStyle = C.muted;
ctx.fillText("还没有上一次的快照可以对比", HP, y);
} else if (!rows.length) {
ctx.fillStyle = C.muted;
ctx.fillText("和上次相比没有变化", HP, y);
} else {
let yy = y;
rows.filter((r) => r.side === "L").forEach((r) => { yy += rowText(HP, yy, r); });
if (upMore) {
ctx.fillStyle = C.muted;
ctx.font = f(500, 15);
ctx.fillText(`另有 ${upMore} 首提升`, HP, yy);
}
yy = y;
rows.filter((r) => r.side === "R").forEach((r) => { yy += rowText(HP + colW + 24, yy, r); });
}
y += changeH;
y += 6;
histSection(ctx, "最近的推分", y, C["SSS+"]);
y += 64;
if (!recent.length) {
ctx.fillStyle = C.muted;
ctx.font = f(700, 15);
ctx.fillText("暂无记录。TS、FC/AB/FB 标记、プラチナスコア☆有提升时会记在这里", HP, y);
}
recent.forEach((u) => {
ctx.fillStyle = C.muted;
ctx.font = f(500, 14);
ctx.fillText(u.t + (u.src === "b" ? "*" : ""), HP, y);
const bw = diffBadge(ctx, u.d, HP + 150, y);
const what = changeText(u);
ctx.font = f(800, 15);
const ww = Math.min(ctx.measureText(what).width, 520);
ctx.fillStyle = C.fg;
ctx.font = f(500, 16);
ctx.fillText(fit(ctx, nameOfKey(u.k, u.n), HW - HP * 2 - 150 - bw - ww - 30), HP + 150 + bw + 8, y);
ctx.textAlign = "right";
ctx.fillStyle = C["SSS+"];
ctx.font = f(800, 15);
ctx.fillText(fit(ctx, what, 520), HW - HP, y);
ctx.textAlign = "left";
const rw = drawRatingChange(ctx, HW - HP, y + 24, u, 14);
const [itext, icolor] = impactText(impact.get(u));
ctx.fillStyle = icolor;
ctx.font = f(icolor === GOOD ? 700 : 500, 14);
ctx.fillText(fit(ctx, itext, HW - HP * 2 - 150 - rw - 20), HP + 150, y + 24);
ctx.fillStyle = "rgba(255,255,255,0.06)";
ctx.fillRect(HP, y + 36, HW - HP * 2, 1);
y += PB_ROW;
});
ctx.fillStyle = C.muted;
ctx.font = f(500, 13);
ctx.fillText(fit(ctx, `${new Date().toLocaleString("ja-JP")}  ·  时间后的 * = 由成绩扫描发现（时间为运行书签的时间）  ·  单曲 rating 按现在的定数计算  ·  账号 Rating 的影响按三个枠各自 ÷50 截断推算`, HW - HP * 2), HP, H - 18);
return toImage(cv);
}
async function drawSongCurve(e) {
const obs = hist.obs.filter((o) => o.k === e.k).sort(byTime);
const plays = obs.filter((o) => o.src === "p");
const { state, updates } = derive(hist);
const impact = accountImpact(hist, updates);
const mine = updates.filter((u) => u.k === e.k).reverse().slice(0, 12);
const cur = state[e.k];
const pbPts = [];
let best = -1;
obs.forEach((o) => { if (o.s > best) { best = o.s; pbPts.push([timeMs(o.t), o.s]); } });
const chart = chartByKey.get(e.k);
const jacket = chart ? await loadJacket(chart.img) : null;
const rows = plays.slice(-15).reverse();
const ROW = 32, UROW = 58;
const H = 170 + 400 + 30 + 64 + Math.max(mine.length, 1) * UROW + 20 + 64 + Math.max(rows.length, 1) * ROW + 50;
const { cv, ctx } = newCanvas(HW, H);
const J = 120;
if (jacket) {
ctx.save();
rrect(ctx, HP, 24, J, J, 10);
ctx.clip();
ctx.drawImage(jacket, HP, 24, J, J);
ctx.restore();
}
const tx = jacket ? HP + J + 20 : HP;
ctx.fillStyle = C.accent;
ctx.font = f(800, 16);
ctx.fillText("O.N.G.E.K.I.  SCORE HISTORY  ·  " + (playerName || hist.name || ""), tx, 46);
ctx.fillStyle = C.fg;
ctx.font = f(800, 36);
ctx.fillText(fit(ctx, nameOfKey(e.k, e.n), HW - tx - 300), tx, 92);
let px = tx + (chart ? constPill(ctx, chart, tx, 128, C[chart.difficulty] || C.muted, 14) : diffBadge(ctx, e.d, tx, 128)) + 8;
if (cur) {
if (cur.l) px += pill(ctx, cur.l, px, 128, C[cur.l] || C.muted, 13) + 6;
if (cur.fb) px += pill(ctx, "FB", px, 128, C.FB, 13) + 6;
if (cur.has.ps) drawStars(ctx, cur.st, px + 72, 129, 13, 2);
}
histStat(ctx, "BEST", best > 0 ? best.toLocaleString("en-US") : "-", HW - HP, C["SSS+"], true);
const rNow = cur ? tsMilliOf(e.k, cur) : null, pNow = cur && cur.has.ps ? psUnitsOf(e.k, cur) : null;
ctx.fillStyle = C.muted;
ctx.font = f(500, 14);
ctx.textAlign = "right";
ctx.fillText([best > 0 ? rankOf(best) : "", rNow != null ? "单曲 Rating " + (rNow / 1000).toFixed(3) : "",
pNow ? "P-rate " + fmtPs(pNow / 1e5) : "", `记录到 ${plays.length} 次游玩`].filter(Boolean).join("　·　"), HW - HP, 128);
ctx.textAlign = "left";
let y = 170;
const CHART_MIN = 940000;
const shownPlays = plays.filter((o) => o.s >= CHART_MIN);
const shownPb = pbPts.filter((pt) => pt[1] >= CHART_MIN);
const chartOpt = {
minSpan: 4000, maxV: 1010000, fmt: (v) => Math.round(v).toLocaleString("en-US"),
refs: [{ v: 1007500, label: "SSS+" }, { v: 1000000, label: "SSS" }, { v: 990000, label: "SS" }, { v: 970000, label: "S" }],
};
const placeholder = (text) => {
rrect(ctx, HP, y, HW - HP * 2, 400, 12);
ctx.fillStyle = C.card;
ctx.fill();
ctx.fillStyle = C.muted;
ctx.font = f(500, 16);
ctx.textAlign = "center";
ctx.fillText(text, HW / 2, y + 200);
ctx.textAlign = "left";
};
const playSeries = { label: "每次游玩（AAA 以上）", color: C.plat, pts: shownPlays.map((o) => [timeMs(o.t), o.s]), line: false, dot: 5 };
if (shownPlays.length >= 2) {
lineChart(ctx, HP, y, HW - HP * 2, 400, [
{ label: "个人最佳", color: C["SSS+"], pts: shownPb, step: true, dots: false, width: 3 }, playSeries,
], chartOpt);
} else if (shownPb.length >= 2) {
lineChart(ctx, HP, y, HW - HP * 2, 400, [
{ label: "个人最佳（成绩扫描）", color: C["SSS+"], pts: shownPb, step: true, dot: 4, width: 3 },
...(shownPlays.length ? [playSeries] : []),
], chartOpt);
} else if (!shownPb.length) {
placeholder("还没有 AAA（940,000）以上的成绩，曲线图只画 AAA 以上的成绩");
} else {
placeholder(`目前只记录到 1 个最佳分数（${best.toLocaleString("en-US")}），还没有可画的变化；分数提升、或プレイ履歴里出现游玩后就能画出曲线`);
}
y += 430;
histSection(ctx, "推分记录", y, C["SSS+"]);
y += 64;
if (!mine.length) {
ctx.fillStyle = C.muted;
ctx.font = f(700, 15);
ctx.fillText("还没有这首歌的推分记录", HP, y);
}
mine.forEach((u) => {
ctx.fillStyle = C.muted;
ctx.font = f(500, 15);
ctx.fillText(u.t + (u.src === "b" ? "*" : ""), HP, y);
ctx.fillStyle = C["SSS+"];
ctx.font = f(800, 16);
ctx.fillText(fit(ctx, changeText(u), HW - HP * 2 - 180), HP + 170, y);
const rw = drawRatingChange(ctx, HW - HP, y + 24, u, 14);
const [itext, icolor] = impactText(impact.get(u));
ctx.fillStyle = icolor;
ctx.font = f(icolor === GOOD ? 700 : 500, 14);
ctx.fillText(fit(ctx, itext, HW - HP * 2 - 170 - rw - 20), HP + 170, y + 24);
ctx.fillStyle = "rgba(255,255,255,0.06)";
ctx.fillRect(HP, y + 36, HW - HP * 2, 1);
y += UROW;
});
y += 20;
histSection(ctx, "最近的游玩", y, C.plat);
y += 64;
if (!rows.length) {
ctx.fillStyle = C.muted;
ctx.font = f(700, 15);
ctx.fillText("还没有这首歌的プレイ履歴记录（只有成绩扫描的数据）", HP, y);
}
const pbAt = new Map(), stAt = new Map();
let run = -1, rs = blankState();
obs.forEach((o) => {
if (o.src === "p") pbAt.set(o, run);
rs = absorb(rs, o).next;
if (o.src === "p") stAt.set(o, { ...rs, s: o.s });
if (o.s > run) run = o.s;
});
rows.forEach((o) => {
ctx.fillStyle = C.muted;
ctx.font = f(500, 15);
ctx.fillText(o.t, HP, y);
ctx.fillStyle = C.fg;
ctx.font = f(800, 18);
ctx.fillText(o.s.toLocaleString("en-US"), HP + 200, y);
ctx.fillStyle = C[rankOf(o.s)] || C.fg;
ctx.font = f(800, 15);
ctx.fillText(rankOf(o.s), HP + 330, y);
let bx = HP + 390;
for (const t of [o.l, o.fb ? "FB" : ""]) if (t) bx += pill(ctx, t, bx, y, C[t] || C.muted, 11) + 4;
const before = pbAt.get(o);
ctx.font = f(700, 15);
const nx = Math.max(bx + 8, HP + 480);
if (before >= 0 && o.s > before) { ctx.fillStyle = GOOD; ctx.fillText("NEW RECORD  +" + (o.s - before).toLocaleString("en-US"), nx, y); }
else if (before < 0 && o.nr) { ctx.fillStyle = GOOD; ctx.fillText("NEW RECORD", nx, y); }
else if (before >= 0) { ctx.fillStyle = C.muted; ctx.font = f(500, 14); ctx.fillText("距最佳 −" + (before - o.s).toLocaleString("en-US"), nx, y); }
const r = tsMilliOf(e.k, stAt.get(o));
if (r != null) {
ctx.textAlign = "right";
ctx.fillStyle = C.muted;
ctx.font = f(500, 14);
ctx.fillText("单曲 " + (r / 1000).toFixed(3), HW - HP, y);
ctx.textAlign = "left";
}
y += ROW;
});
ctx.fillStyle = C.muted;
ctx.font = f(500, 13);
ctx.fillText(`${new Date().toLocaleString("ja-JP")}  ·  data: オンゲキ-NET プレイ履歴 / 成绩扫描  ·  * = 由成绩扫描发现`, HP, H - 18);
return toImage(cv);
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const csvCell = (s) => (/[",\n]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s));
const toCsv = (rows, keys = Object.keys(rows[0])) =>
"﻿" + [keys, ...rows.map((r) => keys.map((k) => r[k] ?? ""))]
.map((r) => r.map(csvCell).join(",")).join("\r\n");
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const saveFile = async (name, blob) => {
const file = new File([blob], name, { type: blob.type });
if (navigator.canShare?.({ files: [file] })) {
try {
await navigator.share({ files: [file] });
return;
} catch (e) {
if (e.name === "AbortError") return; // 用户取消
}
}
const url = URL.createObjectURL(blob);
if (isIOS) {
window.open(url, "_blank") || (location.href = url);
return;
}
const a = document.createElement("a");
a.href = url;
a.download = name;
document.body.appendChild(a);
a.click();
a.remove();
};
const download = (name, text, type) => saveFile(name, new Blob([text], { type }));
const songKeys = ["frame", "const", "level", "difficulty", "title", "genre", "technical_score", "rank", "lamp", "full_bell", "rating", "platinum_star", "ps_rating", "platinum_max", "version", "const_unknown", "battle_score", "over_damage", "platinum_score"];
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
for (const [k, label] of [["b50", "B50 图"], ["filter", "筛选图"], ["table", "表格"], ["history", "历史"]]) {
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
group("难度", sel("oc-diff", `<option value="">全部</option>${DIFFS.filter((d) => !d.hidden).map((d) => `<option>${d.name}</option>`).join("")}`)),
group("范围", sel("oc-frame", `<option value="">全部</option><option value="B">ベスト枠(B50)</option><option value="N">新曲枠</option><option value="P">P-SCORE枠</option>`)),
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
mkBtn("JSON", () => download(`ongeki_scores_${stamp}.json`, JSON.stringify({ exported_at: new Date().toISOString(), rating: ratingInfo, official, summary, songs: all }, null, 1), "application/json"), moreBtns);
mkBtn("调试信息", async () => {
const info = JSON.stringify({
ua: navigator.userAgent,
charts: DIFFS.map((d) => `${d.name}:${charts.filter((s) => s.difficulty === d.name).length}`).join(" "),
rating: ratingInfo,
official,
unknownConst: charts.filter((s) => s.played && s.const_unknown).map((s) => `${s.difficulty} ${s.title} (${s.const_unknown})`),
matchLog,
sampleHtml: sampleHtml.replace(/\s+/g, " ").slice(0, 3000),
playlogSample,
history: { snaps: hist.snaps.length, obs: hist.obs.length, plays: hist.obs.filter((o) => o.src === "p").length, syncNote },
}, null, 1);
let box = more.querySelector("textarea");
if (!box) {
box = document.createElement("textarea");
box.readOnly = true;
box.style.cssText = "width:100%;height:200px;font:11px monospace;box-sizing:border-box;margin:6px 0";
moreBtns.after(box);
}
box.value = info;
try {
await navigator.clipboard.writeText(info);
box.placeholder = "";
alert("调试信息已复制，粘贴发给开发者即可。");
} catch (e) {
box.focus();
box.select();
}
}, moreBtns);
panel.appendChild(more);
const table = (rows, keys) =>
`<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;background:#fff"><table style="border-collapse:collapse;white-space:nowrap">` +
`<tr>${keys.map((k) => `<th style="border:1px solid #ccc;padding:2px 6px;background:#eee">${esc(k)}</th>`).join("")}</tr>` +
rows.map((r) => `<tr${r.frame && /^(B|N)d/.test(r.frame) ? ' style="background:#fff4d6"' : ""}>${keys.map((k) => {
let v = r[k];
if (v === true) v = "✓";
else if (v === false || v == null) v = "";
else if (k === "rating" && typeof v === "number") v = v.toFixed(3);
else if (k === "ps_rating" && typeof v === "number") v = fmtPs(v);
else if (k === "const" && typeof v === "number") v = v.toFixed(1);
return `<td style="border:1px solid #ccc;padding:2px 6px">${esc(v)}</td>`;
}).join("")}</tr>`).join("") +
`</table></div>`;
more.insertAdjacentHTML("beforeend", table(summary, Object.keys(summary[0])));
const showImage = ({ url, blob }, name, target = view) => {
target.innerHTML = "";
const tip = document.createElement("div");
tip.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:6px;color:#555";
mkBtn("保存图片", () => saveFile(name, blob), tip);
tip.append(isIOS ? "点「保存图片」→「存储图像」，或长按图片保存" : "也可以长按 / 右键图片保存");
const img = new Image();
img.src = url;
img.alt = name;
img.style.cssText = "width:100%;height:auto;display:block;border-radius:8px;-webkit-touch-callout:default;-webkit-user-select:auto;user-select:auto;pointer-events:auto";
target.append(tip, img);
};
const imageCache = {};
let timer = null;
let renderSeq = 0;
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
async function renderHistory(seq) {
view.innerHTML = "";
const card = (css) => {
const d = document.createElement("div");
d.style.cssText = "background:#fff;border-radius:10px;padding:10px;margin-bottom:8px;line-height:1.7;" + (css || "");
view.appendChild(d);
return d;
};
const { pb, updates } = derive(hist);
const info = card();
info.innerHTML = `<div>${esc(syncNote)}</div><div style="color:#555">${hist.since ? "从 " + esc(hist.since) + " 开始记录 · " : ""}${hist.snaps.length} 个 Rating 快照 · ` +
`${hist.obs.filter((o) => o.src === "p").length} 条游玩记录 · ${updates.length} 次推分</div>`;
const row = document.createElement("div");
row.style.cssText = "margin-top:6px;display:flex;flex-wrap:wrap;gap:6px";
if (SYNC_URL) {
mkBtn("更改同步名字", async () => {
await recordAndSync(true);
imageCache.trend = null;
render();
}, row);
}
mkBtn("从现在重新开始记录", async () => {
if (!confirm("清空这个账号的全部历史记录" + (SYNC_URL ? "（本机和云端）" : "") + "，把现在全部谱面的成绩当作新的起点，从现在开始重新记录？\n清空后无法恢复。")) return;
await recordAndSync(false, true);
imageCache.trend = null;
render();
}, row);
info.appendChild(row);
const pushed = new Set(updates.map((u) => u.k));
const songs = new Map();
hist.obs.forEach((o) => {
const e = songs.get(o.k) || { k: o.k, n: o.n, d: o.d, plays: 0, last: "" };
if (o.src === "p") e.plays++;
if (o.t > e.last) e.last = o.t;
songs.set(o.k, e);
});
const trendBox = card("padding:0;background:none");
trendBox.textContent = "正在生成走势图…";
const search = card();
search.innerHTML = '<b>单曲分数曲线</b><input id="oc-hq" placeholder="输入曲名搜索" autocomplete="off" ' +
'style="display:block;width:100%;box-sizing:border-box;margin:6px 0;padding:6px 8px;font-size:16px"><div id="oc-hlist"></div>';
const curveBox = card("display:none");
const listEl = search.querySelector("#oc-hlist");
const renderList = () => {
const q = norm(search.querySelector("#oc-hq").value).toLowerCase();
const items = [...songs.values()]
.filter((e) => (e.plays > 0 || pushed.has(e.k)) && (!q || norm(e.n).toLowerCase().includes(q)))
.sort((a, b) => b.plays - a.plays || (a.last < b.last ? 1 : -1))
.slice(0, 30);
listEl.innerHTML = items.length ? "" : '<div style="color:#888">没有记录（プレイ履歴里出现过、或有推分记录的谱面才会列在这里）</div>';
for (const e of items) {
const b = document.createElement("button");
b.style.cssText = "display:flex;width:100%;align-items:center;gap:6px;text-align:left;margin:3px 0;padding:7px 8px;" +
"border:1px solid #ddd;border-radius:8px;background:#fafafa;color:#222;font-size:14px";
b.innerHTML = `<span style="background:${C[e.d] || "#999"};color:#16151c;border-radius:4px;padding:0 5px;font-size:12px;font-weight:bold">${DIFF_SHORT[e.d] || e.d}</span>` +
`<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(nameOfKey(e.k, e.n))}</span>` +
`<span style="color:#777;font-size:12px">${(pb[e.k] || 0).toLocaleString("en-US")} · ${e.plays} 次</span>`;
b.onclick = async () => {
curveBox.style.display = "";
curveBox.textContent = "正在生成…";
curveBox.scrollIntoView({ behavior: "smooth", block: "start" });
try {
showImage(await drawSongCurve(e), `ongeki_${e.n.replace(/[\\/:*?"<>|\s]+/g, "_").slice(0, 40)}_${stamp}.png`, curveBox);
} catch (err) {
curveBox.textContent = "生成失败：" + err;
}
};
listEl.appendChild(b);
}
};
search.querySelector("#oc-hq").oninput = renderList;
renderList();
try {
const img = imageCache.trend = imageCache.trend || (await drawTrend());
if (seq === renderSeq) showImage(img, `ongeki_history_${stamp}.png`, trendBox);
} catch (err) {
trendBox.textContent = "走势图生成失败：" + err;
}
}
async function render() {
const seq = ++renderSeq;
for (const [k, b] of Object.entries(tabs)) {
b.style.background = k === tab ? "#d1127a" : "#fff";
b.style.color = k === tab ? "#fff" : "#222";
}
filters.style.display = tab === "b50" || tab === "history" ? "none" : "flex";
const desc = filterRows();
if (tab === "history") {
renderHistory(seq);
return;
}
if (tab === "table") {
const played = shownRows.filter((s) => s.played);
view.innerHTML =
`<div style="margin:4px 0 6px"><b>${shownRows.length} 条</b>（已游玩 ${played.length}，平均单曲rating ${avg(played, "rating").toFixed(3)}）· 黄色 = 计入 rating</div>` +
table(shownRows, innerWidth >= 768 ? songKeys : compactKeys);
return;
}
view.innerHTML = '<div style="padding:24px 0;color:#555">正在生成图片（加载曲绘中）…</div>';
let url, name;
if (tab === "b50") {
url = imageCache.b50 = imageCache.b50 || (await b50Image());
name = `ongeki_b50_${stamp}.png`;
} else {
const played = shownRows.filter((s) => s.played);
const rows = shownRows.slice(0, IMG.MAX_CARDS);
const count = (r) => played.filter((s) => s.rank === r).length;
url = await drawImage(
`${shownRows.length} 谱面`,
`${desc.join(" · ") || "全部谱面"} · 排序：${$("oc-sort").selectedOptions[0].text}`,
[
["已游玩", `${played.length}`, `${shownRows.length ? ((played.length / shownRows.length) * 100).toFixed(1) : 0}%`],
["平均 rating", avg(played, "rating").toFixed(3), `平均 TS ${Math.round(avg(played, "technical_score")).toLocaleString("en-US")}`],
["SSS+ / SSS", `${count("SSS+")} / ${count("SSS")}`, `SS ${count("SS")} · S ${count("S")}`],
["AB+ / AB / FC", `${played.filter((s) => s.lamp === "AB+").length} / ${played.filter((s) => s.lamp === "AB").length} / ${played.filter((s) => s.lamp === "FC").length}`, `FB ${played.filter((s) => s.full_bell).length}`],
],
[{
name: "筛选结果",
note: shownRows.length > rows.length ? `只显示前 ${rows.length} 个，请缩小筛选范围` : "",
rows,
label: (s, i) => `${i + 1}`,
mode: $("oc-sort").value === "ps" ? "ps" : "ts",
}]
);
name = `ongeki_filtered_${stamp}.png`;
}
if (seq === renderSeq) showImage(url, name); // 期间又切换了标签/筛选条件时，丢弃旧结果
}
const rerender = () => {
clearTimeout(timer);
timer = setTimeout(render, 400);
};
filters.addEventListener("input", rerender);
filters.addEventListener("change", rerender);
render();
})().catch((e) => alert("出错了：" + e));
