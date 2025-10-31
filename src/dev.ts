// src/index.ts
import * as fs from "fs";
import * as path from "path";
import * as http from "http";
import sanitizeHtml from "sanitize-html";
import imagemin from "imagemin";
import imageminGifsicle from "imagemin-gifsicle";
import imageminMozjpeg from "imagemin-mozjpeg";
import imageminPngquant from "imagemin-pngquant";
import { marked } from "marked";

const mdDir = path.join(process.cwd(), "md");
const publicDir = path.join(process.cwd(), "public");
const imageDir = publicDir;
const PORT = 3000;

let allUsedImages: Set<string>;

interface NavItem {
  name: string;
  path: string;
  children?: NavItem[];
}

const prettifyName = (name: string): string => {
  const baseName = path.basename(name, ".md");
  if (baseName === "index") return "Home";
  return baseName.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
};

const buildNavTree = (dir: string, webPathPrefix: string): NavItem[] => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const navItems: NavItem[] = [];

  const files = entries.filter((e) => e.isFile() && e.name.endsWith(".md"));
  const dirs = entries.filter((e) => e.isDirectory());

  files.sort((a, b) => {
    if (a.name === "index.md") return -1;
    if (b.name === "index.md") return 1;
    return a.name.localeCompare(b.name);
  });
  dirs.sort((a, b) => a.name.localeCompare(b.name));

  for (const file of files) {
    navItems.push({
      name: prettifyName(file.name),
      path: `${webPathPrefix}${file.name.replace(/\.md$/, ".html")}`,
    });
  }

  for (const subDir of dirs) {
    const children = buildNavTree(
      path.join(dir, subDir.name),
      `${webPathPrefix}${subDir.name}/`
    );
    if (children.length > 0) {
      const indexPage = children.find(
        (child) => path.basename(child.path) === "index.html"
      );
      navItems.push({
        name: prettifyName(subDir.name),
        path: indexPage ? indexPage.path : "#",
        children: children,
      });
    }
  }

  return navItems;
};

const generateSidebarHtml = (
  navTree: NavItem[],
  currentPagePath: string
): string => {
  let html = "<ul>";
  for (const item of navTree) {
    const isActive = item.path === currentPagePath;
    html += `<li><a href="${item.path}" class="${isActive ? "active" : ""}">${
      item.name
    }</a>`;
    if (item.children && item.children.length > 0) {
      html += generateSidebarHtml(item.children, currentPagePath);
    }
    html += "</li>";
  }
  html += "</ul>";
  return html;
};

const processMarkdownImages = async (
  markdown: string,
  withLiveReload: boolean
): Promise<string> => {
  const imageUrlRegex = /!\[(.*?)\]\((https?:\/\/.*?)\)/g;
  const matches = [...markdown.matchAll(imageUrlRegex)];
  let processedMarkdown = markdown;

  for (const match of matches) {
    const fullMatch = match[0];
    const altText = match[1];
    const remoteUrl = match[2];

    if (!remoteUrl) continue;

    try {
      const url = new URL(remoteUrl);
      const filename = path.basename(url.pathname);
      const localFilePath = path.join(imageDir, filename);

      allUsedImages.add(localFilePath);

      if (!fs.existsSync(localFilePath)) {
        console.log(`- Downloading image: ${remoteUrl}`);
        const response = await fetch(remoteUrl);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch ${remoteUrl}: ${response.statusText}`
          );
        }
        const buffer = Buffer.from(await response.arrayBuffer());

        const compressedBuffer = await imagemin.buffer(buffer, {
          plugins: [
            imageminMozjpeg({ quality: 80 }),
            imageminPngquant({ quality: [0.6, 0.8] }),
            imageminGifsicle({ optimizationLevel: 2 }),
          ],
        });

        fs.writeFileSync(localFilePath, compressedBuffer);
        console.log(
          `  -> Saved to: ${path.relative(process.cwd(), localFilePath)}`
        );
      }

      const webPath = withLiveReload
        ? `http://localhost:${PORT}/${filename}`
        : `/${filename}`;
      const newImageTag = `![${altText}](${webPath})`;
      processedMarkdown = processedMarkdown.replace(fullMatch, newImageTag);
    } catch (error) {
      console.error(`Error processing image ${remoteUrl}:`, error);
    }
  }

  return processedMarkdown;
};

const renderer = new marked.Renderer();
renderer.image = ({
  href,
  title,
  text,
}: {
  href: string | null;
  title: string | null;
  text: string;
}) => {
  if (href === null) {
    return text;
  }
  let out = `<img loading="lazy" decoding="async" src="${href}" alt="${text}"`;
  if (title) {
    out += ` title="${title}"`;
  }
  out += "/>";
  return out;
};

marked.use({
  renderer,
  gfm: true,
  breaks: true,
});

const parseMarkdown = (markdown: string): string => {
  const html = marked.parse(markdown) as string;
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ["src", "alt", "title", "loading", "decoding"],
    },
  });
};

const createHtmlTemplate = (
  title: string,
  content: string,
  sidebarHtml: string,
  withLiveReload: boolean = false
): string => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"; line-height: 1.6; margin: 0; color: #333; }
        .container { display: flex; min-height: 100vh; }
        .sidebar { width: 220px; min-width: 220px; border-right: 1px solid #e0e0e0; padding: 2em; background-color: #f9f9f9; }
        .sidebar h2 { font-size: 1.1em; margin-top: 0; margin-bottom: 1em; color: #555; text-transform: uppercase; letter-spacing: 0.5px; }
        .sidebar ul { list-style: none; padding: 0; margin: 0; }
        .sidebar ul ul { padding-left: 1em; border-left: 1px solid #eee; margin-left: 0.2em; margin-top: 0.5em;}
        .sidebar li { margin-bottom: 0.5em; }
        .sidebar a { color: #333; text-decoration: none; display: block; padding: 0.2em 0; border-radius: 4px; transition: background-color 0.2s, color 0.2s; }
        .sidebar a:hover { color: #007bff; }
        .sidebar a.active { font-weight: bold; color: #007bff; }
        main { flex-grow: 1; padding: 2em 3em; max-width: 800px; }
        main img { max-width: 100%; height: auto; border-radius: 4px; }
        h1, h2, h3 { line-height: 1.2; }
        pre { background: #f4f4f4; padding: 1em; border-radius: 5px; overflow-x: auto; border: 1px solid #ddd; }
        code { font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace; }
        a { color: #007bff; text-decoration: none; }
        a:hover { text-decoration: underline; }
        p { margin-bottom: 1em; }
    </style>
</head>
<body>
    <div class="container">
        <aside class="sidebar">
            <h2>Navigation</h2>
            ${sidebarHtml}
        </aside>
        <main>
${content}
        </main>
    </div>
    ${
      withLiveReload
        ? `
    <script>
        const evtSource = new EventSource("/__livereload__");
        evtSource.onmessage = function(event) {
            if (event.data === 'reload') {
                console.log('Reloading page...');
                window.location.reload();
            }
        };
        evtSource.onerror = function() {
            console.log("Live reload connection error. Retrying...");
        };
    </script>
    `
        : ""
    }
</body>
</html>`;

const cleanupOrphanedImages = () => {
  console.log("Cleaning up orphaned images...");
  if (!fs.existsSync(imageDir)) return;

  const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"];
  const filesInDir = fs.readdirSync(imageDir);

  for (const file of filesInDir) {
    const fullPath = path.join(imageDir, file);
    if (imageExtensions.includes(path.extname(file).toLowerCase())) {
      if (!allUsedImages.has(fullPath)) {
        console.log(
          `- Deleting orphaned image: ${path.relative(process.cwd(), fullPath)}`
        );
        fs.unlinkSync(fullPath);
      }
    }
  }
  console.log("Cleanup complete.");
};

const compile = async (withLiveReload: boolean = false) => {
  console.log("Building static pages...");
  allUsedImages = new Set<string>();

  if (!fs.existsSync(mdDir)) {
    console.log(
      "-> No 'md' directory found. Creating one with an example file."
    );
    fs.mkdirSync(mdDir, { recursive: true });
    fs.writeFileSync(
      path.join(mdDir, "index.md"),
      "# Hello World\n\nThis is your first page.\n\nEdit `md/index.md` to see changes."
    );
  }

  if (fs.existsSync(publicDir) && !withLiveReload) {
    fs.rmSync(publicDir, { recursive: true, force: true });
  }
  fs.mkdirSync(publicDir, { recursive: true });

  const navTree = buildNavTree(mdDir, "/");

  const processFiles = async (
    dir: string,
    outBaseDir: string,
    webPathPrefix: string
  ) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const newOutDir = path.join(outBaseDir, entry.name);
        fs.mkdirSync(newOutDir, { recursive: true });
        await processFiles(
          fullPath,
          newOutDir,
          `${webPathPrefix}${entry.name}/`
        );
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        let markdownContent = fs.readFileSync(fullPath, "utf-8");
        markdownContent = await processMarkdownImages(
          markdownContent,
          withLiveReload
        );

        const htmlContent = parseMarkdown(markdownContent);
        const title = prettifyName(entry.name);

        const outFileName = entry.name.replace(/\.md$/, ".html");
        const currentPagePath = `${webPathPrefix}${outFileName}`;

        const sidebarHtml = generateSidebarHtml(navTree, currentPagePath);
        const finalHtml = createHtmlTemplate(
          title,
          htmlContent,
          sidebarHtml,
          withLiveReload
        );

        const outFilePath = path.join(outBaseDir, outFileName);
        fs.writeFileSync(outFilePath, finalHtml);
        console.log(
          `- Generated: ${path.relative(process.cwd(), outFilePath)}`
        );
      }
    }
  };

  await processFiles(mdDir, publicDir, "/");
  cleanupOrphanedImages();
  console.log("Build complete!");
};

let liveReloadClients: http.ServerResponse[] = [];

const triggerReload = () => {
  for (const res of liveReloadClients) {
    if (!res.writableEnded) {
      res.write("data: reload\n\n");
    }
  }
};

const debounce = <F extends (...args: any[]) => any>(
  func: F,
  waitFor: number
) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<F>): Promise<ReturnType<F>> =>
    new Promise((resolve) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => resolve(func(...args)), waitFor);
    });
};

const handleRebuild = debounce(async () => {
  console.log("\nChanges detected, rebuilding...");
  try {
    await compile(true);
    triggerReload();
  } catch (error) {
    console.error("Build failed:", error);
  }
}, 100);

const startDevServer = () => {
  const server = http.createServer((req, res) => {
    const url = req.url || "/";
    if (url === "/__livereload__") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      liveReloadClients.push(res);
      req.on("close", () => {
        liveReloadClients = liveReloadClients.filter(
          (client) => client !== res
        );
      });
      return;
    }

    let filePath = path.join(publicDir, url);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    const ext = path.extname(filePath);
    const contentTypes: { [key: string]: string } = {
      ".html": "text/html",
      ".css": "text/css",
      ".js": "application/javascript",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".svg": "image/svg+xml",
      ".webp": "image/webp",
    };
    const contentType = contentTypes[ext] || "application/octet-stream";

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("404 Not Found");
      } else {
        res.writeHead(200, { "Content-Type": contentType });
        res.end(content);
      }
    });
  });

  server
    .listen(PORT, () => {
      console.log(`\nDevelopment server running at http://localhost:${PORT}`);
      console.log("Watching for changes in ./md...");
    })
    .on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        console.error(`Error: Port ${PORT} is already in use.`);
        process.exit(1);
      } else {
        console.error(err);
      }
    });
};

const watchFiles = () => {
  if (!fs.existsSync(mdDir)) return;
  fs.watch(mdDir, { recursive: true }, (eventType, filename) => {
    if (filename) {
      handleRebuild();
    }
  });
};

const runDev = async () => {
  await compile(true);
  startDevServer();
  watchFiles();
};

const runBuild = async () => {
  await compile(false);
};

const main = () => {
  const command = process.argv[2];

  if (command === "dev") {
    runDev().catch((err) => {
      console.error(err);
      process.exit(1);
    });
  } else if (command === "build") {
    runBuild().catch((err) => {
      console.error(err);
      process.exit(1);
    });
  } else {
    console.log("Usage:");
    console.log("  npm run dev    - Start dev server with live reload");
    console.log("  npm run build  - Build static pages for production");
  }
};

main();

