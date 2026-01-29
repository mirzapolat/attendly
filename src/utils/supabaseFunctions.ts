export type SupabaseFunctionError = {
  reason?: string;
  status?: number;
};

export const parseSupabaseFunctionError = async (error: unknown): Promise<SupabaseFunctionError> => {
  if (!error || typeof error !== 'object') return {};
  const maybeError = error as { context?: Response; status?: number };
  const status = maybeError.status ?? maybeError.context?.status;

  if (!maybeError.context) {
    return { status };
  }

  try {
    const body = await maybeError.context.clone().json();
    return { reason: body?.reason, status };
  } catch {
    return { status };
  }
};
