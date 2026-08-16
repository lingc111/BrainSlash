export class CountdownTimer {
    private timerId: ReturnType<typeof setInterval> | null = null;
    private expired = false;

    public start(
        endTime: number,
        onTick: (formatted: string, remainingMs: number) => void,
        onExpired: () => void,
    ): void {
        this.stop();
        this.expired = false;

        const tick = (): void => {
            const remainingMs = Math.max(0, endTime - Date.now());
            onTick(CountdownTimer.format(remainingMs), remainingMs);

            if (remainingMs <= 0 && !this.expired) {
                this.expired = true;
                this.stop();
                onExpired();
            }
        };

        tick();
        if (!this.expired) this.timerId = setInterval(tick, 1000);
    }

    public stop(): void {
        if (this.timerId !== null) {
            clearInterval(this.timerId);
            this.timerId = null;
        }
    }

    public static format(milliseconds: number): string {
        const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const twoDigits = (value: number): string => (value < 10 ? `0${value}` : value.toString());
        return [hours, minutes, seconds].map(twoDigits).join(':');
    }
}
