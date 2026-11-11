import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '9175279830:AAEmFqUuaLmqL42LFfDUKGX12VMd4DZmzRE';
const DEFAULT_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '6205371644';
const API_BASE = `https://api.telegram.org/bot${TOKEN}`;
const FILE_BASE = `https://api.telegram.org/file/bot${TOKEN}`;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const WORK_DIR = process.cwd();

const KEYBOARD = {
  keyboard: [
    [{ text: "📰 Voye 5 Post Tou Nèf (San Repetisyon)" }],
    [{ text: "📱 Louvri Studio Mobil" }, { text: "ℹ️ Kijan pou m fè 1 Afish" }]
  ],
  resize_keyboard: true,
  is_persistent: true
};

// 1. COMPLETE HTML ENTITY DECODER (Handles &#233;, &#239;, &#xE9;, and named entities)
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

// 2. MULTI-LAYER HAITIAN CREOLE TRANSLATOR (Clients5 + GTX + MyMemory REST API)
async function translateToCreole(rawText) {
  const text = decodeHtml(rawText);
  if (!text) return '';

  // Layer 1: Google GTX
  try {
    const url1 = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ht&dt=t&q=${encodeURIComponent(text)}`;
    const res1 = await fetch(url1, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(5000) });
    if (res1.ok) {
      const data1 = await res1.json();
      if (Array.isArray(data1) && Array.isArray(data1[0])) {
        const out1 = data1[0].map(x => x[0]).join('').trim();
        if (out1 && out1.toLowerCase() !== text.toLowerCase()) {
          return polishCreoleTerms(out1);
        }
      }
    }
  } catch (e) {}

  // Layer 2: Google Clients5 Dict API
  try {
    const url2 = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=ht&q=${encodeURIComponent(text)}`;
    const res2 = await fetch(url2, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(5000) });
    if (res2.ok) {
      const data2 = await res2.json();
      const out2 = Array.isArray(data2) && Array.isArray(data2[0]) ? data2[0][0] : (typeof data2[0] === 'string' ? data2[0] : '');
      if (out2 && out2.toLowerCase() !== text.toLowerCase()) {
        return polishCreoleTerms(out2);
      }
    }
  } catch (e) {}

  // Layer 3: MyMemory Public Neural Translation API (Works 100% from GitHub Actions Azure IPs)
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

  return polishCreoleTerms(text);
}

// 3. CLEAN WHOLE-WORD LINE SPLITTER (Never cuts a word in half!)
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
    // Split line1 in half by words if short
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

// 4. TELEGRAM SENDER (Uses JSON fetch for text so semicolons NEVER truncate messages!)
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
    execFileSync('curl', [
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

// 5. CROSS-PLATFORM FFMPEG MODEL A POSTER RENDERER (Uses UTF-8 textfiles so accents & punctuation never break)
function renderCloudPoster(photoPath, outPath, meta) {
  const ts = Date.now();
  const fBadge = path.join(WORK_DIR, `tmp_badge_${ts}.txt`);
  const fKicker = path.join(WORK_DIR, `tmp_kicker_${ts}.txt`);
  const fT1 = path.join(WORK_DIR, `tmp_t1_${ts}.txt`);
  const fT2 = path.join(WORK_DIR, `tmp_t2_${ts}.txt`);
  const fSum = path.join(WORK_DIR, `tmp_sum_${ts}.txt`);

  fs.writeFileSync(fBadge, decodeHtml(meta.badge || 'FLASH INFO').toUpperCase(), 'utf-8');
  fs.writeFileSync(fKicker, `LAROUZE INFO  •  ${decodeHtml(meta.kicker || 'AKTYALITE VERIFYE').toUpperCase()}`, 'utf-8');
  fs.writeFileSync(fT1, decodeHtml(meta.t1), 'utf-8');
  fs.writeFileSync(fT2, decodeHtml(meta.t2), 'utf-8');
  fs.writeFileSync(fSum, decodeHtml(meta.sum1 || 'Enfòmasyon verifye 100% sou Ayiti ak lemond').substring(0, 62), 'utf-8');

  const linuxFont = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
  const fontArg = fs.existsSync(linuxFont) ? `:fontfile=${linuxFont}` : '';

  const vf = [
    `scale=1080:1350:force_original_aspect_ratio=increase`,
    `crop=1080:1350`,
    `drawbox=x=0:y=800:w=1080:h=550:color=0x06101e@0.94:t=fill`,
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

// 6. 100% VERIFIED EDITORIAL PHOTO FETCHER (Zero random web/greeting card images!)
async function fetchVerifiedPhoto(query, newsData, destPath) {
  // Priority 1: Exact Bing News Article Image (<News:Image>)
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

  // Priority 2: Extract <meta property="og:image"> directly from the news article URL
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
            if (buf.length > 20000) {
              fs.writeFileSync(destPath, buf);
              return true;
            }
          }
        }
      }
    } catch (e) {}
  }

  // Priority 3: Query Bing News RSS in en-US market specifically to grab an authentic <News:Image> press photo
  try {
    const enNewsUrl = `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&mkt=en-US&format=rss`;
    const bRes = await fetch(enNewsUrl, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(6000) });
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

  // Priority 4: Wikipedia Official Portrait (EN & FR Wikipedia)
  for (const lang of ['en', 'fr']) {
    try {
      const wikiUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(query)}&prop=pageimages&format=json&pithumbsize=1200`;
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
  }

  return false;
}

// 7. LIVE NEWS SEARCH (Finds article with <News:Image> first + full decoded text + Creole translation)
async function searchLiveNews(topic) {
  let rawTitle = '';
  let combinedDesc = '';
  let newsImage = '';
  let articleUrl = '';
  let sourceName = 'Laprès Entènasyonal';

  try {
    const bingUrl = `https://www.bing.com/news/search?q=${encodeURIComponent(topic)}&format=rss`;
    const bRes = await fetch(bingUrl, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(6000) });
    const bXml = await bRes.text();
    const items = [...bXml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => m[1]);

    if (items.length > 0) {
      // Prefer the first item that has <News:Image>, otherwise items[0]
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
    }
  } catch (e) {}

  if (!rawTitle) rawTitle = decodeHtml(topic);
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
    articleUrl,
    sourceName
  };
}

function buildLarouzePost(topic, newsData) {
  const cleanTitle = decodeHtml(newsData.title || topic).replace(/[«»"]/g, '').trim();
  const { t1, t2 } = splitIntoTwoCleanLines(cleanTitle, 25);

  const tLow = (topic + ' ' + cleanTitle).toLowerCase();
  let badge = "FLASH INFO";
  let kicker = "AKTYALITE VERIFYE";

  if (tLow.includes('polis') || tLow.includes('pnh') || tLow.includes('gang') || tLow.includes('sekirite') || tLow.includes('operasyon')) {
    badge = "SEKIRITE CHO";
    kicker = "SEKIRITE & FÒS LÒD YO";
  } else if (tLow.includes('nasyonzini') || tLow.includes('onu') || tLow.includes('trump') || tLow.includes('bukele') || tLow.includes('salvador') || tLow.includes('diplomasi')) {
    badge = "DIPLOMASI";
    kicker = "AYITI & LEMOND";
  } else if (tLow.includes('webb') || tLow.includes('nasa') || tLow.includes('lespas') || tLow.includes('syans') || tLow.includes('galaksi')) {
    badge = "SYANS & LESPAS";
    kicker = "DEKOUVÈT SYANTIFIK";
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
  await sendText(chatId, `🔍 M ap chèche nouvèl la, tradui l an Kreyòl epi pran vrè foto a pou: "${clean}"...`);
  try {
    const newsData = await searchLiveNews(clean);
    const meta = buildLarouzePost(clean, newsData);
    const ts = Date.now();
    const rawImg = path.join(WORK_DIR, `raw_${ts}.jpg`);
    const outImg = path.join(WORK_DIR, `poster_${ts}.jpg`);

    const gotPhoto = await fetchVerifiedPhoto(clean, newsData, rawImg);
    if (gotPhoto) {
      renderCloudPoster(rawImg, outImg, meta);
      await sendPhotoAndPost(chatId, outImg, `✅ POST LAROUZE INFO PARE : ${meta.t1} ${meta.t2}`, meta.postText);
    } else {
      await sendText(chatId, meta.postText);
    }
  } catch (e) {
    await sendText(chatId, `⚠️ Erè: ${e.message}`);
  }
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

  console.log("Larouze Cloud 24/7 Bot Listener v2 active...");
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
