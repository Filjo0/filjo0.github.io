// Optional discoveries. No private app data or unverified public demo links.
export const discoveries = {
  coaching: {
    title: 'On the touchline',
    eyebrow: 'Youth football coaching',
    paragraphs: [
      'I coach youth football at Floreat Athena FC, working across U9 to U14 age groups.',
      'My work includes player development, training and match preparation. I hold a Football Australia C Licence.'
    ],
    action: { route: 'experience', label: 'Read about my experience' }
  }
};

export function mountDiscovery(content, id) {
  const item = discoveries[id];
  if (!item) throw new Error('Unknown discovery');
  const article = document.createElement('article');
  article.className = 'world-discovery';
  article.dataset.discovery = id;
  const eyebrow = document.createElement('p');
  eyebrow.className = 'world-discovery-eyebrow';
  eyebrow.textContent = item.eyebrow;
  const title = document.createElement('h3');
  title.textContent = item.title;
  article.append(eyebrow, title);
  for (const text of item.paragraphs) {
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    article.append(paragraph);
  }
  const link = document.createElement('a');
  link.href = '#' + item.action.route;
  link.dataset.worldRoute = item.action.route;
  link.textContent = item.action.label;
  article.append(link);
  content.replaceChildren(article);
}
