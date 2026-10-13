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
? { title: s.title, diff: s.diffKey, level: s.level, genre: s.genre, idx: s.idx, candidates: c.map((m) => `${m.genre} / Lv${m.level} / ${m.const} / ${m.artist}`) }
: null;
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
for (const s of charts) {
const m = await findConst(s);
s.const = m && m.const > 0 ? m.const : null;
s.const_unknown = !m ? "无数据" : m.ambiguous ? "同名未区分" : m.is_unknown ? "未确定" : "";
s.version = m?.version || "";
s.img = m?.img || "";
s.is_new = !!m && !!latestVersion && m.version === latestVersion;
s.is_bonus = !!m?.is_bonus;
s.rating = s.played && s.const ? tsRating(s.const, s) : 0;
s.ps_rating = s.const ? psRating(s.const, s.platinum_star) : 0;
s.frame = "";
delete s.diffKey;
delete s.idx;
}
const hiddenDiffs = new Set(DIFFS.filter((d) => d.hidden).map((d) => d.name));
const all = charts.filter((s) => !hiddenDiffs.has(s.difficulty)); // 筛选图 / 表格 / 汇总只显示 EXP/MAS/LUN
const eligible = charts.filter((s) => s.const && !s.is_bonus);
const byRating = (a, b) => b.rating - a.rating;
const new10 = eligible.filter((s) => s.is_new && s.rating > 0).sort(byRating).slice(0, 10);
const best50 = eligible.filter((s) => !s.is_new && s.rating > 0).sort(byRating).slice(0, 50);
const ps50 = eligible.filter((s) => s.ps_rating > 0).sort((a, b) => b.ps_rating - a.ps_rating).slice(0, 50);
new10.forEach((s, i) => (s.frame = `新曲${i + 1}`));
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
total: Math.floor((units.new10 + units.best50 + units.ps50) / 5000) / 1000,
exact: (units.new10 + units.best50 + units.ps50) / 50 / 1e5,
};
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
const stars = (n) => "★".repeat(Math.min(n, 5)) + "☆".repeat(Math.max(0, 5 - Math.min(n, 5)));
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
const diffText = `${DIFF_SHORT[s.difficulty] || ""} ${s.const != null ? s.const.toFixed(1) : "?"}${s.const_unknown ? "?" : ""}`;
let px = L + pill(ctx, diffText, L, y + 19, C[s.difficulty] || C.muted, 12) + 6;
ctx.font = f(600, 12);
ctx.fillStyle = C.muted;
ctx.fillText(`Lv${s.level}`, px, y + 19);
if (s.frame) {
ctx.textAlign = "right";
ctx.fillText(fit(ctx, s.frame, 90), R, y + 19);
ctx.textAlign = "left";
}
ctx.font = f(700, 16);
ctx.fillStyle = C.fg;
ctx.fillText(fit(ctx, s.title, TW), L, y + 42);
if (s.played) {
ctx.font = f(800, 18);
ctx.fillStyle = C.fg;
const ts = s.technical_score.toLocaleString("en-US");
ctx.fillText(ts, L, y + 66);
const tw = ctx.measureText(ts).width;
ctx.font = f(800, 14);
ctx.fillStyle = C[s.rank] || C.muted;
ctx.fillText(s.rank, L + tw + 6, y + 66);
let rx = R;
const tags = [];
if (s.full_bell) tags.push(["FB", C.FB]);
if (C[s.lamp]) tags.push([s.lamp, C[s.lamp]]);
for (const [t, c] of tags) {
ctx.font = f(800, 11);
rx -= ctx.measureText(t).width + 11;
pill(ctx, t, rx, y + 65, c, 11);
rx -= 4;
}
} else {
ctx.font = f(700, 15);
ctx.fillStyle = C.muted;
ctx.fillText("未游玩", L, y + 66);
}
ctx.font = f(600, 12);
ctx.fillStyle = C.muted;
const ps = s.platinum_score
? `PS ${s.platinum_score.toLocaleString("en-US")}${s.platinum_max ? " / " + s.platinum_max.toLocaleString("en-US") : ""}`
: "PS —";
ctx.fillText(fit(ctx, ps, TW - 70), L, y + 88);
ctx.textAlign = "right";
ctx.font = f(700, 13);
ctx.fillStyle = s.platinum_star ? C.star : C.line;
ctx.fillText(stars(s.platinum_star), R, y + 88);
ctx.textAlign = "left";
const main = mode === "ps" ? s.ps_rating : s.rating;
const sub = mode === "ps"
? `rating ${s.rating > 0 ? s.rating.toFixed(3) : "—"}`
: `P-rate ${s.ps_rating > 0 ? fmtPs(s.ps_rating) : "—"}`;
ctx.font = f(600, 12);
ctx.fillStyle = C.muted;
ctx.fillText(sub, L, y + 114);
ctx.textAlign = "right";
ctx.font = f(800, 22);
ctx.fillStyle = main > 0 ? (mode === "ps" ? C.plat : C.accent) : C.muted;
ctx.fillText(main > 0 ? (mode === "ps" ? fmtPs(main) : main.toFixed(3)) : "—", R, y + 115);
ctx.textAlign = "left";
}
async function drawImage(title, subtitle, stats, sections) {
const { W, PAD, COLS, GAP, CH, HEAD, SEC, FOOT, CW } = IMG;
const rowsOf = (n) => Math.max(1, Math.ceil(n / COLS));
const H = HEAD + sections.reduce((h, sec) => h + SEC + rowsOf(sec.rows.length) * (CH + GAP), 0) + FOOT;
const jackets = new Map();
await Promise.all(sections.flatMap((sec) => sec.rows).map(async (s) => jackets.set(s, await loadJacket(s.img))));
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
let y = HEAD;
for (const sec of sections) {
ctx.fillStyle = C.line;
ctx.fillRect(PAD, y + 6, W - PAD * 2, 1);
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
ctx.fillText(
`${new Date().toLocaleString("ja-JP")}  ·  估算值（仅 EXP/MAS/LUN），与游戏内会有少许出入  ·  定数・曲绘：reiwa.f5.si（定数后带 "?" 为未确定）`,
PAD, H - 16
);
try {
return cv.toDataURL("image/png");
} catch (e) {
if (jackets.size) {
for (const k of jacketCache.keys()) jacketCache.set(k, Promise.resolve(null));
return drawImage(title, subtitle, stats, sections);
}
throw e;
}
}
const stamp = new Date().toISOString().slice(0, 10);
const fmtPs = (v) => v.toFixed(5).replace(/(\.\d{3}\d*?)0+$/, "$1");
const avg = (arr, k) => (arr.length ? sum(arr, k) / arr.length : 0);
const ratingStats = () => [
["新曲枠", avg(new10, "rating").toFixed(3), `${new10.length}曲 合计 ${ratingInfo.new10.toFixed(2)}`],
["ベスト枠", avg(best50, "rating").toFixed(3), `${best50.length}曲 合计 ${ratingInfo.best50.toFixed(2)}`],
["P-SCORE枠", fmtPs(ratingInfo.ps50), `${ps50.length}曲 · ÷50 = ${(ratingInfo.ps50 / 50).toFixed(6)}`],
];
const b50Image = () =>
drawImage(
`Rating ${ratingInfo.total.toFixed(3)}`,
`新曲枠 10 + ベスト枠 50 + P-SCORE枠 50，合计 ÷ 50 = ${ratingInfo.exact.toFixed(6)}（截断到小数点后 3 位）`,
ratingStats(),
[
{ name: "新曲枠", note: `${latestVersion} · 平均 ${avg(new10, "rating").toFixed(3)}`, rows: new10, label: (s, i) => `#${i + 1}` },
{ name: "ベスト枠", note: `平均 ${avg(best50, "rating").toFixed(3)} · 最低 ${best50.length ? best50[best50.length - 1].rating.toFixed(3) : "—"}`, rows: best50, label: (s, i) => `#${i + 1}` },
]
);
const p50Image = () =>
drawImage(
`P-SCORE ${fmtPs(ratingInfo.ps50)}`,
`プラチナスコア枠：☆数 × 定数² ÷ 1000，取前 50`,
ratingStats(),
[{ name: "P-SCORE枠", note: `合计 ${fmtPs(ratingInfo.ps50)} · 最低 ${ps50.length ? fmtPs(ps50[ps50.length - 1].ps_rating) : "—"}`, rows: ps50, label: (s, i) => `P${i + 1}`, mode: "ps" }]
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
for (const [k, label] of [["b50", "B50 图"], ["p50", "P50 图"], ["filter", "筛选图"], ["table", "表格"]]) {
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
mkBtn("调试信息", async () => {
const info = JSON.stringify({
ua: navigator.userAgent,
charts: DIFFS.map((d) => `${d.name}:${charts.filter((s) => s.difficulty === d.name).length}`).join(" "),
rating: ratingInfo,
unknownConst: charts.filter((s) => s.played && s.const_unknown).map((s) => `${s.difficulty} ${s.title} (${s.const_unknown})`),
matchLog,
sampleHtml: sampleHtml.replace(/\s+/g, " ").slice(0, 3000),
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
rows.map((r) => `<tr${r.frame && /^(B|新曲)/.test(r.frame) ? ' style="background:#fff4d6"' : ""}>${keys.map((k) => {
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
const showImage = (url, name) => {
view.innerHTML = "";
const tip = document.createElement("div");
tip.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:6px;color:#555";
tip.textContent = "长按图片可以保存；双指可以放大。";
mkBtn("保存图片", () => saveUrl(name, url), tip);
const img = new Image();
img.src = url;
img.alt = name;
img.style.cssText = "width:100%;height:auto;display:block;border-radius:8px";
view.append(tip, img);
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
async function render() {
const seq = ++renderSeq;
for (const [k, b] of Object.entries(tabs)) {
b.style.background = k === tab ? "#d1127a" : "#fff";
b.style.color = k === tab ? "#fff" : "#222";
}
filters.style.display = tab === "b50" || tab === "p50" ? "none" : "flex";
const desc = filterRows();
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
} else if (tab === "p50") {
url = imageCache.p50 = imageCache.p50 || (await p50Image());
name = `ongeki_p50_${stamp}.png`;
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
