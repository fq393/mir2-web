import { _decorator, Sprite, gfx } from 'cc';
const {ccclass}=_decorator;

/** Crystal light tiles use additive blending. Isolated to Cocos 3.8.8's renderer API. */
@ccclass('MirSprite')
export class MirSprite extends Sprite {
    setAdditive():void {
        this._srcBlendFactor=gfx.BlendFactor.SRC_ALPHA;
        this._dstBlendFactor=gfx.BlendFactor.ONE;
        this._updateBlendFunc();
    }
}
