import { useCallback, useState } from 'react';
import { getErrorMessage } from '../utils/errors';

/**
 * 工作的結果：字串會顯示為成功訊息，null 表示成功但不需要訊息，
 * false 表示失敗且工作本身已設定錯誤訊息。
 */
export type TaskResult = string | null | false;

export interface Status {
  loading: boolean;
  error: string | null;
  success: string | null;
  setError: (message: string | null) => void;
  setSuccess: (message: string | null) => void;
  /** 執行非同步工作並管理 loading 與訊息；成功時回傳 true。 */
  runTask: (
    task: () => Promise<TaskResult>,
    fallbackError: string,
  ) => Promise<boolean>;
}

export function useStatus(): Status {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const runTask = useCallback(async (
    task: () => Promise<TaskResult>,
    fallbackError: string,
  ) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await task();
      if (result === false) {
        return false;
      }
      if (result) {
        setSuccess(result);
      }
      return true;
    } catch (err) {
      setError(getErrorMessage(err, fallbackError));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, success, setError, setSuccess, runTask };
}
