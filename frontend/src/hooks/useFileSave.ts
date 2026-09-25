import { useState } from 'react';
import { convertToImage, downloadFile, downloadPDF } from '../services/api';
import type { ConvertDpi, ConvertFormat } from '../types';
import {
  canUseNativeSaveFilePicker,
  chooseNativeSaveFile,
  getDestinationFilename,
  saveBlobToDestination,
} from '../utils/fileSave';
import type { FileDestination, NativeSaveFileOptions } from '../utils/fileSave';
import type { Status } from './useStatus';

export type SaveRequest =
  | {
      kind: 'pdf';
      pdfId: string;
      suggestedName: string;
    }
  | {
      kind: 'images';
      pdfId: string;
      suggestedName: string;
      format: ConvertFormat;
      dpi: ConvertDpi;
      selectedPageNumbers?: number[];
    };

interface PreparedSave {
  request: SaveRequest;
  blob: Blob;
  imageCount?: number;
}

function getDownloadFilename(downloadUrl: string): string {
  const pathname = new URL(downloadUrl, window.location.origin).pathname;
  const filename = pathname.split('/').pop();
  if (!filename) {
    throw new Error('下載網址缺少檔案名稱');
  }
  return decodeURIComponent(filename);
}

export function getSaveExtension(request: SaveRequest): string {
  return request.kind === 'pdf' ? '.pdf' : '.zip';
}

function getSaveFileOptions(request: SaveRequest): NativeSaveFileOptions {
  if (request.kind === 'pdf') {
    return {
      suggestedName: request.suggestedName,
      description: 'PDF 文件',
      mimeType: 'application/pdf',
      extension: '.pdf',
    };
  }

  return {
    suggestedName: request.suggestedName,
    description: '圖片 ZIP 壓縮檔',
    mimeType: 'application/zip',
    extension: '.zip',
  };
}

function getSaveFailureMessage(request: SaveRequest): string {
  return request.kind === 'pdf' ? '下載 PDF 失敗。' : '轉換或下載圖片失敗。';
}

function getSaveSuccessMessage(
  preparedSave: PreparedSave,
  destination: FileDestination,
): string {
  const filename = getDestinationFilename(destination);
  if (preparedSave.request.kind === 'pdf') {
    return destination.kind === 'native'
      ? `PDF 已儲存為「${filename}」。`
      : `已開始下載 PDF「${filename}」。`;
  }

  return destination.kind === 'native'
    ? `轉換成功！已將 ${preparedSave.imageCount} 張圖片儲存為「${filename}」。`
    : `轉換成功！已開始下載包含 ${preparedSave.imageCount} 張圖片的「${filename}」。`;
}

async function prepareSave(request: SaveRequest): Promise<PreparedSave> {
  if (request.kind === 'pdf') {
    return {
      request,
      blob: await downloadPDF(request.pdfId),
    };
  }

  const response = await convertToImage(
    request.pdfId,
    request.format,
    request.dpi,
    request.selectedPageNumbers ? 'selected' : 'all',
    request.selectedPageNumbers,
  );
  return {
    request,
    // 伺服器會在 ZIP 下載完成後刪除它，因此這裡先保留在記憶體中。
    blob: await downloadFile(getDownloadFilename(response.zipUrl)),
    imageCount: response.imageCount,
  };
}

/**
 * 另存流程：先向伺服器取得檔案，再讓使用者確認檔名與儲存位置。
 */
export function useFileSave(
  { runTask }: Status,
  onSaved?: (request: SaveRequest) => void,
) {
  const [pendingSave, setPendingSave] = useState<PreparedSave | null>(null);

  const beginSave = (request: SaveRequest) => runTask(async () => {
    setPendingSave(await prepareSave(request));
    return null;
  }, getSaveFailureMessage(request));

  const completeSave = async (filename: string) => {
    if (!pendingSave) return;

    const preparedSave: PreparedSave = {
      ...pendingSave,
      request: { ...pendingSave.request, suggestedName: filename },
    };

    await runTask(async () => {
      let destination: FileDestination = { kind: 'browser', filename };
      if (canUseNativeSaveFilePicker()) {
        const selection = await chooseNativeSaveFile(
          getSaveFileOptions(preparedSave.request),
        );
        if (selection.status === 'cancelled') {
          return null;
        }
        if (selection.status === 'selected') {
          destination = { kind: 'native', handle: selection.handle };
        }
      }

      await saveBlobToDestination(preparedSave.blob, destination);
      setPendingSave(null);
      onSaved?.(preparedSave.request);
      return getSaveSuccessMessage(preparedSave, destination);
    }, getSaveFailureMessage(preparedSave.request));
  };

  return {
    pendingRequest: pendingSave?.request ?? null,
    beginSave,
    completeSave,
    cancelSave: () => setPendingSave(null),
  };
}
