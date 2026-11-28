/**
 * Direct DOM print utility that avoids react-to-print hidden iframe issues
 * (e.g., "contentWindow of the print iframe did not load").
 * Works across Desktop Chrome/Firefox/Safari, Mobile browsers, AI Studio iframes, and Electron.
 */

const DIRECT_PRINT_MOUNT_ID = 'direct-print-mount';

function copyCanvasPixels(source: HTMLElement, target: HTMLElement) {
  const sourceCanvases = source.querySelectorAll('canvas');
  const targetCanvases = target.querySelectorAll('canvas');
  for (let i = 0; i < sourceCanvases.length; i++) {
    const srcCanvas = sourceCanvases[i];
    const dstCanvas = targetCanvases[i];
    if (!dstCanvas) continue;
    dstCanvas.width = srcCanvas.width;
    dstCanvas.height = srcCanvas.height;
    const ctx = dstCanvas.getContext('2d');
    if (ctx) {
      try {
        ctx.drawImage(srcCanvas, 0, 0);
      } catch {
        // Ignore tainted canvas errors
      }
    }
  }
}

async function waitForImages(container: HTMLElement, timeoutMs = 1500): Promise<void> {
  const imgs = Array.from(container.querySelectorAll('img'));
  if (imgs.length === 0) return;

  const promises = imgs.map(
    (img) =>
      new Promise<void>((resolve) => {
        if (img.complete && img.naturalWidth > 0) {
          resolve();
          return;
        }
        const done = () => resolve();
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
      })
  );

  await Promise.race([
    Promise.all(promises),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

export interface DirectPrintOptions {
  documentTitle?: string;
  onAfterPrint?: () => void;
  fallbackPdfUrl?: string | null;
}

export function printElementDirectly(
  element: HTMLElement | null,
  options: DirectPrintOptions = {}
): Promise<void> {
  const { documentTitle, onAfterPrint, fallbackPdfUrl } = options;

  if (!element) {
    if (fallbackPdfUrl) {
      return printPdfDataUrl(fallbackPdfUrl).then(() => {
        onAfterPrint?.();
      });
    }
    try {
      window.print();
    } catch (err) {
      console.warn('window.print failed:', err);
    }
    onAfterPrint?.();
    return Promise.resolve();
  }

  const originalTitle = document.title;
  let cleanedUp = false;

  let mount = document.getElementById(DIRECT_PRINT_MOUNT_ID);
  if (!mount) {
    mount = document.createElement('div');
    mount.id = DIRECT_PRINT_MOUNT_ID;
    document.body.appendChild(mount);
  }

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    document.body.classList.remove('is-direct-printing');
    if (documentTitle && document.title === documentTitle) {
      document.title = originalTitle;
    }
    const existingMount = document.getElementById(DIRECT_PRINT_MOUNT_ID);
    if (existingMount) {
      existingMount.innerHTML = '';
    }
    onAfterPrint?.();
  };

  try {
    mount.innerHTML = '';
    const clone = element.cloneNode(true) as HTMLElement;
    copyCanvasPixels(element, clone);
    mount.appendChild(clone);

    const pendingImgs = Array.from(mount.querySelectorAll('img')).filter(
      (img) => !(img.complete && img.naturalWidth > 0)
    );

    const runPrint = (): Promise<void> => {
      try {
        if (documentTitle) {
          document.title = documentTitle;
        }
        document.body.classList.add('is-direct-printing');

        window.addEventListener('afterprint', cleanup, { once: true });

        // Trigger native browser print dialog on the main window (no nested iframe contentWindow needed)
        window.print();

        // Fallback cleanup in case afterprint does not fire in a WebView/iframe
        setTimeout(cleanup, 15000);
        return Promise.resolve();
      } catch (err) {
        console.warn('Direct print failed, attempting fallback:', err);
        cleanup();
        if (fallbackPdfUrl) {
          return printPdfDataUrl(fallbackPdfUrl).then(() => undefined);
        }
        return Promise.resolve();
      }
    };

    if (pendingImgs.length === 0) {
      // Execute synchronously inside click gesture when no unloaded images exist
      return runPrint();
    }

    return waitForImages(mount).then(runPrint);
  } catch (err) {
    console.warn('Direct print setup failed, attempting fallback:', err);
    cleanup();
    if (fallbackPdfUrl) {
      return printPdfDataUrl(fallbackPdfUrl).then(() => undefined);
    }
    return Promise.resolve();
  }
}

export async function printPdfDataUrl(pdfDataUrl: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      if (!pdfDataUrl) {
        window.print();
        resolve(true);
        return;
      }

      const parts = pdfDataUrl.split(',');
      const base64 = parts[1] || parts[0];
      const byteCharacters = atob(base64);
      const byteNumbers = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const blob = new Blob([byteNumbers], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      iframe.src = blobUrl;

      let printed = false;
      const triggerPrint = () => {
        if (printed) return;
        printed = true;
        try {
          if (iframe.contentWindow) {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            resolve(true);
            return;
          }
        } catch (e) {
          console.warn('iframe print exception, trying window.print fallback:', e);
        }
        try {
          window.print();
        } catch {}
        resolve(false);
      };

      iframe.onload = () => {
        setTimeout(triggerPrint, 250);
      };

      document.body.appendChild(iframe);

      setTimeout(() => {
        if (!printed) {
          triggerPrint();
        }
      }, 1200);

      setTimeout(() => {
        try {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
          URL.revokeObjectURL(blobUrl);
        } catch {}
      }, 60000);
    } catch (err) {
      console.warn('printPdfDataUrl failed:', err);
      try {
        window.print();
      } catch {}
      resolve(false);
    }
  });
}
