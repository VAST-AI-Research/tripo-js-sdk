/**
 * Error hierarchy for the Tripo3D SDK.
 *
 *   TripoError                — base class for all SDK errors
 *   ├── TripoRequestError     — transport/network/HTTP-status failures
 *   ├── TripoAPIError         — well-formed error responses (non-zero `code`)
 *   ├── TripoTaskError        — task ended in `failed` / `cancelled` / `banned`
 *   └── TripoTimeoutError     — waitForTask exceeded its timeout budget
 */

export class TripoError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'TripoError';
    if (options.cause !== undefined) this.cause = options.cause;
  }
}

export class TripoRequestError extends TripoError {
  /**
   * @param {string} message
   * @param {{
   *   status?: number,
   *   statusText?: string,
   *   body?: unknown,
   *   cause?: unknown,
   *   indeterminate?: boolean,
   * }} [options]
   */
  constructor(message, { status, statusText, body, cause, indeterminate = false } = {}) {
    super(message, { cause });
    this.name = 'TripoRequestError';
    this.status = status;
    this.statusText = statusText;
    this.body = body;
    /**
     * True when the request may have been processed despite the failure.
     * Resubmitting a billed task-creation request in this state risks being
     * charged twice; reconcile against the task list first.
     */
    this.indeterminate = indeterminate;
  }
}

export class TripoAPIError extends TripoError {
  /**
   * @param {{ code: number, message?: string, suggestion?: string, status?: number }} payload
   */
  constructor({ code, message, suggestion, status }) {
    const parts = [`Tripo API error (code=${code})`];
    if (message) parts.push(message);
    if (suggestion) parts.push(`— ${suggestion}`);
    super(parts.join(': '));
    this.name = 'TripoAPIError';
    this.code = code;
    this.suggestion = suggestion;
    this.status = status;
  }
}

export class TripoTaskError extends TripoError {
  /**
   * @param {import('./types.js').Task} task
   */
  constructor(task) {
    const detail = task.error_message ?? task.error_msg;
    super(
      `Task ${task.task_id} ended with status "${task.status}"` +
        (detail ? `: ${detail}` : '') +
        (task.error_code !== undefined ? ` (error_code=${task.error_code})` : '')
    );
    this.name = 'TripoTaskError';
    this.task = task;
    this.status = task.status;
    this.errorCode = task.error_code;
    this.errorMessage = detail;
  }
}

export class TripoTimeoutError extends TripoError {
  constructor(taskId, timeoutMs) {
    super(`Timed out after ${timeoutMs}ms waiting for task ${taskId}`);
    this.name = 'TripoTimeoutError';
    this.taskId = taskId;
    this.timeoutMs = timeoutMs;
  }
}
