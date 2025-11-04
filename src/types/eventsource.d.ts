declare module "eventsource" {
  interface EventSourceInit {
    headers?: Record<string, string>;
    withCredentials?: boolean;
    https?: {
      rejectUnauthorized?: boolean;
    };
  }

  export default class EventSource {
    constructor(url: string, eventSourceInitDict?: EventSourceInit);

    readonly readyState: number;
    readonly url: string;
    readonly withCredentials: boolean;

    onopen: ((event: Event) => void) | null;
    onmessage: ((event: MessageEvent) => void) | null;
    onerror: ((event: Event) => void) | null;

    close(): void;

    static readonly CONNECTING: number;
    static readonly OPEN: number;
    static readonly CLOSED: number;
  }
}
