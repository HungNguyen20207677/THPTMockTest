export interface ApiSuccessResponse<TData> {
  data: TData;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}
