export type AnalyticsEvent = 'game_start' | 'question_result' | 'game_finish' | 'share';
export class AnalyticsService { public track(_event: AnalyticsEvent, _data: Readonly<Record<string, unknown>> = {}): void { /* MVP no-op adapter. */ } }
