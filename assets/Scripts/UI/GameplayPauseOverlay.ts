import { BlockInputEvents, Button, Color, Graphics, Label, Node, UITransform, Vec3, view } from 'cc';
import { applyGameFont } from './GameFont';

const INK = new Color(45, 43, 39, 255);
const PAPER = new Color(255, 250, 236, 255);
const PAPER_RAISED = new Color(255, 253, 245, 255);
const BLUE = new Color(91, 133, 156, 255);
const YELLOW = new Color(226, 184, 67, 255);

export interface GameplayPauseActions {
    continueGame: () => void;
    home: () => void;
}

/** Covers gameplay knowledge and answer targets while exposing only pause actions. */
export function showGameplayPauseOverlay(parent: Node, actions: GameplayPauseActions): Node {
    parent.getChildByName('GameplayPauseOverlay')?.destroy();
    const visible = view.getVisibleSize();
    const overlay = makeNode('GameplayPauseOverlay', parent, visible.width, visible.height);
    overlay.addComponent(BlockInputEvents);

    const shade = overlay.addComponent(Graphics);
    // Use a fully opaque warm-black cover: gameplay text and answer silhouettes must
    // not remain readable on devices where translucent UI blending is especially clear.
    shade.fillColor = new Color(25, 23, 21, 255);
    shade.rect(-visible.width / 2, -visible.height / 2, visible.width, visible.height);
    shade.fill();

    const card = makeNode('PauseCard', overlay, 560, 520);
    const fitScale = Math.min(1, (visible.width - 48) / 560, (visible.height - 96) / 520);
    card.setScale(new Vec3(fitScale, fitScale, 1));
    const paper = card.addComponent(Graphics);
    paper.fillColor = new Color(35, 31, 27, 115);
    paper.roundRect(-272, -266, 560, 520, 26);
    paper.fill();
    paper.fillColor = PAPER;
    paper.strokeColor = INK;
    paper.lineWidth = 5;
    paper.roundRect(-280, -260, 560, 520, 26);
    paper.fill();
    paper.stroke();

    makeLabel(card, 'Title', '游戏暂停', 48, INK, 460).node.setPosition(0, 145);
    makeLabel(card, 'Detail', '题目与答案已隐藏，计时已冻结', 24, BLUE, 440).node.setPosition(0, 82);
    makeActionButton(card, '继续游戏', -25, true, actions.continueGame);
    makeActionButton(card, '返回首页', -145, false, actions.home);
    return overlay;
}

function makeActionButton(parent: Node, value: string, y: number, primary: boolean, action: () => void): void {
    const node = makeNode(`Button_${value}`, parent, 420, 88);
    node.setPosition(0, y);
    const graphic = node.addComponent(Graphics);
    graphic.fillColor = primary ? YELLOW : PAPER_RAISED;
    graphic.strokeColor = INK;
    graphic.lineWidth = 4;
    graphic.roundRect(-210, -44, 420, 88, 18);
    graphic.fill();
    graphic.stroke();
    makeLabel(node, 'Label', value, 31, INK, 370);
    const button = node.addComponent(Button);
    button.transition = Button.Transition.SCALE;
    button.zoomScale = 0.97;
    node.on(Button.EventType.CLICK, action);
}

function makeLabel(parent: Node, name: string, value: string, fontSize: number, color: Color, width: number): Label {
    const label = makeNode(name, parent, width, Math.ceil(fontSize * 1.5)).addComponent(Label);
    label.string = value;
    label.fontSize = fontSize;
    label.lineHeight = Math.ceil(fontSize * 1.2);
    label.color = color;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.enableWrapText = false;
    label.overflow = Label.Overflow.SHRINK;
    return applyGameFont(label);
}

function makeNode(name: string, parent: Node, width: number, height: number): Node {
    const node = new Node(name);
    parent.addChild(node);
    const transform = node.addComponent(UITransform);
    transform.setContentSize(width, height);
    transform.setAnchorPoint(0.5, 0.5);
    return node;
}
