import axios from 'axios';

interface ApiErrorData {
  detail?: string | Array<{ msg?: string }>;
}

/** 取出後端回傳的錯誤訊息；無法辨識時使用 fallback。 */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiErrorData>(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string') {
      return detail;
    }
    if (Array.isArray(detail)) {
      const messages = detail
        .map((item) => item.msg)
        .filter((message): message is string => Boolean(message));
      if (messages.length > 0) {
        return messages.join('；');
      }
    }
  }
  return fallback;
}
