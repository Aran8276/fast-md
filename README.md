# fast-md

A plain and basic Markdown generator.

This project uses the following stack:

-   Node.js
-   TypeScript
-   Express
-   Marked
-   esbuild

## Resources

-   [Node.js](https://nodejs.org/)
-   [TypeScript](https://www.typescriptlang.org/)
-   [Express](https://expressjs.com/)
-   [Marked](https://marked.js.org/)
-   [esbuild](https://esbuild.github.io/)

## Getting Started

First, install the dependencies:

```bash
npm install
```

## Available Scripts

In the project directory, you can run:

### `npm run dev`

Runs the app in development mode with live reload.
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits to the markdown files in the `md` directory.

### `npm run dev:generate`

Builds the static HTML from the markdown without starting the dev server.
Perfect when trying to adjust something (e.g typos) quickly.

### `npm run dev:core`

Runs the app in development mode with live reload, **including the server files**.
Essentially the same as `npm run dev` but it also watches the TypeScript files.

Used when trying to contribute or debug the server.

### `npm run build`

Builds the optimized server for production to the `dist/bundle.js`.
It bundles and optimizes the assets for the best performance.

### `npm run start`

Runs the production server for the built static site.
This command should be executed after you have run `npm run build`.
