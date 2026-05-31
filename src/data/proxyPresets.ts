export interface ProxyPreset {
  id: string
  name: string
  region: 'America' | 'Europe' | 'Asia' | 'Optimal'
  type: 'http' | 'https' | 'socks'
  host: string
  port: number
  auth?: { username: string; password: string }
}

export const proxyPresets: ProxyPreset[] = [
  // America
  { id: 'us-http-1', name: 'ASV Ņujorka', region: 'America', type: 'http', host: '72.10.160.172', port: 31229 },
  { id: 'us-http-2', name: 'ASV Čikāga', region: 'America', type: 'http', host: '68.183.191.73', port: 3128 },
  { id: 'us-http-3', name: 'ASV Maiami', region: 'America', type: 'http', host: '104.248.48.148', port: 3128 },
  { id: 'us-http-4', name: 'ASV Sietla', region: 'America', type: 'http', host: '104.236.54.188', port: 3128 },
  { id: 'us-http-5', name: 'ASV Losandželosa', region: 'America', type: 'http', host: '159.65.245.255', port: 80 },
  { id: 'ca-http-1', name: 'Kanāda Toronto', region: 'America', type: 'http', host: '138.197.157.32', port: 3128 },
  { id: 'br-http-1', name: 'Brazīlija Sanpaulu', region: 'America', type: 'http', host: '177.54.143.59', port: 3128 },

  // Europe
  { id: 'de-http-1', name: 'Vācija Frankfurte', region: 'Europe', type: 'http', host: '159.69.63.65', port: 3128 },
  { id: 'de-http-2', name: 'Vācija Berlīne', region: 'Europe', type: 'http', host: '46.4.96.137', port: 3128 },
  { id: 'nl-http-1', name: 'Nīderlande Amsterdama', region: 'Europe', type: 'http', host: '178.62.244.128', port: 3128 },
  { id: 'nl-http-2', name: 'Nīderlande Roterdama', region: 'Europe', type: 'http', host: '86.107.35.51', port: 3128 },
  { id: 'uk-http-1', name: 'Apvienotā Karaliste Londona', region: 'Europe', type: 'http', host: '51.89.21.99', port: 3128 },
  { id: 'uk-http-2', name: 'Apvienotā Karaliste Mančestra', region: 'Europe', type: 'http', host: '176.9.75.42', port: 3128 },
  { id: 'fr-http-1', name: 'Francija Parīze', region: 'Europe', type: 'http', host: '51.158.68.133', port: 8811 },
  { id: 'fr-http-2', name: 'Francija Marseļa', region: 'Europe', type: 'http', host: '163.172.157.42', port: 3128 },
  { id: 'es-http-1', name: 'Spānija Madride', region: 'Europe', type: 'http', host: '185.244.212.60', port: 3128 },
  { id: 'it-http-1', name: 'Itālija Roma', region: 'Europe', type: 'http', host: '94.177.8.138', port: 3128 },
  { id: 'se-http-1', name: 'Zviedrija Stokholma', region: 'Europe', type: 'http', host: '158.174.124.190', port: 3128 },
  { id: 'pl-http-1', name: 'Polija Varšava', region: 'Europe', type: 'http', host: '188.0.149.204', port: 3128 },
  { id: 'nl-socks-1', name: 'Nīderlande SOCKS5 (anonīms)', region: 'Europe', type: 'socks', host: '2.58.80.142', port: 4145 },
  { id: 'de-socks-1', name: 'Vācija SOCKS5 (anonīms)', region: 'Europe', type: 'socks', host: '188.241.117.100', port: 1080 },

  // Asia
  { id: 'jp-http-1', name: 'Japāna Tokija', region: 'Asia', type: 'http', host: '133.18.77.131', port: 3128 },
  { id: 'jp-http-2', name: 'Japāna Osaka', region: 'Asia', type: 'http', host: '45.125.17.161', port: 3128 },
  { id: 'kr-http-1', name: 'Dienvidkoreja Seula', region: 'Asia', type: 'http', host: '211.197.12.251', port: 3128 },
  { id: 'sg-http-1', name: 'Singapūra', region: 'Asia', type: 'http', host: '167.172.101.128', port: 3128 },
  { id: 'in-http-1', name: 'Indija Mumbaja', region: 'Asia', type: 'http', host: '103.151.172.186', port: 3128 },
  { id: 'cn-http-1', name: 'Ķīna Honkonga', region: 'Asia', type: 'http', host: '47.91.112.189', port: 3128 },
  { id: 'tw-http-1', name: 'Taivāna Taibei', region: 'Asia', type: 'http', host: '210.61.215.67', port: 3128 },
  { id: 'th-http-1', name: 'Taizeme Bangkoka', region: 'Asia', type: 'http', host: '49.228.236.10', port: 3128 },
  { id: 'vn-http-1', name: 'Vjetnama Hanoja', region: 'Asia', type: 'http', host: '14.225.204.215', port: 3128 },

  // Optimal
  { id: 'opt-http-1', name: 'Optimālais — ASV Rietumi', region: 'Optimal', type: 'http', host: '162.243.119.255', port: 3128 },
  { id: 'opt-http-2', name: 'Optimālais — Eiropas Centr.', region: 'Optimal', type: 'http', host: '138.68.161.56', port: 3128 },
  { id: 'opt-http-3', name: 'Optimālais — Āzijas D.R.', region: 'Optimal', type: 'http', host: '128.199.200.112', port: 3128 },
]
