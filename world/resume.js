// Read the approved local document; never maintain a second set of résumé facts.
let approved;
export async function mountResume(root, signal) {
  root.innerHTML = `<p class="world-resume-actions">
    <a href="resume.html" target="_blank" rel="noopener">Read or print résumé ↗</a></p>
    <p data-resume-loading>Loading résumé…</p>`;
  root.querySelectorAll('a').forEach(link => link.tabIndex = 0);
  try {
    approved ||= fetch(new URL('../resume.html', import.meta.url)).then(r => {
      if (!r.ok) throw Error('Résumé unavailable');
      return r.text();
    }).catch(e => {
      approved = null;
      throw e;
    });
    const text = await approved;
    if (signal.aborted) return;
    const doc = new DOMParser().parseFromString(text, 'text/html');
    const articles = doc.querySelectorAll('body > article.page');
    if (!articles.length) throw Error('Résumé document structure unavailable');
    const host = document.createElement('div');
    host.dataset.resumeDocument = '';
    const shadow = host.attachShadow({
        mode: 'open'
      }),
      style = document.createElement('style');
    style.textContent = doc.querySelector('style').textContent.replaceAll(':root', ':host') + `
      :host{display:block;font:15px/1.5 var(--font-ui);color:var(--color-ink);}
      .page{width:100%;max-width:none;height:auto;min-height:0;margin:0 0 16px;padding:0;box-shadow:none;border:0;}
      .page-grid{display:block;padding:0;gap:0;} .main-column{padding:0 16px 16px;} .sidebar{padding:16px;}
      .main-column{margin-bottom:20px;} .sidebar{padding:12px;height:auto;}
      .masthead,.compact-masthead{display:block;padding:16px;min-height:0;} .masthead .contact{margin-top:12px;}
      h1{font-size:27px;} .headline{font-size:18px;}
      .page :is(p,li,dd,address){font-size:15px;line-height:1.5;}
      .page>section{padding:16px;margin-bottom:16px;} .page .headline{font-size:18px;} .contact-line,.meta,.entry-description{font-size:15px;}
      a{overflow-wrap:anywhere;} .contact{padding:0;background:transparent;}
      .sidebar{background:var(--color-green-soft);}
      .side-label,.compact-list strong{display:block;margin-right:0;} .compact-list br{display:initial;}
      .language-list strong{display:inline;} .page-number{font-size:13px;}
      .contact-line{display:flex;flex-wrap:wrap;gap:0 16px;} .contact-line .separator{display:none;}
      .contact-item,.contact a{white-space:nowrap;} section{break-inside:auto;}
    `;
    shadow.append(style);
    const paper=document.body.dataset.worldNavigation==='objects';
    articles.forEach(article=>shadow.append(document.importNode(article,true)));
    host.dataset.layout='continuous';
    if(paper) {
      style.textContent+=' .page{background:transparent;overflow:visible;} .compact-masthead{display:none;}';
      style.textContent+=`@media(max-width:720px){
        .masthead,.compact-masthead{padding:12px;}h1{font-size:24px;}.page .headline{font-size:16px;}
        .page-grid{padding:0;}.main-column{padding:0 12px 12px;}section{margin-bottom:18px;}.sidebar{padding:12px;}
      }`;
    }
    // Explicit normal tab order also reaches links with WebKit's default keyboard preference.
    shadow.querySelectorAll('a[href]').forEach(link => link.tabIndex = 0);
    shadow.addEventListener('focusin', event => {
      event.target.scrollIntoView({block: 'nearest', inline: 'nearest', behavior: 'instant'});
    });
    root.querySelector('[data-resume-loading]').replaceWith(host);
  } catch (e) {
    if (signal.aborted) return;
    root.querySelector('[data-resume-loading]').textContent =
      'The clipboard could not load the résumé. Use the read or print link above.';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = 'Retry résumé';
    retry.addEventListener('click', () => mountResume(root, signal), {
      once: true
    });
    root.append(retry);
  }
}
