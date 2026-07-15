/**
 * Extrae atributos físicos y de vestimenta a partir de un texto transcrito.
 * Funciona de manera local usando algoritmos de tokenización y expresiones regulares.
 */
export const extraerDatosDeAudio = (audioText: string) => {
  const lower = audioText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const result: any = {};

  // Género
  if (/\b(hombre|caballero|nino|abuelo|chico|senor|muchacho)\b/.test(lower)) {
    result.genero = 'Masculino';
  } else if (/\b(mujer|dama|nina|abuela|chica|senora|muchacha)\b/.test(lower)) {
    result.genero = 'Femenino';
  }

  // Edad
  const edadMatch = lower.match(/\b(\d+)\s*(anos|ano|meses|mes)\b/);
  if (edadMatch) {
    result.edad = edadMatch[1];
  }

  // Piel
  if (/(blanco|blanca)/.test(lower)) result.piel = 'clara';
  else if (/(trigueno|triguena)/.test(lower)) result.piel = 'trigueña';
  else if (/(moreno|morena)/.test(lower)) result.piel = 'morena';
  else if (/(oscuro|oscura|negro|negra)/.test(lower) && !/(cabello|pelo|ojos)/.test(lower)) result.piel = 'oscura';

  // Cabello
  if (/(cabello negro|pelo negro|cabello oscuro|pelo oscuro)/.test(lower)) result.cabello = 'negro';
  else if (/(cabello castano|pelo castano|castano)/.test(lower)) result.cabello = 'castaño';
  else if (/(cabello rubio|pelo rubio|rubio|catire)/.test(lower)) result.cabello = 'rubio';
  else if (/(canas|canoso|pelo blanco|cabello blanco)/.test(lower)) result.cabello = 'canoso';
  else if (/(calvo|sin cabello|sin pelo)/.test(lower)) result.cabello = 'sin cabello';

  // Ojos
  if (/(ojos negros|ojos oscuros)/.test(lower)) result.ojos = 'negro';
  else if (/(ojos marrones|ojos cafes|ojos cafe)/.test(lower)) result.ojos = 'marrones';
  else if (/(ojos verdes)/.test(lower)) result.ojos = 'verde';
  else if (/(ojos azules)/.test(lower)) result.ojos = 'azul';

  // Vestimenta
  const words = audioText.split(/\s+/);
  const clothingKeywords = ['franela','camisa','pantalon','pantalón','short','shorts','zapatos','gorra','sombrero','vestido','falda','chaqueta','sueter','suéter','mono','ropa','jean','jeans','bermuda','chemise'];
  const stopWords = ['y','o','con','tiene','lleva','piel','cabello','pelo','ojos','tez','edad','anos','años','hombre','mujer','nino','niño','nina','niña','es','esta','está','pero', 'de'];
  
  let vestimenta = [];
  let isExtracting = false;
  let currentItem = [];

  for (let word of words) {
    const cleanWord = word.toLowerCase().replace(/[.,;]/g, '');
    if (clothingKeywords.includes(cleanWord)) {
      if (currentItem.length > 0) vestimenta.push(currentItem.join(' '));
      currentItem = [word];
      isExtracting = true;
    } else if (isExtracting) {
      if (stopWords.includes(cleanWord) || clothingKeywords.some(c => cleanWord.includes(c))) {
        isExtracting = false;
        vestimenta.push(currentItem.join(' '));
        currentItem = [];
      } else {
        currentItem.push(word);
      }
    }
  }
  if (currentItem.length > 0) vestimenta.push(currentItem.join(' '));
  
  if (vestimenta.length > 0) {
    result.detallesVestimenta = vestimenta.map(v => v.replace(/[.,;]/g, '').trim()).join(', ');
  }

  return result;
};
