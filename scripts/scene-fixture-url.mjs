// Existing layout/screenshot suites use a stable light, independent of Perth's clock.
// Automatic phases, timezone independence and day/night loading have their own suite.
export function sceneFixtureURL(){
 const url=new URL(process.env.STUDIO_URL||'http://127.0.0.1:8765/');
 if(!url.searchParams.has('light'))url.searchParams.set('light','sunset');
 return url.href;
}
