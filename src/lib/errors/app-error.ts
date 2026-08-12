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

export class UnsupportedMediaTypeError extends AppError {
  constructor() {
    super(
      "Yêu cầu phải sử dụng định dạng application/json.",
      "UNSUPPORTED_MEDIA_TYPE",
      415,
    );
  }
}

export class RequestTooLargeError extends AppError {
  constructor() {
    super("Nội dung yêu cầu quá lớn.", "REQUEST_TOO_LARGE", 413);
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

export class ExamPdfAlreadyAttachedError extends AppError {
  constructor() {
    super(
      "Tệp PDF này đã được gắn với một đề thi khác.",
      "EXAM_PDF_ALREADY_ATTACHED",
      409,
    );
  }
}

export class ExamPdfOperationConflictError extends AppError {
  constructor() {
    super(
      "Tệp PDF này đang được xử lý. Vui lòng thử lại.",
      "EXAM_PDF_OPERATION_CONFLICT",
      409,
    );
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

export class ExamNotPublishedError extends AppError {
  constructor() {
    super(
      "Đề thi hiện không mở cho lượt làm bài mới.",
      "EXAM_NOT_PUBLISHED",
      409,
    );
  }
}

export class ExamAttemptNotFoundError extends AppError {
  constructor() {
    super("Không tìm thấy lượt làm bài.", "EXAM_ATTEMPT_NOT_FOUND", 404);
  }
}

export class ExamRetakeNotAllowedError extends AppError {
  constructor() {
    super("Đề thi này không cho phép làm lại.", "EXAM_RETAKE_NOT_ALLOWED", 409);
  }
}

export class ExamAttemptConflictError extends AppError {
  constructor() {
    super(
      "Không thể tạo lượt làm bài lúc này. Vui lòng thử lại.",
      "EXAM_ATTEMPT_CONFLICT",
      409,
    );
  }
}

export class ExamContentLockedError extends AppError {
  constructor() {
    super(
      "Đề thi đã có lượt làm nên không thể thay đổi tệp PDF hoặc đáp án.",
      "EXAM_CONTENT_LOCKED",
      409,
    );
  }
}

export class ExamAttemptLockedError extends AppError {
  constructor() {
    super(
      "Lượt làm bài đã kết thúc nên không thể thay đổi câu trả lời.",
      "EXAM_ATTEMPT_LOCKED",
      409,
    );
  }
}

export class ExamAttemptStateConflictError extends AppError {
  constructor() {
    super(
      "Trạng thái lượt làm bài vừa thay đổi. Vui lòng tải lại trang.",
      "EXAM_ATTEMPT_STATE_CONFLICT",
      409,
    );
  }
}

export class ExamAttemptResultUnavailableError extends AppError {
  constructor() {
    super(
      "Lượt làm bài chưa kết thúc nên chưa có kết quả.",
      "EXAM_ATTEMPT_RESULT_UNAVAILABLE",
      409,
    );
  }
}
