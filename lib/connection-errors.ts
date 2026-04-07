type UiStatus = 'success' | 'error';

function messageFromUnknown(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function formatConnectionError(error: unknown): string {
  const message = messageFromUnknown(error);

  if (message.includes('401')) {
    return 'Unauthorized (401). Check the API key and Basic Auth credentials.';
  }

  if (message.includes('403')) {
    return 'Forbidden (403). Check API access rules and any proxy restrictions.';
  }

  if (
    message.includes('NetworkError when attempting to fetch resource')
    || message.includes('Failed to fetch')
  ) {
    return 'Could not reach qui. Check the server URL, DNS, TLS certificate, or proxy settings.';
  }

  if (message.toLowerCase().includes('timed out')) {
    return 'Request timed out. Check that the qui server is reachable and responding.';
  }

  return message;
}

export function getSaveConnectionResult(
  error: unknown | null,
): { status: UiStatus; message: string } {
  if (error === null) {
    return {
      status: 'success',
      message: 'Settings saved. Connected to qui.',
    };
  }

  return {
    status: 'error',
    message: `Settings saved, but connection failed: ${formatConnectionError(error)}`,
  };
}
