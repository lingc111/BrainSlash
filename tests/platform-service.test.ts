import assert from 'node:assert/strict';
import test from 'node:test';
import { PlatformService } from '../assets/Scripts/infrastructure/PlatformService.ts';

test('WeChat leaderboard upload uses stable cloud keys and compact values', async () => {
    let uploaded: Array<{ key: string; value: string }> = [];
    (globalThis as { wx?: unknown }).wx = {
        setUserCloudStorage(options: { KVDataList: typeof uploaded; success: () => void }) {
            uploaded = options.KVDataList;
            options.success();
        },
    };
    const platform = new PlatformService();
    const success = await platform.uploadLeaderboard({
        brawl: { rankScore: 2715, survivalMs: 120_000, answeredCount: 60, maxCombo: 12, accuracy: .9, masterSlashCount: 2 },
        trial: { highestFloor: 18, answeredCount: 90, accuracy: .8 },
    });
    assert.equal(success, true);
    assert.deepEqual(uploaded.map((item) => item.key), [
        'bs_brawl_score', 'bs_brawl_detail', 'bs_trial_floor', 'bs_trial_detail',
    ]);
    assert.equal(uploaded[0].value, '2715');
    assert.equal(uploaded[2].value, '18');
    delete (globalThis as { wx?: unknown }).wx;
});

test('native WeChat authorization button normalizes and stores the approved profile', () => {
    let tap: ((result: { userInfo?: { nickName?: string; avatarUrl?: string } }) => void) | null = null;
    const storage = new Map<string, string>();
    (globalThis as { wx?: unknown }).wx = {
        getSystemInfoSync: () => ({ screenWidth: 390, screenHeight: 844 }),
        createUserInfoButton: () => ({ onTap: (listener: typeof tap) => { tap = listener; }, destroy: () => undefined }),
        getStorageSync: (key: string) => storage.get(key),
        setStorageSync: (key: string, value: string) => storage.set(key, value),
    };
    const platform = new PlatformService();
    let authorized = false;
    assert.equal(platform.showUserAuthorizationButton({
        centerX: 0, centerY: -160, width: 500, height: 74, viewportWidth: 941, viewportHeight: 1884,
    }, (result) => { authorized = result.status === 'authorized'; }), true);
    tap?.({ userInfo: { nickName: ' 阿宁 ', avatarUrl: ' https://avatar.example/a.png ' } });
    assert.equal(authorized, true);
    assert.deepEqual(platform.authorizedUserProfile(), { nickName: '阿宁', avatarUrl: 'https://avatar.example/a.png' });
    assert.ok(storage.has('brain-slash.wechat-profile.v1'));
    delete (globalThis as { wx?: unknown }).wx;
});
