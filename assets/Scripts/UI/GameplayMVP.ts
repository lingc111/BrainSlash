import { _decorator, Color, Component, director, EventTouch, game, Game, Graphics, Label, Mask, Node, NodePool, ResolutionPolicy, resources, screen, Sprite, SpriteFrame, tween, Tween, UIOpacity, UITransform, Vec2, Vec3, view } from 'cc';
import { AppRuntime } from '../app/AppRuntime';
import { GAMEPLAY_CONFIG } from '../configs/GameConfig';
import { Brawl60Director, FriendChallengeDirector, type BrawlQuestionDirective } from '../domain/Brawl60Director';
import { dailyRecipeById } from '../domain/DailyChallenge';
import { GameSession } from '../domain/GameSession';
import { friendTargetPresentation } from '../domain/FriendChallenge';
import { countdownWarningSecond, failureFeedback, successFeedback } from '../domain/GameFeedback';
import { GestureResolver, GestureProgress, shouldKeepIncompleteGesture } from '../domain/GestureResolver';
import type { ActionConstraint, FailureKind, MistakeRecord, QuestionInstance, RunResult, TargetSpec } from '../domain/Models';
import { QuestionGenerator } from '../domain/QuestionGenerator';
import { createMistakeRecord, evaluateRules, maximumAnswerTextLength, questionFlightDurationSeconds, questionPreviewDurationSeconds, slashRuleLabel } from '../domain/Rules';
import { SeededRng } from '../domain/SeededRng';
import { TowerDirector } from '../domain/TowerDirector';
import { TowerChallengeRuntime, towerChallengeSummary, type TowerChallengeSnapshot, type TowerQuestionRequest } from '../domain/TowerChallenge';
import { allowedBrawlRules, towerFloorConfig, towerFloorDisplayName } from '../domain/TowerMode';
import { GameplayTarget, GameplayTargetData, TargetContentType } from './GameplayTarget';
import { calculatePortraitTargetLayout, portraitTargetEntranceDelay, type PortraitTargetPosition } from './PortraitTargetLayout';
import {
    createPortraitTargetMotionPlans,
    evaluatePortraitTargetMotion,
    evaluatePortraitTargetRotation,
    resolveSoftTargetSeparation,
    type PortraitTargetMotionPlan,
} from './PortraitTargetMotion';
import { showResultOverlay, showTowerResultOverlay } from './ResultOverlay';
import { ACTIVE_TARGET_SKINS, ALL_TARGET_SKINS, targetShapeForSkin, targetSkinForAnswer, uniqueColorTargetSkins } from './TargetSkinSizing';
import { applyGameFont, applyGameFontToTree, setGameFontMetrics } from './GameFont';
import { towerOpeningTextPresentation } from './TargetTypography';

const { ccclass } = _decorator;
const INK = new Color(45,43,39,255), PAPER = new Color(255,250,236,255), RED = new Color(174,69,61,255), GREEN = new Color(109,152,106,255), BLUE = new Color(91,133,156,255), YELLOW = new Color(226,184,67,255);
const COLORS = [YELLOW,GREEN,BLUE,new Color(137,111,158,255),new Color(207,132,70,255)];
const SKINS = ACTIVE_TARGET_SKINS;
const DESIGN_WIDTH = 750, DESIGN_HEIGHT = 1624;
const FRAME_TOP_INSET = 292, FRAME_BOTTOM_INSET = 12, TARGET_VISUAL_RADIUS = 132;
const PROMPT_PAPER_WIDTH = 400, PROMPT_PAPER_HEIGHT = 246;
const PROMPT_PAPER_BOTTOM_GAP = 8, PROMPT_CONTENT_LIFT = 10, PROMPT_PROGRESS_LIFT = 16;
const TIMER_CARD_RIGHT_INSET = 86, TIMER_LABEL_RIGHT_INSET = 58;
type EffectKey = typeof ALL_TARGET_SKINS[number] | 'bomb';
interface TargetMotion extends PortraitTargetMotionPlan {
    node: Node;
    delay: number;
}
function ui(n:Node,w:number,h:number):UITransform { const t=n.getComponent(UITransform)??n.addComponent(UITransform); t.setContentSize(w,h); t.setAnchorPoint(.5,.5); return t; }
function node(name:string,parent:Node,w=0,h=0):Node { const n=new Node(name); parent.addChild(n); ui(n,w,h); return n; }
function text(parent:Node,name:string,value:string,size:number,color=INK):Label { const l=node(name,parent,Math.max(100,value.length*size*1.25),size*1.5).addComponent(Label); l.string=value;l.fontSize=size;l.lineHeight=size*1.2;l.color=color;l.horizontalAlign=Label.HorizontalAlign.CENTER;l.verticalAlign=Label.VerticalAlign.CENTER;l.enableWrapText=false;return applyGameFont(l); }
function gfx(parent:Node,name:string,w:number,h:number):Graphics { return node(name,parent,w,h).addComponent(Graphics); }
function image(parent:Node,name:string,w:number,h:number):Sprite { const s=node(name,parent,w,h).addComponent(Sprite);s.sizeMode=Sprite.SizeMode.CUSTOM;return s; }

@ccclass('GameplayMVP')
export class GameplayMVP extends Component {
    private session!:GameSession; private generator!:QuestionGenerator; private director!:Brawl60Director|FriendChallengeDirector|TowerDirector; private visual!:SeededRng;
    private question:QuestionInstance|null=null; private constraint:ActionConstraint|null=null; private gesture:GestureResolver|null=null;
    private targets!:Node; private effects!:Node; private floats!:Node; private trail!:Graphics;
    private score!:Label; private combo!:Label; private prompt!:Label; private rule!:Label; private ruleBadge:Node|null=null; private timer!:Label; private life!:Label;
    private friendTarget:Label|null=null; private friendTargetCard:Node|null=null;
    private dailyTarget:Label|null=null; private dailyTargetCard:Node|null=null; private dailyBest=0; private dailyTargetAnnounced=false;
    private towerProgress:Label|null=null; private towerProgressCard:Node|null=null;
    private towerChallenge:TowerChallengeRuntime|null=null; private towerRequest:TowerQuestionRequest|null=null; private towerSnapshot:TowerChallengeSnapshot|null=null;
    private handDrawnChrome:Node|null=null; private handDrawnFrame:Graphics|null=null;
    private readonly lifeHearts:Sprite[]=[]; private renderedLife=-1;
    private points:Vec2[]=[]; private pendingTouchPoint:Vec2|null=null; private lastQueuedTouchPoint:Vec2|null=null; private touchActive=false;
    private trailAge=1; private trailVisible=false; private readonly trailOuterColor=new Color(148,187,199,95); private readonly trailInnerColor=new Color(255,253,241,235);
    private finished=false; private reverseFrame:Node|null=null;
    private paused=false; private hidden=false; private hitStopActive=false; private targetRevealPending=false; private revealToken=0; private lastCountdownSecond=-1;
    private currentDirective:BrawlQuestionDirective|null=null;
    private readyDurationSeconds=GAMEPLAY_CONFIG.readyMs/1000;
    private readonly mistakes:MistakeRecord[]=[];
    private currentSkins:(typeof SKINS[number])[]=[]; private currentMotionPhases:number[]=[];
    private readonly handleResize=():void=>this.applyVisibleLayout();
    private readonly effectByNode=new Map<Node,EffectKey>(); private readonly frames=new Map<EffectKey,SpriteFrame>(); private readonly pool=new NodePool();
    private readonly loadedTargetArtwork=new Set<EffectKey>();
    private wrongAnswerFrame:SpriteFrame|null=null; private masterSlashFrame:SpriteFrame|null=null; private masterHitFrame:SpriteFrame|null=null;
    private readonly motions:TargetMotion[]=[];
    protected onLoad():void {
        view.setDesignResolutionSize(DESIGN_WIDTH,DESIGN_HEIGHT,ResolutionPolicy.SHOW_ALL);
        const editorPreview=this.node.getChildByName('TargetContainer')?.getChildByName('EditorPreviewTargets');if(editorPreview){editorPreview.active=false;editorPreview.destroy();}
        AppRuntime.initialize();if(!AppRuntime.consumeGameplayLaunch()){AppRuntime.home();return;}AppRuntime.consumePendingFriendChallenge();const saved=AppRuntime.save.snapshot();this.session=new GameSession(AppRuntime.entry,GAMEPLAY_CONFIG);const daily=saved.daily;this.dailyBest=AppRuntime.entry.mode==='daily'&&daily?.dateKey===AppRuntime.entry.dailyDate&&daily.recipeId===AppRuntime.entry.recipeId?daily.bestScore:0;
        this.generator=new QuestionGenerator(new SeededRng(`${AppRuntime.entry.seed}:gameplay`),GAMEPLAY_CONFIG,{recentFactIds:saved.recentQuestionIds,recentSemanticSignatures:saved.recentQuestionSignatures,onQuestionAccepted:(ids,signature)=>AppRuntime.save.rememberQuestion(ids,signature)});this.director=AppRuntime.entry.mode==='tower'?new TowerDirector(new SeededRng(`${AppRuntime.entry.seed}:director`),AppRuntime.entry.towerFloor??saved.tower.currentFloor):AppRuntime.entry.mode==='friendChallenge'&&AppRuntime.entry.challengeConfig?new FriendChallengeDirector(new SeededRng(`${AppRuntime.entry.seed}:director`),AppRuntime.entry.challengeConfig):new Brawl60Director(new SeededRng(`${AppRuntime.entry.seed}:director`),AppRuntime.entry.recipeId,AppRuntime.entry.mode==='brawl60'?allowedBrawlRules(saved.tower,saved.tutorials):undefined,AppRuntime.entry.mode!=='brawl60'||saved.tower.highestClearedFloor>=15);this.visual=new SeededRng(`${AppRuntime.entry.seed}:visual`);
        if(AppRuntime.entry.mode==='tower'){const floor=AppRuntime.entry.towerFloor??saved.tower.currentFloor;this.towerChallenge=new TowerChallengeRuntime(towerFloorConfig(floor).challenge,new SeededRng(`${AppRuntime.entry.seed}:challenge`));}
        this.bindStaticView();this.prepareTowerReadyCard();applyGameFontToTree(this.node);screen.on('window-resize',this.handleResize,this);game.on(Game.EVENT_HIDE,this.onHide,this);game.on(Game.EVENT_SHOW,this.onShow,this);this.scheduleOnce(this.handleResize,0);
        this.scheduleOnce(()=>{this.node.getChildByName('Ready')?.destroy();AppRuntime.audio.play('ui');this.session.start();this.spawn();},this.readyDurationSeconds);
    }
    protected onDestroy():void { this.revealToken++;screen.off('window-resize',this.handleResize,this);game.off(Game.EVENT_HIDE,this.onHide,this);game.off(Game.EVENT_SHOW,this.onShow,this);this.node.off(Node.EventType.TOUCH_START,this.startTouch,this);this.node.off(Node.EventType.TOUCH_MOVE,this.moveTouch,this);this.node.off(Node.EventType.TOUCH_END,this.endTouch,this);this.node.off(Node.EventType.TOUCH_CANCEL,this.endTouch,this);this.releaseQuestionArtwork(new Set<EffectKey>()); }
    protected update(dt:number):void {
        if(this.finished||this.paused)return;
        const moved=this.processPendingTouchMoves();
        this.session.tick(dt*1000);if(this.towerChallenge){this.towerSnapshot=this.towerChallenge.tick(this.session.state);if(this.towerSnapshot.status!=='active')this.session.finish();}
        if(this.session.state.phase==='playing'&&this.question&&!this.targetRevealPending&&!this.session.isQuestionResolved()&&this.updateTargetMotions())this.fail('miss');
        if(this.session.state.phase==='finished')this.finish(); this.refresh(); this.trailAge=moved?0:this.trailAge+dt;if(this.trailAge<.14)this.drawTrail(1-this.trailAge/.14);else if(this.trailVisible){this.trail.clear();this.trailVisible=false;}
    }
    public rebuildStaticView():void {
        for(const c of [...this.node.children]){c.removeFromParent();c.destroy();}
        ui(this.node,DESIGN_WIDTH,DESIGN_HEIGHT);
        const bg=image(this.node,'Background',DESIGN_WIDTH,DESIGN_HEIGHT);resources.load('textures/common/background_paper/spriteFrame',SpriteFrame,(e,f)=>{if(!e&&bg.isValid)bg.spriteFrame=f;});
        node('TargetContainer',this.node,DESIGN_WIDTH,DESIGN_HEIGHT);gfx(this.node,'SlashTrail',DESIGN_WIDTH,DESIGN_HEIGHT);node('HitEffects',this.node,DESIGN_WIDTH,DESIGN_HEIGHT);node('FloatingText',this.node,DESIGN_WIDTH,DESIGN_HEIGHT);
        const y=DESIGN_HEIGHT/2-150;const score=text(this.node,'Score','0',30);score.node.setPosition(-DESIGN_WIDTH/2+85,y);const combo=text(this.node,'Combo','0 COMBO',27,RED);combo.node.setPosition(-DESIGN_WIDTH/2+110,y-48);
        const promptY=y+PROMPT_CONTENT_LIFT;const prompt=text(this.node,'Prompt','准备斩击',44);prompt.node.setPosition(0,promptY);const badge=image(this.node,'RuleBadge',230,45);badge.node.setPosition(0,promptY-55);badge.color=BLUE;resources.load('textures/home/paper/daily_paper/spriteFrame',SpriteFrame,(e,f)=>{if(!e&&badge.isValid)badge.spriteFrame=f;});const rule=text(this.node,'Rule','单选',25,PAPER);rule.node.setPosition(0,promptY-55);rule.isBold=true;ui(rule.node,220,40);rule.overflow=Label.Overflow.SHRINK;
        const timer=text(this.node,'Timer','∞',38);timer.node.setPosition(DESIGN_WIDTH/2-TIMER_LABEL_RIGHT_INSET,y);const life=text(this.node,'Life','♥ ♥ ♥',26,RED);life.node.setPosition(DESIGN_WIDTH/2-TIMER_LABEL_RIGHT_INSET,y-48);text(this.node,'Ready','READY',68,RED);
        this.buildHandDrawnChrome();this.layoutHandDrawnChrome(DESIGN_WIDTH,DESIGN_HEIGHT);
    }
    private bindStaticView():void {
        const required=(name:string):Node=>{const found=this.node.getChildByName(name);if(!found)throw new Error(`[GameplayMVP] Gameplay.scene 缺少静态节点 ${name}，请在编辑器中重建并保存静态布局。`);return found;};
        const requiredLabel=(name:string):Label=>{const found=required(name).getComponent(Label);if(!found)throw new Error(`[GameplayMVP] 静态节点 ${name} 缺少 Label 组件。`);return found;};
        const background=required('Background').getComponent(Sprite);if(!background)throw new Error('[GameplayMVP] 静态节点 Background 缺少 Sprite 组件。');
        resources.load('textures/common/background_paper/spriteFrame',SpriteFrame,(e,f)=>{if(!e&&background.isValid)background.spriteFrame=f;});
        this.targets=required('TargetContainer');const trailNode=required('SlashTrail');const trail=trailNode.getComponent(Graphics);if(!trail)throw new Error('[GameplayMVP] 静态节点 SlashTrail 缺少 Graphics 组件。');this.trail=trail;
        this.effects=required('HitEffects');this.floats=required('FloatingText');this.score=requiredLabel('Score');this.combo=requiredLabel('Combo');this.prompt=requiredLabel('Prompt');this.rule=requiredLabel('Rule');this.prepareRuleBadge();this.timer=requiredLabel('Timer');this.life=requiredLabel('Life');const endless=this.session.entry.mode==='brawl60';setGameFontMetrics(this.timer,endless?72:38,endless?82:46);ui(this.timer.node,128,100);
        this.buildHandDrawnChrome();
        this.applyVisibleLayout();
        this.node.on(Node.EventType.TOUCH_START,this.startTouch,this);this.node.on(Node.EventType.TOUCH_MOVE,this.moveTouch,this);this.node.on(Node.EventType.TOUCH_END,this.endTouch,this);this.node.on(Node.EventType.TOUCH_CANCEL,this.endTouch,this);
        resources.load('textures/gameplay/ui/answer_wrong/spriteFrame',SpriteFrame,(e,f)=>{if(!e&&f?.isValid)this.wrongAnswerFrame=f;});
        resources.load('textures/gameplay/ui/Master/spriteFrame',SpriteFrame,(e,f)=>{if(!e&&f?.isValid)this.masterSlashFrame=f;});
        resources.load('textures/gameplay/ui/Hit/spriteFrame',SpriteFrame,(e,f)=>{if(!e&&f?.isValid)this.masterHitFrame=f;});
    }
    private applyVisibleLayout():void{const background=this.node.getChildByName('Background')?.getComponent(Sprite);if(!background||!this.score)return;const v=view.getVisibleSize();ui(this.node,v.width,v.height);for(const layer of [background.node,this.targets,this.trail.node,this.effects,this.floats])ui(layer,v.width,v.height);this.layoutStaticHud(v.width,v.height);this.layoutHandDrawnChrome(v.width,v.height);this.layoutTowerReadyCard(v.width);}
    private layoutStaticHud(width:number,height:number):void{const y=height/2-150,promptY=y+PROMPT_CONTENT_LIFT;this.score.node.active=false;this.combo.node.active=true;setGameFontMetrics(this.combo,44,53);this.combo.color=INK;this.combo.node.setPosition(-width/2+96,y+3);this.prompt.node.setPosition(0,promptY);this.fitPromptTypography(this.prompt.string);this.ruleBadge?.setPosition(0,promptY-55);this.rule.node.setPosition(0,promptY-55);this.timer.node.setPosition(width/2-TIMER_LABEL_RIGHT_INSET,y+4);this.life.node.active=false;}
    private fitPromptTypography(value:string):void{const length=[...value.trim()].length,size=length<=4?44:length<=6?38:length<=9?32:26;setGameFontMetrics(this.prompt,size,Math.ceil(size*1.16));this.prompt.enableWrapText=false;this.prompt.overflow=Label.Overflow.SHRINK;ui(this.prompt.node,258,64);}
    private prepareRuleBadge():void{
        let badge=this.node.getChildByName('RuleBadge')??this.rule.node.getChildByName('Badge');
        if(badge?.parent===this.rule.node){const ruleIndex=this.rule.node.getSiblingIndex();badge.removeFromParent();badge.name='RuleBadge';this.node.addChild(badge);badge.setSiblingIndex(ruleIndex);}
        this.ruleBadge=badge;this.rule.isBold=true;ui(this.rule.node,220,40);this.rule.overflow=Label.Overflow.SHRINK;
    }
    private buildHandDrawnChrome():void{
        for(const name of ['HandDrawnChrome','HandDrawnFrameLayer']){const old=this.node.getChildByName(name);if(old){old.removeFromParent();old.destroy();}}
        this.lifeHearts.length=0;this.renderedLife=-1;
        const frameLayer=node('HandDrawnFrameLayer',this.node,DESIGN_WIDTH,DESIGN_HEIGHT);
        const targetIndex=this.node.getChildByName('TargetContainer')?.getSiblingIndex()??1;frameLayer.setSiblingIndex(targetIndex);
        this.handDrawnFrame=gfx(frameLayer,'GameplayHandDrawnFrame',DESIGN_WIDTH-38,DESIGN_HEIGHT-330);
        const chrome=node('HandDrawnChrome',this.node,DESIGN_WIDTH,DESIGN_HEIGHT);this.handDrawnChrome=chrome;
        const scoreIndex=this.node.getChildByName('Score')?.getSiblingIndex()??this.node.children.length;chrome.setSiblingIndex(scoreIndex);
        this.makeComboCard(chrome);
        this.makeArtworkCard(chrome,'PromptPaperCard','gameplay_mid_title',PROMPT_PAPER_WIDTH,PROMPT_PAPER_HEIGHT);
        const timerCard=this.makeArtworkCard(chrome,'TimerPaperCard','gameplay_time',176,176,1.1);this.makeLifeHearts(timerCard,this.session?.state.maxLife??3);
        const friendCard=node('FriendChallengeTarget',chrome,286,32),friend=text(friendCard,'Label','',18,INK);ui(friend.node,278,30);friend.overflow=Label.Overflow.SHRINK;friendCard.active=this.session?.entry.mode==='friendChallenge'&&this.session.entry.challengeRole==='responder';this.friendTarget=friend;this.friendTargetCard=friendCard;
        const towerCard=node('TowerFloorProgress',chrome,420,58),tower=text(towerCard,'Label','',18,INK);ui(tower.node,410,56);tower.overflow=Label.Overflow.SHRINK;tower.enableWrapText=true;tower.lineHeight=21;towerCard.active=this.session?.entry.mode==='tower';this.towerProgress=tower;this.towerProgressCard=towerCard;
        const dailyCard=node('DailyChallengeProgress',chrome,286,32),dailyLabel=text(dailyCard,'Label','',18,INK);ui(dailyLabel.node,278,30);dailyLabel.overflow=Label.Overflow.SHRINK;dailyCard.active=this.session?.entry.mode==='daily';this.dailyTarget=dailyLabel;this.dailyTargetCard=dailyCard;
    }
    private makeComboCard(parent:Node):Node{
        const card=node('ComboPaperCard',parent,164,212);card.angle=-1.2;const artwork=image(card,'ComboArtwork',164,212);
        resources.load('textures/gameplay/ui/combo/spriteFrame',SpriteFrame,(e,f)=>{if(!e&&artwork.isValid)artwork.spriteFrame=f;});return card;
    }
    private makeArtworkCard(parent:Node,name:string,assetName:string,width:number,height:number,angle=0):Node{
        const card=node(name,parent,width,height);card.angle=angle;const artwork=image(card,'Artwork',width,height);
        resources.load(`textures/gameplay/ui/${assetName}/spriteFrame`,SpriteFrame,(e,f)=>{if(!e&&artwork.isValid)artwork.spriteFrame=f;});return card;
    }
    private makeLifeHearts(parent:Node,maxLife:number):void{
        const gap=maxLife>3?29:42,size=maxLife>3?32:42;for(let i=0;i<maxLife;i++){const cell=node(`LifeHeart_${i}`,parent,size,size);cell.setPosition((i-(maxLife-1)/2)*gap,-42);const mask=cell.addComponent(Mask);mask.type=Mask.Type.GRAPHICS_RECT;const heart=image(cell,'Artwork',132,42);heart.node.setPosition(0,0);this.lifeHearts.push(heart);}
        resources.load('textures/gameplay/ui/life_heart/spriteFrame',SpriteFrame,(e,f)=>{if(e)return;for(const heart of this.lifeHearts)if(heart.isValid)heart.spriteFrame=f;});
    }
    private layoutHandDrawnChrome(width:number,height:number):void{
        const chrome=this.handDrawnChrome;if(!chrome?.isValid)return;ui(chrome,width,height);const hudY=height/2-168,frameTop=height/2-FRAME_TOP_INSET;
        chrome.getChildByName('ComboPaperCard')?.setPosition(-width/2+96,hudY);
        // Keep the paper completely above the answer frame; its lower edge must never
        // cover the playable area.
        chrome.getChildByName('PromptPaperCard')?.setPosition(0,frameTop+PROMPT_PAPER_BOTTOM_GAP+PROMPT_PAPER_HEIGHT/2);
        chrome.getChildByName('TimerPaperCard')?.setPosition(width/2-TIMER_CARD_RIGHT_INSET,hudY);
        chrome.getChildByName('FriendChallengeTarget')?.setPosition(0,hudY-94+PROMPT_PROGRESS_LIFT);
        chrome.getChildByName('TowerFloorProgress')?.setPosition(0,hudY-94+PROMPT_PROGRESS_LIFT);
        chrome.getChildByName('DailyChallengeProgress')?.setPosition(0,hudY-94+PROMPT_PROGRESS_LIFT);
        const frame=this.handDrawnFrame;if(!frame?.isValid)return;const frameLayer=frame.node.parent;if(frameLayer)ui(frameLayer,width,height);
        const frameBottom=-height/2+FRAME_BOTTOM_INSET,frameWidth=width-38,frameHeight=frameTop-frameBottom;ui(frame.node,frameWidth,frameHeight);frame.node.setPosition(0,(frameTop+frameBottom)/2);this.drawHandDrawnFrame(frame,frameWidth,frameHeight);
    }
    private drawHandDrawnFrame(g:Graphics,width:number,height:number):void{
        const w=width/2,h=height/2;g.clear();g.strokeColor=new Color(196,57,43,235);g.lineWidth=4;g.lineCap=Graphics.LineCap.ROUND;g.lineJoin=Graphics.LineJoin.ROUND;
        g.moveTo(-w+7,-h+5);g.bezierCurveTo(-w+1,-h*.25,-w+4,h*.45,-w+8,h-7);g.bezierCurveTo(-w*.35,h+2,w*.38,h-2,w-8,h-5);g.bezierCurveTo(w+1,h*.3,w-3,-h*.4,w-6,-h+7);g.stroke();
        g.strokeColor=new Color(166,48,37,155);g.lineWidth=2;g.moveTo(-w+12,-h+10);g.bezierCurveTo(-w+8,-h*.18,-w+10,h*.48,-w+13,h-12);g.bezierCurveTo(-w*.28,h-5,w*.42,h-7,w-13,h-10);g.bezierCurveTo(w-7,h*.25,w-9,-h*.48,w-11,-h+12);g.stroke();
    }
    private spawn():void {
        if(this.session.state.phase!=='playing')return;
        if(this.towerChallenge){this.towerRequest=this.towerChallenge.nextRequest();this.currentDirective=(this.director as TowerDirector).next(this.session.state.elapsedMs,this.towerRequest);}else this.currentDirective=this.director.next(this.session.state.elapsedMs);this.question=this.generator.next(this.currentDirective);this.presentCurrentQuestion();
    }
    private presentCurrentQuestion():void{
        if(!this.question||!this.currentDirective||this.session.state.phase!=='playing')return;
        for(const c of [...this.targets.children]){c.removeFromParent();c.destroy();}
        this.effectByNode.clear();this.motions.length=0;this.gesture=null;this.constraint=null;this.pendingTouchPoint=null;this.lastQueuedTouchPoint=null;
        this.currentSkins=uniqueColorTargetSkins(this.visual.shuffle(SKINS));this.currentMotionPhases=this.question.targets.map(()=>this.visual.next()*Math.PI*2);this.prepareQuestionArtwork();
        this.prompt.string=this.question.prompt.text;this.fitPromptTypography(this.prompt.string);this.rule.string=slashRuleLabel(this.question.activeRules);this.showReverse(this.question.activeRules.includes('reverse'));
        this.targetRevealPending=true;const token=++this.revealToken;this.refresh();
        this.scheduleOnce(()=>this.revealCurrentTargets(token),questionPreviewDurationSeconds(this.question.activeRules));
    }
    private revealCurrentTargets(token:number):void{
        if(token!==this.revealToken||!this.question||!this.currentDirective||this.session.state.phase!=='playing')return;
        this.targetRevealPending=false;this.constraint=evaluateRules(this.question);this.session.beginQuestion();
        const answerCount=this.question.targets.filter((target)=>!target.isBomb).length;
        const maximumAnswerLength=maximumAnswerTextLength(this.question.targets);
        const positions=this.layout(this.question.targets.length),v=view.getVisibleSize(),duration=questionFlightDurationSeconds((this.question.timeLimitMs??3000)/1000,this.question.activeRules,answerCount,maximumAnswerLength),plans=createPortraitTargetMotionPlans(positions,this.currentMotionPhases,{visibleWidth:v.width,visibleHeight:v.height,duration,speed:this.currentDirective.speed,topInset:FRAME_TOP_INSET,visualRadius:TARGET_VISUAL_RADIUS});
        this.question.targets.forEach((s,i)=>this.createTarget(s,positions[i],plans[i],this.currentSkins[i%this.currentSkins.length],i));this.refresh();
    }
    private createTarget(spec:TargetSpec,pos:PortraitTargetPosition,motion:PortraitTargetMotionPlan,skin:typeof SKINS[number],i:number):void {
        const n=node(spec.isBomb?'BombTarget':`Target_${spec.id}`,this.targets,168,168);const row=Math.max(0,pos.row),delay=portraitTargetEntranceDelay({x:pos.x,y:pos.y,row});
        n.setPosition(motion.startX,motion.startY);n.setScale(.68,.68,1);n.angle=motion.entranceAngle;
        const wordColors:Record<string,Color>={红:RED,蓝:BLUE,绿:GREEN,黄:YELLOW};
        const artwork=targetSkinForAnswer(spec.colorName,skin);
        const data:GameplayTargetData={id:spec.id,contentType:TargetContentType.TEXT,text:spec.text,value:spec.value,shape:targetShapeForSkin(artwork),isBomb:spec.isBomb,color:COLORS[i%COLORS.length],contentColor:spec.colorName?wordColors[spec.colorName]:undefined};const target=n.addComponent(GameplayTarget);target.configure(data);
        const key:EffectKey=spec.isBomb?'bomb':artwork;this.effectByNode.set(n,key);resources.load(`textures/gameplay/targets/${key}/spriteFrame`,SpriteFrame,(e,f)=>{if(!e&&n.isValid&&n.active)target.applySkin(f);});
        this.motions.push({node:n,...motion,delay});tween(n).delay(delay).to(.18,{scale:new Vec3(1.12,1.12,1)},{easing:'backOut'}).to(.16,{scale:Vec3.ONE},{easing:'quadOut'}).start();
    }
    private prepareQuestionArtwork():void{
        if(!this.question)return;const wanted=new Set<EffectKey>();
        this.question.targets.forEach((spec,index)=>wanted.add(spec.isBomb?'bomb':targetSkinForAnswer(spec.colorName,this.currentSkins[index%this.currentSkins.length])));
        this.releaseQuestionArtwork(wanted);
        for(const key of wanted){this.loadedTargetArtwork.add(key);if(this.frames.has(key))continue;resources.load(`textures/gameplay/effects/slash/${key}_slash/spriteFrame`,SpriteFrame,(e,f)=>{if(!e&&f?.isValid&&this.loadedTargetArtwork.has(key))this.frames.set(key,f);});}
    }
    private releaseQuestionArtwork(wanted:Set<EffectKey>):void{
        this.pool.clear();
        for(const key of [...this.loadedTargetArtwork]){if(wanted.has(key))continue;this.loadedTargetArtwork.delete(key);this.frames.delete(key);resources.release(`textures/gameplay/targets/${key}/spriteFrame`,SpriteFrame);resources.release(`textures/gameplay/effects/slash/${key}_slash/spriteFrame`,SpriteFrame);}
    }
    private layout(count:number):PortraitTargetPosition[]{const v=view.getVisibleSize();return calculatePortraitTargetLayout(count,v.width,v.height);}
    private startTouch(e:EventTouch):void{if(this.finished||this.paused)return;if(this.touchActive){const moved=this.processPendingTouchMoves();if(moved)this.drawTrail(1);this.finishTouchGesture();}const p=this.point(e);this.touchActive=true;this.points=[p];this.pendingTouchPoint=null;this.lastQueuedTouchPoint=p;if(!this.gesture&&this.canResolveTouch())this.gesture=new GestureResolver(this.constraint!);this.trailAge=0;}
    private moveTouch(e:EventTouch):void{if(!this.touchActive||this.finished||this.paused)return;const p=this.point(e),a=this.lastQueuedTouchPoint??this.points[this.points.length-1];if(!a||Vec2.distance(a,p)<4)return;this.pendingTouchPoint=p;this.lastQueuedTouchPoint=p;}
    private endTouch():void{if(!this.touchActive)return;const moved=this.processPendingTouchMoves();if(moved)this.drawTrail(1);this.finishTouchGesture();}
    private processPendingTouchMoves():boolean{const p=this.pendingTouchPoint,a=this.points[this.points.length-1];this.pendingTouchPoint=null;if(!p||!a)return false;this.points.push(p);if(this.points.length>18)this.points.shift();if(this.canResolveTouch()){if(!this.gesture)this.gesture=new GestureResolver(this.constraint!);this.sweep(a,p);}this.lastQueuedTouchPoint=p;return true;}
    private finishTouchGesture():void{if(this.gesture&&this.gesture.hasHits()&&this.session.state.phase==='playing'){const p=this.gesture.end(this.keepsIncompleteGesture());this.progress(p,null);if(p.status!=='continue')this.gesture=null;}else if(!this.keepsIncompleteGesture())this.gesture=null;this.touchActive=false;this.lastQueuedTouchPoint=null;this.trailAge=0;}
    private canResolveTouch():boolean{return !!this.constraint&&!this.targetRevealPending&&this.session.state.phase==='playing'&&!this.session.isQuestionResolved();}
    private point(e:EventTouch):Vec2{const p=e.getUILocation(),v=view.getVisibleSize();return new Vec2(p.x-v.width/2,p.y-v.height/2);}
    private sweep(a:Vec2,b:Vec2):void{if(!this.gesture)return;for(const n of this.targets.children){const t=n.getComponent(GameplayTarget);if(!t||t.hit||!t.segmentHit(a,b))continue;t.hit=true;const p=this.gesture.hit(t.data.id);this.slash(t,a,b);this.progress(p,t);if(p.status!=='continue'){this.gesture=null;break;}}}
    private progress(p:GestureProgress,t:GameplayTarget|null):void{if(p.status==='success')this.success(t,p.masterSlash);else if(p.status==='failure')this.fail(p.kind,t);}
    private keepsIncompleteGesture():boolean{return !!this.constraint&&shouldKeepIncompleteGesture(this.constraint);}
    private success(t:GameplayTarget|null,masterSlash=false):void{if(!this.question)return;const r=this.session.resolveSuccess(this.question,masterSlash);if(!r)return;const pos=t?.node.position??Vec3.ZERO,master=r.masterHit||r.masterSlash,feedback=successFeedback(r.kind,this.session.state.combo),vibration=AppRuntime.save.snapshot().settings.vibration;AppRuntime.audio.play(feedback.sound,{variant:this.session.state.combo});AppRuntime.platform.vibrate(vibration,feedback.haptic);if(feedback.comboMilestone&&!master)AppRuntime.audio.play('combo',{variant:this.session.state.combo});this.animateCombo(this.session.state.combo,feedback.comboMilestone);if(r.masterSlash)this.playMasterSlashEffect(pos);else if(r.masterHit)this.playMasterHitEffect(pos);else this.hitSparks(pos,GREEN,false);if(feedback.hitStopMs)this.applyHitStop(feedback.hitStopMs);this.float(pos,`+${r.scoreDelta}${r.masterSlash?' MASTER SLASH':''}`,master?YELLOW:GREEN);if(r.lifeDelta>0){AppRuntime.audio.play('combo',{variant:5});AppRuntime.platform.vibrate(vibration,'medium');this.float(new Vec3(pos.x,pos.y+70,pos.z),'♥ +1 生命',RED);}if(this.towerChallenge&&this.towerRequest){this.towerSnapshot=this.towerChallenge.resolve(this.towerRequest.requestId,true,this.session.state);this.towerRequest=null;if(this.towerSnapshot.status!=='active'){this.session.finish();return;}}this.scheduleOnce(()=>{this.session.continueAfterFeedback();this.spawn();},master?.34:.28);}
    private fail(kind:FailureKind,t:GameplayTarget|null=null):void{const pos=t?.node.position??Vec3.ZERO,vibration=AppRuntime.save.snapshot().settings.vibration;const brokenCombo=this.session.state.combo;if(!this.session.resolveFailure(kind))return;if(this.question&&this.constraint)this.mistakes.push(createMistakeRecord(this.question,this.constraint,kind,t?.data.id));const feedback=failureFeedback(kind,brokenCombo);AppRuntime.audio.play(feedback.sound);AppRuntime.platform.vibrate(vibration,feedback.haptic);if(kind==='wrong'||kind==='miss'||kind==='bomb')this.showWrongAnswer(pos);else{this.error(pos);if(feedback.label)this.float(pos,feedback.label,RED);}if(feedback.showComboBreak)this.breakCombo(brokenCombo);if(this.towerChallenge&&this.towerRequest){this.towerSnapshot=this.towerChallenge.resolve(this.towerRequest.requestId,false,this.session.state,kind);this.towerRequest=null;if(this.towerSnapshot.status!=='active')this.session.finish();}if(this.session.state.phase!=='finished')this.scheduleOnce(()=>{this.session.continueAfterFeedback();this.spawn();},.3);}
    private finish():void{if(this.finished)return;this.finished=true;AppRuntime.audio.play('finish');const s=this.session.state,total=s.correctCount+s.errorCount;const run:RunResult={entry:this.session.entry,score:s.score,maxCombo:s.maxCombo,correctCount:s.correctCount,errorCount:s.errorCount,accuracy:total?s.correctCount/total:0,bestReactionMs:s.bestReactionMs,remainingMs:s.remainingMs,elapsedMs:s.elapsedMs,masterSlashCount:s.masterSlashCount,mistakes:[...this.mistakes]};if(this.session.entry.mode==='tower'){const snapshot=this.towerSnapshot??this.towerChallenge?.snapshot(s);const result=AppRuntime.finishTower(run,s.life,snapshot);showTowerResultOverlay(this.node,result,{next:()=>AppRuntime.nextTowerFloor(),retry:()=>AppRuntime.retryTowerFloor(),home:()=>AppRuntime.home()});return;}const result=AppRuntime.finish(run);showResultOverlay(this.node,result,{replay:()=>AppRuntime.replay(),share:()=>AppRuntime.share(),home:()=>AppRuntime.home()});}
    private refresh():void{if(!this.score)return;const s=this.session.state,endless=this.session.entry.mode==='brawl60',seconds=Math.ceil(s.remainingMs/1000);this.score.string=String(s.score);this.combo.string=String(s.combo);this.timer.string=endless?'∞':`${seconds}s`;this.updateLifeHearts(s.life);this.updateFriendTarget(s.score);this.updateDailyTarget(s.score);this.updateTowerProgress(s.correctCount);if(!endless)this.updateCountdownFeedback(s.remainingMs);}
    private updateTowerProgress(_correct:number):void{const label=this.towerProgress,card=this.towerProgressCard;if(!label||!card)return;if(this.session.entry.mode!=='tower'){card.active=false;return;}const floor=this.session.entry.towerFloor??1,snapshot=this.towerSnapshot??this.towerChallenge?.snapshot(this.session.state),items=snapshot?.objectiveProgress??[];card.active=true;const detail=items.slice(0,2).map((item)=>`${item.label} ${Math.min(item.current,item.target)}/${item.target}`).join(' · ');label.string=`${towerFloorDisplayName(floor)}\n${detail}`;}
    private prepareTowerReadyCard():void{this.layoutTowerReadyCard(view.getVisibleSize().width);}
    private layoutTowerReadyCard(visibleWidth:number):void{if(this.session.entry.mode!=='tower')return;const floor=this.session.entry.towerFloor??1,config=towerFloorConfig(floor),ready=this.node.getChildByName('Ready')?.getComponent(Label);if(!ready)return;const presentation=towerOpeningTextPresentation(towerFloorDisplayName(floor),config.challenge.openingHint??towerChallengeSummary(config.challenge),visibleWidth);ready.string=presentation.displayText;ready.enableWrapText=true;ready.overflow=Label.Overflow.SHRINK;setGameFontMetrics(ready,presentation.fontSize,presentation.lineHeight);ui(ready.node,presentation.width,presentation.height);this.readyDurationSeconds=presentation.displaySeconds;}
    private updateFriendTarget(score:number):void{const label=this.friendTarget,card=this.friendTargetCard,target=this.session.entry.targetScore;if(!label||!card)return;if(this.session.entry.mode!=='friendChallenge'||target===undefined){card.active=false;return;}const state=friendTargetPresentation(score,target);card.active=true;label.string=state.text;label.color=state.tone==='ahead'?GREEN:state.tone==='tied'?BLUE:INK;}
    private updateDailyTarget(score:number):void{const label=this.dailyTarget,card=this.dailyTargetCard,target=this.session.entry.dailyTargetScore;if(!label||!card)return;if(this.session.entry.mode!=='daily'||target===undefined){card.active=false;return;}const recipe=dailyRecipeById(this.session.entry.recipeId),achieved=score>=target;card.active=true;label.string=this.dailyBest>0?`今日 ${Math.min(score,target)}/${target} · 最佳 ${this.dailyBest}`:`${recipe?.title??'今日挑战'} · ${Math.min(score,target)}/${target}`;label.color=achieved?GREEN:INK;if(!achieved||this.dailyTargetAnnounced)return;this.dailyTargetAnnounced=true;AppRuntime.audio.play('combo',{variant:10});AppRuntime.platform.vibrate(AppRuntime.save.snapshot().settings.vibration,'medium');Tween.stopAllByTarget(card);card.setScale(Vec3.ONE);tween(card).to(.1,{scale:new Vec3(1.06,1.06,1)},{easing:'backOut'}).to(.18,{scale:Vec3.ONE},{easing:'quadOut'}).start();}
    private updateLifeHearts(life:number):void{
        if(life===this.renderedLife)return;const previous=this.renderedLife,lit=new Color(255,255,255,255),off=new Color(92,88,82,125);
        this.lifeHearts.forEach((heart,i)=>{Tween.stopAllByTarget(heart.node);heart.node.setScale(Vec3.ONE);const alive=i<life;if(previous>=0&&!alive&&i<previous){heart.color=lit;tween(heart.node).to(.09,{scale:new Vec3(.78,.78,1)}).call(()=>{if(heart.isValid)heart.color=off;}).to(.14,{scale:Vec3.ONE},{easing:'backOut'}).start();}else if(previous>=0&&alive&&i>=previous){heart.color=lit;heart.node.setScale(.55,.55,1);tween(heart.node).to(.24,{scale:new Vec3(1.2,1.2,1)},{easing:'backOut'}).to(.14,{scale:Vec3.ONE},{easing:'quadOut'}).start();}else heart.color=alive?lit:off;});
        this.renderedLife=life;
    }
    private drawTrail(alpha:number):void{this.trail.clear();if(this.points.length<2||alpha<=0){this.trailVisible=false;return;}this.trailOuterColor.a=Math.round(95*alpha);this.trailInnerColor.a=Math.round(235*alpha);this.trail.lineCap=Graphics.LineCap.ROUND;this.trail.lineJoin=Graphics.LineJoin.ROUND;this.drawTrailStroke(16,this.trailOuterColor);this.drawTrailStroke(8,this.trailInnerColor);this.trailVisible=true;}
    private drawTrailStroke(width:number,color:Color):void{this.trail.lineWidth=width;this.trail.strokeColor=color;this.trail.moveTo(this.points[0].x,this.points[0].y);for(let i=1;i<this.points.length;i++)this.trail.lineTo(this.points[i].x,this.points[i].y);this.trail.stroke();}
    private showReverse(active:boolean):void{this.reverseFrame?.destroy();this.reverseFrame=null;if(!active)return;const v=view.getVisibleSize(),g=gfx(this.node,'ReverseFrame',v.width-24,v.height-28);g.strokeColor=new Color(174,69,61,170);g.lineWidth=8;g.rect(-v.width/2+12,-v.height/2+14,v.width-24,v.height-28);g.stroke();this.reverseFrame=g.node;}
    private showWrongAnswer(pos:Readonly<Vec3>):void{const frame=this.wrongAnswerFrame;if(!frame){this.error(pos);return;}const s=image(this.effects,'WrongAnswer',168,168);s.spriteFrame=frame;s.node.setPosition(pos);s.node.setScale(.72,.72,1);const o=s.node.addComponent(UIOpacity);tween(s.node).to(.14,{scale:new Vec3(1.04,1.04,1)},{easing:'backOut'}).to(.1,{scale:new Vec3(.98,.98,1)},{easing:'quadOut'}).start();tween(o).delay(.1).to(.18,{opacity:0}).call(()=>s.node.destroy()).start();}
    private error(pos:Readonly<Vec3>):void{const g=gfx(this.effects,'ErrorRing',190,190);g.node.setPosition(pos);g.strokeColor=RED;g.lineWidth=12;g.circle(0,0,80);g.moveTo(-52,-52);g.lineTo(52,52);g.moveTo(-52,52);g.lineTo(52,-52);g.stroke();const o=g.node.addComponent(UIOpacity);tween(g.node).to(.22,{scale:new Vec3(1.16,1.16,1)},{easing:'quadOut'}).start();tween(o).to(.24,{opacity:0}).call(()=>g.node.destroy()).start();}
    private float(pos:Readonly<Vec3>,value:string,color:Color):void{const l=text(this.floats,'Float',value,32,color);l.node.setPosition(pos.x,pos.y+44);const o=l.node.addComponent(UIOpacity);tween(l.node).to(.34,{position:new Vec3(pos.x,pos.y+105,0)},{easing:'quadOut'}).start();tween(o).delay(.12).to(.22,{opacity:0}).call(()=>l.node.destroy()).start();}
    private slash(t:GameplayTarget,a:Vec2,b:Vec2):void{AppRuntime.audio.play('slash');const key=this.effectByNode.get(t.node),frame=key?this.frames.get(key):undefined,pos=t.node.position.clone();t.node.active=false;if(!frame){this.float(pos,'✦',YELLOW);return;}const n=this.pool.size()?this.pool.get()!:node('SlashBurst',this.effects,310,310);if(!n.parent)this.effects.addChild(n);n.active=true;n.setPosition(pos);n.setScale(.76,.76,1);const d=b.clone().subtract(a);n.angle=Math.atan2(d.y,d.x)*180/Math.PI-45;const s=n.getComponent(Sprite)??n.addComponent(Sprite);s.sizeMode=Sprite.SizeMode.CUSTOM;s.spriteFrame=frame;const o=n.getComponent(UIOpacity)??n.addComponent(UIOpacity);o.opacity=255;Tween.stopAllByTarget(n);Tween.stopAllByTarget(o);tween(n).to(.06,{scale:new Vec3(1.02,1.02,1)}).to(.16,{scale:new Vec3(1.1,1.1,1)}).start();tween(o).delay(.08).to(.14,{opacity:0}).call(()=>{if(n.isValid)this.pool.put(n);}).start();}
    private playMasterSlashEffect(pos:Readonly<Vec3>):void{if(this.playMasterTexture(this.masterSlashFrame,'MasterSlashEffect',pos,210,140))return;const g=gfx(this.effects,'MasterSlashPlaceholder',190,190);g.node.setPosition(pos);g.strokeColor=YELLOW;g.lineWidth=7;g.lineCap=Graphics.LineCap.ROUND;g.moveTo(-62,-43);g.lineTo(62,43);g.moveTo(-48,59);g.lineTo(48,-59);g.circle(0,0,48);g.stroke();const o=g.node.addComponent(UIOpacity);g.node.setScale(.7,.7,1);tween(g.node).to(.13,{scale:new Vec3(1.14,1.14,1)},{easing:'backOut'}).start();tween(o).delay(.1).to(.2,{opacity:0}).call(()=>g.node.destroy()).start();}
    private playMasterHitEffect(pos:Readonly<Vec3>):void{if(!this.playMasterTexture(this.masterHitFrame,'MasterHitEffect',pos,200,134))this.hitSparks(pos,YELLOW,true);}
    private playMasterTexture(frame:SpriteFrame|null,name:string,pos:Readonly<Vec3>,width:number,height:number):boolean{if(!frame)return false;const s=image(this.effects,name,width,height);s.spriteFrame=frame;s.trim=false;s.node.setPosition(this.clampMasterEffectPosition(pos,width,height));s.node.setScale(.66,.66,1);const o=s.node.addComponent(UIOpacity);tween(s.node).to(.12,{scale:new Vec3(1.06,1.06,1)},{easing:'backOut'}).to(.18,{scale:new Vec3(1.16,1.16,1)},{easing:'quadOut'}).start();tween(o).delay(.12).to(.2,{opacity:0}).call(()=>s.node.destroy()).start();return true;}
    private clampMasterEffectPosition(pos:Readonly<Vec3>,width:number,height:number):Vec3{const v=view.getVisibleSize(),halfWidth=width*.58,halfHeight=height*.58,margin=12,frameTop=v.height/2-FRAME_TOP_INSET,frameBottom=-v.height/2+FRAME_BOTTOM_INSET;const maxX=Math.max(0,v.width/2-halfWidth-margin),minY=Math.min(0,frameBottom+halfHeight+margin),maxY=Math.max(0,frameTop-halfHeight-margin);return new Vec3(Math.max(-maxX,Math.min(maxX,pos.x)),Math.max(minY,Math.min(maxY,pos.y)),pos.z);}
    private hitSparks(pos:Readonly<Vec3>,color:Color,master:boolean):void{const size=master?300:220,g=gfx(this.effects,master?'MasterImpact':'HitSparks',size,size),r1=master?58:42,r2=master?126:86,count=master?10:6;g.node.setPosition(pos);g.strokeColor=color;g.lineWidth=master?12:7;g.lineCap=Graphics.LineCap.ROUND;for(let i=0;i<count;i++){const angle=Math.PI*2*i/count,x1=Math.cos(angle)*r1,y1=Math.sin(angle)*r1,x2=Math.cos(angle)*r2,y2=Math.sin(angle)*r2;g.moveTo(x1,y1);g.lineTo(x2,y2);}if(master)g.circle(0,0,72);g.stroke();g.node.setScale(.72,.72,1);const opacity=g.node.addComponent(UIOpacity);tween(g.node).to(master?.3:.2,{scale:new Vec3(master?1.28:1.08,master?1.28:1.08,1)},{easing:'quadOut'}).start();tween(opacity).delay(master?.08:.04).to(master?.22:.16,{opacity:0}).call(()=>g.node.destroy()).start();}
    private animateCombo(combo:number,milestone:boolean):void{const target=this.combo.node;Tween.stopAllByTarget(target);target.setScale(Vec3.ONE);this.combo.color=milestone?YELLOW:INK;tween(target).to(.08,{scale:new Vec3(milestone?1.3:1.16,milestone?1.3:1.16,1)},{easing:'backOut'}).to(.14,{scale:Vec3.ONE},{easing:'quadOut'}).start();if(milestone)this.scheduleOnce(()=>{if(this.combo?.isValid)this.combo.color=INK;},.26);}
    private breakCombo(_combo:number):void{const target=this.combo.node,origin=target.position.clone();Tween.stopAllByTarget(target);target.setScale(Vec3.ONE);this.combo.color=RED;tween(target).to(.05,{position:new Vec3(origin.x-9,origin.y,origin.z),scale:new Vec3(.86,.86,1)}).to(.05,{position:new Vec3(origin.x+9,origin.y,origin.z)}).to(.08,{position:origin,scale:Vec3.ONE},{easing:'backOut'}).start();this.scheduleOnce(()=>{if(this.combo?.isValid)this.combo.color=INK;},.22);}
    private applyHitStop(durationMs:number):void{this.hitStopActive=true;this.paused=true;this.scheduleOnce(()=>{this.hitStopActive=false;if(!this.hidden)this.paused=false;},durationMs/1000);}
    private updateCountdownFeedback(remainingMs:number):void{const second=countdownWarningSecond(remainingMs,this.lastCountdownSecond);if(second===null)return;this.lastCountdownSecond=second;AppRuntime.audio.play('warning',{variant:5-second});this.timer.color=RED;Tween.stopAllByTarget(this.timer.node);this.timer.node.setScale(Vec3.ONE);tween(this.timer.node).to(.08,{scale:new Vec3(1.18,1.18,1)},{easing:'backOut'}).to(.12,{scale:Vec3.ONE},{easing:'quadOut'}).start();}
    private updateTargetMotions():boolean{
        const elapsed=this.session.questionElapsedMs()/1000;
        const rotating=this.question?.activeRules.includes('rotate')===true;
        let landed=false;
        const valid=this.motions.filter((motion)=>motion.node.isValid),base=valid.map((motion)=>evaluatePortraitTargetMotion(motion,elapsed-motion.delay)),separated=resolveSoftTargetSeparation(base);
        for(let index=0;index<valid.length;index++){
            const motion=valid[index],local=elapsed-motion.delay,point=separated[index];
            motion.node.setPosition(point.x,point.y);motion.node.angle=evaluatePortraitTargetRotation(motion,local,rotating);
            if(local>=motion.duration)landed=true;
        }
        return landed;
    }
    private onHide():void{if(this.finished)return;this.hidden=true;this.paused=true;this.pendingTouchPoint=null;this.lastQueuedTouchPoint=null;this.touchActive=false;if(!this.keepsIncompleteGesture())this.gesture=null;director.pause();}
    private onShow():void{if(this.finished)return;this.hidden=false;director.resume();this.paused=true;const ready=text(this.node,'ResumeReady','READY',68,RED);this.scheduleOnce(()=>{ready.node.destroy();if(!this.hitStopActive)this.paused=false;},GAMEPLAY_CONFIG.readyMs/1000);}
}
