type AttemptLimitSettings = {
  allowRetake?: boolean;
  maxAttempts?: number | null;
};

export function resolveExamMaxAttempts(
  settings: AttemptLimitSettings,
): number | null {
  if (settings.maxAttempts !== undefined) {
    return settings.maxAttempts;
  }

  return settings.allowRetake === false ? 1 : null;
}

export function normalizeExamSettings<TSettings extends AttemptLimitSettings>(
  settings: TSettings,
): TSettings & { allowRetake: boolean; maxAttempts?: number | null } {
  const maxAttempts = resolveExamMaxAttempts(settings);

  return {
    ...settings,
    allowRetake: maxAttempts === null || maxAttempts > 1,
    maxAttempts,
  };
}
