import html2canvas from 'html2canvas-pro';

export { html2canvas };

export interface CaptureCanvasOptions {
  scale?: number;
  backgroundColor?: string;
  windowWidth?: number;
  onclone?: (clonedDoc: Document, element: HTMLElement) => void;
  [key: string]: any;
}

/**
 * Robust canvas capture helper with html2canvas-pro
 * Supports modern CSS color functions (oklab, oklch, color-mix) and provides clean defaults.
 */
export async function captureElementToCanvas(
  element: HTMLElement,
  options: CaptureCanvasOptions = {}
): Promise<HTMLCanvasElement> {
  const {
    scale = 3.0,
    backgroundColor = '#ffffff',
    windowWidth,
    onclone,
    ...rest
  } = options;

  return html2canvas(element, {
    scale,
    useCORS: true,
    logging: false,
    backgroundColor,
    allowTaint: false,
    imageTimeout: 2000,
    ...(windowWidth ? { windowWidth } : {}),
    onclone: (clonedDoc, clonedEl) => {
      if (onclone) {
        onclone(clonedDoc, clonedEl);
      }
    },
    ...rest,
  });
}
