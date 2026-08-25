export interface NativeSaveFileOptions {
  suggestedName: string;
  description: string;
  mimeType: string;
  extension: string;
}

interface WritableFileStream {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
  abort?(): Promise<void>;
}

export interface NativeFileHandle {
  readonly name: string;
  createWritable(): Promise<WritableFileStream>;
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: Array<{
    description?: string;
    accept: Record<string, string[]>;
  }>;
  excludeAcceptAllOption?: boolean;
}

type SaveFilePickerWindow = Window & {
  showSaveFilePicker?: (
    options?: SaveFilePickerOptions,
  ) => Promise<NativeFileHandle>;
};

export type NativeSaveFileResult =
  | { status: 'selected'; handle: NativeFileHandle }
  | { status: 'cancelled' }
  | { status: 'unavailable' };

export type FileDestination =
  | { kind: 'native'; handle: NativeFileHandle }
  | { kind: 'browser'; filename: string };

function getErrorName(error: unknown): string {
  if (typeof error !== 'object' || error === null || !('name' in error)) {
    return '';
  }
  return String(error.name);
}

export function normalizeDownloadFilename(
  value: string,
  extension: string,
  fallbackBaseName: string,
): string {
  const normalizedExtension = extension.startsWith('.')
    ? extension
    : `.${extension}`;
  const filenameOnly = value.trim().split(/[\\/]/).pop() ?? '';
  const safeName = filenameOnly
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim();
  const candidateName = safeName || fallbackBaseName;
  const hasExtension = candidateName
    .toLowerCase()
    .endsWith(normalizedExtension.toLowerCase());
  const candidateStem = hasExtension
    ? candidateName.slice(0, -normalizedExtension.length).trim()
    : candidateName;
  const baseName = candidateStem ? candidateName : fallbackBaseName;

  return baseName.toLowerCase().endsWith(normalizedExtension.toLowerCase())
    ? baseName
    : `${baseName}${normalizedExtension}`;
}

export function canUseNativeSaveFilePicker(): boolean {
  const picker = (window as SaveFilePickerWindow).showSaveFilePicker;
  return window.isSecureContext && typeof picker === 'function';
}

export async function chooseNativeSaveFile(
  options: NativeSaveFileOptions,
): Promise<NativeSaveFileResult> {
  const picker = (window as SaveFilePickerWindow).showSaveFilePicker;
  if (!canUseNativeSaveFilePicker() || typeof picker !== 'function') {
    return { status: 'unavailable' };
  }

  try {
    const handle = await picker.call(window, {
      suggestedName: options.suggestedName,
      types: [
        {
          description: options.description,
          accept: {
            [options.mimeType]: [options.extension],
          },
        },
      ],
      excludeAcceptAllOption: true,
    });
    return { status: 'selected', handle };
  } catch (error) {
    const errorName = getErrorName(error);
    if (errorName === 'AbortError') {
      return { status: 'cancelled' };
    }
    if (errorName === 'SecurityError' || errorName === 'NotAllowedError') {
      return { status: 'unavailable' };
    }
    throw error;
  }
}

async function writeToNativeFile(
  handle: NativeFileHandle,
  blob: Blob,
): Promise<void> {
  const writable = await handle.createWritable();
  try {
    await writable.write(blob);
    await writable.close();
  } catch (error) {
    try {
      await writable.abort?.();
    } catch {
      // Preserve the original write error.
    }
    throw error;
  }
}

function downloadWithBrowser(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 10_000);
}

export async function saveBlobToDestination(
  blob: Blob,
  destination: FileDestination,
): Promise<void> {
  if (destination.kind === 'native') {
    await writeToNativeFile(destination.handle, blob);
    return;
  }

  downloadWithBrowser(blob, destination.filename);
}

export function getDestinationFilename(destination: FileDestination): string {
  return destination.kind === 'native'
    ? destination.handle.name
    : destination.filename;
}
