export interface HomeViewData {
    level: number;
    rankName: string;
    energy: number;
    maxEnergy: number;
    dailyAccent: string;
    dailyTitle: string;
    dailyStatus: string;
    challengeEndTime: number;
    towerFloor: number;
    towerHighestFloor: number;
    towerPoints: number;
    towerFloorTitle: string;
    towerHint: string;
    rankProgress: number;
    rankProgressMax: number;
}

export function createMockHomeViewData(now = Date.now()): HomeViewData {
    return {
        level: 12,
        rankName: '学徒',
        energy: 120,
        maxEnergy: 150,
        dailyAccent: '成',
        dailyTitle: '成语连斩',
        dailyStatus: '今日首战 · 全员同题',
        challengeEndTime: now + 4 * 60 * 60 * 1000 + 23 * 60 * 1000 + 59 * 1000,
        towerFloor: 1,
        towerHighestFloor: 0,
        towerPoints: 0,
        towerFloorTitle: '基础试炼',
        towerHint: '第 3 层解锁禁区',
        rankProgress: 7,
        rankProgressMax: 10,
    };
}
