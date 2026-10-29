// Compare rendered CV facts with the owner's verbatim approval, independently of its styling.
export async function resumeFacts(locator) {
 return locator.evaluate(host=>{
  const root=host.shadowRoot||host,clean=s=>s.replace(/\s+/g,' ').trim();
  const text=(n,s)=>clean(n.querySelector(s)?.innerText||'');
  const roles=[...root.querySelectorAll('.role-block,.entry')].map(n=>({
   employer_or_project:n.classList.contains('role-block')?'Acquire Technology Solutions':text(n,'.entry-title'),
   role:text(n,'.role-title'),date:text(n,'.date'),
   after:[...n.querySelectorAll('li')].map(n=>clean(n.innerText)),
   stack:[...n.querySelectorAll('.positioning-detail')].map(n=>clean(n.innerText)),
   paragraphs:[...n.querySelectorAll(':scope > p:not([class])')].map(n=>clean(n.innerText)),
  }));
  const header=root.querySelector('.masthead');
  return {
   header:[text(header,'h1'),text(header,'.headline'),text(header,'.positioning'),clean(header.querySelector('.contact').textContent)],
   summary:text(root,'.summary'),roles,
   other_sections:[...root.querySelectorAll('.sidebar > section')].map(n=>({title:text(n,'h2'),
    lines:[...n.querySelectorAll('li,.side-group')].map(n=>clean(n.innerText))})),
   links:[...header.querySelectorAll('a')].map(n=>n.getAttribute('href')),
  };
 });
}
export function approvedResumeFacts(approval) {
 return {header:approval.header,summary:approval.summary,
  roles:approval.roles.map(({employer_or_project,role,date,after,stack,paragraphs})=>({employer_or_project,role,date,after,stack,paragraphs})),
  other_sections:approval.other_sections,
  links:['mailto:philalimov@gmail.com','https://linkedin.com/in/philalimov','https://github.com/Filjo0','https://filjo0.github.io']};
}
export function canonicalFacts(facts) {
 // Contact separators are styled spacing; normalize whitespace without changing any words.
 return {...facts,header:facts.header.map(s=>s.replace(/\s+/g,''))};
}
