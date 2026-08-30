export interface HomeViewData {
    level: number;
    rankName: string;
    dailyAccent: string;
    dailyTitle: string;
    dailyStatus: string;
    dailyGoal: string;
    dailyAchieved: boolean;
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
        dailyAccent: '成',
        dailyTitle: '成语连斩',
        dailyStatus: '今日首战 · 全员同题',
        dailyGoal: '目标 1200 分',
        dailyAchieved: false,
        challengeEndTime: now + 4 * 60 * 60 * 1000 + 23 * 60 * 1000 + 59 * 1000,
        towerFloor: 1,
        towerHighestFloor: 0,
        towerPoints: 0,
        towerFloorTitle: '第1层 · 基础试炼',
        towerHint: '再过 1 层解锁多选',
        rankProgress: 7,
        rankProgressMax: 10,
    };
}
