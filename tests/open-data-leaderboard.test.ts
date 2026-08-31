import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

interface PendingRequest { success(result: unknown): void; fail(error?: unknown): void }

function createHarness() {
    const friendRequests: PendingRequest[] = [];
    const selfRequests: PendingRequest[] = [];
    const drawn: string[] = [];
    const fontRuns: Array<{ text: string; font: string }> = [];
    let onMessage: (message: unknown) => void = () => undefined;
    const canvasContext = {
        clearRect() { drawn.length = 0; }, save() {}, restore() {}, beginPath() {}, arc() {}, clip() {},
        fillRect() {}, fill() {}, stroke() {}, drawImage() {},
        fillText(value: unknown) {
            drawn.push(String(value));
            fontRuns.push({ text: String(value), font: canvasContext.font });
        },
        fillStyle: '', strokeStyle: '', lineWidth: 0, textAlign: '', textBaseline: '', font: '',
    };
    const wx = {
        getSharedCanvas: () => ({ width: 941, height: 1450, getContext: () => canvasContext }),
        onMessage: (listener: typeof onMessage) => { onMessage = listener; },
        getFriendCloudStorage: (request: PendingRequest) => { friendRequests.push(request); },
        getUserCloudStorage: (request: PendingRequest) => { selfRequests.push(request); },
        createImage: () => ({}),
    };
    const source = readFileSync('build-templates/wechatgame/openDataContext/index.js', 'utf8');
    vm.runInNewContext(source, { wx, console });
    return { drawn, fontRuns, friendRequests, selfRequests, send: (message: unknown) => onMessage(message) };
}

function values(brawl: number, trial: number) {
    return [
        { key: 'bs_brawl_score_v2', value: String(brawl) },
        { key: 'bs_brawl_detail_v2', value: JSON.stringify({ s: brawl, a: 1, c: 1, r: 1, m: 0 }) },
        { key: 'bs_trial_floor', value: String(trial) },
        { key: 'bs_trial_detail', value: JSON.stringify({ a: trial, r: 1 }) },
    ];
}

const localRecord = {
    brawl: { rankScore: 100, survivalMs: 100, answeredCount: 1, maxCombo: 1, accuracy: 1 },
    trial: { highestFloor: 9, answeredCount: 9, accuracy: 1 },
};

test('open-data leaderboard ignores stale callbacks after switching tabs', () => {
    const h = createHarness();
    h.send({ type: 'brainSlashLeaderboard', action: 'show', mode: 'brawl', localRecord });
    h.send({ type: 'brainSlashLeaderboard', action: 'show', mode: 'trial', localRecord });

    h.friendRequests[1].success({ data: [{ nickname: '好友', KVDataList: values(200, 5) }] });
    assert.deepEqual(h.drawn, ['试炼榜加载中…']);
    h.selfRequests[1].success({ KVDataList: values(100, 9) });
    assert.ok(h.drawn.includes('第 9 层'));
    assert.ok(!h.drawn.some((text) => text.startsWith('综合 ')));

    const stable = [...h.drawn];
    h.friendRequests[0].success({ data: [{ nickname: '旧数据', KVDataList: values(999, 99) }] });
    h.selfRequests[0].success({ KVDataList: values(999, 99) });
    assert.deepEqual(h.drawn, stable);
});

test('open-data leaderboard removes the cloud copy of self without profile authorization', () => {
    const h = createHarness();
    h.send({ type: 'brainSlashLeaderboard', action: 'show', mode: 'brawl', localRecord });
    h.friendRequests[0].success({ data: [{ nickname: '我的微信', KVDataList: values(100, 9) }] });
    h.selfRequests[0].success({ KVDataList: values(100, 9) });

    assert.equal(h.drawn.filter((text) => text === '综合 100').length, 2); // podium + fixed self card
    assert.ok(h.drawn.includes('1'));
});

test('switching tabs reuses the friend snapshot without another cloud request', () => {
    const h = createHarness();
    h.send({ type: 'brainSlashLeaderboard', action: 'show', mode: 'brawl', localRecord });
    h.friendRequests[0].success({ data: [{ nickname: '好友', KVDataList: values(200, 5) }] });
    h.selfRequests[0].success({ KVDataList: values(100, 9) });

    h.send({ type: 'brainSlashLeaderboard', action: 'show', mode: 'trial', refreshCloudData: false, localRecord });

    assert.equal(h.friendRequests.length, 1);
    assert.equal(h.selfRequests.length, 1);
    assert.ok(h.drawn.includes('第 9 层'));
    assert.ok(h.drawn.includes('第 5 层'));
    assert.ok(!h.drawn.some((text) => text.startsWith('综合 ')));
});

test('a transient empty refresh keeps the last non-empty friend snapshot', () => {
    const h = createHarness();
    h.send({ type: 'brainSlashLeaderboard', action: 'show', mode: 'trial', localRecord });
    h.friendRequests[0].success({ data: [{ nickname: '好友', KVDataList: values(200, 12) }] });
    h.selfRequests[0].success({ KVDataList: values(100, 9) });
    assert.ok(h.drawn.includes('第 12 层'));

    h.send({ type: 'brainSlashLeaderboard', action: 'show', mode: 'trial', refreshCloudData: true, localRecord });
    h.friendRequests[1].success({ data: [] });
    h.selfRequests[1].success({ KVDataList: values(100, 9) });

    assert.ok(h.drawn.includes('第 12 层'));
    assert.ok(h.drawn.includes('2'));
});

test('open-data leaderboard loads the compact rank font but keeps arbitrary nicknames on the system font', () => {
    const h = createHarness();
    h.send({ type: 'brainSlashLeaderboardFont', family: 'BrainSlashRank' });
    h.send({ type: 'brainSlashLeaderboard', action: 'show', mode: 'brawl', localRecord });
    h.friendRequests[0].success({ data: [{ nickname: '玩家🎮', KVDataList: values(200, 12) }] });
    h.selfRequests[0].success({ KVDataList: values(100, 9) });

    assert.match(h.fontRuns.find((run) => run.text === '综合 200')?.font ?? '', /BrainSlashRank/);
    assert.doesNotMatch(h.fontRuns.find((run) => run.text === '玩家🎮')?.font ?? '', /BrainSlashRank/);
    assert.ok(statSync('build-templates/wechatgame/openDataContext/fonts/jiangxi-rank.ttf').size < 100_000);
});
