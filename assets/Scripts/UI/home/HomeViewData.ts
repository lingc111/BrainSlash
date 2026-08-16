export interface HomeViewData {
    level: number;
    rankName: string;
    energy: number;
    maxEnergy: number;
    friendMessage: string;
    challengeEndTime: number;
    rankProgress: number;
    rankProgressMax: number;
}

export function createMockHomeViewData(now = Date.now()): HomeViewData {
    return {
        level: 12,
        rankName: '学徒',
        energy: 120,
        maxEnergy: 150,
        friendMessage: '好友刚刚完成斩击！',
        challengeEndTime: now + 4 * 60 * 60 * 1000 + 23 * 60 * 1000 + 59 * 1000,
        rankProgress: 7,
        rankProgressMax: 10,
    };
}
