import { _decorator, Component, Node } from 'cc';
import { HomeController } from './home/HomeController';

const { ccclass, property } = _decorator;

@ccclass('HomeScreenAdapter')
export class HomeScreenAdapter extends Component {
    // Keep these legacy serialized fields until the old scene is next saved in
    // Creator; the runtime controller replaces their visual nodes immediately.
    @property(Node)
    public background: Node | null = null;

    @property(Node)
    public bottomNav: Node | null = null;

    @property(Node)
    public topBar: Node | null = null;

    @property
    public bottomGestureInset = 64;

    protected onLoad(): void {
        if (!this.getComponent(HomeController)) this.node.addComponent(HomeController);
    }
}
