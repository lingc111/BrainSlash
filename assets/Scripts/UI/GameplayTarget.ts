import { _decorator, Color, Component, Graphics, Label, Node, Sprite, SpriteFrame, UITransform, Vec2 } from 'cc';
import { targetContentLayout, targetSkinPixelScale, targetSkinVisualScale } from './TargetSkinSizing';

const { ccclass } = _decorator;

export enum TargetContentType { TEXT, ICON, IMAGE }
export type TargetShape = 'circle' | 'roundedSquare' | 'hexagon';

export interface GameplayTargetData {
    id: string;
    contentType: TargetContentType;
    text?: string;
    spriteFrame?: SpriteFrame;
    skinSpriteFrame?: SpriteFrame;
    shape: TargetShape;
    value?: unknown;
    isBomb?: boolean;
    color: Color;
    contentColor?: Color;
}

const INK = new Color(45, 43, 39, 255);
const PAPER = new Color(255, 250, 236, 255);
const RED = new Color(174, 69, 61, 255);

function ui(node: Node, width: number, height: number): UITransform {
    const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
    transform.setContentSize(width, height);
    transform.setAnchorPoint(0.5, 0.5);
    return transform;
}

function makeNode(name: string, parent: Node, width = 0, height = 0): Node {
    const node = new Node(name);
    parent.addChild(node);
    ui(node, width, height);
    return node;
}

function label(parent: Node, name: string, text: string, size: number, color = INK): Label {
    const node = makeNode(name, parent, Math.max(90, text.length * size * 1.2), size * 1.5);
    const result = node.addComponent(Label);
    result.string = text;
    result.fontSize = size;
    result.lineHeight = size * 1.2;
    result.color = color;
    result.horizontalAlign = Label.HorizontalAlign.CENTER;
    result.verticalAlign = Label.VerticalAlign.CENTER;
    result.enableWrapText = false;
    return result;
}

function graphics(parent: Node, name: string, width: number, height: number): Graphics {
    return makeNode(name, parent, width, height).addComponent(Graphics);
}

function polygon(g: Graphics, points: Vec2[], fill: Color, stroke = INK, width = 4): void {
    g.clear();
    g.fillColor = fill;
    g.strokeColor = stroke;
    g.lineWidth = width;
    g.lineJoin = Graphics.LineJoin.ROUND;
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
    g.close();
    g.fill();
    g.stroke();
}

@ccclass('GameplayTarget')
export class GameplayTarget extends Component {
    public data!: GameplayTargetData;
    public radius = 70;
    public hit = false;

    public configure(data: GameplayTargetData): void {
        this.data = data;
        for (const child of [...this.node.children]) { child.removeFromParent(); child.destroy(); }
        ui(this.node, this.radius * 2.8, this.radius * 2.8);
        if (data.isBomb) this.drawBomb();
        else this.drawTarget();
    }

    public applySkin(frame: SpriteFrame): void {
        this.data.skinSpriteFrame = frame;
        this.configure(this.data);
    }

    public segmentHit(a: Vec2, b: Vec2): boolean {
        const px = this.node.position.x, py = this.node.position.y;
        const abx = b.x - a.x, aby = b.y - a.y;
        const lengthSq = abx * abx + aby * aby;
        const projection = lengthSq === 0 ? 0 : ((px - a.x) * abx + (py - a.y) * aby) / lengthSq;
        const t = Math.max(0, Math.min(1, projection));
        const dx = a.x + abx * t - px, dy = a.y + aby * t - py;
        return dx * dx + dy * dy <= this.radius * this.radius;
    }

    private drawTarget(): void {
        if (this.data.skinSpriteFrame) {
            this.drawNormalizedSkin('PaperSkin', this.data.skinSpriteFrame);
        } else {
            const contact = graphics(this.node, 'ContactShadow', this.radius * 2.45, this.radius * 2.45);
            contact.node.setPosition(10, -13);
            this.drawShape(contact, new Color(61, 48, 35, 34), new Color(61, 48, 35, 8), 3);
            contact.node.setScale(1.04, 1.04, 1);

            const shadow = graphics(this.node, 'PaperShadow', this.radius * 2.35, this.radius * 2.35);
            shadow.node.setPosition(5, -7);
            this.drawShape(shadow, new Color(75, 62, 45, 62), new Color(75, 62, 45, 18), 3);

            const thickness = graphics(this.node, 'PaperThickness', this.radius * 2.3, this.radius * 2.3);
            thickness.node.setPosition(2, -3);
            this.drawShape(thickness, new Color(224, 211, 181, 255), new Color(98, 83, 61, 150), 5);

            const edge = graphics(this.node, 'PaperEdge', this.radius * 2.3, this.radius * 2.3);
            this.drawShape(edge, PAPER, INK, 4);

            const shape = graphics(this.node, 'MarkerLayer', this.radius * 2.2, this.radius * 2.2);
            shape.node.setScale(0.89, 0.89, 1);
            shape.node.setPosition(-1, 2);
            this.drawShape(shape, this.data.color, new Color(58, 54, 46, 210), 3);

            const fibers = graphics(this.node, 'PencilTexture', this.radius * 1.35, this.radius * 1.1);
            fibers.node.setPosition(-1, 2);
            fibers.strokeColor = new Color(58, 54, 46, 32);
            fibers.lineWidth = 2;
            const strokes = [
                [-36, 23, 30, 20], [-43, 10, 39, 12], [-35, -4, 34, -1],
                [-42, -18, 31, -15], [-25, -29, 24, -27],
            ];
            for (const stroke of strokes) {
                fibers.moveTo(stroke[0], stroke[1]);
                fibers.bezierCurveTo(stroke[0] + 15, stroke[1] + 2, stroke[2] - 12, stroke[3] - 2, stroke[2], stroke[3]);
            }
            fibers.stroke();

            const highlight = graphics(this.node, 'PaperHighlight', 92, 70);
            highlight.node.setPosition(-10, 8);
            highlight.strokeColor = new Color(255, 251, 232, 105);
            highlight.lineWidth = 3;
            highlight.moveTo(-29, 29); highlight.bezierCurveTo(-4, 34, 18, 31, 31, 24); highlight.stroke();


        }

        const layout = targetContentLayout(this.data.skinSpriteFrame?.name, this.data.shape);
        const contentWidth = this.radius * layout.width;
        const contentHeight = this.radius * layout.height;
        const root = makeNode('ContentRoot', this.node, contentWidth, contentHeight);
        root.setPosition(this.radius * layout.offsetX, this.radius * layout.offsetY);
        if (this.data.contentType === TargetContentType.IMAGE && this.data.spriteFrame) {
            const original = this.data.spriteFrame.originalSize;
            const imageScale = Math.min(
                contentWidth / Math.max(1, original.width),
                contentHeight / Math.max(1, original.height),
            ) * 0.9;
            const image = makeNode(
                'ImageContent',
                root,
                original.width * imageScale,
                original.height * imageScale,
            ).addComponent(Sprite);
            image.sizeMode = Sprite.SizeMode.CUSTOM;
            image.spriteFrame = this.data.spriteFrame;
        } else {
            const targetText = (this.data.text ?? '').trim();
            const characterCount = [...targetText].length;
            const fontSize = characterCount > 6 ? 25 : characterCount > 4 ? 30 : characterCount > 2 ? 38 : 52;
            const content = label(root, this.data.contentType === TargetContentType.ICON ? 'IconContent' : 'TextContent', targetText, fontSize, this.data.contentColor ?? INK);
            content.isBold = true;
            ui(content.node, contentWidth, contentHeight);
            content.overflow = Label.Overflow.SHRINK;
        }
    }

    private drawShape(g: Graphics, fill: Color, stroke: Color, lineWidth: number): void {
        const r = this.radius;
        g.fillColor = fill;
        g.strokeColor = stroke;
        g.lineWidth = lineWidth;
        g.lineJoin = Graphics.LineJoin.ROUND;
        if (this.data.shape === 'circle') {
            g.circle(0, 0, r);
            g.fill(); g.stroke();
            return;
        }
        if (this.data.shape === 'roundedSquare') {
            g.roundRect(-r, -r * 0.82, r * 2, r * 1.64, 18);
            g.fill(); g.stroke();
            return;
        }
        const sides = 6;
        const points: Vec2[] = [];
        const start = Math.PI / 2;
        for (let i = 0; i < sides; i++) {
            const angle = start + i * Math.PI * 2 / sides;
            points.push(new Vec2(Math.cos(angle) * r, Math.sin(angle) * r));
        }
        polygon(g, points, fill, stroke, lineWidth);
    }

    private drawBomb(): void {
        if (this.data.skinSpriteFrame) {
            this.drawNormalizedSkin('BombSkin', this.data.skinSpriteFrame);
            return;
        }
        const contact = graphics(this.node, 'ContactShadow', 184, 184);
        contact.node.setPosition(9, -13);
        contact.fillColor = new Color(62, 48, 35, 42); contact.strokeColor = new Color(62, 48, 35, 8); contact.lineWidth = 3;
        contact.circle(0, -5, 68); contact.fill(); contact.stroke();

        const thickness = graphics(this.node, 'PaperThickness', 176, 176);
        thickness.node.setPosition(3, -4);
        thickness.fillColor = new Color(225, 211, 179, 255); thickness.strokeColor = new Color(113, 81, 58, 190); thickness.lineWidth = 5;
        thickness.circle(0, -5, 65); thickness.fill(); thickness.stroke();

        const edge = graphics(this.node, 'PaperEdge', 170, 170);
        edge.fillColor = PAPER; edge.strokeColor = RED; edge.lineWidth = 10;
        edge.circle(0, -5, 62); edge.fill(); edge.stroke();

        const bomb = graphics(this.node, 'BombDrawing', 160, 160);
        bomb.fillColor = new Color(55, 52, 48, 255); bomb.strokeColor = INK; bomb.lineWidth = 5;
        bomb.circle(0, -5, 54); bomb.fill(); bomb.stroke();
        bomb.moveTo(28, 42); bomb.bezierCurveTo(38, 66, 50, 58, 56, 76); bomb.stroke();
        bomb.strokeColor = new Color(255, 255, 255, 24); bomb.lineWidth = 2;
        bomb.moveTo(-31, 28); bomb.bezierCurveTo(-14, 39, 7, 40, 22, 31); bomb.stroke();
        bomb.fillColor = PAPER;
        bomb.circle(-18, 5, 9); bomb.circle(18, 5, 9); bomb.fill();
        bomb.strokeColor = PAPER; bomb.lineWidth = 7;
        bomb.moveTo(-19, -25); bomb.lineTo(19, -25); bomb.moveTo(-10, -34); bomb.lineTo(-10, -17); bomb.moveTo(10, -34); bomb.lineTo(10, -17); bomb.stroke();
    }

    private drawNormalizedSkin(name: string, frame: SpriteFrame): Sprite {
        const original = frame.originalSize;
        const targetExtent = this.radius * 2.64;
        const pixelScale = targetSkinPixelScale(original.width, original.height, targetExtent)
            * targetSkinVisualScale(frame.name);
        const skin = makeNode(name, this.node, original.width * pixelScale, original.height * pixelScale).addComponent(Sprite);
        skin.sizeMode = Sprite.SizeMode.CUSTOM;
        skin.spriteFrame = frame;
        skin.node.setPosition(-frame.offset.x * pixelScale, -frame.offset.y * pixelScale);
        return skin;
    }
}
