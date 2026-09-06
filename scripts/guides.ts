import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const publicRoot = resolve(root, "apps/gallery/public");
const origin = "https://axel-rock.github.io/models";
const escape = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const code = (value: string) => `<pre tabindex="0"><code>${escape(value)}</code></pre>`;
const guides = [
  {
    slug: "sveltekit-model-selector",
    title: "A SvelteKit AI model selector",
    description:
      "Add a live model catalog and a copyable composer to SvelteKit. Browser registration, loading, retry, and cleanup included.",
    starter: "sveltekit",
    file: "src/routes/+page.svelte",
    explanation:
      "The component registers in onMount so server rendering does not access browser globals. It aborts catalog discovery and removes listeners when the page unmounts. The copied UI lives in src/lib/ui; edit it like the rest of your app.",
  },
  {
    slug: "openrouter-model-selector",
    title: "An OpenRouter model selector",
    description:
      "Search a live OpenRouter catalog, choose model settings, and read the selection in plain JavaScript.",
    starter: "vanilla",
    file: "index.html",
    explanation:
      "The public OpenRouter model catalog needs no API key. This example emits the selected model and validated options. Your server remains responsible for authentication and sending requests. Discovery failures have a visible retry action.",
  },
  {
    slug: "ai-sdk-model-settings",
    title: "Model settings for AI SDK",
    description:
      "Turn a Models selection into AI SDK 7 call options, with explicit mapping warnings.",
    starter: "ai-sdk",
    file: "index.mjs",
    explanation:
      "The bridge constructs an AI SDK model and maps provider settings. This runnable example prints the mapping without sending a generation request. Check warnings before using the options: an unsupported mapping must stay visible. For generation, pass prepared.model and prepared.callOptions to generateText on your server with your own credentials.",
  },
];

/** Build crawlable guides and complete starters from the same source files. */
export async function buildGuides(): Promise<void> {
  const ui = JSON.parse(
    await readFile(resolve(publicRoot, "distribution/ui-source.json"), "utf8"),
  ) as { files: { path: string; content: string }[] };
  const packageExample = await readFile(
    resolve(publicRoot, "distribution/package-example.html"),
    "utf8",
  );
  for (const guide of guides) {
    const destination = resolve(publicRoot, "distribution/starters", guide.starter);
    await mkdir(destination, { recursive: true });
    await cp(resolve(root, "examples", guide.starter), destination, { recursive: true });
    if (guide.starter === "vanilla")
      await writeFile(
        resolve(destination, "index.html"),
        packageExample.replaceAll("vercelGatewayAdapter", "openRouterAdapter"),
      );
    if (guide.starter !== "ai-sdk") {
      for (const file of ui.files) {
        const path = resolve(
          destination,
          guide.starter === "sveltekit" ? "src/lib" : ".",
          file.path,
        );
        await mkdir(resolve(path, ".."), { recursive: true });
        await writeFile(path, file.content);
      }
    }
    await cp(
      resolve(publicRoot, "distribution/LICENSES.txt"),
      resolve(destination, "LICENSES.txt"),
    );
    execFileSync("tar", ["-czf", `${destination}.tar.gz`, "-C", destination, "."]);
    const source = await readFile(resolve(destination, guide.file), "utf8");
    const files: { path: string; content: string }[] = [];
    async function collect(directory: string, prefix = ""): Promise<void> {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = prefix + entry.name;
        if (entry.isDirectory()) await collect(resolve(directory, entry.name), `${path}/`);
        else files.push({ path, content: await readFile(resolve(directory, entry.name), "utf8") });
      }
    }
    await collect(destination);
    await writeFile(
      `${destination}.json`,
      JSON.stringify({
        description: "Complete starter. Preserve paths and license notices.",
        files,
      }),
    );
    await page(
      guide.slug,
      guide.title,
      guide.description,
      `<p>${guide.explanation}</p><h2>Run it locally</h2><p>Node.js 22.12 or newer. Download and extract the starter, then run these commands in its folder.</p>${code(`npm install\nnpm ${guide.starter === "ai-sdk" ? "start" : "run dev"}`)}<p><a href="../../distribution/starters/${guide.starter}.tar.gz" download>Download complete starter ↓</a> · <a href="../../distribution/starters/${guide.starter}.json">All source files for agents</a></p><h2>${escape(guide.file)}</h2>${code(source)}<h2>Make it yours</h2><p>${guide.starter === "ai-sdk" ? "Resolve the incoming model ID against your server catalog and validate its options. Do not trust model objects sent by the browser." : "Keep the UI files in your project. Change the styles, choose which option groups appear, and handle the selection event. Provider API keys belong on your server."}</p><p><a href="../../#panel-composer">Try the Models playground →</a></p>`,
    );
  }
  const { icons } = JSON.parse(
    await readFile(resolve(publicRoot, "distribution/icons.json"), "utf8"),
  ) as { icons: { id: string; name: string; color: string; monochrome: string }[] };
  await page(
    "ai-provider-icons",
    "AI provider icons: color and monochrome SVGs",
    "Browse 46 AI provider and model brand marks. Direct SVG files, a JSON index, and clear LobeHub attribution.",
    `<p>Use these SVG files in a model selector, chat interface, or provider settings page. Save files locally. Each icon has a stable ID and both color and monochrome variants.</p><p>Artwork comes from <a href="https://github.com/lobehub/lobe-icons">LobeHub</a>. Preserve the <a href="../../distribution/LICENSES.txt">license notices</a>. Brand marks remain the property of their owners; inclusion does not imply endorsement or a provider integration.</p><p><a href="../../distribution/icons.json">Get the complete JSON index →</a></p><ul class="icons">${icons.map((icon) => `<li><img src="../../distribution/${icon.color}" alt="" width="24" height="24" loading="lazy" /><strong>${escape(icon.name)}</strong><code>${escape(icon.id)}</code><a href="../../distribution/${icon.color}" download aria-label="${escape(icon.name)} color SVG">Color</a><a href="../../distribution/${icon.monochrome}" download aria-label="${escape(icon.name)} monochrome SVG">B&amp;W</a></li>`).join("")}</ul><h2>For agents</h2><p>Read icons.json, match the stable ID, and resolve SVG paths relative to that JSON file. Save the chosen SVG and LICENSES.txt in the target project.</p><p><a href="../../#icons">Search and copy icons in the playground →</a></p>`,
  );
  const links = [
    ...guides,
    {
      slug: "ai-provider-icons",
      title: "AI provider icons",
      description: "46 brand marks, both styles, direct SVGs and a JSON index.",
    },
  ];
  await page(
    "",
    "Build with Models",
    "Runnable examples for SvelteKit, JavaScript, and AI SDK. Copy the interface, install the model tools.",
    `<ul class="guides">${links.map((g) => `<li><a href="./${g.slug}/">${g.title} →</a><p>${g.description}</p></li>`).join("")}</ul>`,
  );
  const urls = ["/", "/guides/", ...links.map((g) => `/guides/${g.slug}/`)];
  await writeFile(
    resolve(publicRoot, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((path) => `<url><loc>${origin}${path}</loc></url>`).join("")}</urlset>\n`,
  );
}

async function page(slug: string, title: string, description: string, body: string): Promise<void> {
  const prefix = slug ? "../../" : "../";
  const canonical = `${origin}/guides/${slug ? `${slug}/` : ""}`;
  const directory = resolve(publicRoot, "guides", slug);
  await mkdir(directory, { recursive: true });
  await writeFile(
    resolve(directory, "index.html"),
    `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} | Models</title><meta name="description" content="${escape(description)}"><link rel="canonical" href="${canonical}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${canonical}"><meta property="og:type" content="article"><meta name="twitter:card" content="summary"><style>
:root{color-scheme:light dark;font:15px/1.65 system-ui;color:#242528;background:#fafafa}*{box-sizing:border-box}body{max-width:840px;margin:0 auto;padding:24px}nav{display:flex;gap:24px;align-items:center;padding:8px 0 28px;border-bottom:1px solid #ddd}nav a:first-child{margin-right:auto;font-weight:650}a{color:inherit;text-underline-offset:4px}nav a{text-decoration:none}main{padding:48px 0}h1{font-size:clamp(28px,5vw,42px);line-height:1.15;letter-spacing:-.045em}h2{font-size:20px;margin-top:40px}p{color:#65656b}pre{padding:20px;background:#f0f0f2;overflow:auto;font:13px/1.6 ui-monospace,monospace;border-radius:8px}code{font-size:.9em}footer{padding:24px 0;border-top:1px solid #ddd}.guides,.icons{list-style:none;padding:0}.guides li{padding:24px 0;border-bottom:1px solid #ddd}.guides a{font-size:20px;font-weight:600}.icons li{display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:14px 0;border-bottom:1px solid #ddd}.icons strong{flex:1;min-width:120px}.icons code{color:#777}@media(prefers-color-scheme:dark){:root{background:#17181a;color:#eee}p{color:#aaa}pre{background:#222326}nav,footer,.guides li,.icons li{border-color:#35363a}}:focus-visible{outline:2px solid currentColor;outline-offset:4px}
</style></head><body><nav aria-label="Main navigation"><a href="${prefix}">Models</a><a href="${prefix}guides/">Guides</a><a href="https://github.com/axel-rock/models">GitHub ↗</a></nav><main><h1>${escape(title)}</h1><p>${escape(description)}</p>${body}</main><footer><a href="${prefix}llms.txt">Agent instructions</a> · <a href="https://www.npmjs.com/package/@axelrock/models">npm</a> · MIT</footer></body></html>`,
  );
}
