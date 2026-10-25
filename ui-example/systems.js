// Predefined flooring systems with materials. Surface prep is always step 1.
window.PROCOAT_SYSTEMS = [
  {
    name: "Izlīdzinošā epoksīda sistēma",
    code: "IZL",
    needsColor: true,
    layers: [
      { name: "EP02 vai EP02 Color", perM2: 0.5, role: "Grunts" },
      { name: "EP02 vai EP02 Color", perM2: 0.5, role: "Papildu grunts", optional: true, note: "Papildu grunts kārta" },
      { name: "EP02 vai EP02 Color", perM2: 0.5, role: "2. kārta" },
      { name: "EP02 (ja estrich)", perM2: 0.5, optional: true, note: "Ja estrich" },
      { name: "EP11", perM2: 2.5, role: "Izlīdzinošais slānis" },
      { name: "PU23 (matētais)", perM2: 0.1, role: "Finišs", note: "Liek 2 kārtās pēc nepieciešamības" },
    ],
  },
  {
    name: "Neslīdošā epoksīda sistēma",
    code: "NES",
    needsColor: true,
    layers: [
      { name: "EP02", perM2: 0.5, role: "Grunts", note: "Šis 2x ja lielas noslodzes grīda" },
      { name: "Kvarca smilts 0.3-0.8mm", perM2: 2.0, role: "Apbēršana" },
      { name: "EP11", perM2: 0.6, role: "Pārklājums" },
    ],
  },
  {
    name: "Gludā epoksīda sistēma",
    code: "GLU",
    needsColor: true,
    layers: [
      { name: "EP02 vai EP02 Color", perM2: 0.5, role: "Grunts", note: "Šis 2x ja lielas noslodzes grīda" },
      { name: "EP11", perM2: 0.6, role: "Pārklājums" },
    ],
  },
  {
    name: "Strukturālā epoksīda sistēma",
    code: "STR",
    needsColor: true,
    layers: [
      { name: "EP02 vai EP02 Color", perM2: 0.5, role: "Grunts", note: "Šis 2x ja lielas noslodzes grīda" },
      { name: "EP12", perM2: 0.6, role: "Pārklājums" },
    ],
  },
  {
    name: "Elpojošs epoksīda pārklājums",
    code: "ELP",
    needsColor: false,
    layers: [
      { name: "EP13", perM2: 0.5, role: "1. kārta" },
      { name: "EP13", perM2: 0.5, role: "2. kārta" },
    ],
  },
  {
    name: "Ķīmiski noturīga epoksīda sistēma",
    code: "KIM",
    needsColor: false,
    layers: [
      { name: "EP02", perM2: 0.5, role: "Grunts" },
      { name: "EP42", perM2: 0.5, role: "1. kārta" },
      { name: "EP42", perM2: 0.5, role: "2. kārta" },
    ],
  },
  {
    name: "Pašizlīdzinoša pārslu epoksīda sistēma",
    code: "PIP",
    needsColor: true,
    layers: [
      { name: "EP02", perM2: 0.5, role: "Grunts" },
      { name: "EP02", perM2: 0.5, role: "2. kārta" },
      { name: "EP02 (ja estrich)", perM2: 0.5, optional: true, note: "Ja estrich" },
      { name: "EP11", perM2: 2.5, role: "Izlīdzinošais slānis" },
      { name: "Akrila pārslas", perM2: 0.2, role: "Pārslas" },
      { name: "EP21 vai EP22", perM2: 0.8, role: "Caurspīdīgs slānis", optional: true, note: "Ja gribas papildus caurspīdīgu slāni" },
      { name: "PU23 (matētais)", perM2: 0.1, role: "Finišs", note: "Liek 2 kārtās, ja gribas matētu" },
    ],
  },
  {
    name: "Pārslu epoksīda sistēma (pilnībā apbērta)",
    code: "PAR",
    needsColor: true,
    layers: [
      { name: "EP02 Color", perM2: 0.5, role: "Grunts" },
      { name: "EP11", perM2: 0.5, role: "Pārklājums", optional: true, note: "Neliek, ja klientam nav nauda un nav liela slodzes telpa" },
      { name: "Akrila pārslas", perM2: 0.7, role: "Pilna apbēršana" },
      { name: "EP21 vai EP22", perM2: 0.6, role: "Caurspīdīgs slānis" },
    ],
  },
  {
    name: "Neslīdošā epoksīda sistēma ar krāsainu smilti",
    code: "NKS",
    needsColor: true,
    layers: [
      { name: "EP02", perM2: 0.8, role: "Grunts" },
      { name: "Krāsota kvarca smilts 0.8-1.2mm", perM2: 5.0, role: "Apbēršana" },
      { name: "EP22", perM2: 0.8, role: "Pārklājums" },
    ],
  },
  {
    name: "Pašizlīdzinoša poliuretāna grīdas sistēma",
    code: "PIPU",
    needsColor: true,
    layers: [
      { name: "EP02 vai EP02 Color", perM2: 0.5, role: "Grunts" },
      { name: "EP02 vai EP02 Color", perM2: 0.5, role: "2. kārta" },
      { name: "EP02 (ja estrich)", perM2: 0.5, optional: true, note: "Ja estrich" },
      { name: "PU11", perM2: 2.5, role: "Izlīdzinošais slānis" },
      { name: "PU23 (matētais)", perM2: 0.1, role: "Finišs" },
    ],
  },
];
