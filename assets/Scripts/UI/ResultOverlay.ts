import { BlockInputEvents, Button, Color, Graphics, Label, Node, UIOpacity, UITransform, Vec3, tween, view } from 'cc';
import { AppRuntime } from '../app/AppRuntime';
import type { GameResult } from '../domain/Models';
import type { TowerFloorResult } from '../domain/TowerMode';
import { createResultPresentation, type ResultPresentation } from '../domain/ResultSummary';

const INK = new Color(45, 43, 39, 255);
const PAPER = new Color(255, 250, 236, 255);
const PAPER_RAISED = new Color(255, 253, 245, 255);
const RED = new Color(174, 69, 61, 255);
const GREEN = new Color(109, 152, 106, 255);
const BLUE = new Color(91, 133, 156, 255);
const YELLOW = new Color(226, 184, 67, 255);

export interface ResultOverlayActions {
    replay: () => void;
    share: () => void;
    home: () => void;
}

export interface TowerResultOverlayActions {
    next: () => void;
    retry: () => void;
    home: () => void;
}

export function showResultOverlay(parent: Node, result: GameResult, actions: ResultOverlayActions): Node {
    const visible = view.getVisibleSize();
    const overlay = makeNode('ResultOverlay', parent, visible.width, visible.height);
    overlay.addComponent(BlockInputEvents);
    const shade = overlay.addComponent(Graphics);
    shade.fillColor = new Color(29, 26, 23, 235);
    shade.rect(-visible.width / 2, -visible.height / 2, visible.width, visible.height);
    shade.fill();

    const card = makeNode('ResultCard', overlay, 690, 1400);
    const fitScale = Math.min(1, (visible.width - 24) / 690, (visible.height - 48) / 1400);
    drawResultCard(card.addComponent(Graphics), 690, 1400);
    const presentation = createResultPresentation(result);
    buildHeader(card, result, presentation);
    buildStats(card, presentation);
    buildGrowth(card, presentation);
    makeActionButton(card, presentation.replayLabel, -390, !presentation.sharePrimary, actions.replay);
    makeActionButton(card, presentation.shareLabel, -500, presentation.sharePrimary, actions.share);
    makeHomeLink(card, -610, actions.home);

    const opacity = overlay.addComponent(UIOpacity);
    opacity.opacity = 0;
    tween(opacity).to(0.18, { opacity: 255 }, { easing: 'quadOut' }).start();
    card.setScale(fitScale * 0.94, fitScale * 0.94, 1);
    tween(card).to(0.24, { scale: new Vec3(fitScale, fitScale, 1) }, { easing: 'backOut' }).start();
    return overlay;
}

export function showTowerResultOverlay(parent: Node, result: TowerFloorResult, actions: TowerResultOverlayActions): Node {
    const visible = view.getVisibleSize();
    const overlay = makeNode('TowerResultOverlay', parent, visible.width, visible.height);
    overlay.addComponent(BlockInputEvents);
    const shade = overlay.addComponent(Graphics);
    shade.fillColor = new Color(29, 26, 23, 235);
    shade.rect(-visible.width / 2, -visible.height / 2, visible.width, visible.height);
    shade.fill();

    const card = makeNode('TowerResultCard', overlay, 690, 1400);
    const fitScale = Math.min(1, (visible.width - 24) / 690, (visible.height - 48) / 1400);
    drawResultCard(card.addComponent(Graphics), 690, 1400);
    makeLabel(card, 'Mode', `答题试炼塔 · 第 ${result.floor} 层`, 24, RED, 500).node.setPosition(0, 615);
    const headline = result.cleared
        ? result.floor === 30 ? '首章突破！' : `第 ${result.floor} 层突破！`
        : result.failureReason === 'lifeDepleted' ? '生命耗尽' : '目标未完成';
    makeLabel(card, 'Headline', headline, 50, INK, 590).node.setPosition(0, 552);
    makeLabel(card, 'ScoreCaption', '本层得分', 22, BLUE, 300).node.setPosition(0, 482);
    makeLabel(card, 'Score', String(result.score), 104, INK, 600).node.setPosition(0, 395);

    const badge = makeNode('TowerStatusBadge', card, 540, 62);
    badge.setPosition(0, 295);
    const badgeGraphic = badge.addComponent(Graphics);
    badgeGraphic.fillColor = result.cleared ? (result.unlockedRule || result.checkpointReached ? YELLOW : GREEN) : PAPER_RAISED;
    badgeGraphic.strokeColor = INK; badgeGraphic.lineWidth = 3;
    badgeGraphic.roundRect(-270, -31, 540, 62, 22); badgeGraphic.fill(); badgeGraphic.stroke();
    const status = result.unlockedLabel ? `新规则已解锁 · ${result.unlockedLabel}`
        : result.checkpointReached ? `第 ${result.floor} 层检查点已保存`
        : result.cleared ? `正确 ${result.correctCount}/${result.requiredCorrect} · 已通关`
        : `正确 ${result.correctCount}/${result.requiredCorrect} · 再来一次`;
    makeLabel(badge, 'Label', status, 25, INK, 500);

    const row = makeNode('TowerStats', card, 630, 132);
    row.setPosition(0, 145);
    makeStat(row, 'Points', -210, `+${result.towerPointsGained}`, '本层塔积分');
    makeStat(row, 'Run', 0, String(result.runTotalScore), '本轮塔积分');
    makeStat(row, 'Highest', 210, String(result.highestClearedFloor), '最高层');

    const growth = makeNode('TowerGrowthCard', card, 630, 160);
    growth.setPosition(0, -45);
    const growthGraphic = growth.addComponent(Graphics);
    growthGraphic.fillColor = new Color(246, 238, 217, 255);
    growthGraphic.strokeColor = INK; growthGraphic.lineWidth = 3;
    growthGraphic.roundRect(-315, -80, 630, 160, 20); growthGraphic.fill(); growthGraphic.stroke();
    makeLabel(growth, 'Title', `累计塔积分 ${result.totalTowerPoints}`, 30, INK, 560).node.setPosition(0, 32);
    makeLabel(growth, 'Detail', result.cleared ? (result.floor === 30 ? '首章完成 · 可重战第30层' : '下一层已开放') : '重试会换一组新题', 23, result.cleared ? GREEN : RED, 560).node.setPosition(0, -30);

    if (result.cleared && result.floor < 30) {
        makeActionButton(card, '下一层', -390, true, actions.next);
        makeActionButton(card, '暂停爬塔', -500, false, actions.home);
    } else if (result.cleared) {
        makeActionButton(card, '完成首章', -390, true, actions.home);
        makeActionButton(card, '重战第30层', -500, false, actions.retry);
    } else {
        makeActionButton(card, '换一组题重试', -390, true, actions.retry);
        makeActionButton(card, '返回首页', -500, false, actions.home);
    }

    const opacity = overlay.addComponent(UIOpacity); opacity.opacity = 0;
    tween(opacity).to(0.18, { opacity: 255 }, { easing: 'quadOut' }).start();
    card.setScale(fitScale * 0.94, fitScale * 0.94, 1);
    tween(card).to(0.24, { scale: new Vec3(fitScale, fitScale, 1) }, { easing: 'backOut' }).start();
    return overlay;
}

function buildHeader(card: Node, result: GameResult, presentation: ResultPresentation): void {
    makeLabel(card, 'Mode', presentation.modeLabel, 24, RED, 460).node.setPosition(0, 615);
    makeLabel(card, 'Headline', presentation.headline, 50, INK, 590).node.setPosition(0, 552);
    makeLabel(card, 'ScoreCaption', '本局得分', 22, BLUE, 300).node.setPosition(0, 482);
    makeLabel(card, 'Score', String(result.score), 104, INK, 600).node.setPosition(0, 395);

    const comparison = makeNode('ComparisonBadge', card, 470, 62);
    comparison.setPosition(0, 295);
    const badge = comparison.addComponent(Graphics);
    badge.fillColor = presentation.comparisonTone === 'positive' ? GREEN
        : presentation.comparisonTone === 'highlight' ? YELLOW : PAPER_RAISED;
    badge.strokeColor = INK;
    badge.lineWidth = 3;
    badge.roundRect(-235, -31, 470, 62, 22);
    badge.fill(); badge.stroke();
    makeLabel(comparison, 'Label', presentation.comparison, 25, INK, 420);
    makeLabel(card, 'AnswerDetail', presentation.answerDetail, 23, INK, 480).node.setPosition(0, 238);
}

function buildStats(card: Node, presentation: ResultPresentation): void {
    const row = makeNode('ResultStats', card, 630, 132);
    row.setPosition(0, 130);
    makeStat(row, 'Combo', -210, presentation.maxCombo, '最高 COMBO');
    makeStat(row, 'Accuracy', 0, presentation.accuracy, '正确率');
    makeStat(row, 'Reaction', 210, presentation.fastestReaction, '最快反应');
}

function makeStat(parent: Node, name: string, x: number, value: string, caption: string): void {
    const stat = makeNode(`Stat_${name}`, parent, 190, 126);
    stat.setPosition(x, 0);
    const graphic = stat.addComponent(Graphics);
    graphic.fillColor = PAPER_RAISED;
    graphic.strokeColor = new Color(78, 72, 64, 180);
    graphic.lineWidth = 3;
    graphic.roundRect(-95, -63, 190, 126, 18);
    graphic.fill(); graphic.stroke();
    makeLabel(stat, 'Value', value, 35, INK, 170).node.setPosition(0, 20);
    makeLabel(stat, 'Caption', caption, 19, BLUE, 170).node.setPosition(0, -29);
}

function buildGrowth(card: Node, presentation: ResultPresentation): void {
    const growth = makeNode('GrowthCard', card, 630, 160);
    growth.setPosition(0, -55);
    const graphic = growth.addComponent(Graphics);
    graphic.fillColor = new Color(246, 238, 217, 255);
    graphic.strokeColor = INK;
    graphic.lineWidth = 3;
    graphic.roundRect(-315, -80, 630, 160, 20);
    graphic.fill(); graphic.stroke();
    makeLabel(growth, 'Title', presentation.growthTitle, 27, INK, 390).node.setPosition(-92, 40);
    makeLabel(growth, 'Gain', presentation.growthDetail, 22, RED, 150).node.setPosition(220, 40);

    const bar = makeNode('ProgressBar', growth, 552, 28);
    bar.setPosition(0, -25);
    const background = bar.addComponent(Graphics);
    background.fillColor = new Color(93, 86, 77, 55);
    background.roundRect(-276, -14, 552, 28, 14);
    background.fill();
    const width = Math.max(0, Math.min(1, presentation.growthProgress)) * 552;
    if (width > 0) {
        const fill = makeNode('Fill', bar, width, 28).addComponent(Graphics);
        fill.node.setPosition(-(552 - width) / 2, 0);
        fill.fillColor = GREEN;
        fill.roundRect(-width / 2, -14, width, 28, Math.min(14, width / 2));
        fill.fill();
    }
}

function makeActionButton(parent: Node, value: string, y: number, primary: boolean, action: () => void): void {
    const button = makeNode(`Button_${value}`, parent, 560, 88);
    button.setPosition(0, y);
    const graphic = button.addComponent(Graphics);
    if (primary) {
        graphic.fillColor = new Color(67, 60, 52, 105);
        graphic.roundRect(-274, -50, 560, 88, 18);
        graphic.fill();
    }
    graphic.fillColor = primary ? YELLOW : PAPER_RAISED;
    graphic.strokeColor = INK;
    graphic.lineWidth = 4;
    graphic.roundRect(-280, -44, 560, 88, 18);
    graphic.fill(); graphic.stroke();
    makeLabel(button, 'Label', value, 31, INK, 500);
    button.addComponent(Button);
    button.on(Node.EventType.TOUCH_END, () => { AppRuntime.audio.play('ui'); action(); });
}

function makeHomeLink(parent: Node, y: number, action: () => void): void {
    const link = makeNode('Button_返回首页', parent, 280, 72);
    link.setPosition(0, y);
    makeLabel(link, 'Label', '返回首页', 24, BLUE, 250);
    link.addComponent(Button);
    link.on(Node.EventType.TOUCH_END, () => { AppRuntime.audio.play('ui'); action(); });
}

function drawResultCard(graphic: Graphics, width: number, height: number): void {
    const x = -width / 2, y = -height / 2;
    graphic.fillColor = new Color(0, 0, 0, 70);
    graphic.roundRect(x + 9, y - 10, width, height, 28);
    graphic.fill();
    graphic.fillColor = PAPER;
    graphic.strokeColor = RED;
    graphic.lineWidth = 5;
    graphic.roundRect(x, y, width, height, 28);
    graphic.fill(); graphic.stroke();
    graphic.strokeColor = new Color(145, 52, 44, 130);
    graphic.lineWidth = 2;
    graphic.roundRect(x + 10, y + 10, width - 20, height - 20, 22);
    graphic.stroke();
}

function makeNode(name: string, parent: Node, width: number, height: number): Node {
    const result = new Node(name);
    parent.addChild(result);
    const transform = result.addComponent(UITransform);
    transform.setContentSize(width, height);
    transform.setAnchorPoint(0.5, 0.5);
    return result;
}

function makeLabel(parent: Node, name: string, value: string, size: number, color: Color, width: number): Label {
    const result = makeNode(name, parent, width, Math.ceil(size * 1.45)).addComponent(Label);
    result.string = value;
    result.fontSize = size;
    result.lineHeight = Math.ceil(size * 1.2);
    result.color = color;
    result.horizontalAlign = Label.HorizontalAlign.CENTER;
    result.verticalAlign = Label.VerticalAlign.CENTER;
    result.overflow = Label.Overflow.SHRINK;
    result.enableWrapText = false;
    return result;
}
