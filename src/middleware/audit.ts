import { Request, Response, NextFunction } from 'express';
import { query } from '../config/db';

export const auditLog = (tableName: string, actionType: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const originalJson = res.json.bind(res);
    res.json = (data: unknown) => {
      if (req.user && res.statusCode < 400) {
        // Fire-and-forget audit log
        const recordId = req.params.id || (data as any)?.data?.id;
        query(
          `INSERT INTO audit_logs (user_id, action_type, table_name, record_id, new_values, ip_address, user_agent, description)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            req.user.userId,
            actionType,
            tableName,
            recordId || null,
            JSON.stringify(req.body),
            req.ip,
            req.headers['user-agent'] || '',
            `${req.method} ${req.path}`,
          ]
        ).catch(err => console.error('Audit log error:', err));
      }
      return originalJson(data);
    };
    next();
  };
};

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'حدث خطأ داخلي في الخادم',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
};
