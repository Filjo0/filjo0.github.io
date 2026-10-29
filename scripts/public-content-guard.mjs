import {createHash} from 'node:crypto';
// Match the existing case-insensitive phrases without publishing their names in tests.
// Word lengths locate exact windows around spaces, including matches inside longer words.
const blocked = [
  [5,6,'605a3256e13af78f49fc0a4cb6451025186c28103e281b41fb775c19691a4625'],
  [7,7,'73d8f4553ceaa188f99c11f33a4e2bfffa089dd66bade8239cfecc1f99017ee2'],
  [6,3,'dcaf08271774a93ca93cdaf88d86f2825e5d8afdb1e2d1c53d6ffb37e3e077bb'],
  [8,3,'d0ae78f9a2bf01fa928eb908827bc3fbf53b39d3252dfe012df420648becc6ce'],
  [8,7,'8f5bf1f01a7f174a082f5a0d17a382755f74409d89f4a55798917936d000ce78'],
  [8,8,'d95a62f28cb9966f0c9a00e3bcd91e7399c161119f31dc58174a19a6d065ef54'],
  [5,3,'90dd93b90186464c21625b7f48eaac44d8ffc9617a2fbbf8c85a4dddad1cbcc9'],
  [11,7,'c87971ee4e51fb33fd86ec53a7ed058db09032b8c6eec3dc5b5e3c01d2625cab'],
];
export function containsPrivateProject(text, fingerprints=blocked) {
  const lower=text.toLowerCase();
  for(let space=lower.indexOf(' ');space!==-1;space=lower.indexOf(' ',space+1)) {
    for(const [left,right,digest] of fingerprints) {
      if(space<left||space+right>=lower.length)continue;
      const phrase=lower.slice(space-left,space+right+1);
      if(createHash('sha256').update(phrase).digest('hex')===digest)return true;
    }
  }
  return false;
}
