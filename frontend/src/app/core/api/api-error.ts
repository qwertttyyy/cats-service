export function extractApiError(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'Произошла ошибка. Попробуйте ещё раз.';
  }

  const maybeHttp = error as { error?: unknown; message?: unknown };
  const payload = maybeHttp.error;

  if (typeof payload === 'string' && payload.trim()) {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    const detail = (payload as Record<string, unknown>)['detail'];
    if (typeof detail === 'string') {
      return detail;
    }

    const firstKey = Object.keys(payload)[0];
    const firstValue = (payload as Record<string, unknown>)[firstKey];
    if (Array.isArray(firstValue) && firstValue.length > 0) {
      return `${firstKey}: ${String(firstValue[0])}`;
    }
    if (typeof firstValue === 'string') {
      return `${firstKey}: ${firstValue}`;
    }
  }

  if (typeof maybeHttp.message === 'string') {
    return maybeHttp.message;
  }

  return 'Произошла ошибка. Попробуйте ещё раз.';
}
