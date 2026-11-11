import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '9175279830:AAEmFqUuaLmqL42LFfDUKGX12VMd4DZmzRE';
const DEFAULT_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '6205371644';
const API_BASE = `https://api.telegram.org/bot${TOKEN}`;
const FILE_BASE = `https://api.telegram.org/file/bot${TOKEN}`;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const WORK_DIR = process.cwd();
const HISTORY_FILE = path.join(WORK_DIR, 'larouze_published_history.json');

const KEYBOARD = {
  keyboard: [
    [{ text: "📰 Voye 5 Post Tou Nèf (San Repetisyon)" }],
    [{ text: "📱 Louvri Studio Mobil" }, { text: "ℹ️ Kijan pou m fè 1 Afish" }]
  ],
  resize_keyboard: true,
  is_persistent: true
};

function decodeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, '')
    .trim();
}

async function translateToCreole(text) {
  if (!text || !text.trim()) return '';
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ht&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(6000) });
    const data = await res.json();
    let translated = data[0].map(x => x[0]).join('');
    return translated
      .replace(/\bHaïti\b/gi, 'Ayiti')
      .replace(/\bHaiti\b/gi, 'Ayiti')
      .replace(/\bPort-au-Prince\b/gi, 'Pòtoprens')
      .replace(/\bÉtats-Unis\b/gi, 'Etazini')
      .trim();
  } catch (e) {
    return text;
  }
}

async function sendText(chatId, text) {
  try {
    await fetch(`${API_BASE}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, reply_markup: KEYBOARD })
    });
  } catch (e) {}
}

function sendPhotoAndPost(chatId, imgPath, caption, postText) {
  try {
    execFileSync('curl', [
      '-s', '-X', 'POST', `${API_BASE}/sendPhoto`,
      '-F', `chat_id=${chatId}`,
      '-F', `photo=@${imgPath}`,
      '-F', `caption=${caption.substring(0, 1024)}`
    ]);
  } catch (e) {}

  if (postText) {
    try {
      execFileSync('curl', [
        '-s', '-X', 'POST', `${API_BASE}/sendMessage`,
        '-F', `chat_id=${chatId}`,
        '-F', `text=${postText}`
      ]);
    } catch (e) {}
  }
}

// Cross-platform FFmpeg Model A Poster Renderer (Works on Linux GitHub Actions & Windows)
function renderCloudPoster(photoPath, outPath, meta) {
  const esc = (s) => (s || '').replace(/['":\\]/g, '');
  const t1 = esc(meta.t1).substring(0, 28);
  const t2 = esc(meta.t2).substring(0, 28);
  const badge = esc(meta.badge).substring(0, 18);
  const kicker = esc(meta.kicker).substring(0, 28);

  const vf = [
    `scale=1080:1350:force_original_aspect_ratio=increase`,
    `crop=1080:1350`,
    `drawbox=x=0:y=820:w=1080:h=530:color=0x071120@0.92:t=fill`,
    `drawbox=x=0:y=820:w=1080:h=6:color=0xfbbf24:t=fill`,
    `drawbox=x=60:y=780:w=280:h=58:color=0xdc2626:t=fill`,
    `drawtext=text='${badge}':fontcolor=white:fontsize=28:x=85:y=796`,
    `drawtext=text='LAROUZE INFO  •  ${kicker}':fontcolor=0x38bdf8:fontsize=24:x=60:y=865`,
    `drawtext=text='${t1}':fontcolor=white:fontsize=50:x=60:y=925`,
    `drawtext=text='${t2}':fontcolor=0xfbbf24:fontsize=50:x=60:y=995`,
    `drawbox=x=60:y=1075:w=960:h=3:color=0x1e293b:t=fill`,
    `drawtext=text='ENFOMASYON VERIFYE 100%  •  SWIV LAROUZE INFO':fontcolor=0x94a3b8:fontsize=24:x=60:y=1110`
  ].join(',');

  execFileSync('ffmpeg', ['-y', '-i', photoPath, '-vf', vf, '-frames:v', '1', outPath], { stdio: 'ignore' });
}

async function fetchVerifiedPhoto(query, newsData, destPath) {
  if (newsData && newsData.newsImage) {
    try {
      const hdBingImg = newsData.newsImage.replace(/^http:/, 'https:') + '&w=1080&h=800&c=7';
      const imgRes = await fetch(hdBingImg, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(6000) });
      if (imgRes.ok) {
        const buf = Buffer.from(await imgRes.arrayBuffer());
        if (buf.length > 15000) {
          fs.writeFileSync(destPath, buf);
          return true;
        }
      }
    } catch (e) {}
  }

  try {
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(query)}&prop=pageimages&format=json&pithumbsize=1200`;
    const wRes = await fetch(wikiUrl, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(5000) });
    const wData = await wRes.json();
    const pages = wData.query ? wData.query.pages : {};
    for (const pid in pages) {
      if (pages[pid].thumbnail && pages[pid].thumbnail.source) {
        const imgRes = await fetch(pages[pid].thumbnail.source, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(6000) });
        if (imgRes.ok) {
          const buf = Buffer.from(await imgRes.arrayBuffer());
          if (buf.length > 20000) {
            fs.writeFileSync(destPath, buf);
            return true;
          }
        }
      }
    }
  } catch (e) {}

  try {
    const bUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&qft=+filterui:imagesize-large`;
    const bRes = await fetch(bUrl, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(5000) });
    const bHtml = await bRes.text();
    const matches = [...bHtml.matchAll(/murl&quot;:&quot;(https?:\/\/[^&]+?\.(?:jpg|jpeg|png))&quot;/gi)].map(m => m[1]);
    for (const imgUrl of matches.slice(0, 5)) {
      try {
        const imgRes = await fetch(imgUrl, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(5000) });
        if (imgRes.ok) {
          const buf = Buffer.from(await imgRes.arrayBuffer());
          if (buf.length > 20000) {
            fs.writeFileSync(destPath, buf);
            return true;
          }
        }
      } catch (err) {}
    }
  } catch (e) {}

  return false;
}

async function searchLiveNews(topic) {
  let rawTitle = '';
  let combinedDesc = '';
  let newsImage = '';
  let sourceName = 'Laprès Entènasyonal';

  try {
    const bingUrl = `https://www.bing.com/news/search?q=${encodeURIComponent(topic)}&format=rss`;
    const bRes = await fetch(bingUrl, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(6000) });
    const bXml = await bRes.text();
    const items = [...bXml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => m[1]);

    if (items.length > 0) {
      const first = items[0];
      const tMatch = first.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) || first.match(/<title>([\s\S]*?)<\/title>/);
      const imgMatch = first.match(/<News:Image>([\s\S]*?)<\/News:Image>/);
      const srcMatch = first.match(/<News:Source>([\s\S]*?)<\/News:Source>/);

      if (tMatch) rawTitle = decodeHtml(tMatch[1]);
      if (imgMatch) newsImage = decodeHtml(imgMatch[1]);
      if (srcMatch) sourceName = decodeHtml(srcMatch[1]);

      const descs = [];
      for (const item of items.slice(0, 2)) {
        const dMatch = item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) || item.match(/<description>([\s\S]*?)<\/description>/);
        if (dMatch) {
          const dClean = decodeHtml(dMatch[1]).replace(/\.\.\.$/, '.');
          if (dClean.length > 30) descs.push(dClean);
        }
      }
      combinedDesc = descs.join(' ');
    }
  } catch (e) {}

  if (!rawTitle) rawTitle = topic;
  if (!combinedDesc || combinedDesc.length < 50) {
    combinedDesc = `${rawTitle}. Otorite yo ak sous ofisyèl yo ap swiv evolisyon dosye sa a de prè pandan plis detay ap kontinye soti sou teren an.`;
  }

  const creoleTitle = await translateToCreole(rawTitle);
  const creoleDesc = await translateToCreole(combinedDesc);

  return {
    rawTitle,
    title: creoleTitle || rawTitle,
    desc: creoleDesc || combinedDesc,
    newsImage,
    sourceName
  };
}

function buildLarouzePost(topic, newsData) {
  const cleanTitle = (newsData.title || topic).replace(/[«»"]/g, '').trim();
  const words = cleanTitle.split(/\s+/);
  const half = Math.ceil(words.length / 2);
  let t1 = words.slice(0, half).join(' ').substring(0, 30).toUpperCase();
  let t2 = words.slice(half).join(' ').substring(0, 30).toUpperCase();
  if (!t2) t2 = "TOUT DETAY YO SOTI!";

  let bodyFacts = (newsData.desc || '').replace(/\s+/g, ' ').trim();
  if (bodyFacts.length < 220) {
    bodyFacts += ` Daprè sous ki pre dosye a (${newsData.sourceName || 'Laprès'}), devlopman sa a gen gwo enpak sou sitiyasyon aktyèl la epi otorite konsène yo ap prepare pwochen etap yo.`;
  }

  const postText =
`🚨 ${cleanTitle.toUpperCase()}!

📌 ${bodyFacts}

👇 Kisa ou panse de nouvèl sa a? Pataje opinyon pa w nan kòmantè yo!

📲 Swiv paj Larouze INFO pou w rete konekte 24 sou 24 ak tout gwo aktyalite verifye sou Ayiti ak lemond!

#LarouzeInfo #Ayiti #NouvelAyiti #Aktyalite #HaitiNews`;

  return {
    badge: "FLASH INFO",
    kicker: "AKTYALITE VERIFYE",
    t1,
    t2,
    postText
  };
}

async function processTopic(chatId, clean) {
  await sendText(chatId, `🔍 [CLOUD 24/7] M ap chèche nouvèl la, tradui l an Kreyòl epi pran vrè foto a pou: "${clean}"...`);
  try {
    const newsData = await searchLiveNews(clean);
    const meta = buildLarouzePost(clean, newsData);
    const ts = Date.now();
    const rawImg = path.join(WORK_DIR, `raw_${ts}.jpg`);
    const outImg = path.join(WORK_DIR, `poster_${ts}.jpg`);

    const gotPhoto = await fetchVerifiedPhoto(clean, newsData, rawImg);
    if (gotPhoto) {
      renderCloudPoster(rawImg, outImg, meta);
      sendPhotoAndPost(chatId, outImg, `✅ POST LAROUZE INFO PARE : ${meta.t1}`, meta.postText);
    } else {
      await sendText(chatId, meta.postText);
    }
  } catch (e) {
    await sendText(chatId, `⚠️ Erè: ${e.message}`);
  }
}

async function runHourlyBatch() {
  const topics = [
    "Alix Didier Fils-Aimé Haïti sécurité",
    "Police Nationale d'Haïti opération",
    "Diplomatie internationale ONU Haïti",
    "NASA James Webb telescope discovery",
    "Haïti Grenadiers CONCACAF"
  ];
  for (const t of topics) {
    await processTopic(DEFAULT_CHAT_ID, t);
  }
}

async function main() {
  // 1. Run Hourly Batch at start of cloud cycle
  if (process.env.RUN_HOURLY === 'true') {
    await runHourlyBatch();
  }

  // 2. Listen for Telegram Bot Commands for 55 minutes in the Cloud
  const endTime = Date.now() + 55 * 60 * 1000;
  let offset = 0;
  try {
    const initRes = await fetch(`${API_BASE}/getUpdates?offset=-1`);
    const initData = await initRes.json();
    if (initData.ok && initData.result.length > 0) {
      offset = initData.result[initData.result.length - 1].update_id + 1;
    }
  } catch (e) {}

  console.log("Larouze Cloud 24/7 Bot Listener active...");
  while (Date.now() < endTime) {
    try {
      const res = await fetch(`${API_BASE}/getUpdates?offset=${offset}&timeout=15`);
      const data = await res.json();
      if (data.ok && data.result.length > 0) {
        for (const upd of data.result) {
          offset = upd.update_id + 1;
          const msg = upd.message;
          if (!msg || !msg.text) continue;
          await processTopic(String(msg.chat.id), msg.text.trim());
        }
      }
    } catch (e) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

main();
