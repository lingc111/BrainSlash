import type { FailureKind } from './Models';

export interface SuccessFeedback {
    sound: 'correct' | 'master';
    haptic: 'light' | 'medium';
    hitStopMs: number;
    comboMilestone: boolean;
}

export interface FailureFeedback {
    sound: 'error' | 'bomb';
    haptic: 'light' | 'medium' | 'heavy';
    label: string;
    showComboBreak: boolean;
}

export function successFeedback(kind: 'correct' | 'master', combo: number): SuccessFeedback {
    return {
        sound: kind,
        haptic: kind === 'master' ? 'medium' : 'light',
        hitStopMs: kind === 'master' ? 100 : 0,
        comboMilestone: combo >= 5 && combo % 5 === 0,
    };
}

export function failureFeedback(kind: FailureKind, brokenCombo: number): FailureFeedback {
    const labels: Readonly<Record<FailureKind, string>> = {
        wrong: '斩错了',
        bomb: '炸弹！',
        miss: '漏斩',
        orderError: '顺序错误',
    };
    return {
        sound: kind === 'bomb' ? 'bomb' : 'error',
        haptic: kind === 'bomb' ? 'heavy' : 'medium',
        label: labels[kind],
        showComboBreak: brokenCombo >= 3,
    };
}

export function countdownWarningSecond(remainingMs: number, previousSecond: number): number | null {
    const second = Math.ceil(Math.max(0, remainingMs) / 1000);
    return second >= 1 && second <= 5 && second !== previousSecond ? second : null;
}
