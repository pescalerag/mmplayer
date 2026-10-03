export interface DelayedLoaderOptions {
  /**
   * Delay in milliseconds before the loader is allowed to become visible.
   * If loading finishes before this delay, the loader is never rendered.
   * Default: 250ms (standard 200-300ms).
   */
  delay?: number;

  /**
   * Minimum duration in milliseconds the loader must remain visible once shown,
   * preventing quick jarring flashes.
   * Default: 500ms.
   */
  minDisplayTime?: number;
}

/**
 * Controller for the Delayed Loader pattern.
 * Manages timing thresholds for delayed appearance and minimum display duration.
 */
export class DelayedLoaderController {
  private readonly delay: number;
  private readonly minDisplayTime: number;
  private showLoader = false;
  private shownAt: number | null = null;
  private delayTimer: ReturnType<typeof setTimeout> | null = null;
  private minDisplayTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly onStateChange: (show: boolean) => void;

  constructor(
    onStateChange: (show: boolean) => void,
    options: DelayedLoaderOptions = {}
  ) {
    this.onStateChange = onStateChange;
    this.delay = options.delay ?? 250;
    this.minDisplayTime = options.minDisplayTime ?? 500;
  }

  public startLoading(): void {
    if (this.minDisplayTimer) {
      clearTimeout(this.minDisplayTimer);
      this.minDisplayTimer = null;
    }
    if (this.shownAt !== null) {
      this.setShow(true);
      return;
    }
    if (!this.delayTimer) {
      this.delayTimer = setTimeout(() => {
        this.shownAt = Date.now();
        this.setShow(true);
        this.delayTimer = null;
      }, this.delay);
    }
  }

  public stopLoading(): void {
    if (this.delayTimer) {
      clearTimeout(this.delayTimer);
      this.delayTimer = null;
    }
    if (this.shownAt === null) {
      this.setShow(false);
      return;
    }

    const elapsed = Date.now() - this.shownAt;
    const remaining = this.minDisplayTime - elapsed;
    if (remaining > 0) {
      if (!this.minDisplayTimer) {
        this.minDisplayTimer = setTimeout(() => {
          this.setShow(false);
          this.shownAt = null;
          this.minDisplayTimer = null;
        }, remaining);
      }
    } else {
      this.setShow(false);
      this.shownAt = null;
    }
  }




  private setShow(val: boolean): void {
    if (this.showLoader !== val) {
      this.showLoader = val;
      this.onStateChange(val);
    }
  }

  public get isShowing(): boolean {
    return this.showLoader;
  }

  public destroy(): void {
    if (this.delayTimer) clearTimeout(this.delayTimer);
    if (this.minDisplayTimer) clearTimeout(this.minDisplayTimer);
  }
}
