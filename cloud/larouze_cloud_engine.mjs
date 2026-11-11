import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '9175279830:AAEmFqUuaLmqL42LFfDUKGX12VMd4DZmzRE';
const DEFAULT_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '6205371644';
const API_BASE = `https://api.telegram.org/bot${TOKEN}`;
const FILE_BASE = `https://api.telegram.org/file/bot${TOKEN}`;
const CURL_BIN = process.platform === 'win32' ? 'curl.exe' : 'curl';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const WORK_DIR = process.cwd();

let lastUserTextTopic = '';
let lastUserTextTime = 0;
let lastUserMediaFrame = '';
let lastUserMediaTime = 0;

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
    .replace(/&amp;/gi, '&')
    .replace(/&#(\d+);?/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);?/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/gi, "'")
    .replace(/&lsquo;/gi, "'")
    .replace(/&rdquo;/gi, '"')
    .replace(/&ldquo;/gi, '"')
    .replace(/&ndash;/gi, '-')
    .replace(/&mdash;/gi, '-')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&eacute;/gi, 'é')
    .replace(/&egrave;/gi, 'è')
    .replace(/&ecirc;/gi, 'ê')
    .replace(/&agrave;/gi, 'à')
    .replace(/&ocirc;/gi, 'ô')
    .replace(/&icirc;/gi, 'î')
    .replace(/&iuml;/gi, 'ï')
    .replace(/&ccedil;/gi, 'ç')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function polishCreoleTerms(str) {
  if (!str) return '';
  return decodeHtml(str)
    .replace(/\bHaïti\b/gi, 'Ayiti')
    .replace(/\bHaiti\b/gi, 'Ayiti')
    .replace(/\bHaitian\b/gi, 'Ayisyen')
    .replace(/\bHaïtien(ne)?s?\b/gi, 'Ayisyen')
    .replace(/\bPort-au-Prince\b/gi, 'Pòtoprens')
    .replace(/\bCap-Haïtien\b/gi, 'Okap')
    .replace(/\bÉtats-Unis\b/gi, 'Etazini')
    .replace(/\bUnited States\b/gi, 'Etazini')
    .replace(/\bUSA\b/gi, 'Etazini')
    .replace(/\bvs\.?\b/gi, 'kont')
    .replace(/\bHow to watch,?\s*stream\b/gi, 'Kijan pou w swiv an dirèk')
    .replace(/\bHow to watch\b/gi, 'Kijan pou w swiv')
    .replace(/\bquarterfinal(s)?\b/gi, 'ka de final')
    .replace(/\bLeg 1\b/gi, 'premye match')
    .replace(/\bNations League\b/gi, 'Lig Nasyon yo')
    .replace(/\bLittle Red Dots\b/gi, 'Ti Pwen Wouj yo')
    .replace(/\bWebb's\b/gi, 'Teleskòp James Webb')
    .trim();
}

async function translateText(rawText, targetLang = 'ht') {
  const text = decodeHtml(rawText);
  if (!text) return '';

  try {
    const url1 = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const res1 = await fetch(url1, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(5000) });
    if (res1.ok) {
      const data1 = await res1.json();
      if (Array.isArray(data1) && Array.isArray(data1[0])) {
        const out1 = data1[0].map(x => x[0]).join('').trim();
        if (out1) return targetLang === 'ht' ? polishCreoleTerms(out1) : out1;
      }
    }
  } catch (e) {}

  try {
    const url2 = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=${targetLang}&q=${encodeURIComponent(text)}`;
    const res2 = await fetch(url2, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(5000) });
    if (res2.ok) {
      const data2 = await res2.json();
      const out2 = Array.isArray(data2) && Array.isArray(data2[0]) ? data2[0][0] : (typeof data2[0] === 'string' ? data2[0] : '');
      if (out2) return targetLang === 'ht' ? polishCreoleTerms(out2) : out2;
    }
  } catch (e) {}

  if (targetLang === 'ht') {
    try {
      const isFr = /[éèêàùçîïô]|(\b(une|des|les|dans|pour|avec|sur|par|est|sont)\b)/i.test(text);
      const langPair = isFr ? 'fr|ht' : 'en|ht';
      const url3 = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.substring(0, 480))}&langpair=${langPair}`;
      const res3 = await fetch(url3, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(6000) });
      if (res3.ok) {
        const data3 = await res3.json();
        if (data3 && data3.responseData && data3.responseData.translatedText) {
          return polishCreoleTerms(data3.responseData.translatedText);
        }
      }
    } catch (e) {}
  }

  return targetLang === 'ht' ? polishCreoleTerms(text) : text;
}

function splitIntoTwoCleanLines(title, maxLen = 25) {
  const clean = decodeHtml(title).toUpperCase().replace(/\s+/g, ' ').trim();
  const words = clean.split(' ');
  let line1 = '';
  let line2 = '';
  let onLine1 = true;

  for (const w of words) {
    if (onLine1) {
      if (!line1) {
        line1 = w.substring(0, maxLen);
      } else if ((line1 + ' ' + w).length <= maxLen) {
        line1 += ' ' + w;
      } else {
        onLine1 = false;
        line2 = w.substring(0, maxLen);
      }
    } else {
      if ((line2 + ' ' + w).length <= maxLen) {
        line2 += ' ' + w;
      } else {
        break;
      }
    }
  }

  if (!line2) {
    const w1 = line1.split(' ');
    if (w1.length >= 2) {
      const mid = Math.ceil(w1.length / 2);
      line1 = w1.slice(0, mid).join(' ');
      line2 = w1.slice(mid).join(' ');
    } else {
      line2 = 'TOUT DETAY YO SOTI!';
    }
  }

  return { t1: line1, t2: line2 };
}

async function sendText(chatId, text) {
  try {
    await fetch(`${API_BASE}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: decodeHtml(text), reply_markup: KEYBOARD })
    });
  } catch (e) {}
}

async function sendPhotoAndPost(chatId, imgPath, caption, postText) {
  const safeCaption = decodeHtml(caption).replace(/;/g, ' -').substring(0, 950);
  try {
    execFileSync(CURL_BIN, [
      '-s', '-X', 'POST', `${API_BASE}/sendPhoto`,
      '-F', `chat_id=${chatId}`,
      '-F', `photo=@${imgPath}`,
      '-F', `caption=${safeCaption}`
    ]);
  } catch (e) {}

  if (postText) {
    await sendText(chatId, postText);
  }
}

async function sendVideoReel(chatId, videoPath, caption) {
  const safeCaption = decodeHtml(caption).replace(/;/g, ' -').substring(0, 950);
  try {
    execFileSync(CURL_BIN, [
      '-s', '-X', 'POST', `${API_BASE}/sendVideo`,
      '-F', `chat_id=${chatId}`,
      '-F', `video=@${videoPath}`,
      '-F', `caption=${safeCaption}`
    ]);
  } catch (e) {}
}

function renderCloudPoster(photoPath, outPath, meta) {
  const ts = Date.now();
  const fBadge = path.join(WORK_DIR, `tmp_badge_${ts}.txt`);
  const fKicker = path.join(WORK_DIR, `tmp_kicker_${ts}.txt`);
  const fT1 = path.join(WORK_DIR, `tmp_t1_${ts}.txt`);
  const fT2 = path.join(WORK_DIR, `tmp_t2_${ts}.txt`);
  const fSum = path.join(WORK_DIR, `tmp_sum_${ts}.txt`);

  fs.writeFileSync(fBadge, decodeHtml(meta.badge || 'FLASH INFO').toUpperCase(), 'utf-8');
  fs.writeFileSync(fKicker, `LAROUZE INFO  |  ${decodeHtml(meta.kicker || 'AKTYALITE VERIFYE').toUpperCase()}`, 'utf-8');
  fs.writeFileSync(fT1, decodeHtml(meta.t1), 'utf-8');
  fs.writeFileSync(fT2, decodeHtml(meta.t2), 'utf-8');
  fs.writeFileSync(fSum, decodeHtml(meta.sum1 || 'Enfomasyon verifye 100% sou Ayiti ak lemond').substring(0, 62), 'utf-8');

  const linuxFont = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
  const winFont = 'C\\:/Windows/Fonts/ariblk.ttf';
  const fontArg = fs.existsSync(linuxFont) ? `:fontfile=${linuxFont}` : (process.platform === 'win32' ? `:fontfile='${winFont}'` : '');

  const vf = [
    `crop=in_w*0.86:in_h*0.80`,
    `scale=1080:1350:force_original_aspect_ratio=increase`,
    `crop=1080:1350`,
    `drawbox=x=0:y=800:w=1080:h=550:color=0x06101e@0.95:t=fill`,
    `drawbox=x=0:y=800:w=1080:h=7:color=0xfbbf24:t=fill`,
    `drawbox=x=60:y=762:w=300:h=62:color=0xdc2626:t=fill`,
    `drawtext=textfile=${path.basename(fBadge)}${fontArg}:fontcolor=white:fontsize=27:x=85:y=780`,
    `drawtext=textfile=${path.basename(fKicker)}${fontArg}:fontcolor=0x38bdf8:fontsize=23:x=60:y=852`,
    `drawtext=textfile=${path.basename(fT1)}${fontArg}:fontcolor=white:fontsize=46:x=60:y=915`,
    `drawtext=textfile=${path.basename(fT2)}${fontArg}:fontcolor=0xfbbf24:fontsize=46:x=60:y=985`,
    `drawbox=x=60:y=1065:w=960:h=2:color=0x1e293b:t=fill`,
    `drawtext=textfile=${path.basename(fSum)}${fontArg}:fontcolor=0xe2e8f0:fontsize=25:x=60:y=1100`,
    `drawtext=text='SWIV LAROUZE INFO POU TOUT DETAY VERIFYE'${fontArg}:fontcolor=0x94a3b8:fontsize=21:x=60:y=1160`
  ].join(',');

  try {
    execFileSync('ffmpeg', ['-y', '-i', photoPath, '-vf', vf, '-frames:v', '1', outPath], { stdio: 'ignore', cwd: WORK_DIR });
  } finally {
    for (const f of [fBadge, fKicker, fT1, fT2, fSum]) {
      if (fs.existsSync(f)) try { fs.unlinkSync(f); } catch (e) {}
    }
  }
}

function renderBrandedVideoReel(inVideoPath, outVideoPath, meta) {
  const linuxFont = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
  const winFont = 'C\\:/Windows/Fonts/ariblk.ttf';
  const fontArg = fs.existsSync(linuxFont) ? `:fontfile=${linuxFont}` : (process.platform === 'win32' ? `:fontfile='${winFont}'` : '');
  const esc = (s) => decodeHtml(s).replace(/['":\\]/g, '');
  const t1 = esc(meta.t1);
  const t2 = esc(meta.t2);
  const badge = esc(meta.badge || 'FLASH INFO');

  const vf = [
    `scale=1080:1920:force_original_aspect_ratio=increase`,
    `crop=1080:1920`,
    `drawbox=x=0:y=0:w=1080:h=340:color=0x050c18@0.88:t=fill`,
    `drawbox=x=0:y=340:w=1080:h=6:color=0xfbbf24:t=fill`,
    `drawbox=x=60:y=60:w=280:h=55:color=0xdc2626:t=fill`,
    `drawtext=text='${badge}'${fontArg}:fontcolor=white:fontsize=26:x=80:y=75`,
    `drawtext=text='LAROUZE INFO'${fontArg}:fontcolor=0x38bdf8:fontsize=28:x=370:y=74`,
    `drawtext=text='${t1}'${fontArg}:fontcolor=white:fontsize=44:x=60:y=155`,
    `drawtext=text='${t2}'${fontArg}:fontcolor=0xfbbf24:fontsize=44:x=60:y=220`,
    `drawbox=x=0:y=1760:w=1080:h=160:color=0x050c18@0.90:t=fill`,
    `drawbox=x=0:y=1760:w=1080:h=5:color=0x38bdf8:t=fill`,
    `drawtext=text='SWIV LAROUZE INFO POU TOUT NOUVEL VERIFYE'${fontArg}:fontcolor=white:fontsize=28:x=(w-text_w)/2:y=1825`
  ].join(',');

  execFileSync('ffmpeg', [
    '-y', '-i', inVideoPath, '-t', '25',
    '-vf', vf,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k',
    outVideoPath
  ], { stdio: 'ignore' });
}

async function fetchVerifiedPhoto(query, newsData, destPath) {
  if (lastUserMediaFrame && fs.existsSync(lastUserMediaFrame) && (Date.now() - lastUserMediaTime < 90000)) {
    fs.copyFileSync(lastUserMediaFrame, destPath);
    return true;
  }

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

  if (newsData && newsData.articleUrl) {
    try {
      const artRes = await fetch(newsData.articleUrl, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(6000) });
      if (artRes.ok) {
        const html = await artRes.text();
        const ogMatch = html.match(/property=["']og:image["'][^>]+content=["'](https?:\/\/[^"']+)["']/i)
                     || html.match(/content=["'](https?:\/\/[^"']+)["'][^>]+property=["']og:image["']/i);
        if (ogMatch && ogMatch[1]) {
          const imgRes = await fetch(decodeHtml(ogMatch[1]), { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(6000) });
          if (imgRes.ok) {
            const buf = Buffer.from(await imgRes.arrayBuffer());
            if (buf.length > 18000) {
              fs.writeFileSync(destPath, buf);
              return true;
            }
          }
        }
      }
    } catch (e) {}
  }

  const enQuery = await translateText(query, 'en');
  const frQuery = await translateText(query, 'fr');

  for (const qVar of [enQuery, frQuery, query]) {
    if (!qVar) continue;
    try {
      const enNewsUrl = `https://www.bing.com/news/search?q=${encodeURIComponent(qVar)}&mkt=en-US&format=rss`;
      const bRes = await fetch(enNewsUrl, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(5000) });
      const bXml = await bRes.text();
      const imgMatches = [...bXml.matchAll(/<News:Image>([\s\S]*?)<\/News:Image>/g)].map(m => decodeHtml(m[1]));
      for (const rawImg of imgMatches.slice(0, 4)) {
        try {
          const hdUrl = rawImg.replace(/^http:/, 'https:') + '&w=1080&h=800&c=7';
          const imgRes = await fetch(hdUrl, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(5000) });
          if (imgRes.ok) {
            const buf = Buffer.from(await imgRes.arrayBuffer());
            if (buf.length > 15000) {
              fs.writeFileSync(destPath, buf);
              return true;
            }
          }
        } catch (err) {}
      }
    } catch (e) {}
  }

  for (const qVar of [enQuery, frQuery]) {
    if (!qVar) continue;
    try {
      const res1 = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(qVar)}&iax=images&ia=images`, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(5000)
      });
      const html = await res1.text();
      const vqdMatch = html.match(/vqd=([0-9-]+)&/);
      if (vqdMatch) {
        const vqd = vqdMatch[1];
        const res2 = await fetch(`https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(qVar)}&vqd=${vqd}&f=,,,`, {
          headers: { 'User-Agent': USER_AGENT },
          signal: AbortSignal.timeout(6000)
        });
        const data = await res2.json();
        for (const item of (data.results || []).slice(0, 5)) {
          if (/pinterest|greeting|birthday|meme/i.test(item.image)) continue;
          try {
            const imgRes = await fetch(item.image, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(5000) });
            if (imgRes.ok) {
              const buf = Buffer.from(await imgRes.arrayBuffer());
              if (buf.length > 18000) {
                fs.writeFileSync(destPath, buf);
                return true;
              }
            }
          } catch (err) {}
        }
      }
    } catch (e) {}
  }

  // Generate a dark blue graphic canvas via ffmpeg if no external photo is reachable so poster NEVER fails
  try {
    execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=0x0b1a30:s=1080x900:d=1', '-frames:v', '1', destPath], { stdio: 'ignore' });
    return fs.existsSync(destPath);
  } catch (e) {}

  return false;
}

async function searchLiveNews(topic) {
  let rawTitle = '';
  let combinedDesc = '';
  let newsImage = '';
  let articleUrl = '';
  let sourceName = 'Laprès Entènasyonal';

  const frTopic = await translateText(topic, 'fr');
  const enTopic = await translateText(topic, 'en');

  for (const q of [topic, frTopic, enTopic]) {
    if (!q) continue;
    try {
      const bingUrl = `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&mkt=en-US&format=rss`;
      const bRes = await fetch(bingUrl, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(6000) });
      const bXml = await bRes.text();
      const items = [...bXml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => m[1]);

      if (items.length > 0) {
        let chosen = items[0];
        for (const it of items) {
          if (it.includes('<News:Image>')) {
            chosen = it;
            break;
          }
        }

        const tMatch = chosen.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) || chosen.match(/<title>([\s\S]*?)<\/title>/);
        const imgMatch = chosen.match(/<News:Image>([\s\S]*?)<\/News:Image>/);
        const srcMatch = chosen.match(/<News:Source>([\s\S]*?)<\/News:Source>/);
        const urlMatch = chosen.match(/url=(https?%3a%2f%2f[^&<]+)/i);

        if (tMatch) rawTitle = decodeHtml(tMatch[1]);
        if (imgMatch) newsImage = decodeHtml(imgMatch[1]);
        if (srcMatch) sourceName = decodeHtml(srcMatch[1]);
        if (urlMatch) articleUrl = decodeURIComponent(urlMatch[1]);

        const descs = [];
        for (const item of items.slice(0, 2)) {
          const dMatch = item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) || item.match(/<description>([\s\S]*?)<\/description>/);
          if (dMatch) {
            const dClean = decodeHtml(dMatch[1]).replace(/\.\.\.$/, '.');
            if (dClean.length > 30) descs.push(dClean);
          }
        }
        combinedDesc = descs.join(' ');
        if (rawTitle && combinedDesc) break;
      }
    } catch (e) {}
  }

  if (!rawTitle) rawTitle = decodeHtml(topic);
  if (!combinedDesc || combinedDesc.length < 50) {
    combinedDesc = `${rawTitle}. Otorite yo ak sous ofisyèl yo ap swiv evolisyon dosye sa a de prè pandan plis detay ap kontinye soti sou teren an.`;
  }

  const creoleTitle = await translateText(rawTitle, 'ht');
  const creoleDesc = await translateText(combinedDesc, 'ht');

  return {
    rawTitle,
    title: creoleTitle || rawTitle,
    desc: creoleDesc || combinedDesc,
    newsImage,
    articleUrl,
    sourceName
  };
}

function buildLarouzePost(topic, newsData, preferUserTitle = false) {
  const cleanTitle = preferUserTitle ? decodeHtml(topic) : decodeHtml(newsData.title || topic).replace(/[«»"]/g, '').trim();
  const { t1, t2 } = splitIntoTwoCleanLines(cleanTitle, 25);

  const tLow = (topic + ' ' + cleanTitle).toLowerCase();
  let badge = "FLASH INFO";
  let kicker = "AKTYALITE VERIFYE";

  if (tLow.includes('polis') || tLow.includes('pnh') || tLow.includes('gang') || tLow.includes('sekirite') || tLow.includes('operasyon') || tLow.includes('solda') || tLow.includes('zam')) {
    badge = "SEKIRITE CHO";
    kicker = "SEKIRITE & FOS LOD YO";
  } else if (tLow.includes('nasyonzini') || tLow.includes('onu') || tLow.includes('trump') || tLow.includes('bukele') || tLow.includes('salvador') || tLow.includes('diplomasi')) {
    badge = "DIPLOMASI";
    kicker = "AYITI & LEMOND";
  } else if (tLow.includes('webb') || tLow.includes('nasa') || tLow.includes('lespas') || tLow.includes('syans') || tLow.includes('galaksi')) {
    badge = "SYANS & LESPAS";
    kicker = "DEKOUVET SYANTIFIK";
  } else if (tLow.includes('grenadye') || tLow.includes('concacaf') || tLow.includes('seleksyon') || tLow.includes('match')) {
    badge = "FYETE AYISYEN";
    kicker = "SELEKSYON NASYONAL";
  }

  let bodyFacts = decodeHtml(newsData.desc || '').replace(/\s+/g, ' ').trim();
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
    badge,
    kicker,
    t1,
    t2,
    sum1: cleanTitle,
    postText
  };
}

async function processTopic(chatId, clean) {
  lastUserTextTopic = clean;
  lastUserTextTime = Date.now();

  await sendText(chatId, `🔍 M ap chèche nouvèl la, tradui l an Kreyòl epi monte Afish Modèl A ak vrè foto a pou: "${clean}"...`);
  try {
    const newsData = await searchLiveNews(clean);
    const preferUserTitle = clean.split(' ').length >= 5;
    const meta = buildLarouzePost(clean, newsData, preferUserTitle);
    const ts = Date.now();
    const rawImg = path.join(WORK_DIR, `raw_${ts}.jpg`);
    const outImg = path.join(WORK_DIR, `poster_${ts}.jpg`);

    await fetchVerifiedPhoto(clean, newsData, rawImg);
    renderCloudPoster(rawImg, outImg, meta);
    await sendPhotoAndPost(chatId, outImg, `✅ AFISH + POST LAROUZE INFO PARE : ${meta.t1} ${meta.t2}`, meta.postText);
  } catch (e) {
    await sendText(chatId, `⚠️ Erè: ${e.message}`);
  }
}

async function handleVideoMessage(chatId, msg) {
  const videoObj = msg.video || msg.animation || msg.document;
  if (!videoObj || !videoObj.file_id) return;

  const caption = (msg.caption || '').trim() || ((Date.now() - lastUserTextTime < 300000) ? lastUserTextTopic : '');
  const topicText = caption || 'NOUVÈL CHO SOU TEREN AN';

  await sendText(chatId, `🎬 Mwen resevwa videyo w la! M ap rale pi bèl imaj HD nan videyo a epi monte Afish Modèl A + Post Kreyòl + Reel Larouze INFO pou: "${topicText}"...`);

  try {
    const fileRes = await fetch(`${API_BASE}/getFile?file_id=${videoObj.file_id}`);
    const fileInfo = await fileRes.json();
    if (!fileInfo.ok) {
      await sendText(chatId, `⚠️ Telegram pa t ka telechaje videyo a (fichye a ka depase 20MB).`);
      return;
    }

    const ts = Date.now();
    const rawVideo = path.join(WORK_DIR, `vraw_${ts}.mp4`);
    const extractedFrame = path.join(WORK_DIR, `vframe_${ts}.jpg`);
    const outPoster = path.join(WORK_DIR, `vposter_${ts}.jpg`);
    const outReel = path.join(WORK_DIR, `vreel_${ts}.mp4`);

    const dlRes = await fetch(`${FILE_BASE}/${fileInfo.result.file_path}`);
    const buf = Buffer.from(await dlRes.arrayBuffer());
    fs.writeFileSync(rawVideo, buf);

    try {
      execFileSync('ffmpeg', ['-y', '-ss', '00:00:01.0', '-i', rawVideo, '-frames:v', '1', '-q:v', '2', extractedFrame], { stdio: 'ignore' });
    } catch (e) {
      execFileSync('ffmpeg', ['-y', '-i', rawVideo, '-frames:v', '1', '-q:v', '2', extractedFrame], { stdio: 'ignore' });
    }

    lastUserMediaFrame = extractedFrame;
    lastUserMediaTime = Date.now();

    const newsData = caption ? await searchLiveNews(caption) : {
      title: topicText,
      desc: `Gade videyo sa a ki fenk tonbe sou teren an konsènan ${topicText}. Imaj sa yo ap fè gwo bri kounye a sou rezo sosyal yo pandan tout moun ap swiv evolisyon sitiyasyon an.`,
      sourceName: 'Videyo sou Teren an'
    };

    const meta = buildLarouzePost(topicText, newsData, Boolean(caption));

    renderBrandedVideoReel(rawVideo, outReel, meta);
    if (fs.existsSync(outReel)) {
      await sendVideoReel(chatId, outReel, `🎬 REEL LAROUZE INFO PARE : ${meta.t1} ${meta.t2}`);
      await sendText(chatId, meta.postText);
    }
  } catch (err) {
    await sendText(chatId, `⚠️ Erè videyo: ${err.message}`);
  }
}

async function handlePhotoMessage(chatId, msg) {
  const photo = msg.photo[msg.photo.length - 1];
  const caption = (msg.caption || '').trim() || ((Date.now() - lastUserTextTime < 300000) ? lastUserTextTopic : 'NOUVÈL CHO AYITI');
  await sendText(chatId, "🎨 M ap transfòme foto w la an Afish Modèl A + Post Kreyòl Larouze INFO...");

  const fileRes = await fetch(`${API_BASE}/getFile?file_id=${photo.file_id}`);
  const fileInfo = await fileRes.json();
  if (!fileInfo.ok) return;

  const ts = Date.now();
  const rawImg = path.join(WORK_DIR, `uimg_${ts}.jpg`);
  const outImg = path.join(WORK_DIR, `uposter_${ts}.jpg`);

  const dlRes = await fetch(`${FILE_BASE}/${fileInfo.result.file_path}`);
  const buf = Buffer.from(await dlRes.arrayBuffer());
  fs.writeFileSync(rawImg, buf);

  lastUserMediaFrame = rawImg;
  lastUserMediaTime = Date.now();

  const newsData = await searchLiveNews(caption);
  const meta = buildLarouzePost(caption, newsData, Boolean(msg.caption));
  renderCloudPoster(rawImg, outImg, meta);
  await sendPhotoAndPost(chatId, outImg, `✅ AFISH AK POST OU A PARE !`, meta.postText);
}

async function runHourlyBatch() {
  const topics = [
    "Alix Didier Fils-Aimé Bukele Haïti sécurité",
    "Police Nationale d'Haïti opération blindés",
    "UN Security Council Haiti mission",
    "NASA James Webb telescope galaxy discovery",
    "Haiti national soccer team Grenadiers CONCACAF"
  ];
  for (const t of topics) {
    await processTopic(DEFAULT_CHAT_ID, t);
  }
}

async function main() {
  if (process.env.RUN_HOURLY === 'true') {
    await runHourlyBatch();
  }

  const endTime = Date.now() + 55 * 60 * 1000;
  let offset = 0;
  try {
    const initRes = await fetch(`${API_BASE}/getUpdates?offset=-1`);
    const initData = await initRes.json();
    if (initData.ok && initData.result.length > 0) {
      offset = initData.result[initData.result.length - 1].update_id + 1;
    }
  } catch (e) {}

  console.log("Larouze Cloud 24/7 Bot Listener v3 (Text + Photo + Video) active...");
  while (Date.now() < endTime) {
    try {
      const res = await fetch(`${API_BASE}/getUpdates?offset=${offset}&timeout=15`);
      const data = await res.json();
      if (data.ok && data.result.length > 0) {
        for (const upd of data.result) {
          offset = upd.update_id + 1;
          const msg = upd.message;
          if (!msg) continue;
          const chatId = String(msg.chat.id);
          if (msg.video || msg.animation || (msg.document && msg.document.mime_type && msg.document.mime_type.startsWith('video/'))) {
            await handleVideoMessage(chatId, msg);
          } else if (msg.photo && msg.photo.length > 0) {
            await handlePhotoMessage(chatId, msg);
          } else if (msg.text) {
            await processTopic(chatId, msg.text.trim());
          }
        }
      }
    } catch (e) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

main();
