import { _decorator, Color, Component, director, EventTouch, game, Game, Graphics, Label, Mask, Node, NodePool, ResolutionPolicy, resources, screen, Sprite, SpriteFrame, tween, Tween, UIOpacity, UITransform, Vec2, Vec3, view } from 'cc';
import { AppRuntime } from '../app/AppRuntime';
import { GAMEPLAY_CONFIG } from '../configs/GameConfig';
import { Brawl60Director, type BrawlQuestionDirective } from '../domain/Brawl60Director';
import { GameSession } from '../domain/GameSession';
import { friendTargetPresentation } from '../domain/FriendChallenge';
import { countdownWarningSecond, failureFeedback, successFeedback } from '../domain/GameFeedback';
import { GestureResolver, GestureProgress, shouldKeepIncompleteGesture } from '../domain/GestureResolver';
import type { ActionConstraint, FailureKind, QuestionInstance, RunResult, TargetSpec } from '../domain/Models';
import { QuestionGenerator } from '../domain/QuestionGenerator';
import { evaluateRules } from '../domain/Rules';
import { prepareRuleTutorial, tutorialRetryInstruction, type RuleTutorialSpec } from '../domain/RuleTutorial';
import { SeededRng } from '../domain/SeededRng';
import { GameplayTarget, GameplayTargetData, TargetContentType, TargetShape } from './GameplayTarget';
import { calculatePortraitTargetLayout, portraitTargetEntranceDelay } from './PortraitTargetLayout';
import { showResultOverlay } from './ResultOverlay';

const { ccclass } = _decorator;
const INK = new Color(45,43,39,255), PAPER = new Color(255,250,236,255), RED = new Color(174,69,61,255), GREEN = new Color(109,152,106,255), BLUE = new Color(91,133,156,255), YELLOW = new Color(226,184,67,255);
const COLORS = [YELLOW,GREEN,BLUE,new Color(137,111,158,255),new Color(207,132,70,255)];
const SKINS = ['blue_square','green_octagon','green_triangle','orange_circle','pink_diamond','purple_hexagon','red_trapezoid','yellow_circle'] as const;
const DESIGN_WIDTH = 750, DESIGN_HEIGHT = 1624;
const FRAME_TOP_INSET = 292, FRAME_BOTTOM_INSET = 12, TARGET_VISUAL_RADIUS = 132;
type EffectKey = typeof SKINS[number] | 'bomb';
interface TargetMotion {
    node: Node;
    startX: number;
    targetX: number;
    startY: number;
    ceilingY: number;
    groundY: number;
    delay: number;
    duration: number;
    velocityY: number;
    gravity: number;
    entranceAngle: number;
    phase: number;
    speed: number;
}
function ui(n:Node,w:number,h:number):UITransform { const t=n.getComponent(UITransform)??n.addComponent(UITransform); t.setContentSize(w,h); t.setAnchorPoint(.5,.5); return t; }
function node(name:string,parent:Node,w=0,h=0):Node { const n=new Node(name); parent.addChild(n); ui(n,w,h); return n; }
function text(parent:Node,name:string,value:string,size:number,color=INK):Label { const l=node(name,parent,Math.max(100,value.length*size*1.25),size*1.5).addComponent(Label); l.string=value;l.fontSize=size;l.lineHeight=size*1.2;l.color=color;l.horizontalAlign=Label.HorizontalAlign.CENTER;l.verticalAlign=Label.VerticalAlign.CENTER;l.enableWrapText=false;return l; }
function gfx(parent:Node,name:string,w:number,h:number):Graphics { return node(name,parent,w,h).addComponent(Graphics); }
function image(parent:Node,name:string,w:number,h:number):Sprite { const s=node(name,parent,w,h).addComponent(Sprite);s.sizeMode=Sprite.SizeMode.CUSTOM;return s; }

@ccclass('GameplayMVP')
export class GameplayMVP extends Component {
    private session!:GameSession; private generator!:QuestionGenerator; private director!:Brawl60Director; private visual!:SeededRng;
    private question:QuestionInstance|null=null; private constraint:ActionConstraint|null=null; private gesture:GestureResolver|null=null;
    private targets!:Node; private effects!:Node; private floats!:Node; private trail!:Graphics;
    private score!:Label; private combo!:Label; private prompt!:Label; private rule!:Label; private timer!:Label; private life!:Label;
    private friendTarget:Label|null=null; private friendTargetCard:Node|null=null; private tutorialCoach:Label|null=null;
    private handDrawnChrome:Node|null=null; private handDrawnFrame:Graphics|null=null;
    private readonly lifeHearts:Sprite[]=[]; private renderedLife=-1;
    private points:Vec2[]=[]; private trailAge=1; private finished=false; private reverseFrame:Node|null=null;
    private paused=false; private hidden=false; private hitStopActive=false; private lastCountdownSecond=-1;
    private currentDirective:BrawlQuestionDirective|null=null; private tutorial:RuleTutorialSpec|null=null;
    private currentSkins:(typeof SKINS[number])[]=[]; private currentMotionPhases:number[]=[];
    private readonly handleResize=():void=>this.applyVisibleLayout();
    private readonly effectByNode=new Map<Node,EffectKey>(); private readonly frames=new Map<EffectKey,SpriteFrame>(); private readonly pool=new NodePool();
    private readonly motions:TargetMotion[]=[];
    protected onLoad():void {
        view.setDesignResolutionSize(DESIGN_WIDTH,DESIGN_HEIGHT,ResolutionPolicy.SHOW_ALL);
        const editorPreview=this.node.getChildByName('TargetContainer')?.getChildByName('EditorPreviewTargets');if(editorPreview){editorPreview.active=false;editorPreview.destroy();}
        AppRuntime.initialize();AppRuntime.consumePendingFriendChallenge();this.session=new GameSession(AppRuntime.entry,GAMEPLAY_CONFIG);
        this.generator=new QuestionGenerator(new SeededRng(`${AppRuntime.entry.seed}:gameplay`),GAMEPLAY_CONFIG);this.director=new Brawl60Director(new SeededRng(`${AppRuntime.entry.seed}:director`));this.visual=new SeededRng(`${AppRuntime.entry.seed}:visual`);
        this.bindStaticView();screen.on('window-resize',this.handleResize,this);game.on(Game.EVENT_HIDE,this.onHide,this);game.on(Game.EVENT_SHOW,this.onShow,this);this.scheduleOnce(this.handleResize,0);
        this.scheduleOnce(()=>{this.node.getChildByName('Ready')?.destroy();AppRuntime.audio.play('ui');this.session.start();this.spawn();},GAMEPLAY_CONFIG.readyMs/1000);
    }
    protected onDestroy():void { screen.off('window-resize',this.handleResize,this);game.off(Game.EVENT_HIDE,this.onHide,this);game.off(Game.EVENT_SHOW,this.onShow,this);this.node.off(Node.EventType.TOUCH_START,this.startTouch,this);this.node.off(Node.EventType.TOUCH_MOVE,this.moveTouch,this);this.node.off(Node.EventType.TOUCH_END,this.endTouch,this);this.node.off(Node.EventType.TOUCH_CANCEL,this.endTouch,this);this.pool.clear(); }
    protected update(dt:number):void {
        if(this.finished||this.paused)return; this.session.tick(dt*1000);
        if(this.session.state.phase==='playing'&&this.question&&!this.session.isQuestionResolved()&&this.updateTargetMotions())this.fail('miss');
        if(this.session.state.phase==='finished')this.finish(); this.refresh(); this.trailAge+=dt;if(this.trailAge<.14)this.drawTrail(1-this.trailAge/.14);else this.trail.clear();
    }
    public rebuildStaticView():void {
        for(const c of [...this.node.children]){c.removeFromParent();c.destroy();}
        ui(this.node,DESIGN_WIDTH,DESIGN_HEIGHT);
        const bg=image(this.node,'Background',DESIGN_WIDTH,DESIGN_HEIGHT);resources.load('textures/common/background_paper/spriteFrame',SpriteFrame,(e,f)=>{if(!e&&bg.isValid)bg.spriteFrame=f;});
        node('TargetContainer',this.node,DESIGN_WIDTH,DESIGN_HEIGHT);gfx(this.node,'SlashTrail',DESIGN_WIDTH,DESIGN_HEIGHT);node('HitEffects',this.node,DESIGN_WIDTH,DESIGN_HEIGHT);node('FloatingText',this.node,DESIGN_WIDTH,DESIGN_HEIGHT);
        const y=DESIGN_HEIGHT/2-150;const score=text(this.node,'Score','0',30);score.node.setPosition(-DESIGN_WIDTH/2+85,y);const combo=text(this.node,'Combo','0 COMBO',27,RED);combo.node.setPosition(-DESIGN_WIDTH/2+110,y-48);
        const prompt=text(this.node,'Prompt','准备斩击',44);prompt.node.setPosition(0,y);const rule=text(this.node,'Rule','标准',25,PAPER);rule.node.setPosition(0,y-55);const badge=image(rule.node,'Badge',210,45);badge.node.setSiblingIndex(0);badge.color=BLUE;resources.load('textures/home/paper/daily_paper/spriteFrame',SpriteFrame,(e,f)=>{if(!e&&badge.isValid)badge.spriteFrame=f;});
        const timer=text(this.node,'Timer','60s',38);timer.node.setPosition(DESIGN_WIDTH/2-85,y);const life=text(this.node,'Life','♥ ♥ ♥',26,RED);life.node.setPosition(DESIGN_WIDTH/2-85,y-48);text(this.node,'Ready','READY',68,RED);
        this.buildHandDrawnChrome();this.layoutHandDrawnChrome(DESIGN_WIDTH,DESIGN_HEIGHT);
    }
    private bindStaticView():void {
        const required=(name:string):Node=>{const found=this.node.getChildByName(name);if(!found)throw new Error(`[GameplayMVP] Gameplay.scene 缺少静态节点 ${name}，请在编辑器中重建并保存静态布局。`);return found;};
        const requiredLabel=(name:string):Label=>{const found=required(name).getComponent(Label);if(!found)throw new Error(`[GameplayMVP] 静态节点 ${name} 缺少 Label 组件。`);return found;};
        const background=required('Background').getComponent(Sprite);if(!background)throw new Error('[GameplayMVP] 静态节点 Background 缺少 Sprite 组件。');
        resources.load('textures/common/background_paper/spriteFrame',SpriteFrame,(e,f)=>{if(!e&&background.isValid)background.spriteFrame=f;});
        this.targets=required('TargetContainer');const trailNode=required('SlashTrail');const trail=trailNode.getComponent(Graphics);if(!trail)throw new Error('[GameplayMVP] 静态节点 SlashTrail 缺少 Graphics 组件。');this.trail=trail;
        this.effects=required('HitEffects');this.floats=required('FloatingText');this.score=requiredLabel('Score');this.combo=requiredLabel('Combo');this.prompt=requiredLabel('Prompt');this.rule=requiredLabel('Rule');this.timer=requiredLabel('Timer');this.life=requiredLabel('Life');
        this.buildHandDrawnChrome();
        this.applyVisibleLayout();
        this.node.on(Node.EventType.TOUCH_START,this.startTouch,this);this.node.on(Node.EventType.TOUCH_MOVE,this.moveTouch,this);this.node.on(Node.EventType.TOUCH_END,this.endTouch,this);this.node.on(Node.EventType.TOUCH_CANCEL,this.endTouch,this);
        for(const key of [...SKINS,'bomb'] as EffectKey[])resources.load(`textures/gameplay/effects/slash/${key}_slash/spriteFrame`,SpriteFrame,(e,f)=>{if(!e&&f?.isValid)this.frames.set(key,f);});
    }
    private applyVisibleLayout():void{const background=this.node.getChildByName('Background')?.getComponent(Sprite);if(!background||!this.score)return;const v=view.getVisibleSize();ui(this.node,v.width,v.height);for(const layer of [background.node,this.targets,this.trail.node,this.effects,this.floats])ui(layer,v.width,v.height);this.layoutStaticHud(v.width,v.height);this.layoutHandDrawnChrome(v.width,v.height);}
    private layoutStaticHud(width:number,height:number):void{const y=height/2-150;this.score.node.active=false;this.combo.node.active=true;this.combo.fontSize=44;this.combo.lineHeight=53;this.combo.color=INK;this.combo.node.setPosition(-width/2+96,y+3);this.prompt.node.setPosition(0,y);this.rule.node.setPosition(0,y-55);this.timer.node.setPosition(width/2-68,y+4);this.life.node.active=false;}
    private buildHandDrawnChrome():void{
        for(const name of ['HandDrawnChrome','HandDrawnFrameLayer']){const old=this.node.getChildByName(name);if(old){old.removeFromParent();old.destroy();}}
        this.lifeHearts.length=0;this.renderedLife=-1;
        const frameLayer=node('HandDrawnFrameLayer',this.node,DESIGN_WIDTH,DESIGN_HEIGHT);
        const targetIndex=this.node.getChildByName('TargetContainer')?.getSiblingIndex()??1;frameLayer.setSiblingIndex(targetIndex);
        this.handDrawnFrame=gfx(frameLayer,'GameplayHandDrawnFrame',DESIGN_WIDTH-38,DESIGN_HEIGHT-330);
        const chrome=node('HandDrawnChrome',this.node,DESIGN_WIDTH,DESIGN_HEIGHT);this.handDrawnChrome=chrome;
        const scoreIndex=this.node.getChildByName('Score')?.getSiblingIndex()??this.node.children.length;chrome.setSiblingIndex(scoreIndex);
        this.makeComboCard(chrome);
        this.makeArtworkCard(chrome,'PromptPaperCard','gameplay_mid_title',306,230);
        const timerCard=this.makeArtworkCard(chrome,'TimerPaperCard','gameplay_time',176,176,1.1);this.makeLifeHearts(timerCard);
        const friendCard=node('FriendChallengeTarget',chrome,430,44),badge=friendCard.addComponent(Graphics);badge.fillColor=new Color(255,250,236,245);badge.strokeColor=INK;badge.lineWidth=2.5;badge.roundRect(-215,-22,430,44,15);badge.fill();badge.stroke();const friend=text(friendCard,'Label','',21,INK);ui(friend.node,410,40);friend.overflow=Label.Overflow.SHRINK;friendCard.active=this.session?.entry.mode==='friendChallenge';this.friendTarget=friend;this.friendTargetCard=friendCard;
        const coachCard=node('TutorialCoach',chrome,430,48),coachBadge=coachCard.addComponent(Graphics);coachBadge.fillColor=new Color(255,244,194,250);coachBadge.strokeColor=YELLOW;coachBadge.lineWidth=3;coachBadge.roundRect(-215,-24,430,48,16);coachBadge.fill();coachBadge.stroke();const coach=text(coachCard,'Label','',22,INK);ui(coach.node,410,44);coach.overflow=Label.Overflow.SHRINK;coachCard.active=false;this.tutorialCoach=coach;
    }
    private makeComboCard(parent:Node):Node{
        const card=node('ComboPaperCard',parent,164,212);card.angle=-1.2;const artwork=image(card,'ComboArtwork',164,212);
        resources.load('textures/gameplay/ui/combo/spriteFrame',SpriteFrame,(e,f)=>{if(!e&&artwork.isValid)artwork.spriteFrame=f;});return card;
    }
    private makeArtworkCard(parent:Node,name:string,assetName:string,width:number,height:number,angle=0):Node{
        const card=node(name,parent,width,height);card.angle=angle;const artwork=image(card,'Artwork',width,height);
        resources.load(`textures/gameplay/ui/${assetName}/spriteFrame`,SpriteFrame,(e,f)=>{if(!e&&artwork.isValid)artwork.spriteFrame=f;});return card;
    }
    private makeLifeHearts(parent:Node):void{
        for(let i=0;i<3;i++){const cell=node(`LifeHeart_${i}`,parent,44,42);cell.setPosition((i-1)*44,-42);const mask=cell.addComponent(Mask);mask.type=Mask.Type.GRAPHICS_RECT;const heart=image(cell,'Artwork',132,42);heart.node.setPosition((1-i)*44,0);this.lifeHearts.push(heart);}
        resources.load('textures/gameplay/ui/life_heart/spriteFrame',SpriteFrame,(e,f)=>{if(e)return;for(const heart of this.lifeHearts)if(heart.isValid)heart.spriteFrame=f;});
    }
    private layoutHandDrawnChrome(width:number,height:number):void{
        const chrome=this.handDrawnChrome;if(!chrome?.isValid)return;ui(chrome,width,height);const hudY=height/2-168;
        chrome.getChildByName('ComboPaperCard')?.setPosition(-width/2+96,hudY);
        chrome.getChildByName('PromptPaperCard')?.setPosition(0,hudY-2);
        chrome.getChildByName('TimerPaperCard')?.setPosition(width/2-96,hudY);
        chrome.getChildByName('FriendChallengeTarget')?.setPosition(0,hudY-100);
        chrome.getChildByName('TutorialCoach')?.setPosition(0,hudY-100);
        const frame=this.handDrawnFrame;if(!frame?.isValid)return;const frameLayer=frame.node.parent;if(frameLayer)ui(frameLayer,width,height);
        const frameTop=height/2-FRAME_TOP_INSET,frameBottom=-height/2+FRAME_BOTTOM_INSET,frameWidth=width-38,frameHeight=frameTop-frameBottom;ui(frame.node,frameWidth,frameHeight);frame.node.setPosition(0,(frameTop+frameBottom)/2);this.drawHandDrawnFrame(frame,frameWidth,frameHeight);
    }
    private drawHandDrawnFrame(g:Graphics,width:number,height:number):void{
        const w=width/2,h=height/2;g.clear();g.strokeColor=new Color(196,57,43,235);g.lineWidth=4;g.lineCap=Graphics.LineCap.ROUND;g.lineJoin=Graphics.LineJoin.ROUND;
        g.moveTo(-w+7,-h+5);g.bezierCurveTo(-w+1,-h*.25,-w+4,h*.45,-w+8,h-7);g.bezierCurveTo(-w*.35,h+2,w*.38,h-2,w-8,h-5);g.bezierCurveTo(w+1,h*.3,w-3,-h*.4,w-6,-h+7);g.stroke();
        g.strokeColor=new Color(166,48,37,155);g.lineWidth=2;g.moveTo(-w+12,-h+10);g.bezierCurveTo(-w+8,-h*.18,-w+10,h*.48,-w+13,h-12);g.bezierCurveTo(-w*.28,h-5,w*.42,h-7,w-13,h-10);g.bezierCurveTo(w-7,h*.25,w-9,-h*.48,w-11,-h+12);g.stroke();
    }
    private spawn():void {
        if(this.session.state.phase!=='playing')return;
        const prepared=prepareRuleTutorial(this.director.next(this.session.state.elapsedMs),AppRuntime.save.snapshot().tutorials);this.currentDirective=prepared.directive;this.tutorial=prepared.tutorial;this.question=this.generator.next(prepared.directive);this.question.tutorialSafe=!!this.tutorial;this.presentCurrentQuestion(false);
    }
    private presentCurrentQuestion(retry:boolean,retryCopy?:string):void{if(!this.question||!this.currentDirective||this.session.state.phase!=='playing')return;for(const c of [...this.targets.children]){c.removeFromParent();c.destroy();}this.effectByNode.clear();this.motions.length=0;this.gesture=null;this.constraint=evaluateRules(this.question);if(!retry){this.session.beginQuestion();this.currentSkins=this.visual.shuffle(SKINS);this.currentMotionPhases=this.question.targets.map(()=>this.visual.next()*Math.PI*2);}this.prompt.string=this.question.prompt.text;const rs=this.question.activeRules.filter(r=>r!=='standard');this.rule.string=this.tutorial?`新规则 · ${this.tutorial.name}`:rs.length?rs.map(r=>({reverse:'反向',multi:'多目标',order:'顺序',stroop:'颜色骗局',bomb:'禁区'} as Record<string,string>)[r]).join(' + '):'标准';this.updateTutorialCoach(retryCopy);this.showReverse(this.question.activeRules.includes('reverse'));const positions=this.layout(this.question.targets.length);this.question.targets.forEach((s,i)=>this.createTarget(s,positions[i],this.currentSkins[i%this.currentSkins.length],i,this.currentDirective!.speed,this.currentMotionPhases[i]));this.refresh();}
    private createTarget(spec:TargetSpec,pos:Vec3,skin:typeof SKINS[number],i:number,speed:number,motionPhase:number):void {
        const n=node(spec.isBomb?'BombTarget':`Target_${spec.id}`,this.targets,168,168);const v=view.getVisibleSize(),side=pos.x<0?-1:pos.x>0?1:i%2===0?-1:1,row=Math.max(0,pos.z),groundY=-v.height/2-TARGET_VISUAL_RADIUS-8-row*220,startY=pos.y,delay=portraitTargetEntranceDelay({x:pos.x,y:pos.y,row}),baseDuration=(this.question?.timeLimitMs??3000)/1000,duration=Math.max(.9,baseDuration-delay),maxApexY=v.height/2-FRAME_TOP_INSET-TARGET_VISUAL_RADIUS-8,apexY=Math.max(startY+24,Math.min(maxApexY,startY+v.height*.105)),arcRatio=Math.sqrt(Math.max(1,apexY-startY)/Math.max(1,apexY-groundY)),apexTime=duration*arcRatio/(1+arcRatio),gravity=2*(startY-apexY)/(apexTime*apexTime),velocityY=-gravity*apexTime,entranceAngle=[-10,8,-7,10,-6,7][i]??0;
        n.setPosition(side*(v.width/2+110),startY);n.setScale(.68,.68,1);n.angle=entranceAngle;
        const wordColors:Record<string,Color>={红:RED,蓝:BLUE,绿:GREEN,黄:YELLOW};
        const data:GameplayTargetData={id:spec.id,contentType:TargetContentType.TEXT,text:spec.text,value:spec.value,shape:(['roundedSquare','triangle','hexagon','circle','pentagon'] as TargetShape[])[i%5],isBomb:spec.isBomb,color:COLORS[i%COLORS.length],contentColor:spec.colorName?wordColors[spec.colorName]:undefined};const target=n.addComponent(GameplayTarget);target.configure(data);
        const key:EffectKey=spec.isBomb?'bomb':skin;this.effectByNode.set(n,key);resources.load(`textures/gameplay/targets/${key}/spriteFrame`,SpriteFrame,(e,f)=>{if(!e&&n.isValid&&n.active)target.applySkin(f);});
        this.motions.push({node:n,startX:n.position.x,targetX:pos.x,startY,ceilingY:maxApexY,groundY,delay,duration,velocityY,gravity,entranceAngle,phase:motionPhase,speed});
        tween(n).delay(delay).to(.18,{scale:new Vec3(1.12,1.12,1)},{easing:'backOut'}).to(.16,{scale:Vec3.ONE},{easing:'quadOut'}).start();
    }
    private layout(count:number):Vec3[]{const v=view.getVisibleSize();return calculatePortraitTargetLayout(count,v.width,v.height).map((position)=>new Vec3(position.x,position.y,position.row));}
    private startTouch(e:EventTouch):void{if(this.paused||this.session.state.phase!=='playing'||!this.constraint)return;if(!this.gesture)this.gesture=new GestureResolver(this.constraint);this.points=[this.point(e)];this.trailAge=0;}
    private moveTouch(e:EventTouch):void{if(!this.gesture||this.session.state.phase!=='playing')return;const p=this.point(e),a=this.points[this.points.length-1];if(!a||Vec2.distance(a,p)<4)return;this.points.push(p);if(this.points.length>18)this.points.shift();this.sweep(a,p);this.trailAge=0;this.drawTrail(1);}
    private endTouch():void{if(this.gesture&&this.gesture.hasHits()&&this.session.state.phase==='playing'){const p=this.gesture.end(this.keepsIncompleteGesture());this.progress(p,null);if(p.status!=='continue')this.gesture=null;}else if(!this.keepsIncompleteGesture())this.gesture=null;this.trailAge=0;}
    private point(e:EventTouch):Vec2{const p=e.getUILocation(),v=view.getVisibleSize();return new Vec2(p.x-v.width/2,p.y-v.height/2);}
    private sweep(a:Vec2,b:Vec2):void{if(!this.gesture)return;for(const n of [...this.targets.children]){const t=n.getComponent(GameplayTarget);if(!t||t.hit||!t.segmentHit(a,b))continue;t.hit=true;const p=this.gesture.hit(t.data.id);this.slash(t,a,b);this.progress(p,t);if(p.status!=='continue'){this.gesture=null;break;}}}
    private progress(p:GestureProgress,t:GameplayTarget|null):void{if(p.status==='success')this.success(t);else if(p.status==='failure')this.fail(p.kind,t);}
    private keepsIncompleteGesture():boolean{return !!this.constraint&&shouldKeepIncompleteGesture(this.constraint);}
    private success(t:GameplayTarget|null):void{if(!this.question)return;const r=this.session.resolveSuccess(this.question);if(!r)return;const pos=t?.node.position??Vec3.ZERO,feedback=successFeedback(r.kind,this.session.state.combo),vibration=AppRuntime.save.snapshot().settings.vibration;AppRuntime.audio.play(feedback.sound,{variant:this.session.state.combo});AppRuntime.platform.vibrate(vibration,feedback.haptic);if(feedback.comboMilestone&&r.kind!=='master')AppRuntime.audio.play('combo',{variant:this.session.state.combo});this.animateCombo(this.session.state.combo,feedback.comboMilestone);this.hitSparks(pos,r.kind==='master'?YELLOW:GREEN,r.kind==='master');if(feedback.hitStopMs)this.applyHitStop(feedback.hitStopMs);if(this.tutorial){AppRuntime.save.markTutorial(this.tutorial.rule);this.updateTutorialCoach(`已掌握 · ${this.tutorial.name}`);}this.float(pos,`+${r.scoreDelta}${r.kind==='master'?' MASTER':''}`,r.kind==='master'?YELLOW:GREEN);this.scheduleOnce(()=>{this.session.continueAfterFeedback();this.spawn();},r.kind==='master'?.32:.28);}
    private fail(kind:FailureKind,t:GameplayTarget|null=null):void{const pos=t?.node.position??Vec3.ZERO,vibration=AppRuntime.save.snapshot().settings.vibration;if(this.question?.tutorialSafe&&this.tutorial){this.session.cancelQuestion();const retryCopy=tutorialRetryInstruction(this.tutorial,kind);AppRuntime.audio.play('warning');AppRuntime.platform.vibrate(vibration,'light');this.float(pos,'再斩一次',YELLOW);this.updateTutorialCoach(retryCopy,true);this.scheduleOnce(()=>{if(this.session.retryQuestion())this.presentCurrentQuestion(true,retryCopy);},.38);return;}const brokenCombo=this.session.state.combo;if(!this.session.resolveFailure(kind))return;const feedback=failureFeedback(kind,brokenCombo);AppRuntime.audio.play(feedback.sound);AppRuntime.platform.vibrate(vibration,feedback.haptic);this.error(pos);this.float(pos,feedback.label,RED);if(feedback.showComboBreak)this.breakCombo(brokenCombo);if(this.session.state.phase!=='finished')this.scheduleOnce(()=>{this.session.continueAfterFeedback();this.spawn();},.3);}
    private finish():void{if(this.finished)return;this.finished=true;AppRuntime.audio.play('finish');const s=this.session.state,total=s.correctCount+s.errorCount;const run:RunResult={entry:this.session.entry,score:s.score,maxCombo:s.maxCombo,correctCount:s.correctCount,errorCount:s.errorCount,accuracy:total?s.correctCount/total:0,bestReactionMs:s.bestReactionMs};const result=AppRuntime.finish(run);showResultOverlay(this.node,result,{replay:()=>AppRuntime.replay(),share:()=>AppRuntime.share(),home:()=>AppRuntime.home()});}
    private refresh():void{if(!this.score)return;const s=this.session.state,seconds=Math.ceil(s.remainingMs/1000);this.score.string=String(s.score);this.combo.string=String(s.combo);this.timer.string=`${seconds}s`;this.updateLifeHearts(s.life);this.updateFriendTarget(s.score);this.updateCountdownFeedback(s.remainingMs);}
    private updateFriendTarget(score:number):void{const label=this.friendTarget,card=this.friendTargetCard,target=this.session.entry.targetScore;if(!label||!card)return;if(this.tutorial||this.session.entry.mode!=='friendChallenge'||target===undefined){card.active=false;return;}const state=friendTargetPresentation(score,target);card.active=true;label.string=state.text;label.color=state.tone==='ahead'?GREEN:state.tone==='tied'?BLUE:INK;}
    private updateTutorialCoach(copy?:string,pulse=false):void{const label=this.tutorialCoach,card=label?.node.parent;if(!label||!card)return;if(!this.tutorial){card.active=false;return;}card.active=true;label.string=copy??`新规则 · ${this.tutorial.instruction}`;if(!pulse)return;Tween.stopAllByTarget(card);card.setScale(Vec3.ONE);tween(card).to(.08,{scale:new Vec3(1.06,1.06,1)},{easing:'backOut'}).to(.14,{scale:Vec3.ONE},{easing:'quadOut'}).start();}
    private updateLifeHearts(life:number):void{
        if(life===this.renderedLife)return;const previous=this.renderedLife,lit=new Color(255,255,255,255),off=new Color(92,88,82,125);
        this.lifeHearts.forEach((heart,i)=>{Tween.stopAllByTarget(heart.node);heart.node.setScale(Vec3.ONE);const alive=i<life;if(previous>=0&&!alive&&i<previous){heart.color=lit;tween(heart.node).to(.09,{scale:new Vec3(.78,.78,1)}).call(()=>{if(heart.isValid)heart.color=off;}).to(.14,{scale:Vec3.ONE},{easing:'backOut'}).start();}else heart.color=alive?lit:off;});
        this.renderedLife=life;
    }
    private drawTrail(alpha:number):void{this.trail.clear();if(this.points.length<2||alpha<=0)return;for(const [w,c] of [[16,new Color(148,187,199,Math.round(95*alpha))],[8,new Color(255,253,241,Math.round(235*alpha))]] as [number,Color][]){this.trail.lineCap=Graphics.LineCap.ROUND;this.trail.lineJoin=Graphics.LineJoin.ROUND;this.trail.lineWidth=w;this.trail.strokeColor=c;this.trail.moveTo(this.points[0].x,this.points[0].y);for(let i=1;i<this.points.length;i++)this.trail.lineTo(this.points[i].x,this.points[i].y);this.trail.stroke();}}
    private showReverse(active:boolean):void{this.reverseFrame?.destroy();this.reverseFrame=null;if(!active)return;const v=view.getVisibleSize(),g=gfx(this.node,'ReverseFrame',v.width-24,v.height-28);g.strokeColor=new Color(174,69,61,170);g.lineWidth=8;g.rect(-v.width/2+12,-v.height/2+14,v.width-24,v.height-28);g.stroke();this.reverseFrame=g.node;}
    private error(pos:Readonly<Vec3>):void{const g=gfx(this.effects,'ErrorRing',190,190);g.node.setPosition(pos);g.strokeColor=RED;g.lineWidth=12;g.circle(0,0,80);g.moveTo(-52,-52);g.lineTo(52,52);g.moveTo(-52,52);g.lineTo(52,-52);g.stroke();const o=g.node.addComponent(UIOpacity);tween(g.node).to(.22,{scale:new Vec3(1.16,1.16,1)},{easing:'quadOut'}).start();tween(o).to(.24,{opacity:0}).call(()=>g.node.destroy()).start();}
    private float(pos:Readonly<Vec3>,value:string,color:Color):void{const l=text(this.floats,'Float',value,32,color);l.node.setPosition(pos.x,pos.y+44);const o=l.node.addComponent(UIOpacity);tween(l.node).to(.34,{position:new Vec3(pos.x,pos.y+105,0)},{easing:'quadOut'}).start();tween(o).delay(.12).to(.22,{opacity:0}).call(()=>l.node.destroy()).start();}
    private slash(t:GameplayTarget,a:Vec2,b:Vec2):void{AppRuntime.audio.play('slash');const key=this.effectByNode.get(t.node),frame=key?this.frames.get(key):undefined,pos=t.node.position.clone();t.node.active=false;if(!frame){this.float(pos,'✦',YELLOW);return;}const n=this.pool.size()?this.pool.get()!:node('SlashBurst',this.effects,310,310);if(!n.parent)this.effects.addChild(n);n.active=true;n.setPosition(pos);n.setScale(.76,.76,1);const d=b.clone().subtract(a);n.angle=Math.atan2(d.y,d.x)*180/Math.PI-45;const s=n.getComponent(Sprite)??n.addComponent(Sprite);s.sizeMode=Sprite.SizeMode.CUSTOM;s.spriteFrame=frame;const o=n.getComponent(UIOpacity)??n.addComponent(UIOpacity);o.opacity=255;Tween.stopAllByTarget(n);Tween.stopAllByTarget(o);tween(n).to(.06,{scale:new Vec3(1.02,1.02,1)}).to(.16,{scale:new Vec3(1.1,1.1,1)}).start();tween(o).delay(.08).to(.14,{opacity:0}).call(()=>{if(n.isValid)this.pool.put(n);}).start();}
    private hitSparks(pos:Readonly<Vec3>,color:Color,master:boolean):void{const size=master?300:220,g=gfx(this.effects,master?'MasterImpact':'HitSparks',size,size),r1=master?58:42,r2=master?126:86,count=master?10:6;g.node.setPosition(pos);g.strokeColor=color;g.lineWidth=master?12:7;g.lineCap=Graphics.LineCap.ROUND;for(let i=0;i<count;i++){const angle=Math.PI*2*i/count,x1=Math.cos(angle)*r1,y1=Math.sin(angle)*r1,x2=Math.cos(angle)*r2,y2=Math.sin(angle)*r2;g.moveTo(x1,y1);g.lineTo(x2,y2);}if(master)g.circle(0,0,72);g.stroke();g.node.setScale(.72,.72,1);const opacity=g.node.addComponent(UIOpacity);tween(g.node).to(master?.3:.2,{scale:new Vec3(master?1.28:1.08,master?1.28:1.08,1)},{easing:'quadOut'}).start();tween(opacity).delay(master?.08:.04).to(master?.22:.16,{opacity:0}).call(()=>g.node.destroy()).start();}
    private animateCombo(combo:number,milestone:boolean):void{const target=this.combo.node;Tween.stopAllByTarget(target);target.setScale(Vec3.ONE);this.combo.color=milestone?YELLOW:INK;tween(target).to(.08,{scale:new Vec3(milestone?1.3:1.16,milestone?1.3:1.16,1)},{easing:'backOut'}).to(.14,{scale:Vec3.ONE},{easing:'quadOut'}).start();if(milestone)this.scheduleOnce(()=>{if(this.combo?.isValid)this.combo.color=INK;},.26);}
    private breakCombo(_combo:number):void{const target=this.combo.node,origin=target.position.clone();Tween.stopAllByTarget(target);target.setScale(Vec3.ONE);this.combo.color=RED;tween(target).to(.05,{position:new Vec3(origin.x-9,origin.y,origin.z),scale:new Vec3(.86,.86,1)}).to(.05,{position:new Vec3(origin.x+9,origin.y,origin.z)}).to(.08,{position:origin,scale:Vec3.ONE},{easing:'backOut'}).start();this.scheduleOnce(()=>{if(this.combo?.isValid)this.combo.color=INK;},.22);}
    private applyHitStop(durationMs:number):void{this.hitStopActive=true;this.paused=true;this.scheduleOnce(()=>{this.hitStopActive=false;if(!this.hidden)this.paused=false;},durationMs/1000);}
    private updateCountdownFeedback(remainingMs:number):void{const second=countdownWarningSecond(remainingMs,this.lastCountdownSecond);if(second===null)return;this.lastCountdownSecond=second;AppRuntime.audio.play('warning',{variant:5-second});this.timer.color=RED;Tween.stopAllByTarget(this.timer.node);this.timer.node.setScale(Vec3.ONE);tween(this.timer.node).to(.08,{scale:new Vec3(1.18,1.18,1)},{easing:'backOut'}).to(.12,{scale:Vec3.ONE},{easing:'quadOut'}).start();}
    private updateTargetMotions():boolean{
        const elapsed=this.session.questionElapsedMs()/1000;
        let landed=false;
        for(const motion of this.motions){
            if(!motion.node.isValid)continue;
            const local=elapsed-motion.delay;
            if(local<0){motion.node.setPosition(motion.startX,motion.startY);continue;}
            const t=Math.min(local,motion.duration),entry=Math.min(1,t/Math.min(.58/Math.max(.1,motion.speed),motion.duration*.3)),ease=1-Math.pow(1-entry,3);
            const x=motion.startX+(motion.targetX-motion.startX)*ease+Math.sin(t*2.4*motion.speed+motion.phase)*8*entry;
            const y=motion.startY+motion.velocityY*t+.5*motion.gravity*t*t;
            motion.node.setPosition(x,Math.min(motion.ceilingY,Math.max(motion.groundY,y)));motion.node.angle=motion.entranceAngle*Math.max(0,1-Math.min(1,t/.24));
            if(local>=motion.duration)landed=true;
        }
        return landed;
    }
    private onHide():void{if(this.finished)return;this.hidden=true;this.paused=true;if(!this.keepsIncompleteGesture())this.gesture=null;director.pause();}
    private onShow():void{if(this.finished)return;this.hidden=false;director.resume();this.paused=true;const ready=text(this.node,'ResumeReady','READY',68,RED);this.scheduleOnce(()=>{ready.node.destroy();if(!this.hitStopActive)this.paused=false;},GAMEPLAY_CONFIG.readyMs/1000);}
}
