/** A navigation intent belongs to the sheet being closed, never its replacement. */
export class SheetTransition {
    private pending?: { sheet: string; run: () => void };
    request(sheet: string, close: () => void, run: () => void) {
        this.pending = { sheet, run };
        close();
    }
    cancel() { this.pending = undefined; }
    complete(sheet: string) {
        if (this.pending?.sheet !== sheet) return;
        const { run } = this.pending;
        this.pending = undefined;
        run();
    }
}

export const sheetTransition = new SheetTransition();
