import type { GameResult, PlayerProgress, RunResult } from './Models';
import { dailyRecipeById } from './DailyChallenge';

export const XP_PER_CORRECT = 5;
export const XP_PER_LEVEL = 500;

export interface ResultCommit {
    result: GameResult;
    player: PlayerProgress;
}

export interface ResultPresentation {
    modeLabel: string;
    headline: string;
    comparison: string;
    comparisonTone: 'highlight' | 'positive' | 'neutral';
    accuracy: string;
    maxCombo: string;
    fastestReaction: string;
    answerDetail: string;
    growthTitle: string;
    growthDetail: string;
    growthProgress: number;
    replayLabel: string;
    shareLabel: string;
    sharePrimary: boolean;
}

export function finalizeResult(run: RunResult, playerBefore: PlayerProgress): ResultCommit {
    const xpBefore = Math.max(0, Math.floor(playerBefore.xp));
    const xpGained = Math.max(0, Math.floor(run.correctCount)) * XP_PER_CORRECT;
    const xpAfter = xpBefore + xpGained;
    const levelBefore = levelForXp(xpBefore);
    const levelAfter = levelForXp(xpAfter);
    const previousBestScore = Math.max(0, Math.floor(playerBefore.bestScore));
    const isNewRecord = run.score > previousBestScore;
    const challenge = run.entry.mode === 'friendChallenge' && run.entry.targetScore !== undefined
        ? challengeResult(run.score, run.entry.targetScore)
        : undefined;
    const result: GameResult = {
        ...run,
        previousBestScore,
        isNewRecord,
        growth: {
            xpGained,
            levelBefore,
            levelAfter,
            levelProgressBefore: xpBefore % XP_PER_LEVEL,
            levelProgressAfter: xpAfter % XP_PER_LEVEL,
            levelTarget: XP_PER_LEVEL,
        },
        challenge,
    };
    return {
        result,
        player: { level: levelAfter, xp: xpAfter, bestScore: Math.max(previousBestScore, run.score) },
    };
}

export function createResultPresentation(result: GameResult): ResultPresentation {
    const challenge = result.challenge;
    const daily = result.daily;
    const sharePrimary = daily ? daily.targetAchieved && daily.isNewBest : result.isNewRecord || challenge?.outcome === 'won';
    return {
        modeLabel: modeLabel(result),
        headline: challenge
            ? challenge.outcome === 'won' ? '挑战成功！' : challenge.outcome === 'tied' ? '势均力敌！' : '就差一点！'
            : daily?.firstAchievement ? '今日目标达成！'
            : daily?.targetAchieved ? daily.isNewBest ? '今日新纪录！' : '今日挑战达标'
            : result.entry.mode === 'daily' ? '挑战未达成'
            : result.entry.mode === 'brawl60' ? result.isNewRecord ? '极限新纪录！' : '极限止步'
            : result.isNewRecord ? '新纪录！' : '本局完成',
        comparison: comparisonText(result),
        comparisonTone: challenge?.outcome === 'won' || daily?.firstAchievement ? 'positive' : daily?.isNewBest || result.isNewRecord ? 'highlight' : 'neutral',
        accuracy: `${Math.round(Math.max(0, Math.min(1, result.accuracy)) * 100)}%`,
        maxCombo: String(result.maxCombo),
        fastestReaction: formatReaction(result.bestReactionMs),
        answerDetail: `答对 ${result.correctCount}  ·  失误 ${result.errorCount}`,
        growthTitle: result.growth.levelAfter > result.growth.levelBefore
            ? `升级！ Lv.${result.growth.levelBefore} → Lv.${result.growth.levelAfter}`
            : `Lv.${result.growth.levelAfter} 熟练度`,
        growthDetail: `本局 +${result.growth.xpGained}`,
        growthProgress: result.growth.levelTarget > 0
            ? result.growth.levelProgressAfter / result.growth.levelTarget
            : 0,
        replayLabel: result.entry.mode === 'friendChallenge' ? '再战同题' : result.entry.mode === 'daily' ? '再战今日' : '再来一局',
        shareLabel: result.entry.mode === 'friendChallenge' ? '回敬挑战' : '挑战好友',
        sharePrimary,
    };
}

function levelForXp(xp: number): number { return 1 + Math.floor(xp / XP_PER_LEVEL); }

function challengeResult(score: number, rawTargetScore: number): NonNullable<GameResult['challenge']> {
    const targetScore = Math.max(0, Math.floor(rawTargetScore));
    const scoreDelta = score - targetScore;
    return { targetScore, scoreDelta, outcome: scoreDelta > 0 ? 'won' : scoreDelta < 0 ? 'lost' : 'tied' };
}

function modeLabel(result: GameResult): string {
    if (result.entry.mode === 'daily') {
        const title = dailyRecipeById(result.entry.recipeId)?.title;
        return title ? `今日挑战 · ${title}` : '今日挑战';
    }
    if (result.entry.mode === 'friendChallenge') return '好友挑战';
    return '无尽乱斗';
}

function comparisonText(result: GameResult): string {
    if (result.challenge) {
        if (result.challenge.scoreDelta > 0) return `超过好友 ${result.challenge.scoreDelta} 分`;
        if (result.challenge.scoreDelta < 0) return `距离好友 ${Math.abs(result.challenge.scoreDelta)} 分`;
        return `追平好友 ${result.challenge.targetScore} 分`;
    }
    if (result.daily) {
        if (!result.daily.targetAchieved) return `距离今日目标 ${Math.max(0, result.daily.targetScore - result.score)} 分`;
        if (result.daily.firstAchievement) return `目标 ${result.daily.targetScore} 分 · 已达成`;
        if (result.daily.attempts === 1) return `今日首战 · ${result.score} 分`;
        if (result.daily.isNewBest) return `刷新今日最佳 +${result.score - result.daily.previousBestScore}`;
        if (result.score === result.daily.bestScore) return '追平今日最佳';
        return `距离今日最佳 ${Math.max(0, result.daily.bestScore - result.score)} 分`;
    }
    if (result.isNewRecord) {
        return result.previousBestScore > 0
            ? `刷新纪录 +${result.score - result.previousBestScore}`
            : '首局即创纪录';
    }
    if (result.previousBestScore <= 0) return '首次出刀，纪录从这里开始';
    if (result.score === result.previousBestScore) return '追平最高纪录';
    return `距离纪录 ${Math.max(0, result.previousBestScore - result.score)} 分`;
}

function formatReaction(reactionMs?: number): string {
    if (reactionMs === undefined) return '—';
    if (reactionMs < 1000) return `${Math.round(reactionMs)}ms`;
    return `${(reactionMs / 1000).toFixed(2)}s`;
}
