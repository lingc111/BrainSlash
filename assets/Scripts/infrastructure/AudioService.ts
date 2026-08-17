export type SoundId = 'ui' | 'slash' | 'error' | 'bomb' | 'master' | 'warning';
export class AudioService {
    public enabled = true;
    public play(_id: SoundId): void { if (!this.enabled) return; /* Audio clips are injected when production assets arrive. */ }
}
