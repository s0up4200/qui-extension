type UiStatus = 'success' | 'error';

function messageFromUnknown(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function categoriesFailed(failedInstances: string[]): string {
  return `categories failed to load for: ${failedInstances.join(', ')}.`;
}

export function getSaveConnectionResult(
  error: unknown | null,
  failedInstances: string[] = [],
): { status: UiStatus; message: string } {
  if (error === null) {
    if (failedInstances.length > 0) {
      return {
        status: 'error',
        message: `Settings saved. Connected to qui, but ${categoriesFailed(failedInstances)}`,
      };
    }
    return {
      status: 'success',
      message: 'Settings saved. Connected to qui.',
    };
  }

  return {
    status: 'error',
    message: `Settings saved, but connection failed: ${messageFromUnknown(error)}`,
  };
}

export function getRefreshResult(
  failedInstances: string[],
): { status: UiStatus; message: string } {
  if (failedInstances.length > 0) {
    return { status: 'error', message: `Cache refreshed, but ${categoriesFailed(failedInstances)}` };
  }
  return { status: 'success', message: 'Cache refreshed' };
}
