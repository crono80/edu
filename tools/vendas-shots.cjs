#!/usr/bin/env node
// Recaptura as telas do MVP usadas na página de vendas (public/inss/img/*.webp) e atualiza
// width/height dos <img> em public/inss/index.html.
//
// Uso:
//   npm run build && npm run preview        # em outro terminal (porta 4173)
//   npm run shots:vendas                    # ou: node tools/vendas-shots.cjs http://localhost:4173
//
// Requer Playwright com Chromium (já instalado no ambiente cloud do Claude Code; fora dele,
// `npm i -g playwright && npx playwright install chromium`).
// Estado fixo para os números baterem com o texto da página: INSS, hoje = 17/11/2026 (Brasília),
// Português forte, Seguridade Social fraca, "Reajustar" → 13h/semana.
const { chromium, devices } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = (process.argv[2] || "http://localhost:4173").replace(/\/$/, "");
const APP_URL = `${BASE}/app/?concurso=inss-tecnico-pre`;
const OUT = path.join(__dirname, "..", "public", "inss", "img");
const HTML = path.join(__dirname, "..", "public", "inss", "index.html");
const TZ = "America/Sao_Paulo";
const DAY1 = new Date("2026-11-17T10:00:00-03:00");
const DAY3 = new Date("2026-11-19T10:00:00-03:00");
// Largura final de cada WebP.
const WIDTH = { vantagem: 1600, "vantagem-resumo": 1000, tempo: 1600, agenda: 1600, progresso: 1500, simulado: 1500, top80: 1500, celular: 780 };

const rect = (loc) =>
  loc.evaluate((e) => {
    const r = e.getBoundingClientRect();
    return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height };
  });

async function open(ctx, now) {
  const page = await ctx.newPage();
  await page.clock.setFixedTime(now);
  await page.goto(APP_URL);
  await page.waitForSelector("#cronograma .cg-block");
  return page;
}

async function level(page) {
  await page.locator('[aria-label="Seu nível em Língua Portuguesa"] button', { hasText: "Forte" }).click();
  await page.locator('[aria-label="Seu nível em Seguridade Social e Custeio"] button', { hasText: "Fraco" }).click();
  await page.getByRole("button", { name: "Reajustar cronograma ao meu nível" }).click();
  await page.waitForTimeout(300);
}

// Cabeçalho e barras "sticky" ficam no fluxo para não aparecerem no meio dos prints.
const flatten = (page) =>
  page.addStyleTag({ content: "header, .sticky, .cg-header { position: static !important; }" });

const shotClip = (page, clip) => page.screenshot({ clip, fullPage: true });
const dayGrid = (page) => page.locator("#cronograma div.grid").filter({ has: page.locator("[data-today]") }).first();

async function desktop(browser) {
  const shots = {};
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 2, timezoneId: TZ, colorScheme: "light" });
  const page = await open(ctx, DAY1);
  await level(page);
  await flatten(page);
  shots.vantagem = await page.locator("#resultado").screenshot();
  const left = await rect(page.locator("#resultado .grid > div").first());
  shots["vantagem-resumo"] = await shotClip(page, { x: left.x - 16, y: left.y - 16, width: left.w + 32, height: left.h + 32 });
  shots.tempo = await page.locator("#prazo").screenshot();
  const ag = await rect(page.locator("#cronograma"));
  const grid = await rect(dayGrid(page));
  shots.agenda = await shotClip(page, { x: ag.x, y: ag.y, width: ag.w, height: grid.y + grid.h - ag.y });
  shots.top80 = await page.locator("#top80").screenshot();
  await page.getByRole("button", { name: "Fazer simulado" }).click();
  await page.waitForTimeout(200);
  shots.simulado = await page.locator("#nivelamento .cg-alt").first().locator("../..").screenshot();
  await ctx.close();
  return shots;
}

// Progresso: 2 blocos estudados no dia 17, aberto de novo no dia 19 (4 blocos atrasados).
async function progress(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2, timezoneId: TZ, colorScheme: "light" });
  const page = await open(ctx, DAY1);
  await level(page);
  const checks = page.locator("#cronograma").getByRole("button", { name: /Marcar como estudado/ });
  await checks.nth(0).click();
  await checks.nth(0).click();
  await page.clock.setFixedTime(DAY3);
  await page.reload();
  await page.waitForSelector("#cronograma .cg-block");
  await flatten(page);
  const panel = await rect(page.locator("#cronograma").getByRole("button", { name: "Reorganizar agenda" }).locator(".."));
  const firstRow = await dayGrid(page)
    .locator(":scope > div")
    .evaluateAll((els) => Math.max(...els.slice(0, 4).map((e) => e.getBoundingClientRect().bottom + scrollY)));
  const shot = await shotClip(page, { x: panel.x, y: panel.y, width: panel.w, height: firstRow - panel.y });
  await ctx.close();
  return { progresso: shot };
}

async function phone(browser) {
  const ctx = await browser.newContext({ ...devices["iPhone 13"], timezoneId: TZ, colorScheme: "light" });
  const page = await open(ctx, DAY1);
  await level(page);
  await flatten(page);
  const day = await rect(page.locator("#cronograma [data-today]").first());
  const shot = await shotClip(page, { x: 0, y: day.y - 16, width: 390, height: 760 });
  await ctx.close();
  return { celular: shot };
}

// PNG → WebP redimensionado, no próprio Chromium (sem dependências extras).
async function toWebp(browser, png, width) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const out = await page.evaluate(
    async ({ src, width }) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const height = Math.round((img.naturalHeight * width) / img.naturalWidth);
      const c = document.createElement("canvas");
      c.width = width;
      c.height = height;
      const g = c.getContext("2d");
      g.imageSmoothingQuality = "high";
      g.drawImage(img, 0, 0, width, height);
      return { data: c.toDataURL("image/webp", 0.82).split(",")[1], width, height };
    },
    { src: `data:image/png;base64,${png.toString("base64")}`, width },
  );
  await ctx.close();
  return out;
}

(async () => {
  const browser = await chromium.launch();
  const shots = { ...(await desktop(browser)), ...(await progress(browser)), ...(await phone(browser)) };
  let html = fs.readFileSync(HTML, "utf8");
  for (const [name, png] of Object.entries(shots)) {
    const { data, width, height } = await toWebp(browser, png, WIDTH[name]);
    const file = path.join(OUT, `${name}.webp`);
    fs.writeFileSync(file, Buffer.from(data, "base64"));
    const re = new RegExp(`(src="img/${name}\\.webp" width=")\\d+(" height=")\\d+(")`, "g");
    const before = html;
    html = html.replace(re, `$1${width}$2${height}$3`);
    console.log(`${name}.webp ${width}×${height} ${Math.round(fs.statSync(file).size / 1024)} KB${before === html ? "" : " (dimensões atualizadas no HTML)"}`);
  }
  fs.writeFileSync(HTML, html);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
