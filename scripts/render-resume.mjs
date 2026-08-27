import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const source = path.join(root, 'resume.html');
const output = path.join(root, 'assets', 'Philipp_Alimov_Resume.pdf');
const profile = path.join(os.tmpdir(), `philipp-resume-${process.pid}`);
const playwrightRoot = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
const playwrightCandidates = existsSync(playwrightRoot)
  ? readdirSync(playwrightRoot)
      .filter((name) => name.startsWith('chromium-'))
      .sort()
      .reverse()
      .flatMap((name) => [
        path.join(playwrightRoot, name, 'chrome-win64', 'chrome.exe'),
        path.join(playwrightRoot, name, 'chrome-win', 'chrome.exe'),
      ])
  : [];
const browserCandidates = [
  ...playwrightCandidates,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

const browser = browserCandidates.find((candidate) => existsSync(candidate));

if (!browser) throw new Error('Playwright Chromium or Microsoft Edge was not found.');

await mkdir(path.dirname(output), { recursive: true });
await mkdir(profile, { recursive: true });

try {
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-pdf-header-footer',
    `--user-data-dir=${profile}`,
    `--print-to-pdf=${output}`,
    pathToFileURL(source).href,
  ];
  const processResult = spawn(browser, args, { stdio: 'inherit', windowsHide: true });
  const exitCode = await new Promise((resolve, reject) => {
    processResult.once('error', reject);
    processResult.once('exit', resolve);
  });
  if (exitCode !== 0) throw new Error(`Edge exited with code ${exitCode}.`);

  const pdf = await readFile(output);
  if (!pdf.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error('Generated file is not a PDF.');
  const pageCount = (pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
  if (pageCount !== 2) throw new Error(`Expected a two-page resume, generated ${pageCount} pages.`);
  console.log(`Generated two-page resume: ${output}`);
} finally {
  await rm(profile, { recursive: true, force: true, maxRetries: 12, retryDelay: 200 });
}
