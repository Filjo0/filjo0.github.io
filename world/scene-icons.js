// Shared navigation and object-tab icons. Decorative SVGs inherit the control name.
const iconPaths={
  fibonacci:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 3v18M11 8h6M11 12h4M11 16h6"/>',
  work:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>'+
    '<rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  experience:'<circle cx="12" cy="8" r="3.5"/><path d="M4.5 21v-2a7.5 7.5 0 0 1 15 0v2"/>',
  resume:'<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M9 12h6M9 16h6"/>',
  contact:
    '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 '+
      '8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9H13a8.5 8.5 0 0 1 8 8z"/>',
  books:'<path d="M12 5v16M12 5C9 3 5 3 2 4v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-3-1-7-1-10 1z"/>',
  winter:'<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 3 3-3M9 20l3-3 3 3M4 10l4-1-1-4M20 14l-4 1 1 4M4 14l4 1-1 4M20 10l-4-1 1-4"/>',
  coast:'<circle cx="12" cy="10" r="4"/><path d="M12 1v2M3 10H1M23 10h-2M4 3l2 2M20 3l-2 2M2 19c3-3 5 3 8 0s5 3 8 0 3 0 4 0"/>',
  aqua:'<path d="M8 16V6a3 3 0 0 1 6 0M17 16V6a3 3 0 0 1 5-2M8 9h9M8 13h9M2 20c3-3 5 3 8 0s5 3 8 0 3 0 4 0"/>',
  futsl:'<circle cx="12" cy="12" r="9"/><path d="m12 7 5 4-2 6H9l-2-6 5-4zM12 7V3M17 11l4-1M15 17l2 3M9 17l-2 3M7 11l-4-1"/>',
  play:'<path d="m9 4 11 8-11 8z"/>',
  gear:
    '<path d="m9.5 3-.6 2.1-2 .9-2-.5-2.4 4.1 1.5 1.5v2.2l-1.5 1.5 2.4 4.1 2-.5 2 .9.6 2.1h5l.6-2.1 2-.9 2 .5 '+
      '2.4-4.1-1.5-1.5v-2.2l1.5-1.5L19.1 5l-2 .5-2-.9L14.5 3z"/><circle cx="12" cy="12" r="3"/>'
};
export function navIcon(id,className='nav-icon') {
  return '<svg class="'+className+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" '+
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+iconPaths[id]+'</svg>';
}
