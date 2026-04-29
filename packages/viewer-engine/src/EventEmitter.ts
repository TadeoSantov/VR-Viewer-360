import type { ViewerEventMap } from "./types";

type Handler<T> = T extends void ? () => void : (data: T) => void;

export class EventEmitter {
  private listeners = new Map<string, Set<Function>>();

  on<K extends keyof ViewerEventMap>(event: K, handler: Handler<ViewerEventMap[K]>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  off<K extends keyof ViewerEventMap>(event: K, handler: Handler<ViewerEventMap[K]>): void {
    this.listeners.get(event)?.delete(handler);
  }

  protected emit<K extends keyof ViewerEventMap>(
    event: K,
    ...args: ViewerEventMap[K] extends void ? [] : [ViewerEventMap[K]]
  ): void {
    this.listeners.get(event)?.forEach((fn) => {
      try {
        (fn as Function)(...args);
      } catch (err) {
        console.error(`[VRViewerEngine] Error in "${event}" handler:`, err);
      }
    });
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}
