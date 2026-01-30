import { Request, Response } from 'express';

export interface IAMBridge {
    id: string;
    name: string;
    version: string;
    enabled: boolean;

    isAuthorized(req: Request): boolean;
    getPhoneNumber(req: Request): string;
    getOtpMessage(req: Request): string;
    extractOtpFromMessage(message: string): string | null;
    handleSuccess(req: Request, res: Response, cid: string | undefined): void;
    handleError(res: Response, error: Error): void;
    handleTest(res: Response): void;
    isTest(message: string): boolean;
}
