export interface ConfirmedExamStartOptions<T> {
  wasDocumentFullscreen: boolean;
  requestFullscreen: () => Promise<boolean>;
  startAttempt: () => Promise<T>;
  exitFullscreen: () => Promise<boolean>;
}

export function createConfirmedExamStart<T>({
  wasDocumentFullscreen,
  requestFullscreen,
  startAttempt,
  exitFullscreen,
}: ConfirmedExamStartOptions<T>): () => Promise<T> {
  return async () => {
    const enteredFullscreen = await requestFullscreen();

    try {
      return await startAttempt();
    } catch (error) {
      if (!wasDocumentFullscreen && enteredFullscreen) {
        await exitFullscreen();
      }

      throw error;
    }
  };
}
