'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function nacitajPrikaz() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!match) throw new Error('<script> s logikou appky sa v index.html nenašiel');
  // Spúšťané cez Function (rovnaký realm ako test), aby vytvorené polia/objekty
  // boli porovnateľné cez node:assert/strict bez cross-realm rozdielov.
  const spustiSVramciWindow = new Function('window', match[1]);
  const window = {};
  spustiSVramciWindow(window);
  if (!window.Prikaz) throw new Error('window.Prikaz nebol nastavený');
  return window.Prikaz;
}

const Prikaz = nacitajPrikaz();

function zakladneData() {
  return {
    menoPriezvisko: 'Ján Novák',
    kde: 'Bratislava',
    kedy: '2026-09-15',
    doprava: 'vlak',
    dovod: 'konferencia XY',
    institucia: 'STU Bratislava',
    zahranicna: false,
    stravne: false,
    ubytovanie: false,
    hradene: 'grant XY',
    miestoOdchodu: 'Žilina FRI',
    odchodTam: '2026-09-15T07:00',
    prichodNaMiesto: '2026-09-15T10:00',
    odchodZoSC: '2026-09-15T16:00',
    miestoPrichodu: 'Žilina FRI',
    prichodSpat: '2026-09-15T19:00',
    spolucestujuci: '',
  };
}

// Podmienené polia Prechod hranice (vyžadujú sa pri Zahraničná cesta = áno).
const PRECHOD_HRANICE = {
  prechodHraniceTamMiesto: 'Brodské',
  prechodHraniceTamCas: '2026-09-15T09:15',
  prechodHraniceSpatMiesto: 'Brodské',
  prechodHraniceSpatCas: '2026-09-16T11:00',
};

function zahranicneData() {
  return {
    ...zakladneData(),
    kde: 'Viedeň',
    institucia: 'TU Wien',
    zahranicna: true,
    prichodNaMiesto: '2026-09-15T10:30',
    prichodSpat: '2026-09-16T14:00',
    ...PRECHOD_HRANICE,
  };
}

const OCAKAVANY_VYSTUP_ZAHRANICNY = [
  'Meno a priezvisko: Ján Novák',
  'Kde: Viedeň',
  'Kedy (dátum): 15.09.2026',
  'Doprava: vlak',
  'Dôvod: konferencia XY',
  'Navštívená inštitúcia: TU Wien',
  'Zahraničná cesta: áno',
  'Stravné: nie',
  'Ubytovanie: nie',
  'Hradené (z čoho): grant XY',
  '',
  'Cesta tam',
  'Miesto odchodu: Žilina FRI',
  'Odchod (dátum a čas): 15.09.2026 07:00',
  'Prechod hranice (kde a kedy): Brodské, 15.09.2026 09:15',
  'Príchod na miesto (dátum a čas): 15.09.2026 10:30',
  '',
  'Cesta späť',
  'Odchod zo SC (dátum a čas): 15.09.2026 16:00',
  'Prechod hranice (kde a kedy): Brodské, 16.09.2026 11:00',
  'Miesto príchodu: Žilina FRI',
  'Príchod (dátum a čas): 16.09.2026 14:00',
].join('\r\n');

const OCAKAVANY_VYSTUP = [
  'Meno a priezvisko: Ján Novák',
  'Kde: Bratislava',
  'Kedy (dátum): 15.09.2026',
  'Doprava: vlak',
  'Dôvod: konferencia XY',
  'Navštívená inštitúcia: STU Bratislava',
  'Zahraničná cesta: nie',
  'Stravné: nie',
  'Ubytovanie: nie',
  'Hradené (z čoho): grant XY',
  '',
  'Cesta tam',
  'Miesto odchodu: Žilina FRI',
  'Odchod (dátum a čas): 15.09.2026 07:00',
  'Príchod na miesto (dátum a čas): 15.09.2026 10:00',
  '',
  'Cesta späť',
  'Odchod zo SC (dátum a čas): 15.09.2026 16:00',
  'Miesto príchodu: Žilina FRI',
  'Príchod (dátum a čas): 15.09.2026 19:00',
].join('\r\n');

test('kompletný tuzemský príkaz bez stravného/ubytovania vyprodukuje presne formátovaný výstup', () => {
  const vysledok = Prikaz.spracujPrikaz(zakladneData());
  assert.deepEqual(vysledok.errors, []);
  assert.deepEqual(vysledok.warnings, []);
  assert.equal(vysledok.outputText, OCAKAVANY_VYSTUP);
  assert.equal(vysledok.fileName, 'prikaz-novak-2026-09-15.txt');
});

test('chýbajúce vždy povinné pole vráti blokujúcu chybu a nevygeneruje výstup', () => {
  assert.ok(Prikaz.vzdyPovinnePolia.length > 0);
  for (const pole of Prikaz.vzdyPovinnePolia) {
    const data = zakladneData();
    delete data[pole];
    const vysledok = Prikaz.spracujPrikaz(data);
    assert.ok(vysledok.errors.length > 0, `pole "${pole}" malo vyprodukovať blokujúcu chybu`);
    assert.equal(vysledok.outputText, '', `pole "${pole}": outputText nemal byť vygenerovaný`);
    assert.equal(vysledok.fileName, '', `pole "${pole}": fileName nemal byť vygenerovaný`);
  }
});

test('výber áno pri Zahraničná cesta / Stravné / Ubytovanie appku nezrúti', () => {
  const data = { ...zahranicneData(), stravne: true, ubytovanie: true };
  const vysledok = Prikaz.spracujPrikaz(data);
  assert.deepEqual(vysledok.errors, []);
  assert.ok(vysledok.outputText.includes('Zahraničná cesta: áno'));
  assert.ok(vysledok.outputText.includes('Stravné: áno'));
  assert.ok(vysledok.outputText.includes('Ubytovanie: áno'));
});

test('zahraničný príkaz s vyplneným Prechod hranice má riadky na správnom mieste v Cesta tam aj Cesta späť', () => {
  const vysledok = Prikaz.spracujPrikaz(zahranicneData());
  assert.deepEqual(vysledok.errors, []);
  assert.deepEqual(vysledok.warnings, []);
  assert.equal(vysledok.outputText, OCAKAVANY_VYSTUP_ZAHRANICNY);
  assert.equal(vysledok.fileName, 'prikaz-novak-2026-09-15.txt');
});

test('Zahraničná cesta = áno bez Prechodu hranice (tam aj späť, miesto aj čas) je blokujúca chyba', () => {
  for (const pole of Object.keys(PRECHOD_HRANICE)) {
    const data = zahranicneData();
    delete data[pole];
    const vysledok = Prikaz.spracujPrikaz(data);
    assert.ok(vysledok.errors.length > 0, `pole "${pole}" malo byť podmienene povinné`);
    assert.ok(
      vysledok.errors.some((e) => e.includes('Prechod hranice')),
      `pole "${pole}": chyba sa má vzťahovať k Prechod hranice, dostalo sa: ${JSON.stringify(vysledok.errors)}`,
    );
    assert.equal(vysledok.outputText, '', `pole "${pole}": outputText nesmie byť vygenerovaný`);
    assert.equal(vysledok.fileName, '', `pole "${pole}": fileName nesmie byť vygenerovaný`);

    const prazdne = zahranicneData();
    prazdne[pole] = '   ';
    assert.ok(Prikaz.spracujPrikaz(prazdne).errors.length > 0, `pole "${pole}": prázdna hodnota musí blokovať`);
  }
});

test('tuzemská cesta nevyžaduje Prechod hranice a jeho riadky vo výstupe úplne chýbajú', () => {
  const data = { ...zakladneData(), ...PRECHOD_HRANICE, zahranicna: false };
  const vysledok = Prikaz.spracujPrikaz(data);
  assert.deepEqual(vysledok.errors, []);
  assert.ok(!vysledok.outputText.includes('Prechod hranice'), 'tuzemský výstup nesmie obsahovať Prechod hranice');
  assert.ok(!vysledok.outputText.includes('Brodské'), 'tuzemský výstup nesmie obsahovať hodnoty z podmienených polí');
});

test('prázdny Spolucestujúci sa vo výstupe úplne vynechá', () => {
  const vysledok = Prikaz.spracujPrikaz(zakladneData());
  assert.ok(!vysledok.outputText.includes('Spolucestujúci'));
});

test('vyplnený Spolucestujúci sa objaví na konci výstupu', () => {
  const data = { ...zakladneData(), spolucestujuci: 'Jana Nováková' };
  const vysledok = Prikaz.spracujPrikaz(data);
  assert.ok(vysledok.outputText.endsWith('\r\n\r\nSpolucestujúci: Jana Nováková'));
});

test('fileName odvodí priezvisko bez diakritiky, malými písmenami, z posledného slova', () => {
  const data = { ...zakladneData(), menoPriezvisko: 'Ľuboš Šuňal', kedy: '2026-01-03' };
  const vysledok = Prikaz.spracujPrikaz(data);
  assert.equal(vysledok.fileName, 'prikaz-sunal-2026-01-03.txt');
});
