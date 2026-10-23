import type { ApiConsoleSession } from "../lib/api";

export type ConsoleSessionState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; session: ApiConsoleSession }
  | { status: "error"; error: string };

export const idleConsoleSession: ConsoleSessionState = { status: "idle" };
const pollIntervalMs = 2500;
const pollDeadlineMs = 120_000;

export type ConsoleScope = { enrollmentId: string; workspaceId: string };
export type ConsoleSessionControllerOptions = {
  requestSession: (enrollmentId: string) => Promise<ApiConsoleSession>;
  onPollError: (error: unknown) => string;
  onViewerError: (message: string) => void;
  timeoutMessage: string;
  afterPollError?: () => void;
};

export class ConsoleSessionController {
  private state: ConsoleSessionState = idleConsoleSession;
  private stateScopeKey: string | null = null;
  private listeners = new Set<() => void>();
  private options: ConsoleSessionControllerOptions;
  private scope: ConsoleScope | null = null;
  private enabled = false;
  private active = true;
  private owner = 0;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private deadlineTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: ConsoleSessionControllerOptions) { this.options = options; }

  getSnapshot = () => this.state;
  getStateScopeKey = () => this.stateScopeKey;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  updateOptions(options: ConsoleSessionControllerOptions) { this.options = options; }

  bind(scope: ConsoleScope | null, enabled: boolean) {
    this.active = true;
    const changed = this.scope?.enrollmentId !== scope?.enrollmentId || this.scope?.workspaceId !== scope?.workspaceId;
    const disabled = this.enabled && !enabled;
    this.scope = scope;
    this.enabled = enabled;
    if (changed || disabled) this.stop();
  }

  start() {
    const scope = this.scope;
    if (!this.active || !this.enabled || !scope) return;
    this.cancelTimers();
    const owner = ++this.owner;
    this.publish({ status: "loading" });
    this.deadlineTimer = setTimeout(() => {
      if (!this.isCurrent(owner)) return;
      this.owner += 1;
      this.cancelTimers();
      this.publish({ status: "error", error: this.options.timeoutMessage });
    }, pollDeadlineMs);
    void this.poll(owner, scope.enrollmentId);
  }

  stop() {
    this.owner += 1;
    this.cancelTimers();
    this.publish(idleConsoleSession);
  }

  deactivate() {
    this.active = false;
    this.enabled = false;
    this.stop();
  }

  reportViewerError(message: string) {
    if (!this.active) return;
    this.stop();
    this.publish({ status: "error", error: message });
    this.options.onViewerError(message);
  }

  private async poll(owner: number, enrollmentId: string) {
    try {
      const session = await this.options.requestSession(enrollmentId);
      if (!this.isCurrent(owner)) return;
      if (session.state === "ready") {
        if (!session.data) {
          this.finishWithError(owner, "The remote desktop response did not include a ticket.");
          return;
        }
        this.cancelTimers();
        this.publish({ status: "ready", session });
        return;
      }
      this.pollTimer = setTimeout(() => {
        this.pollTimer = null;
        void this.poll(owner, enrollmentId);
      }, pollIntervalMs);
    } catch (error) {
      if (!this.isCurrent(owner)) return;
      this.finishWithError(owner, this.options.onPollError(error));
      this.options.afterPollError?.();
    }
  }

  private finishWithError(owner: number, error: string) {
    if (!this.isCurrent(owner)) return;
    this.owner += 1;
    this.cancelTimers();
    this.publish({ status: "error", error });
  }

  private isCurrent(owner: number) { return this.active && this.enabled && this.owner === owner; }

  private cancelTimers() {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    if (this.deadlineTimer) clearTimeout(this.deadlineTimer);
    this.pollTimer = null;
    this.deadlineTimer = null;
  }

  private publish(state: ConsoleSessionState) {
    this.state = state;
    this.stateScopeKey = state.status === "idle" || !this.scope ? null : `${this.scope.enrollmentId}:${this.scope.workspaceId}`;
    for (const listener of this.listeners) listener();
  }
}
