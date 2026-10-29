let cached;
const file=name=>new URL('../assets/games/'+name,import.meta.url).href;
async function image(name){
  const result=new Image();result.decoding='async';result.src=file(name);await result.decode();return result;
}
// The homepage never fetches sports art. Failed loads can be retried deliberately.
export function loadJugglingArt(){
  return cached??=fetch(file('juggling-v2.json')).then(async response=>{
    if(!response.ok)throw Error('Juggling artwork unavailable');
    const data=await response.json();
    const [court,player,ball,shadow]=await Promise.all(['court','player','ball','shadow'].map(key=>image(data.images[key])));
    return {data,court,player,ball,shadow};
  }).catch(error=>{cached=null;throw error;});
}