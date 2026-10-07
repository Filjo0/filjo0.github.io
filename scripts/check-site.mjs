import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const textFiles = ['index.html', 'resume.html', 'styles.css', 'studio.css', 'script.js', 'README.md', 'AGENTS.md'];
const htmlFiles = ['index.html', 'resume.html'];
const requiredFiles = [
  ...textFiles,
  '.nojekyll',
  'assets/hero-workspace.jpg',
  'assets/studio-workspace.webp',
  'assets/Philipp_Alimov_Resume.pdf',
];
const failures = [];

const fail = (message) => failures.push(message);
for (const path of requiredFiles) {
  if (!existsSync(resolve(root, path))) fail(`Missing required file: ${path}`);
}

const contents = new Map(
  textFiles
    .filter((path) => existsSync(resolve(root, path)))
    .map((path) => [path, readFileSync(resolve(root, path), 'utf8')]),
);

const index = contents.get('index.html') || '';
const resume = contents.get('resume.html') || '';
const allText = [...contents.values()].join('\n');
const emailMatches = allText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
const approvedEmails = new Set(['philalimov.apps@gmail.com', 'philalimov@gmail.com']);
const unexpectedEmails = [...new Set(emailMatches)].filter(
  (email) => !approvedEmails.has(email.toLowerCase()),
);
if (unexpectedEmails.length) fail(`Unexpected public email address: ${unexpectedEmails.join(', ')}`);
if (!index.includes('mailto:philalimov.apps@gmail.com')) fail('Portfolio business contact email is missing.');
if (index.includes('mailto:philalimov@gmail.com')) fail('Personal resume email appears on the portfolio page.');
if (!resume.includes('mailto:philalimov@gmail.com')) fail('Original resume email is missing.');
if (resume.includes('mailto:philalimov.apps@gmail.com')) fail('Business contact email appears in the resume.');
if (!index.includes('<h3>FUTSL</h3>')) fail('The FUTSL portfolio project is missing.');
if (!resume.includes('<p class="entry-title">FUTSL</p>')) fail('The FUTSL resume project is missing.');
if (/Perth Futsal/i.test(`${index}\n${resume}`)) fail('Former FUTSL product branding appears in the public portfolio.');
if (/\b(?:\+?61[ -]?)?0?4\d{2}[ -]?\d{3}[ -]?\d{3}\b/.test(allText)) {
  fail('A personal phone number appears in the public site.');
}
if (/[A-Z]:\\Users\\/i.test(allText)) fail('An absolute local Windows path appears in the public site.');
if (/private_inputs|Personality Library/i.test(allText)) {
  fail('A private source or private-library reference appears in the public site.');
}

for (const path of htmlFiles) {
  const html = contents.get(path) || '';
  const h1Count = (html.match(/<h1\b/gi) || []).length;
  if (h1Count !== 1) fail(`${path} must contain exactly one h1; found ${h1Count}.`);
  if (!/<meta name="description" content="[^"]+">/i.test(html)) {
    fail(`${path} is missing a meta description.`);
  }
  if (!/class="skip-link"/i.test(html)) fail(`${path} is missing its skip link.`);

  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/gi)) {
    const reference = match[1];
    if (/^(?:https?:|mailto:|#)/i.test(reference)) continue;
    const withoutFragment = reference.split('#')[0].split('?')[0];
    if (!withoutFragment) continue;
    const target = resolve(root, withoutFragment);
    if (!existsSync(target)) fail(`${path} references missing local file: ${reference}`);
  }

  for (const match of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/gi)) {
    if (!/rel="[^"]*noopener[^"]*"/i.test(match[0])) {
      fail(`${path} has a target=_blank link without rel=noopener.`);
    }
  }
}

const unreleasedProject = ['perth', 'tennis'].join(' ');
if (allText.toLowerCase().includes(unreleasedProject)) fail('Unreleased project material appears in the public site.');
for (const sectionId of ['work', 'experience', 'capabilities', 'resume', 'contact']) {
  if (!index.includes(`id="${sectionId}"`)) fail(`index.html is missing #${sectionId}.`);
}

const styles = `${contents.get('styles.css') || ''}\n${contents.get('studio.css') || ''}`;
if (/linear-gradient|radial-gradient/i.test(styles)) fail('Decorative gradients are not part of the portfolio system.');
if (/letter-spacing:\s*-/i.test(styles)) fail('Negative letter spacing is not allowed.');

const pdfPath = resolve(root, 'assets/Philipp_Alimov_Resume.pdf');
if (existsSync(pdfPath) && statSync(pdfPath).size < 20_000) fail('Generated resume PDF is unexpectedly small.');

for (const path of requiredFiles.filter((value) => ['.png', '.jpg', '.webp', '.pdf'].includes(extname(value).toLowerCase()))) {
  if (existsSync(resolve(root, path)) && statSync(resolve(root, path)).size === 0) {
    fail(`Generated or copied asset is empty: ${path}`);
  }
}

if (failures.length) {
  console.error('Portfolio validation failed:');
  failures.forEach((message) => console.error(`- ${message}`));
  process.exit(1);
}

console.log(`Portfolio validation passed: ${requiredFiles.length} files, ${emailMatches.length} contact references.`);
