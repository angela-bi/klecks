import './polyfills/polyfills';
import { KlApp } from './app/kl-app';
import { TKlProject, TKlProjectWithOptionalId, TRgb } from './klecks/kl-types';
import { klPsdToKlProject, readPsd } from './klecks/storage/psd';
import { LANG } from './language/language';
import { loadAgPsd, TAgPsd } from './klecks/storage/load-ag-psd';
import { KL_CONFIG } from './klecks/kl-config';
import { randomUuid } from './bb/base/base';
import { TVector2D } from './bb/bb-types';

export type TEmbedParams = {
    project?: TKlProject;
    psdBlob?: Blob;
    onSubmit: (onSuccess: () => void, onError: () => void) => void;
    embedUrl: string;
    logoImg?: any;
    bottomBar?: HTMLElement;
    aboutEl?: HTMLElement;
    disableAutoFit?: boolean; // disable automatic Fit to View for small canvases
    enableImageDropperImport?: boolean; // default false
};

export type TReadPSD = {
    blob: Blob;
    callback: (k: TKlProject | null) => void;
};

/**
 * Note: Wrapped by EmbedWrapper, which quickly provides feedback for the user without having loaded everything.
 * Embed runs when the main bundle is loaded. It instantiates Klecks.
 */
export class Embed {
    private isInitialized: boolean = false;
    private klApp: KlApp | undefined;
    private readonly psdQueue: TReadPSD[] = []; // queue of psds waiting while ag-psd is loading
    private agPsd: TAgPsd | 'error' | undefined;
    private loadingScreenEl: HTMLElement | null;
    private loadingScreenTextEl: HTMLElement | null;

    onProjectReady(project: TKlProjectWithOptionalId) {
        try {
            if (this.isInitialized) {
                throw new Error('Already called openProject');
            }
            this.isInitialized = true;

            const projectWithId = {
                ...project,
                projectId: project.projectId ?? randomUuid(),
            };
            this.klApp = new KlApp({
                project: projectWithId,
                bottomBar: this.p.bottomBar,
                aboutEl: this.p.aboutEl,
                embed: {
                    url: this.p.embedUrl,
                    enableImageDropperImport: !!this.p.enableImageDropperImport,
                    onSubmit: this.p.onSubmit,
                },
            });

            void this.loadingScreenEl?.remove();
            this.loadingScreenEl = null;
            this.loadingScreenTextEl = null;

            document.body.append(this.klApp.getElement());
        } catch (e) {
            if (this.loadingScreenTextEl) {
                this.loadingScreenTextEl.textContent = '❌ ' + e;
            }
            if (this.loadingScreenEl) {
                this.loadingScreenEl.className += 'loading-screen-error';
            }
            console.error(e);
        }
    }

    // ----------------------------------- public -----------------------------------
    constructor(private p: TEmbedParams) {
        this.loadingScreenEl = document.getElementById('loading-screen');
        this.loadingScreenTextEl = document.getElementById('loading-screen-text');
        if (this.loadingScreenTextEl) {
            this.loadingScreenTextEl.textContent = LANG('embed-init-waiting');
        }

        if (p.disableAutoFit) {
            KL_CONFIG.disableAutoFit = true;
        }
        if (p.project) {
            this.onProjectReady(p.project);
        }
    }

    openProject = (project: TKlProjectWithOptionalId) => {
        this.onProjectReady(project);
    };

    initError(error: string) {
        if (this.loadingScreenTextEl) {
            this.loadingScreenTextEl.textContent = '❌ ' + error;
        }
        if (this.loadingScreenEl) {
            this.loadingScreenEl.className += 'loading-screen-error';
        }
    }

    /**
     * Get the complete canvas as an HTMLCanvasElement.
     * @param scaleFactor Optional scale factor (default: 1). Use 1 for original size.
     * @returns The canvas element containing the complete drawing.
     */
    getCanvas(scaleFactor: number = 1): HTMLCanvasElement {
        if (!this.klApp) {
            throw new Error('App not initialized');
        }
        return this.klApp.getCanvas(scaleFactor);
    }

    /**
     * Get the complete canvas as a data URL string.
     * @param format Optional image format (default: 'image/png').
     * @param quality Optional quality for JPEG (0-1, default: 0.92).
     * @returns A data URL string that can be used in img src or downloaded.
     */
    getCanvasDataURL(format: string = 'image/png', quality?: number): string {
        if (!this.klApp) {
            throw new Error('App not initialized');
        }
        return this.klApp.getCanvasDataURL(format, quality);
    }

    async getPNG(): Promise<Blob> {
        if (!this.klApp) {
            throw new Error('App not initialized');
        }
        return await this.klApp.getPNG();
    }

    async getPSD(): Promise<Blob> {
        if (!this.klApp) {
            throw new Error('App not initialized');
        }
        return await this.klApp.getPSD();
    }

    /**
     * Set the brush size dynamically.
     * @param size The brush size (actual value, not display value). The valid range depends on the current brush type.
     */
    setBrushSize(size: number): void {
        if (!this.klApp) {
            throw new Error('App not initialized');
        }
        this.klApp.setBrushSize(size);
    }

    /**
     * Get the current brush size.
     * @returns The current brush size (actual value, not display value).
     */
    getBrushSize(): number {
        if (!this.klApp) {
            throw new Error('App not initialized');
        }
        return this.klApp.getBrushSize();
    }

    /**
     * Set the brush opacity dynamically.
     * @param opacity The opacity from 0–1 or 0–100 depending on your internal convention.
     */
    setBrushOpacity(opacity: number): void {
        if (!this.klApp) {
            throw new Error('App not initialized');
        }
        this.klApp.setBrushOpacity(opacity);
    }

    /**
     * Get the current brush opacity.
     * @returns The current opacity.
     */
    getBrushOpacity(): number {
        if (!this.klApp) {
            throw new Error('App not initialized');
        }
        return this.klApp.getBrushOpacity();
    }

    /**
     * Set the brush color dynamically.
     * @param color The color as TRgb object.
     */
    setBrushColor(color: TRgb): void {
        if (!this.klApp) {
            throw new Error('App not initialized');
        }
        this.klApp.setBrushColor(color);
    }

    /**
     * Get the current brush color.
     * @returns The current color.
     */
    getBrushColor(): TRgb {
        if (!this.klApp) {
            throw new Error('App not initialized');
        }
        return this.klApp.getBrushColor();
    }

    setBrushScatter(scatter: number): void {
        if (!this.klApp) {
            throw new Error('App not initialized');
        }
        this.klApp.setBrushScatter(scatter);
    }

    draw(path: TVector2D[]): void {
        if (!this.klApp) {
            throw new Error('App not initialized');
        }
        this.klApp.draw(path);
    }

    clearLayer(): void {
        if (!this.klApp) {
            throw new Error('App not initialized');
        }
        this.klApp.clearLayer();
    }

    getColor(): TRgb {
        if (!this.klApp) {
            throw new Error('App not initialized');
        }
        return this.klApp.getColor();
    }

    /**
     * Show the toolspace/toolbar.
     */
    showToolSpace(): void {
        if (!this.klApp) {
            throw new Error('App not initialized');
        }
        this.klApp.showToolspace();
    }

    /**
     * Hide the toolspace/toolbar.
     */
    hideToolSpace(): void {
        if (!this.klApp) {
            throw new Error('App not initialized');
        }
        this.klApp.hideToolspace();
    }


    readPSDs(psds: TReadPSD[]) {
        if (psds.length === 0) {
            return;
        }

        const readItem = (item: TReadPSD) => {
            try {
                const psd = (this.agPsd as any).readPsd(item.blob as any);
                const project = klPsdToKlProject(readPsd(psd));
                item.callback(project);
            } catch (e) {
                console.error('failed to read psd', e);
                item.callback(null);
            }
        };

        // library not loaded yet
        if (!this.agPsd) {
            if (this.psdQueue.length === 0) {
                // load ag-psd
                (async () => {
                    try {
                        this.agPsd = await loadAgPsd();
                    } catch (e) {
                        this.agPsd = 'error';
                    }
                    while (this.psdQueue.length) {
                        readItem(this.psdQueue.shift()!);
                    }
                })();
            }
            psds.forEach((item) => {
                this.psdQueue.push(item);
            });
        } else {
            psds.forEach(readItem);
        }
    }

    /**
     * Read a PSD file and return the project.
     * @param blob The PSD file as a Blob.
     * @returns A Promise that resolves to the loaded project, or rejects if loading fails.
     */
    async readPSD(blob: Blob): Promise<TKlProject> {
        return new Promise((resolve, reject) => {
            const item: TReadPSD = {
                blob,
                callback: (loadedProject: TKlProject | null) => {
                    if (loadedProject) {
                        resolve(loadedProject);
                    } else {
                        reject(new Error('Failed to load PSD file'));
                    }
                },
            };
            this.readPSDs([item]);
        });
    }

    /**
     * Read a PSD file and automatically open it as a new project.
     * @param blob The PSD file as a Blob.
     * @returns A Promise that resolves when the PSD is loaded and opened.
     */
    async openPSD(blob: Blob): Promise<void> {
        try {
            const project = await this.readPSD(blob);
            this.openProject(project);
        } catch (error) {
            throw new Error(`Failed to open PSD file: ${error}`);
        }
    }
}
