/**
 * Custom error thrown inside database transactions to trigger a clean rollback.
 * Caught by service functions to return formatted error responses to callers.
 */
export class TxAbortError extends Error {
  public readonly status: number;
  public readonly code?: string;

  constructor(message: string, status: number = 400, code?: string) {
    super(message);
    this.name = "TxAbortError";
    this.status = status;
    this.code = code;
    Object.setPrototypeOf(this, TxAbortError.prototype);
  }
}
