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
