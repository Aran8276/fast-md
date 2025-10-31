// src/index.ts
import express from 'express';
import path from 'path';
import compression from 'compression';
import helmet from 'helmet';

const app = express();
const port = process.env.PORT || 3000;
const publicDirectoryPath = path.join(__dirname, '..', 'public');
const oneYearInSeconds = 31536000;

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "script-src": ["'self'"],
            "img-src": ["'self'", "data:"],
        },
    },
}));

app.use(compression());

app.use(express.static(publicDirectoryPath, {
    maxAge: `${oneYearInSeconds}s`,
    immutable: true,
    setHeaders: (res, filePath) => {
        const fileExtension = path.extname(filePath);
        if (fileExtension === '.html') {
            res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        }
    },
}));

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});