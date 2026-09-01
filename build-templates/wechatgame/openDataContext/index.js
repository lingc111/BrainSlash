/* BrainSlash WeChat open-data context. Keep this file dependency-free: it is
 * executed in WeChat's isolated friend-data environment, not in Cocos. */
const sharedCanvas = wx.getSharedCanvas();
const context = sharedCanvas.getContext('2d');

const WIDTH = 941;
const HEIGHT = 1450;
// RankingPage moves the SubContextView down by the same amount. Compensating
// all drawing coordinates here preserves every screen position while leaving
// extra canvas space below the self-avatar mask.
const VIEW_OFFSET_Y = 20;
const ROW_Y = [-28, -104, -180, -256, -332, -408, -484];
const DISPLAY_ORDER = [1, 0, 2, 3, 4, 5, 6, 7, 8, 9];
const KEYS = ['bs_brawl_score_v2', 'bs_brawl_detail_v2', 'bs_trial_floor', 'bs_trial_detail'];
const images = Object.create(null);
const GAME_FONT_SCALE = 1.1;
const RANK_FONT_GLYPHS = new Set(Array.from(' 0123456789C%·…第层综合题答对试炼榜加载中乱斗暂无好友成绩'));
let rankFontFamily = '';

let visible = false;
let mode = 'brawl';
let localRecord = null;
let localProfile = null;
let friends = [];
let selfCloud = null;
let requestGeneration = 0;
let requestInFlight = false;
let hasFriendSnapshot = false;

wx.onMessage((message) => {
    if (message?.type === 'brainSlashLeaderboardFont') {
        const family = typeof message.family === 'string' ? message.family.trim() : '';
        if (!family || family === rankFontFamily) return;
        rankFontFamily = family;
        if (visible) render();
        return;
    }
    if (!message || message.type !== 'brainSlashLeaderboard') return;
    if (message.action === 'hide') {
        visible = false;
        requestGeneration += 1;
        requestInFlight = false;
        clear();
        return;
    }
    if (message.action !== 'show') return;
    visible = true;
    mode = message.mode === 'trial' ? 'trial' : 'brawl';
    localRecord = message.localRecord || null;
    localProfile = message.profile || null;
    // Both modes use the same four cloud keys. A tab switch must only sort and
    // render the cached snapshot; refetching here caused occasional empty
    // WeChat responses to erase every friend and change the self rank to 1.
    const shouldRefreshCloud = message.refreshCloudData !== false;
    if (hasFriendSnapshot) render();
    else drawLoading();
    if (shouldRefreshCloud) requestCloudData();
    else if (!requestInFlight && !hasFriendSnapshot) requestCloudData();
});

function requestCloudData() {
    const generation = ++requestGeneration;
    requestInFlight = true;
    let nextFriends = friends;
    let nextSelfCloud = selfCloud;
    let friendSettled = false;
    let friendSucceeded = false;
    let selfSettled = typeof wx.getUserCloudStorage !== 'function';
    const commitWhenReady = () => {
        // A new cloud refresh starts a new generation. Never let older
        // callbacks replace it, and commit friend/self data as one snapshot so
        // the self entry cannot briefly be counted twice.
        if (!visible || generation !== requestGeneration || !friendSettled || !selfSettled) return;
        requestInFlight = false;
        friends = nextFriends;
        selfCloud = nextSelfCloud;
        if (friendSucceeded) hasFriendSnapshot = true;
        render();
    };
    wx.getFriendCloudStorage({
        keyList: KEYS,
        success(result) {
            if (generation !== requestGeneration) return;
            const received = Array.isArray(result.data) ? result.data : [];
            // Once a non-empty snapshot has been displayed, a single empty
            // response during a refresh is treated as transient. Friend access
            // cannot legitimately disappear because the user tapped a tab.
            if (received.length > 0 || !hasFriendSnapshot || friends.length === 0) nextFriends = received;
            friendSucceeded = true;
            friendSettled = true;
            commitWhenReady();
        },
        fail(error) {
            if (generation !== requestGeneration) return;
            console.warn('[BrainSlashOpenData] getFriendCloudStorage failed', error);
            friendSettled = true;
            commitWhenReady();
        },
    });
    if (typeof wx.getUserCloudStorage === 'function') {
        wx.getUserCloudStorage({
            keyList: KEYS,
            success(result) {
                if (generation !== requestGeneration) return;
                nextSelfCloud = result || null;
                selfSettled = true;
                commitWhenReady();
            },
            fail() {
                if (generation !== requestGeneration) return;
                nextSelfCloud = null;
                selfSettled = true;
                commitWhenReady();
            },
        });
    }
    commitWhenReady();
}

function drawLoading() {
    clear();
    drawText(mode === 'trial' ? '试炼榜加载中…' : '乱斗榜加载中…', 0, -40, 28, '#59544b', 'center', true);
}

function render() {
    if (!visible) return;
    clear();
    const ranked = createRanking();
    DISPLAY_ORDER.forEach((rankIndex, displayIndex) => {
        const entry = ranked[rankIndex];
        if (!entry) return;
        if (displayIndex < 3) drawPodium(entry, displayIndex);
        else drawRow(entry, displayIndex - 3);
    });
    const self = ranked.find((entry) => entry.isSelf) || createSelfEntry();
    drawSelf(self, Math.max(1, ranked.indexOf(self) + 1));
    if (ranked.length === 0) drawText('暂无好友成绩', 0, -40, 28, '#59544b', 'center', true);
}

function createRanking() {
    const entries = friends.map((item, index) => fromCloud(item, `friend-${index}`, false));
    const cloudSelf = selfCloud ? fromCloud(selfCloud, 'self', true) : createSelfEntry();
    const matchIndex = findSelfIndex(entries, cloudSelf);
    if (matchIndex >= 0) entries.splice(matchIndex, 1);
    entries.push(cloudSelf);
    entries.sort((a, b) => comparePerformance(a, b)
        || Number(b.isSelf) - Number(a.isSelf)
        || String(a.id).localeCompare(String(b.id)));
    entries.forEach((entry, index) => { entry.rank = index + 1; });
    return entries;
}

function fromCloud(item, id, isSelf) {
    const values = Object.create(null);
    const list = Array.isArray(item.KVDataList) ? item.KVDataList : [];
    list.forEach((pair) => { if (pair && typeof pair.key === 'string') values[pair.key] = pair.value; });
    const brawlDetail = parseJson(values.bs_brawl_detail_v2);
    const trialDetail = parseJson(values.bs_trial_detail);
    const entry = {
        id: item.openid || id,
        name: item.nickname || item.nickName || '微信好友',
        avatarUrl: item.avatarUrl || '',
        isSelf,
        brawl: {
            rankScore: integer(values.bs_brawl_score_v2),
            survivalMs: integer(brawlDetail.s),
            answeredCount: integer(brawlDetail.a),
            maxCombo: integer(brawlDetail.c),
            accuracy: ratio(brawlDetail.r),
            masterSlashCount: integer(brawlDetail.m),
        },
        trial: {
            highestFloor: integer(values.bs_trial_floor),
            answeredCount: integer(trialDetail.a),
            accuracy: ratio(trialDetail.r),
        },
    };
    return isSelf ? mergeLocalSelf(entry) : entry;
}

function createSelfEntry() {
    return mergeLocalSelf({
        id: 'self', name: '我', avatarUrl: '', isSelf: true,
        brawl: { rankScore: 0, survivalMs: 0, answeredCount: 0, maxCombo: 0, accuracy: 0, masterSlashCount: 0 },
        trial: { highestFloor: 0, answeredCount: 0, accuracy: 0 },
    });
}

function mergeLocalSelf(entry) {
    if (localProfile) {
        entry.name = localProfile.nickName || entry.name;
        entry.avatarUrl = localProfile.avatarUrl || entry.avatarUrl;
    }
    if (localRecord && localRecord.brawl && integer(localRecord.brawl.rankScore) >= entry.brawl.rankScore) {
        entry.brawl = {
            rankScore: integer(localRecord.brawl.rankScore),
            survivalMs: integer(localRecord.brawl.survivalMs),
            answeredCount: integer(localRecord.brawl.answeredCount),
            maxCombo: integer(localRecord.brawl.maxCombo),
            accuracy: ratio(localRecord.brawl.accuracy),
            masterSlashCount: integer(localRecord.brawl.masterSlashCount),
        };
    }
    if (localRecord && localRecord.trial && integer(localRecord.trial.highestFloor) >= entry.trial.highestFloor) {
        entry.trial = {
            highestFloor: integer(localRecord.trial.highestFloor),
            answeredCount: integer(localRecord.trial.answeredCount),
            accuracy: ratio(localRecord.trial.accuracy),
        };
    }
    return entry;
}

function sameUser(a, b) {
    return a.id === b.id || (a.avatarUrl && b.avatarUrl && a.avatarUrl === b.avatarUrl)
        || (a.name !== '微信好友' && b.name !== '我' && a.name === b.name);
}

function findSelfIndex(entries, cloudSelf) {
    const identityMatch = entries.findIndex((entry) => sameUser(entry, cloudSelf));
    if (identityMatch >= 0) return identityMatch;
    // getUserCloudStorage does not always expose openid/profile fields. Its KV
    // payload does match the current user's row in getFriendCloudStorage, so a
    // unique score/detail match is a safe fallback for removing that duplicate.
    if (!selfCloud) return -1;
    const matches = [];
    entries.forEach((entry, index) => {
        if (sameRecords(entry, cloudSelf)) matches.push(index);
    });
    return matches.length === 1 ? matches[0] : -1;
}

function sameRecords(a, b) {
    return a.brawl.rankScore === b.brawl.rankScore
        && a.brawl.survivalMs === b.brawl.survivalMs
        && a.brawl.answeredCount === b.brawl.answeredCount
        && a.brawl.maxCombo === b.brawl.maxCombo
        && a.brawl.accuracy === b.brawl.accuracy
        && a.brawl.masterSlashCount === b.brawl.masterSlashCount
        && a.trial.highestFloor === b.trial.highestFloor
        && a.trial.answeredCount === b.trial.answeredCount
        && a.trial.accuracy === b.trial.accuracy;
}

function comparePerformance(a, b) {
    return mode === 'trial' ? compareTrial(a, b) : compareBrawl(a, b);
}

function compareBrawl(a, b) {
    return b.brawl.rankScore - a.brawl.rankScore
        || b.brawl.maxCombo - a.brawl.maxCombo
        || b.brawl.accuracy - a.brawl.accuracy
        || correctAnswers(b.brawl) - correctAnswers(a.brawl)
        || b.brawl.survivalMs - a.brawl.survivalMs;
}

function compareTrial(a, b) {
    return b.trial.highestFloor - a.trial.highestFloor
        || b.trial.accuracy - a.trial.accuracy
        || b.trial.answeredCount - a.trial.answeredCount;
}

function drawPodium(entry, displayIndex) {
    const x = [-250, 0, 250][displayIndex];
    const avatarX = [-248, -3, 250][displayIndex];
    const avatarY = [212, 223, 212][displayIndex];
    const avatarDiameter = [104, 112, 104][displayIndex];
    drawAvatar(entry.avatarUrl, avatarX, avatarY, avatarDiameter, false);
    drawText(entry.name, x, 101, 31, '#1f1d19', 'center', true, 190, true);
    drawText(scoreText(entry), x, 59, 30, '#1f1d19', 'center', true, 176);
    drawText(detailText(entry), x + 12, 27, 20, '#59544b', 'center', true, 242);
}

function drawRow(entry, rowIndex) {
    const y = ROW_Y[rowIndex];
    drawText(String(entry.rank || rowIndex + 4), -300, y, 29, '#1f1d19', 'center', true, 56);
    drawAvatar(entry.avatarUrl, -242, y, 40, true);
    drawText(entry.name, -207, y + 13, 25, '#1f1d19', 'left', true, 250, true);
    drawText(detailText(entry), -207, y - 16, 20, '#59544b', 'left', true, 330);
    drawText(scoreText(entry), 244, y, 25, '#1f1d19', 'center', true, 154);
}

function drawSelf(entry, rank) {
    drawText(String(rank), -333, -643, 42, '#1f1d19', 'center', true, 90);
    drawAvatar(entry.avatarUrl, -253, -680, 114, false);
    drawText(entry.name || '我', -30, -620, 34, '#1f1d19', 'center', true, 275, true);
    drawText(detailText(entry), -5, -671, 22, '#59544b', 'center', true, 385);
    drawText(scoreText(entry), 244, -676, 31, '#1f1d19', 'center', true, 178);
}

function scoreText(entry) {
    return mode === 'trial' ? `第 ${entry.trial.highestFloor} 层` : `综合 ${entry.brawl.rankScore}`;
}

function detailText(entry) {
    if (mode === 'trial') return `${entry.trial.answeredCount}题 · ${percent(entry.trial.accuracy)}`;
    const data = entry.brawl;
    return `答对${correctAnswers(data)}题 · C${data.maxCombo} · ${percent(data.accuracy)}`;
}

function correctAnswers(record) { return Math.round(record.answeredCount * record.accuracy); }

function drawText(value, x, y, size, color, align, bold, maxWidth, useSystemFont = false) {
    const scale = drawingScale();
    const text = String(value);
    context.save();
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'middle';
    const usesRankFont = !useSystemFont && Boolean(rankFontFamily);
    const pixelSize = Math.max(10, Math.round(size * (usesRankFont ? GAME_FONT_SCALE : 1) * scale));
    if (usesRankFont) {
        // wx.loadFont returns a directly usable family identifier. Keep the
        // Canvas declaration identical to the form recommended by WeChat.
        context.font = `${pixelSize}px ${JSON.stringify(rankFontFamily)}`;
        warnForMissingRankGlyph(text);
    } else {
        context.font = `${bold ? 'bold ' : ''}${pixelSize}px sans-serif`;
    }
    const px = canvasX(x);
    const py = canvasY(y);
    if (maxWidth) context.fillText(text, px, py, maxWidth * scale);
    else context.fillText(text, px, py);
    context.restore();
}

function warnForMissingRankGlyph(value) {
    for (const character of value) {
        if (RANK_FONT_GLYPHS.has(character)) continue;
        console.warn(`[BrainSlashOpenData] rank font subset is missing: ${character}`);
        return;
    }
}

function drawAvatar(url, x, y, diameter, drawOutline) {
    const scale = drawingScale();
    const px = canvasX(x);
    const py = canvasY(y);
    const radius = diameter * scale / 2;
    const cached = url && images[url];
    if (!url) {
        if (drawOutline) {
            context.fillStyle = '#fffaf0';
            context.strokeStyle = '#59544b';
            context.lineWidth = Math.max(1, 2 * scale);
            context.beginPath();
            context.arc(px, py, radius, 0, Math.PI * 2);
            context.fill();
            context.stroke();
        }
        return;
    }
    context.save();
    context.beginPath();
    context.arc(px, py, radius, 0, Math.PI * 2);
    context.clip();
    context.fillStyle = '#fffaf0';
    context.fillRect(px - radius, py - radius, radius * 2, radius * 2);
    if (cached && cached.ready) context.drawImage(cached.image, px - radius, py - radius, radius * 2, radius * 2);
    context.restore();
    if (drawOutline) {
        context.strokeStyle = '#59544b';
        context.lineWidth = Math.max(1, 2 * scale);
        context.beginPath();
        context.arc(px, py, radius, 0, Math.PI * 2);
        context.stroke();
    }
    if (url && !cached) loadAvatar(url);
}

function loadAvatar(url) {
    const image = wx.createImage();
    images[url] = { image, ready: false };
    image.onload = () => { images[url].ready = true; render(); };
    image.onerror = () => { images[url].failed = true; };
    image.src = url;
}

function clear() { context.clearRect(0, 0, sharedCanvas.width, sharedCanvas.height); }
function canvasX(x) { return (x + WIDTH / 2) * sharedCanvas.width / WIDTH; }
function canvasY(y) { return (HEIGHT / 2 - (y + VIEW_OFFSET_Y)) * sharedCanvas.height / HEIGHT; }
function drawingScale() { return Math.min(sharedCanvas.width / WIDTH, sharedCanvas.height / HEIGHT); }
function integer(value) { const number = Number(value); return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0; }
function ratio(value) { const number = Number(value); return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0; }
function parseJson(value) { try { const result = JSON.parse(value || '{}'); return result && typeof result === 'object' ? result : {}; } catch (_) { return {}; } }
function percent(value) { return `${Math.round(ratio(value) * 100)}%`; }
