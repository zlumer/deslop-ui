// ============================================================================
// 2. Visual Regression Engine Signatures
// ============================================================================

export interface VisualRegressionOptions {
  /** The props to pass to the component so it can actually render in the hidden browser */
  mockProps?: Record<string, any>;
  /** The maximum acceptable difference percentage (0.0 to 100.0). Defaults to 0.0 */
  mismatchThreshold?: number;
  /** Viewport dimensions for the headless browser screenshot. Defaults to 1024x768 */
  viewport?: { width: number; height: number };
  /** Time to wait (ms) after mounting before taking the screenshot (for animations/fonts) */
  delayMs?: number;
}

export interface VisualRegressionResult {
  /** The percentage of pixels that differ (0 is a perfect match) */
  diffPercentage: number;
  /** True if diffPercentage <= options.mismatchThreshold */
  passed: boolean;
  /** Base64 string of the diff image highlighting the differences in red */
  diffImageBase64?: string;
}

/**
 * Spins up a local Vite/esbuild server, mounts the original and refactored components,
 * takes Playwright/Puppeteer screenshots, and compares them using Resemble.js.
 * 
 * @param componentIdentifier The name or path identifier to locate the components (e.g., 'UserCard')
 * @param options Render configurations including mock props and threshold.
 * @returns A promise resolving to the pixel difference percentage and diff image.
 */
export declare function runVisualRegression(
  componentIdentifier: string,
  options?: VisualRegressionOptions
): Promise<VisualRegressionResult>;