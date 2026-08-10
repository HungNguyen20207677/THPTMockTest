export class AppError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class AuthenticationRequiredError extends AppError {
  constructor() {
    super("Vui lòng đăng nhập để tiếp tục.", "UNAUTHENTICATED", 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Bạn không có quyền thực hiện thao tác này.") {
    super(message, "FORBIDDEN", 403);
  }
}

export class DuplicateUsernameError extends AppError {
  constructor() {
    super("Tên đăng nhập đã được sử dụng.", "USERNAME_EXISTS", 409);
  }
}

export class StudentNotFoundError extends AppError {
  constructor() {
    super("Không tìm thấy tài khoản học sinh.", "STUDENT_NOT_FOUND", 404);
  }
}

export class AdminAlreadyExistsError extends AppError {
  constructor() {
    super("Tài khoản quản trị ban đầu đã tồn tại.", "ADMIN_EXISTS", 409);
  }
}

export class RequestValidationError extends AppError {
  constructor(message = "Dữ liệu gửi lên không hợp lệ.") {
    super(message, "VALIDATION_ERROR", 400);
  }
}

export class ExamNotFoundError extends AppError {
  constructor() {
    super("Không tìm thấy đề thi.", "EXAM_NOT_FOUND", 404);
  }
}

export class ExamPublicationError extends AppError {
  constructor(message = "Đề thi chưa có đủ thông tin hợp lệ để xuất bản.") {
    super(message, "EXAM_NOT_READY", 422);
  }
}

export class ExamPdfValidationError extends AppError {
  constructor(message: string) {
    super(message, "INVALID_EXAM_PDF", 400);
  }
}

export class ExamPdfUploadError extends AppError {
  constructor() {
    super("Không thể lưu tệp PDF. Vui lòng thử lại.", "PDF_UPLOAD_FAILED", 502);
  }
}

export class ExamConflictError extends AppError {
  constructor() {
    super(
      "Đề thi đã được cập nhật ở nơi khác. Vui lòng tải lại trước khi lưu.",
      "EXAM_CONFLICT",
      409,
    );
  }
}

export class ExamPdfTooLargeError extends AppError {
  constructor() {
    super("Tệp PDF không được vượt quá 15 MB.", "PDF_TOO_LARGE", 413);
  }
}
