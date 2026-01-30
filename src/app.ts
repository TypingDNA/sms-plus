import express, { Request, Response, NextFunction } from 'express';
import routes from './routes';
import hookRoutes from './routes/hooks';
import path from 'path';
import { logger } from './resources';

export const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/static', express.static(path.join(__dirname, './public')));
app.use('/favicon.ico', express.static(path.join(__dirname, 'public/favicon.ico')));

// Core application routes
app.use('/', routes);

// Dynamic bridge hook routes
app.use('/hooks', hookRoutes);

// Page not found
app.use(function (req: Request, res: Response) {
    res.status(404).json({ error: 'Not found' });
});

// Internal server error
app.use(function (err: any, req: Request, res: Response, next: NextFunction) {
    logger.error({
        userId: 'system',
        message: 'Internal server error:',
        error: err?.message,
        httpStatus: 500,
    });

    return res.status(500).json({ error: 'Internal server error' });
});
