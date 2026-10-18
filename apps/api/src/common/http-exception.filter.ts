import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = isHttpException ? exception.getResponse() : undefined;
    const details = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {};
    const message = details.message ?? (isHttpException ? payload : 'An unexpected server error occurred.');

    response.status(status).json({
      errorCode: details.error ?? (isHttpException ? 'HTTP_ERROR' : 'INTERNAL_SERVER_ERROR'),
      message,
      path: request.url,
      statusCode: status,
      timestamp: new Date().toISOString(),
    });
  }
}
