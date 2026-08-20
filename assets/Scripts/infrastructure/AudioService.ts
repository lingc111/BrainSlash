export type SoundId = 'ui' | 'slash' | 'correct' | 'error' | 'bomb' | 'master' | 'combo' | 'warning' | 'finish';

export interface SoundPlayOptions {
    variant?: number;
    volume?: number;
}

export const SOUND_COOLDOWN_MS: Readonly<Record<SoundId, number>> = {
    ui: 70,
    slash: 34,
    correct: 45,
    error: 120,
    bomb: 180,
    master: 180,
    combo: 100,
    warning: 280,
    finish: 500,
};

type OscillatorKind = 'sine' | 'square' | 'sawtooth' | 'triangle';
interface ToneSpec {
    frequency: number;
    endFrequency: number;
    duration: number;
    delay?: number;
    gain: number;
    type: OscillatorKind;
}
interface AudioParamLike {
    setValueAtTime(value: number, time: number): void;
    exponentialRampToValueAtTime(value: number, time: number): void;
}
interface Connectable { connect(destination: unknown): unknown; }
interface OscillatorLike extends Connectable {
    frequency: AudioParamLike;
    type: OscillatorKind;
    start(time?: number): void;
    stop(time?: number): void;
}
interface GainLike extends Connectable { gain: AudioParamLike; }
interface SynthAudioContext {
    currentTime: number;
    destination: unknown;
    state?: string;
    createOscillator(): OscillatorLike;
    createGain(): GainLike;
    resume?(): Promise<void> | void;
}

type Clock = () => number;
type ContextFactory = () => SynthAudioContext | null;

const RECIPES: Readonly<Record<SoundId, readonly ToneSpec[]>> = {
    ui: [{ frequency: 420, endFrequency: 540, duration: 0.055, gain: 0.045, type: 'sine' }],
    slash: [
        { frequency: 1450, endFrequency: 240, duration: 0.085, gain: 0.045, type: 'sawtooth' },
        { frequency: 820, endFrequency: 170, duration: 0.07, gain: 0.035, type: 'triangle' },
    ],
    correct: [
        { frequency: 620, endFrequency: 840, duration: 0.09, gain: 0.045, type: 'sine' },
        { frequency: 900, endFrequency: 1120, duration: 0.08, delay: 0.045, gain: 0.035, type: 'triangle' },
    ],
    error: [
        { frequency: 190, endFrequency: 82, duration: 0.16, gain: 0.07, type: 'square' },
        { frequency: 125, endFrequency: 70, duration: 0.18, gain: 0.04, type: 'sine' },
    ],
    bomb: [
        { frequency: 125, endFrequency: 42, duration: 0.23, gain: 0.11, type: 'sawtooth' },
        { frequency: 72, endFrequency: 38, duration: 0.26, gain: 0.09, type: 'square' },
    ],
    master: [
        { frequency: 520, endFrequency: 1040, duration: 0.18, gain: 0.075, type: 'sawtooth' },
        { frequency: 780, endFrequency: 1560, duration: 0.2, gain: 0.055, type: 'triangle' },
        { frequency: 165, endFrequency: 82, duration: 0.12, gain: 0.07, type: 'square' },
    ],
    combo: [
        { frequency: 760, endFrequency: 1080, duration: 0.1, gain: 0.05, type: 'triangle' },
        { frequency: 1140, endFrequency: 1480, duration: 0.09, delay: 0.035, gain: 0.03, type: 'sine' },
    ],
    warning: [{ frequency: 880, endFrequency: 650, duration: 0.065, gain: 0.055, type: 'square' }],
    finish: [
        { frequency: 392, endFrequency: 392, duration: 0.3, gain: 0.05, type: 'sine' },
        { frequency: 523, endFrequency: 523, duration: 0.3, delay: 0.035, gain: 0.045, type: 'sine' },
        { frequency: 659, endFrequency: 659, duration: 0.32, delay: 0.07, gain: 0.04, type: 'triangle' },
    ],
};

export class SoundThrottle {
    private readonly lastPlayedAt = new Map<SoundId, number>();
    public constructor(private readonly cooldowns: Readonly<Record<SoundId, number>> = SOUND_COOLDOWN_MS) {}
    public allow(id: SoundId, nowMs: number): boolean {
        const previous = this.lastPlayedAt.get(id);
        if (previous !== undefined && nowMs >= previous && nowMs - previous < this.cooldowns[id]) return false;
        this.lastPlayedAt.set(id, nowMs);
        return true;
    }
    public reset(): void { this.lastPlayedAt.clear(); }
}

export class AudioService {
    public enabled = true;
    public volume = 0.8;
    private context: SynthAudioContext | null = null;
    private resuming = false;
    private readonly throttle = new SoundThrottle();

    public constructor(
        private readonly clock: Clock = () => Date.now(),
        private readonly contextFactory: ContextFactory = createAudioContext,
    ) {}

    public play(id: SoundId, options: SoundPlayOptions = {}): boolean {
        if (!this.enabled) return false;
        const context = this.context ?? this.contextFactory();
        if (!context) return false;
        this.context = context;
        const nowMs = this.clock();
        if (!this.throttle.allow(id, nowMs)) return false;
        const variant = Math.max(0, Math.min(12, options.variant ?? 0));
        const pitch = id === 'combo' ? 1 + variant * 0.035 : 1;
        const volume = Math.max(0, Math.min(1, options.volume ?? 1)) * Math.max(0, Math.min(1, this.volume));
        const emit = (): void => { for (const tone of RECIPES[id]) this.playTone(context, tone, pitch, volume); };
        try {
            if (context.state && context.state !== 'running') {
                if (this.resuming || !context.resume) return false;
                const resumed = context.resume?.();
                if (resumed && typeof (resumed as Promise<void>).then === 'function') {
                    this.resuming = true;
                    void (resumed as Promise<void>).then(() => {
                        this.resuming = false;
                        if (this.enabled && (!context.state || context.state === 'running')) emit();
                    }).catch(() => { this.resuming = false; });
                    return true;
                }
                if (context.state !== 'running') return false;
            }
            emit();
            return true;
        } catch {
            return false;
        }
    }

    public resetThrottle(): void { this.throttle.reset(); }

    private playTone(context: SynthAudioContext, tone: ToneSpec, pitch: number, volume: number): void {
        const start = context.currentTime + 0.003 + (tone.delay ?? 0);
        const end = start + tone.duration;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = tone.type;
        oscillator.frequency.setValueAtTime(Math.max(20, tone.frequency * pitch), start);
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, tone.endFrequency * pitch), end);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, tone.gain * volume), start + Math.min(0.012, tone.duration * 0.25));
        gain.gain.exponentialRampToValueAtTime(0.0001, end);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(start);
        oscillator.stop(end + 0.01);
    }
}

function createAudioContext(): SynthAudioContext | null {
    const wxApi = (globalThis as { wx?: { createWebAudioContext?: () => unknown } }).wx;
    try {
        const context = wxApi?.createWebAudioContext?.();
        if (isSynthAudioContext(context)) return context;
    } catch {
        // Fall through to the browser constructor when the platform adapter is unavailable.
    }
    try {
        const constructors = globalThis as unknown as {
            AudioContext?: new () => SynthAudioContext;
            webkitAudioContext?: new () => SynthAudioContext;
        };
        const Context = constructors.AudioContext ?? constructors.webkitAudioContext;
        return Context ? new Context() : null;
    } catch {
        return null;
    }
}

function isSynthAudioContext(value: unknown): value is SynthAudioContext {
    const candidate = value as Partial<SynthAudioContext> | null | undefined;
    return !!candidate && typeof candidate.createOscillator === 'function' && typeof candidate.createGain === 'function';
}
