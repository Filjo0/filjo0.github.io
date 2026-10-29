// Follow the device setting until the visitor makes an explicit local choice.
export function reducedMotion() {
  const choice=document.body.dataset.motion;
  return choice?choice==='reduce':matchMedia('(prefers-reduced-motion: reduce)').matches;
}
export function restoreMotionPreference() {
  try {
    const choice=localStorage.getItem('portfolio-motion');
    if(['reduce','full'].includes(choice))document.body.dataset.motion=choice;
  } catch { /* Storage is optional; private browsing still has working controls. */ }
}
export function setMotionPreference(reduce) {
  document.body.dataset.motion=reduce?'reduce':'full';
  try {localStorage.setItem('portfolio-motion',document.body.dataset.motion);} catch { /* Optional preference. */ }
}
