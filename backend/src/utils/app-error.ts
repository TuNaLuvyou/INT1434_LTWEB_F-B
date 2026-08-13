export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public data?: any
  ) {
    super(message);
    // Restore prototype chain
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
