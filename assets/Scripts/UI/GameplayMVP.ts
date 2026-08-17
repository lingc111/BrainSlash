import { _decorator, Button, Color, Component, director, EventTouch, game, Game, Graphics, Label, Node, NodePool, ResolutionPolicy, resources, screen, Sprite, SpriteFrame, tween, Tween, UIOpacity, UITransform, Vec2, Vec3, view } from 'cc';
import { AppRuntime } from '../app/AppRuntime';
import { GAMEPLAY_CONFIG } from '../configs/GameConfig';
import { difficultyAt } from '../domain/DifficultyDirector';
import { GameSession } from '../domain/GameSession';
import { GestureResolver, GestureProgress } from '../domain/GestureResolver';
import type { ActionConstraint, FailureKind, GameResult, QuestionInstance, RuleId, TargetSpec } from '../domain/Models';
import { QuestionGenerator } from '../domain/QuestionGenerator';
import { evaluateRules } from '../domain/Rules';
import { SeededRng } from '../domain/SeededRng';
import { GameplayTarget, GameplayTargetData, TargetContentType, TargetShape } from './GameplayTarget';

const { ccclass } = _decorator;
const INK = new Color(45,43,39,255), PAPER = new Color(255,250,236,255), RED = new Color(174,69,61,255), GREEN = new Color(109,152,106,255), BLUE = new Color(91,133,156,255), YELLOW = new Color(226,184,67,255);
const COLORS = [YELLOW,GREEN,BLUE,new Color(137,111,158,255),new Color(207,132,70,255)];
const SKINS = ['blue_square','green_octagon','green_triangle','orange_circle','pink_diamond','purple_hexagon','red_trapezoid','yellow_circle'] as const;
const DESIGN_WIDTH = 750, DESIGN_HEIGHT = 1624;
type EffectKey = typeof SKINS[number] | 'bomb';
function ui(n:Node,w:number,h:number):UITransform { const t=n.getComponent(UITransform)??n.addComponent(UITransform); t.setContentSize(w,h); t.setAnchorPoint(.5,.5); return t; }
function node(name:string,parent:Node,w=0,h=0):Node { const n=new Node(name); parent.addChild(n); ui(n,w,h); return n; }
function text(parent:Node,name:string,value:string,size:number,color=INK):Label { const l=node(name,parent,Math.max(100,value.length*size*1.25),size*1.5).addComponent(Label); l.string=value;l.fontSize=size;l.lineHeight=size*1.2;l.color=color;l.horizontalAlign=Label.HorizontalAlign.CENTER;l.verticalAlign=Label.VerticalAlign.CENTER;l.enableWrapText=false;return l; }
function gfx(parent:Node,name:string,w:number,h:number):Graphics { return node(name,parent,w,h).addComponent(Graphics); }
function image(parent:Node,name:string,w:number,h:number):Sprite { const s=node(name,parent,w,h).addComponent(Sprite);s.sizeMode=Sprite.SizeMode.CUSTOM;return s; }

@ccclass('GameplayMVP')
export class GameplayMVP extends Component {
    private session!:GameSession; private generator!:QuestionGenerator; private visual!:SeededRng;
    private question:QuestionInstance|null=null; private constraint:ActionConstraint|null=null; private gesture:GestureResolver|null=null;
    private targets!:Node; private effects!:Node; private floats!:Node; private trail!:Graphics;
    private score!:Label; private combo!:Label; private prompt!:Label; private rule!:Label; private timer!:Label; private life!:Label;
    private points:Vec2[]=[]; private trailAge=1; private finished=false; private reverseFrame:Node|null=null;
    private paused=false;
    private tutorialRule:RuleId|null=null;
    private readonly handleResize=():void=>this.applyVisibleLayout();
    private readonly effectByNode=new Map<Node,EffectKey>(); private readonly frames=new Map<EffectKey,SpriteFrame>(); private readonly pool=new NodePool();
    protected onLoad():void {
        view.setDesignResolutionSize(DESIGN_WIDTH,DESIGN_HEIGHT,ResolutionPolicy.SHOW_ALL);
        const editorPreview=this.node.getChildByName('TargetContainer')?.getChildByName('EditorPreviewTargets');if(editorPreview){editorPreview.active=false;editorPreview.destroy();}
        AppRuntime.initialize(); this.session=new GameSession(AppRuntime.entry,GAMEPLAY_CONFIG);
        this.generator=new QuestionGenerator(new SeededRng(`${AppRuntime.entry.seed}:gameplay`),GAMEPLAY_CONFIG); this.visual=new SeededRng(`${AppRuntime.entry.seed}:visual`);
        this.bindStaticView();screen.on('window-resize',this.handleResize,this);game.on(Game.EVENT_HIDE,this.onHide,this);game.on(Game.EVENT_SHOW,this.onShow,this);this.scheduleOnce(this.handleResize,0);
        this.scheduleOnce(()=>{this.node.getChildByName('Ready')?.destroy();this.session.start();this.spawn();},GAMEPLAY_CONFIG.readyMs/1000);
    }
    protected onDestroy():void { screen.off('window-resize',this.handleResize,this);game.off(Game.EVENT_HIDE,this.onHide,this);game.off(Game.EVENT_SHOW,this.onShow,this);this.node.off(Node.EventType.TOUCH_START,this.startTouch,this);this.node.off(Node.EventType.TOUCH_MOVE,this.moveTouch,this);this.node.off(Node.EventType.TOUCH_END,this.endTouch,this);this.node.off(Node.EventType.TOUCH_CANCEL,this.endTouch,this);this.pool.clear(); }
    protected update(dt:number):void {
        if(this.finished||this.paused)return; this.session.tick(dt*1000);
        if(this.session.state.phase==='playing'&&this.question&&!this.session.isQuestionResolved()&&this.session.questionElapsedMs()>=this.question.timeLimitMs)this.fail('miss');
        if(this.session.state.phase==='finished')this.finish(); this.refresh(); this.trailAge+=dt;if(this.trailAge<.14)this.drawTrail(1-this.trailAge/.14);else this.trail.clear();
    }
    public rebuildStaticView():void {
        for(const c of [...this.node.children]){c.removeFromParent();c.destroy();}
        ui(this.node,DESIGN_WIDTH,DESIGN_HEIGHT);
        const bg=image(this.node,'Background',DESIGN_WIDTH,DESIGN_HEIGHT);resources.load('textures/home/paper/bg_graph_paper/spriteFrame',SpriteFrame,(e,f)=>{if(!e&&bg.isValid)bg.spriteFrame=f;});
        node('TargetContainer',this.node,DESIGN_WIDTH,DESIGN_HEIGHT);gfx(this.node,'SlashTrail',DESIGN_WIDTH,DESIGN_HEIGHT);node('HitEffects',this.node,DESIGN_WIDTH,DESIGN_HEIGHT);node('FloatingText',this.node,DESIGN_WIDTH,DESIGN_HEIGHT);
        const y=DESIGN_HEIGHT/2-150;const score=text(this.node,'Score','0',30);score.node.setPosition(-DESIGN_WIDTH/2+85,y);const combo=text(this.node,'Combo','0 COMBO',27,RED);combo.node.setPosition(-DESIGN_WIDTH/2+110,y-48);
        const prompt=text(this.node,'Prompt','准备斩击',44);prompt.node.setPosition(0,y);const rule=text(this.node,'Rule','标准',25,PAPER);rule.node.setPosition(0,y-55);const badge=image(rule.node,'Badge',210,45);badge.node.setSiblingIndex(0);badge.color=BLUE;resources.load('textures/home/paper/daily_paper/spriteFrame',SpriteFrame,(e,f)=>{if(!e&&badge.isValid)badge.spriteFrame=f;});
        const timer=text(this.node,'Timer','60s',38);timer.node.setPosition(DESIGN_WIDTH/2-85,y);const life=text(this.node,'Life','♥ ♥ ♥',26,RED);life.node.setPosition(DESIGN_WIDTH/2-85,y-48);text(this.node,'Ready','READY',68,RED);
    }
    private bindStaticView():void {
        const required=(name:string):Node=>{const found=this.node.getChildByName(name);if(!found)throw new Error(`[GameplayMVP] Gameplay.scene 缺少静态节点 ${name}，请在编辑器中重建并保存静态布局。`);return found;};
        const requiredLabel=(name:string):Label=>{const found=required(name).getComponent(Label);if(!found)throw new Error(`[GameplayMVP] 静态节点 ${name} 缺少 Label 组件。`);return found;};
        const background=required('Background').getComponent(Sprite);if(!background)throw new Error('[GameplayMVP] 静态节点 Background 缺少 Sprite 组件。');
        this.targets=required('TargetContainer');const trailNode=required('SlashTrail');const trail=trailNode.getComponent(Graphics);if(!trail)throw new Error('[GameplayMVP] 静态节点 SlashTrail 缺少 Graphics 组件。');this.trail=trail;
        this.effects=required('HitEffects');this.floats=required('FloatingText');this.score=requiredLabel('Score');this.combo=requiredLabel('Combo');this.prompt=requiredLabel('Prompt');this.rule=requiredLabel('Rule');this.timer=requiredLabel('Timer');this.life=requiredLabel('Life');
        this.applyVisibleLayout();
        this.node.on(Node.EventType.TOUCH_START,this.startTouch,this);this.node.on(Node.EventType.TOUCH_MOVE,this.moveTouch,this);this.node.on(Node.EventType.TOUCH_END,this.endTouch,this);this.node.on(Node.EventType.TOUCH_CANCEL,this.endTouch,this);
        for(const key of [...SKINS,'bomb'] as EffectKey[])resources.load(`textures/gameplay/effects/slash/${key}_slash/spriteFrame`,SpriteFrame,(e,f)=>{if(!e&&f?.isValid)this.frames.set(key,f);});
    }
    private applyVisibleLayout():void{const background=this.node.getChildByName('Background')?.getComponent(Sprite);if(!background||!this.score)return;const v=view.getVisibleSize();ui(this.node,v.width,v.height);for(const layer of [background.node,this.targets,this.trail.node,this.effects,this.floats])ui(layer,v.width,v.height);this.layoutStaticHud(v.width,v.height);}
    private layoutStaticHud(width:number,height:number):void{const y=height/2-150;this.score.node.setPosition(-width/2+85,y);this.combo.node.setPosition(-width/2+110,y-48);this.prompt.node.setPosition(0,y);this.rule.node.setPosition(0,y-55);this.timer.node.setPosition(width/2-85,y);this.life.node.setPosition(width/2-85,y-48);}
    private spawn():void {
        if(this.session.state.phase!=='playing')return;for(const c of [...this.targets.children]){c.removeFromParent();c.destroy();}this.effectByNode.clear();this.gesture=null;
        const d=difficultyAt(this.session.state.elapsedMs);this.question=this.generator.next(this.session.state.elapsedMs,d.stage);this.constraint=evaluateRules(this.question);
        const learned=AppRuntime.save.snapshot().tutorials;this.tutorialRule=this.question.activeRules.find(r=>r!=='standard'&&!learned[r])??null;this.question.tutorialSafe=!!this.tutorialRule;
        this.session.beginQuestion();this.prompt.string=`${this.tutorialRule?'教学·':''}${this.question.prompt.text}`;
        const rs=this.question.activeRules.filter(r=>r!=='standard');this.rule.string=rs.length?rs.map(r=>({reverse:'反向',multi:'多目标',order:'顺序',stroop:'颜色骗局',bomb:'禁区'} as Record<string,string>)[r]).join(' + '):'标准';this.showReverse(this.question.activeRules.includes('reverse'));
        const positions=this.layout(this.question.targets.length),skins=this.visual.shuffle(SKINS);this.question.targets.forEach((s,i)=>this.createTarget(s,positions[i],skins[i%skins.length],i));this.refresh();
    }
    private createTarget(spec:TargetSpec,pos:Vec3,skin:typeof SKINS[number],i:number):void {
        const n=node(spec.isBomb?'BombTarget':`Target_${spec.id}`,this.targets,168,168);n.setPosition(pos);n.angle=[-3,2,-2,3,-1,2][i]??0;
        const wordColors:Record<string,Color>={红:RED,蓝:BLUE,绿:GREEN,黄:YELLOW};
        const data:GameplayTargetData={id:spec.id,contentType:TargetContentType.TEXT,text:spec.text,value:spec.value,shape:(['roundedSquare','triangle','hexagon','circle','pentagon'] as TargetShape[])[i%5],isBomb:spec.isBomb,color:COLORS[i%COLORS.length],contentColor:spec.colorName?wordColors[spec.colorName]:undefined};const target=n.addComponent(GameplayTarget);target.configure(data);
        const key:EffectKey=spec.isBomb?'bomb':skin;this.effectByNode.set(n,key);resources.load(`textures/gameplay/targets/${key}/spriteFrame`,SpriteFrame,(e,f)=>{if(!e&&n.isValid&&n.active)target.applySkin(f);});
        tween(n).repeatForever(tween().by(1+i*.06,{position:new Vec3(0,5+i%3,0),angle:1}).by(1+i*.06,{position:new Vec3(0,-5-i%3,0),angle:-1})).start();
    }
    private layout(count:number):Vec3[]{const v=view.getVisibleSize(),top=v.height/2-360,bottom=-v.height/2+180,result:Vec3[]=[];for(let i=0;i<count;i++){const row=Math.floor(i/2),rows=Math.ceil(count/2),single=count%2===1&&i===count-1;result.push(new Vec3(single?0:(i%2?185:-185),top-(top-bottom)*(row/Math.max(1,rows-1)),0));}return result;}
    private startTouch(e:EventTouch):void{if(this.paused||this.session.state.phase!=='playing'||!this.constraint)return;this.gesture=new GestureResolver(this.constraint);this.points=[this.point(e)];this.trailAge=0;}
    private moveTouch(e:EventTouch):void{if(!this.gesture||this.session.state.phase!=='playing')return;const p=this.point(e),a=this.points[this.points.length-1];if(!a||Vec2.distance(a,p)<4)return;this.points.push(p);if(this.points.length>18)this.points.shift();this.sweep(a,p);this.trailAge=0;this.drawTrail(1);}
    private endTouch():void{if(this.gesture&&this.session.state.phase==='playing')this.progress(this.gesture.end(),null);this.gesture=null;this.trailAge=0;}
    private point(e:EventTouch):Vec2{const p=e.getUILocation(),v=view.getVisibleSize();return new Vec2(p.x-v.width/2,p.y-v.height/2);}
    private sweep(a:Vec2,b:Vec2):void{if(!this.gesture)return;for(const n of [...this.targets.children]){const t=n.getComponent(GameplayTarget);if(!t||t.hit||!t.segmentHit(a,b))continue;t.hit=true;const p=this.gesture.hit(t.data.id);this.slash(t,a,b);this.progress(p,t);if(p.status!=='continue')break;}}
    private progress(p:GestureProgress,t:GameplayTarget|null):void{if(p.status==='success')this.success(t);else if(p.status==='failure')this.fail(p.kind,t);}
    private success(t:GameplayTarget|null):void{if(!this.question)return;const r=this.session.resolveSuccess(this.question);if(!r)return;if(this.tutorialRule)AppRuntime.save.markTutorial(this.tutorialRule);this.float(t?.node.position??Vec3.ZERO,`+${r.scoreDelta}${r.kind==='master'?' MASTER':''}`,r.kind==='master'?YELLOW:GREEN);this.scheduleOnce(()=>{this.session.continueAfterFeedback();this.spawn();},.28);}
    private fail(kind:FailureKind,t:GameplayTarget|null=null):void{if(this.question?.tutorialSafe){this.session.cancelQuestion();this.float(t?.node.position??Vec3.ZERO,'再试一次',YELLOW);this.scheduleOnce(()=>{this.session.continueAfterFeedback();this.spawn();},.35);return;}if(!this.session.resolveFailure(kind))return;AppRuntime.platform.vibrate(AppRuntime.save.snapshot().settings.vibration);if(t)this.error(t.node.position);if(this.session.state.phase!=='finished')this.scheduleOnce(()=>{this.session.continueAfterFeedback();this.spawn();},.28);}
    private finish():void{if(this.finished)return;this.finished=true;const s=this.session.state,total=s.correctCount+s.errorCount;const r:GameResult={entry:this.session.entry,score:s.score,maxCombo:s.maxCombo,correctCount:s.correctCount,errorCount:s.errorCount,accuracy:total?s.correctCount/total:0,bestReactionMs:s.bestReactionMs,isNewRecord:false};AppRuntime.finish(r);this.result(AppRuntime.result!);}
    private result(r:GameResult):void{const v=view.getVisibleSize(),o=node('ResultOverlay',this.node,v.width,v.height),g=gfx(o,'Shade',v.width,v.height);g.fillColor=new Color(35,31,27,240);g.rect(-v.width/2,-v.height/2,v.width,v.height);g.fill();text(o,'Title',r.isNewRecord?'NEW RECORD!':'本局完成',52,YELLOW).node.setPosition(0,340);text(o,'Score',String(r.score),92,PAPER).node.setPosition(0,220);text(o,'Stats',`最高 COMBO ${r.maxCombo}   正确率 ${Math.round(r.accuracy*100)}%`,27,PAPER).node.setPosition(0,90);this.button(o,'再来一局',-70,()=>AppRuntime.replay());this.button(o,'挑战好友',-185,()=>AppRuntime.share());this.button(o,'返回首页',-300,()=>AppRuntime.home());}
    private button(p:Node,value:string,y:number,fn:()=>void):void{const n=node(`Button_${value}`,p,390,82),g=n.addComponent(Graphics);g.fillColor=value==='再来一局'?YELLOW:PAPER;g.strokeColor=INK;g.lineWidth=4;g.roundRect(-195,-41,390,82,16);g.fill();g.stroke();text(n,'Label',value,31);n.setPosition(0,y);n.addComponent(Button);n.on(Node.EventType.TOUCH_END,fn);}
    private refresh():void{if(!this.score)return;const s=this.session.state;this.score.string=String(s.score);this.combo.string=`${s.combo} COMBO`;this.timer.string=`${Math.ceil(s.remainingMs/1000)}s`;this.life.string=Array.from({length:3},(_,i)=>i<s.life?'♥':'♡').join(' ');}
    private drawTrail(alpha:number):void{this.trail.clear();if(this.points.length<2||alpha<=0)return;for(const [w,c] of [[16,new Color(148,187,199,Math.round(95*alpha))],[8,new Color(255,253,241,Math.round(235*alpha))]] as [number,Color][]){this.trail.lineCap=Graphics.LineCap.ROUND;this.trail.lineJoin=Graphics.LineJoin.ROUND;this.trail.lineWidth=w;this.trail.strokeColor=c;this.trail.moveTo(this.points[0].x,this.points[0].y);for(let i=1;i<this.points.length;i++)this.trail.lineTo(this.points[i].x,this.points[i].y);this.trail.stroke();}}
    private showReverse(active:boolean):void{this.reverseFrame?.destroy();this.reverseFrame=null;if(!active)return;const v=view.getVisibleSize(),g=gfx(this.node,'ReverseFrame',v.width-24,v.height-28);g.strokeColor=new Color(174,69,61,170);g.lineWidth=8;g.rect(-v.width/2+12,-v.height/2+14,v.width-24,v.height-28);g.stroke();this.reverseFrame=g.node;}
    private error(pos:Readonly<Vec3>):void{const g=gfx(this.effects,'ErrorRing',190,190);g.node.setPosition(pos);g.strokeColor=RED;g.lineWidth=12;g.circle(0,0,80);g.stroke();const o=g.node.addComponent(UIOpacity);tween(o).to(.24,{opacity:0}).call(()=>g.node.destroy()).start();}
    private float(pos:Readonly<Vec3>,value:string,color:Color):void{const l=text(this.floats,'Float',value,32,color);l.node.setPosition(pos.x,pos.y+44);const o=l.node.addComponent(UIOpacity);tween(l.node).to(.24,{position:new Vec3(pos.x,pos.y+95,0)}).start();tween(o).delay(.08).to(.16,{opacity:0}).call(()=>l.node.destroy()).start();}
    private slash(t:GameplayTarget,a:Vec2,b:Vec2):void{const key=this.effectByNode.get(t.node),frame=key?this.frames.get(key):undefined,pos=t.node.position.clone();t.node.active=false;if(!frame){this.float(pos,'✦',YELLOW);return;}const n=this.pool.size()?this.pool.get()!:node('SlashBurst',this.effects,310,310);if(!n.parent)this.effects.addChild(n);n.active=true;n.setPosition(pos);n.setScale(.76,.76,1);const d=b.clone().subtract(a);n.angle=Math.atan2(d.y,d.x)*180/Math.PI-45;const s=n.getComponent(Sprite)??n.addComponent(Sprite);s.sizeMode=Sprite.SizeMode.CUSTOM;s.spriteFrame=frame;const o=n.getComponent(UIOpacity)??n.addComponent(UIOpacity);o.opacity=255;Tween.stopAllByTarget(n);Tween.stopAllByTarget(o);tween(n).to(.06,{scale:new Vec3(1.02,1.02,1)}).to(.16,{scale:new Vec3(1.1,1.1,1)}).start();tween(o).delay(.08).to(.14,{opacity:0}).call(()=>{if(n.isValid)this.pool.put(n);}).start();}
    private onHide():void{if(this.finished)return;this.paused=true;this.gesture=null;director.pause();}
    private onShow():void{if(this.finished)return;director.resume();this.paused=true;const ready=text(this.node,'ResumeReady','READY',68,RED);this.scheduleOnce(()=>{ready.node.destroy();this.paused=false;},GAMEPLAY_CONFIG.readyMs/1000);}
}
