/* BrainSlash WeChat open-data context. Keep this file dependency-free: it is
 * executed in WeChat's isolated friend-data environment, not in Cocos. */
const sharedCanvas = wx.getSharedCanvas();
const context = sharedCanvas.getContext('2d');

const WIDTH = 941;
const HEIGHT = 1450;
const ROW_Y = [-28, -104, -180, -256, -332, -408, -484];
const DISPLAY_ORDER = [1, 0, 2, 3, 4, 5, 6, 7, 8, 9];
const KEYS = ['bs_brawl_score', 'bs_brawl_detail', 'bs_trial_floor', 'bs_trial_detail'];
const images = Object.create(null);
const DEFAULT_AVATAR_URL = 'default_avatar.png';

let visible = false;
let mode = 'brawl';
let localRecord = null;
let localProfile = null;
let friends = [];
let selfCloud = null;

wx.onMessage((message) => {
    if (!message || message.type !== 'brainSlashLeaderboard') return;
    if (message.action === 'hide') {
        visible = false;
        clear();
        return;
    }
    if (message.action !== 'show') return;
    visible = true;
    mode = message.mode === 'trial' ? 'trial' : 'brawl';
    localRecord = message.localRecord || null;
    localProfile = message.profile || null;
    requestCloudData();
});

function requestCloudData() {
    wx.getFriendCloudStorage({
        keyList: KEYS,
        success(result) {
            friends = Array.isArray(result.data) ? result.data : [];
            render();
        },
        fail(error) {
            console.warn('[BrainSlashOpenData] getFriendCloudStorage failed', error);
            friends = [];
            render();
        },
    });
    if (typeof wx.getUserCloudStorage === 'function') {
        wx.getUserCloudStorage({
            keyList: KEYS,
            success(result) {
                selfCloud = result || null;
                render();
            },
            fail() {
                selfCloud = null;
                render();
            },
        });
    }
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
    const matchIndex = entries.findIndex((entry) => sameUser(entry, cloudSelf));
    if (matchIndex >= 0) entries.splice(matchIndex, 1);
    entries.push(cloudSelf);
    entries.sort(mode === 'trial'
        ? (a, b) => b.trial.highestFloor - a.trial.highestFloor || b.trial.accuracy - a.trial.accuracy || b.trial.answeredCount - a.trial.answeredCount
        : (a, b) => b.brawl.rankScore - a.brawl.rankScore || b.brawl.survivalMs - a.brawl.survivalMs || b.brawl.answeredCount - a.brawl.answeredCount);
    entries.forEach((entry, index) => { entry.rank = index + 1; });
    return entries;
}

function fromCloud(item, id, isSelf) {
    const values = Object.create(null);
    const list = Array.isArray(item.KVDataList) ? item.KVDataList : [];
    list.forEach((pair) => { if (pair && typeof pair.key === 'string') values[pair.key] = pair.value; });
    const brawlDetail = parseJson(values.bs_brawl_detail);
    const trialDetail = parseJson(values.bs_trial_detail);
    const entry = {
        id: item.openid || id,
        name: item.nickname || item.nickName || '微信好友',
        avatarUrl: item.avatarUrl || '',
        isSelf,
        brawl: {
            rankScore: integer(values.bs_brawl_score),
            survivalMs: integer(brawlDetail.s),
            answeredCount: integer(brawlDetail.a),
            maxCombo: integer(brawlDetail.c),
            accuracy: ratio(brawlDetail.r),
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
        brawl: { rankScore: 0, survivalMs: 0, answeredCount: 0, maxCombo: 0, accuracy: 0 },
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

function drawPodium(entry, displayIndex) {
    const x = [-250, 0, 250][displayIndex];
    const avatarY = [203, 222, 203][displayIndex];
    drawAvatar(entry.avatarUrl, x, avatarY, displayIndex === 1 ? 52 : 47);
    drawText(entry.name, x, 101, 31, '#1f1d19', 'center', true, 190);
    drawText(scoreText(entry), x, 59, 30, '#1f1d19', 'center', true, 176);
    drawText(detailText(entry), x + 12, 27, 16, '#59544b', 'center', true, 218);
}

function drawRow(entry, rowIndex) {
    const y = ROW_Y[rowIndex];
    drawText(String(entry.rank || rowIndex + 4), -300, y, 29, '#1f1d19', 'center', true, 56);
    drawAvatar(entry.avatarUrl, -242, y, 34);
    drawText(entry.name, -207, y + 13, 25, '#1f1d19', 'left', true, 250);
    drawText(detailText(entry), -207, y - 16, 16, '#59544b', 'left', true, 312);
    drawText(scoreText(entry), 244, y, 25, '#1f1d19', 'center', true, 154);
}

function drawSelf(entry, rank) {
    drawText(String(rank), -333, -643, 42, '#1f1d19', 'center', true, 90);
    // Cover the legacy avatar baked into ranking_self.png as well as drawing
    // the current profile/default avatar.
    drawAvatar(entry.avatarUrl, -250, -643, 110);
    drawText(entry.name || '我', -30, -620, 34, '#1f1d19', 'center', true, 275);
    drawText(detailText(entry), -5, -671, 20, '#59544b', 'center', true, 385);
    drawText(scoreText(entry), 244, -676, 31, '#1f1d19', 'center', true, 178);
}

function scoreText(entry) {
    return mode === 'trial' ? `第 ${entry.trial.highestFloor} 层` : `综合 ${entry.brawl.rankScore}`;
}

function detailText(entry) {
    if (mode === 'trial') return `${entry.trial.answeredCount}题 · ${percent(entry.trial.accuracy)}`;
    const data = entry.brawl;
    return `存活 ${duration(data.survivalMs)} · ${data.answeredCount}题 · C${data.maxCombo} · ${percent(data.accuracy)}`;
}

function drawText(value, x, y, size, color, align, bold, maxWidth) {
    const scale = drawingScale();
    context.save();
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'middle';
    context.font = `${bold ? 'bold ' : ''}${Math.max(10, Math.round(size * scale))}px sans-serif`;
    const px = canvasX(x);
    const py = canvasY(y);
    if (maxWidth) context.fillText(String(value), px, py, maxWidth * scale);
    else context.fillText(String(value), px, py);
    context.restore();
}

function drawAvatar(url, x, y, diameter) {
    const scale = drawingScale();
    const px = canvasX(x);
    const py = canvasY(y);
    const radius = diameter * scale / 2;
    context.save();
    context.beginPath();
    context.arc(px, py, radius, 0, Math.PI * 2);
    context.clip();
    context.fillStyle = '#fffaf0';
    context.fillRect(px - radius, py - radius, radius * 2, radius * 2);
    const sourceUrl = url || DEFAULT_AVATAR_URL;
    const cached = images[sourceUrl];
    if (cached && cached.ready) {
        const zoom = url ? 1 : 1.55;
        context.drawImage(cached.image, px - radius * zoom, py - radius * zoom, radius * 2 * zoom, radius * 2 * zoom);
    }
    context.restore();
    context.strokeStyle = '#1f1d19';
    context.lineWidth = Math.max(1, 2 * scale);
    context.beginPath();
    context.arc(px, py, radius, 0, Math.PI * 2);
    context.stroke();
    if (!cached) loadAvatar(sourceUrl);
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
function canvasY(y) { return (HEIGHT / 2 - y) * sharedCanvas.height / HEIGHT; }
function drawingScale() { return Math.min(sharedCanvas.width / WIDTH, sharedCanvas.height / HEIGHT); }
function integer(value) { const number = Number(value); return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0; }
function ratio(value) { const number = Number(value); return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0; }
function parseJson(value) { try { const result = JSON.parse(value || '{}'); return result && typeof result === 'object' ? result : {}; } catch (_) { return {}; } }
function percent(value) { return `${Math.round(ratio(value) * 100)}%`; }
function duration(milliseconds) { const seconds = integer(milliseconds) / 1000 | 0; const minutes = seconds / 60 | 0; return minutes > 0 ? `${minutes}:${String(seconds % 60).padStart(2, '0')}` : `${seconds}s`; }
