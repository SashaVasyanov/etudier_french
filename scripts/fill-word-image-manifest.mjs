import fs from 'node:fs/promises';
import path from 'node:path';

const DATASET_FILES = ['public/data/words_a1.json', 'public/data/words_a2.json', 'public/data/words_b1.json'];
const MANIFEST_PATH = 'public/data/word_images.json';

function normalize(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function hasAny(haystack, needles) {
  return needles.some((needle) => haystack.includes(needle));
}

function getCategory(word) {
  const tags = word.tags ?? [];

  if (tags.some((tag) => ['nature', 'plants'].includes(tag))) return 'plants';
  if (tags.some((tag) => ['animals'].includes(tag))) return 'animals';
  if (tags.some((tag) => ['food'].includes(tag))) return 'food';
  if (tags.some((tag) => ['travel', 'transport', 'city', 'places'].includes(tag))) return 'travel';
  if (tags.some((tag) => ['home', 'objects'].includes(tag))) return 'home';

  return 'core';
}

function getImageType(word) {
  const key = normalize(`${word.original} ${word.translation} ${(word.tags ?? []).join(' ')} ${word.part_of_speech}`);

  if (hasAny(key, ['chien', 'собак'])) return 'dog';
  if (hasAny(key, ['chat', 'кот', 'кошка'])) return 'cat';
  if (hasAny(key, ['oiseau', 'pigeon', 'canard', 'coq', 'poule', 'птиц', 'утк', 'петух', 'куриц'])) return 'bird';
  if (hasAny(key, ['poisson', 'saumon', 'thon', 'requin', 'dauphin', 'baleine', 'рыб', 'акул', 'кит'])) return 'fish';
  if (hasAny(key, ['cheval', 'лошад'])) return 'horse';
  if (hasAny(key, ['ours', 'медвед'])) return 'bear';
  if (hasAny(key, ['lapin', 'крол'])) return 'rabbit';
  if (hasAny(key, ['lion', 'лев'])) return 'lion';
  if (hasAny(key, ['cochon', 'свин'])) return 'pig';
  if (hasAny(key, ['arbre', 'sapin', 'pin', 'chene', 'bouleau', 'дерев', 'сосна', 'дуб', 'берез'])) return 'tree';
  if (hasAny(key, ['fleur', 'rose', 'tulipe', 'pissenlit', 'цвет', 'роза', 'тюльпан'])) return 'flower';
  if (hasAny(key, ['feuille', 'plante', 'лист', 'растен'])) return 'leaf';
  if (hasAny(key, ['graine', 'сем'])) return 'seed';
  if (hasAny(key, ['herbe', 'трава'])) return 'grass';
  if (hasAny(key, ['foret', 'bois', 'лес'])) return 'forest';
  if (hasAny(key, ['branche', 'ветк'])) return 'branch';
  if (hasAny(key, ['racine', 'корень'])) return 'root';
  if (hasAny(key, ['pain', 'baguette', 'croissant', 'хлеб', 'багет'])) return 'bread';
  if (hasAny(key, ['fromage', 'сыр'])) return 'cheese';
  if (hasAny(key, ['soupe', 'суп'])) return 'soup';
  if (hasAny(key, ['pomme', 'яблок'])) return 'apple';
  if (hasAny(key, ['poire', 'груш'])) return 'pear';
  if (hasAny(key, ['raisin', 'виноград'])) return 'grapes';
  if (hasAny(key, ['carotte', 'морков'])) return 'carrot';
  if (hasAny(key, ['tomate', 'помидор'])) return 'tomato';
  if (hasAny(key, ['pomme de terre', 'картоф'])) return 'potato';
  if (hasAny(key, ['riz', 'рис'])) return 'rice';
  if (hasAny(key, ['pates', 'макарон'])) return 'pasta';
  if (hasAny(key, ['eau', 'jus', 'boisson', 'вода', 'сок', 'напит'])) return 'water';
  if (hasAny(key, ['cafe', 'the', 'tasse', 'кофе', 'чай', 'чаш'])) return 'cup';
  if (hasAny(key, ['dessert', 'gateau', 'tarte', 'glace', 'biscuit', 'bonbon', 'десерт', 'торт', 'пирог', 'морож', 'печень', 'конфет'])) return 'dessert';
  if (hasAny(key, ['valise', 'bagage', 'sac a dos', 'чемодан', 'багаж', 'рюкзак'])) return 'suitcase';
  if (hasAny(key, ['passeport', 'visa', 'douane', 'frontiere', 'паспорт', 'виза', 'тамож', 'границ'])) return 'passport';
  if (hasAny(key, ['billet', 'ticket', 'recu', 'чек', 'билет', 'квитанц'])) return 'ticket';
  if (hasAny(key, ['gare', 'station', 'arret', 'quai', 'вокзал', 'станци', 'останов', 'платформ'])) return 'station';
  if (hasAny(key, ['train', 'metro', 'tramway', 'wagon', 'поезд', 'метро', 'трамвай', 'вагон'])) return 'train';
  if (hasAny(key, ['avion', 'aeroport', 'helicoptere', 'самол', 'аэропорт', 'вертолет'])) return 'plane';
  if (hasAny(key, ['hotel', 'reception', 'отель', 'ресепшен'])) return 'hotel';
  if (hasAny(key, ['chambre', 'salon', 'комната', 'номер', 'гостиная'])) return 'room';
  if (hasAny(key, ['carte', 'plan', 'itineraire', 'route', 'trajet', 'карта', 'план', 'маршрут', 'дорог'])) return 'map';
  if (hasAny(key, ['musee', 'exposition', 'cinema', 'theatre', 'музей', 'выстав', 'кинотеатр', 'театр'])) return 'museum';
  if (hasAny(key, ['plage', 'sable', 'пляж', 'песок'])) return 'beach';
  if (hasAny(key, ['montagne', 'colline', 'vallee', 'гора', 'холм', 'долин'])) return 'mountain';
  if (hasAny(key, ['maison', 'appartement', 'immeuble', 'batiment', 'дом', 'квартир', 'здание'])) return 'house';
  if (hasAny(key, ['cuisine', 'four', 'refrigerateur', 'кухн', 'духов', 'холодильник'])) return 'kitchen';
  if (hasAny(key, ['canape', 'fauteuil', 'диван', 'кресло'])) return 'sofa';
  if (hasAny(key, ['lit', 'matelas', 'oreiller', 'кровать', 'матрас', 'подуш'])) return 'bed';
  if (hasAny(key, ['lampe', 'lumiere', 'свет', 'ламп'])) return 'lamp';
  if (hasAny(key, ['porte', 'entree', 'sortie', 'двер', 'вход', 'выход'])) return 'door';
  if (hasAny(key, ['fenetre', 'окно'])) return 'window';
  if (hasAny(key, ['assiette', 'verre', 'bol', 'fourchette', 'couteau', 'cuillere', 'тарел', 'стакан', 'миска', 'вилка', 'нож', 'ложка'])) return 'plate';
  if (hasAny(key, ['ordinateur', 'telephone', 'ecran', 'clavier', 'application', 'site', 'fichier', 'компьютер', 'телефон', 'экран', 'клавиатура', 'приложение', 'файл'])) return 'tech';
  if (hasAny(key, ['argent', 'prix', 'budget', 'paiement', 'salaire', 'деньги', 'цена', 'бюджет', 'платеж', 'зарплата'])) return 'money';
  if (hasAny(key, ['question', 'reponse', 'message', 'conversation', 'appel', 'разговор', 'вопрос', 'ответ', 'сообщение', 'звонок'])) return 'speech';
  if (hasAny(key, ['idee', 'pensee', 'avis', 'opinion', 'doute', 'идея', 'мнение', 'сомнение'])) return 'idea';
  if (hasAny(key, ['travail', 'bureau', 'projet', 'reunion', 'document', 'работа', 'офис', 'проект', 'встреча', 'документ'])) return 'work';
  if (hasAny(key, ['ecole', 'universite', 'cours', 'lecon', 'livre', 'cahier', 'stylo', 'школа', 'университет', 'урок', 'книга', 'тетрадь', 'ручка'])) return 'study';
  if (hasAny(key, ['sante', 'corps', 'tete', 'main', 'jambe', 'douleur', 'medicament', 'здоровье', 'тело', 'голова', 'рука', 'нога', 'боль', 'лекарство'])) return 'health';
  if (hasAny(key, ['preposition', 'determiner', 'pronoun', 'conjunction', 'adverb', 'предлог', 'определитель', 'местоимение', 'союз', 'наречие'])) return 'grammar';
  if (word.part_of_speech === 'verb') return 'action';
  if (word.part_of_speech === 'adjective') return 'quality';

  const category = getCategory(word);
  if (category === 'plants') return 'leaf';
  if (category === 'animals') return 'dog';
  if (category === 'food') return 'plate';
  if (category === 'travel') return 'map';
  if (category === 'home') return 'house';
  return 'idea';
}

const THEMES = {
  plants: ['#e9f8ed', '#d4efdb', '#3c8a4d', '#7fc489', '#2d5f39', '#c8a66b'],
  animals: ['#fff3ea', '#ffdcca', '#8f5a3c', '#f2b48d', '#6a402b', '#fff2d7'],
  food: ['#fff8e5', '#ffe7b7', '#9b671a', '#f0be61', '#7f510e', '#d95147'],
  travel: ['#eaf2ff', '#d4e3ff', '#486cb7', '#9bb8eb', '#315090', '#f9c75b'],
  home: ['#f5efff', '#e3d8ff', '#6a57ab', '#b39ce9', '#4b3b86', '#f2c8a1'],
  core: ['#edf4ff', '#dde8ff', '#466ca9', '#a7bee8', '#2c4b7f', '#f0c36d'],
};

const ICONS = {
  dog: ['M100 153c0-22 18-40 40-40h40c22 0 40 18 40 40v18c0 19-16 35-35 35h-50c-19 0-35-16-35-35v-18Z', 'M135 116 116 91c-6-8-4-19 5-24 8-4 17-2 23 5l17 22m48 25 16-25c6-9 18-11 26-4 7 6 8 16 3 24l-18 27'],
  cat: ['M120 172c0-30 19-54 44-54s44 24 44 54c0 18-14 32-32 32h-24c-18 0-32-14-32-32Z', 'M135 120 150 88l16 28m17-28 16 32'],
  bird: ['M91 160c27-33 63-49 110-48 15 0 29 6 39 17-24 40-57 60-99 60-30 0-50-11-50-29Z', 'M211 130l36 13-30 18M147 188l-16 24m42-25 18 25'],
  fish: ['M80 158c28-34 59-50 93-50 33 0 61 17 84 50-23 31-51 46-84 46-34 0-65-15-93-46Z', 'M82 158 54 134m28 24-28 25m112-31a12 12 0 1 0 0 24 12 12 0 0 0 0-24Z'],
  horse: ['M105 160c0-32 22-56 53-56h33c23 0 41 18 41 41v20c0 24-19 43-43 43h-43c-24 0-41-20-41-48Z', 'M152 105 138 78l21-20 26 22-7 25m45 26 28-7 7 20-29 11'],
  bear: ['M116 166c0-31 23-55 52-55s52 24 52 55c0 22-17 39-39 39h-26c-22 0-39-17-39-39Z', 'M136 112a15 15 0 1 0 0-30 15 15 0 0 0 0 30Zm64 0a15 15 0 1 0 0-30 15 15 0 0 0 0 30Z'],
  rabbit: ['M126 175c0-31 18-54 42-54s42 23 42 54c0 17-13 30-30 30h-24c-17 0-30-13-30-30Z', 'M146 123V77c0-15 8-27 18-27s18 12 18 27v46m0-3c2-29 11-48 25-56 10 13 10 35-1 62'],
  lion: ['M123 166c0-25 20-45 45-45s45 20 45 45c0 21-16 37-37 37h-16c-21 0-37-16-37-37Z', 'M168 90c39 0 70 31 70 70 0 12-3 24-9 34-8-24-31-40-61-40s-53 16-61 40c-6-10-9-22-9-34 0-39 31-70 70-70Z'],
  pig: ['M112 154c0-26 22-47 48-47h18c26 0 48 21 48 47v12c0 22-18 40-40 40h-34c-22 0-40-18-40-40v-12Z', 'M153 151h32a10 10 0 0 1 0 20h-32a10 10 0 0 1 0-20Z'],
  tree: ['M113 154c0-23 18-41 41-41 6 0 12 1 17 4 5-16 20-27 37-27 22 0 40 18 40 40 0 5-1 9-2 13 15 5 25 18 25 34 0 20-16 35-37 35H111c-21 0-37-16-37-36 0-17 11-31 27-35-1-4-1-7-1-11Z', 'M160 143h22v82h-22z'],
  flower: ['M142 98c10 0 18 8 18 18 0 4-1 7-3 10 7-7 16-11 26-11 13 0 23 10 23 23 0 9-5 17-12 21 14 0 24 10 24 24s-10 24-24 24c-9 0-17-5-21-12v34h-20v-34c-5 7-12 12-21 12-14 0-24-10-24-24s10-24 24-24c-7-4-12-12-12-21 0-13 10-23 23-23 10 0 19 4 26 11-2-3-3-6-3-10 0-10 8-18 18-18Z', 'M168 151a16 16 0 1 0 0 32 16 16 0 0 0 0-32Z'],
  leaf: ['M92 180c0-63 45-104 118-116-7 73-55 120-118 116Zm37-16c21-6 38-23 51-49', 'M124 124c14 14 24 37 24 67h-15c0-23-8-45-23-59z'],
  seed: ['M167 77c39 27 46 67 20 111-39-3-66-27-74-66 5-25 24-43 54-45Z', 'M135 178c14-20 32-36 55-48'],
  grass: ['M84 211c11-39 27-72 48-101 7 23 6 56-4 101H84Zm55 0c11-49 28-88 51-123 8 31 7 71-3 123h-48Zm61 0c11-34 27-64 49-91 6 23 5 53-2 91h-47Z', ''],
  forest: ['M86 205 130 98l43 107H86Zm59 0 35-84 35 84h-70Zm58 0 28-67 28 67h-56Z', 'M125 205h10v24h-10zm54 0h10v24h-10zm52 0h10v24h-10z'],
  branch: ['M82 169c65 0 96-17 132-61l10 11c-39 49-78 67-142 67z', 'M166 126c4-18 14-30 31-38l9 11c-12 7-20 17-24 32zm-39 20c3-16 9-28 19-38l11 8c-8 9-13 20-14 33z'],
  root: ['M156 76h21v59c0 12-3 22-9 31l-10 17v44h-20v-44l-11-17c-6-9-9-19-9-31V76h21v58c0 8 2 15 6 21l4 5 4-5c4-6 6-13 6-21z', 'M148 183c-18 0-36 9-51 27m63-27c17 0 35 9 51 27m-53-17c-7 6-12 14-15 24'],
  bread: ['M99 178c0-42 28-72 69-72s69 30 69 72c0 18-14 32-32 32h-74c-18 0-32-14-32-32Z', 'M139 131c0-9 7-16 16-16m22 5c0-9 7-16 16-16'],
  cheese: ['M92 192v-62l82-37 58 27v72H92Z', 'M142 145a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm49 21a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm-23-40a6 6 0 1 0 0 12 6 6 0 0 0 0-12Z'],
  soup: ['M93 150h150c0 35-28 63-63 63h-24c-35 0-63-28-63-63Z', 'M114 136h108c0 8-6 14-14 14h-80c-8 0-14-6-14-14Zm31-28c0-13 10-24 24-24m18 24c0-13 10-24 24-24'],
  apple: ['M121 158c0-29 21-52 47-52s47 23 47 52c0 27-21 49-47 49s-47-22-47-49Z', 'M165 106c-7-16-2-34 11-43 9 16 5 34-11 43Zm-14 2c-15-13-28-19-43-20 11-13 32-12 43 20Z'],
  pear: ['M135 119c0-16 13-30 30-30s30 14 30 30c0 8-3 15-8 21 17 9 28 27 28 47 0 30-20 52-45 52h-10c-25 0-45-22-45-52 0-20 11-38 28-47-5-6-8-13-8-21Z', 'M168 89c0-10 8-18 18-22'],
  grapes: ['M146 106a16 16 0 1 0 0 32 16 16 0 0 0 0-32Zm32 6a16 16 0 1 0 0 32 16 16 0 0 0 0-32Zm-47 26a16 16 0 1 0 0 32 16 16 0 0 0 0-32Zm33 18a16 16 0 1 0 0 32 16 16 0 0 0 0-32Zm34-15a16 16 0 1 0 0 32 16 16 0 0 0 0-32Z', 'M168 105c8-15 18-25 31-30'],
  carrot: ['M148 105c25 20 42 49 51 88-40 3-71-8-95-32 9-23 24-42 44-56Z', 'M171 91c8-15 20-27 36-36m-63 40c-14-9-27-14-42-14'],
  tomato: ['M120 160c0-30 22-53 49-53s49 23 49 53c0 26-22 46-49 46s-49-20-49-46Z', 'M168 98c14-12 28-15 42-10-6 9-15 14-27 15m-24-8c-12-9-24-11-35-6 7 10 16 14 27 14'],
  potato: ['M120 161c0-32 22-55 50-55s50 23 50 55c0 24-19 43-43 43h-14c-24 0-43-19-43-43Z', 'M151 142a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm31-12a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm13 29a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z'],
  rice: ['M99 169c0-27 20-48 47-48h44c27 0 47 21 47 48v23H99v-23Z', 'M119 143h98c-8-17-22-27-40-27h-18c-18 0-32 10-40 27Z'],
  pasta: ['M111 145c16-20 36-30 61-30s45 10 61 30c-16 20-36 30-61 30s-45-10-61-30Z', 'M130 146c7 9 18 14 31 14m20 0c13 0 24-5 32-14'],
  water: ['M168 80c31 38 46 66 46 88 0 28-20 50-46 50s-46-22-46-50c0-22 15-50 46-88Z', 'M150 184c4 7 11 12 19 14'],
  cup: ['M111 121h94c0 42-13 72-43 72h-8c-30 0-43-30-43-72Z', 'M205 129h21c12 0 21 10 21 22s-9 22-21 22h-15M111 198h104'],
  dessert: ['M116 194c0-25 24-44 52-44s52 19 52 44H116Z', 'M134 151 157 95h24l23 56Zm13-64a15 15 0 1 0 30 0 15 15 0 0 0-30 0Z'],
  suitcase: ['M102 109h132a16 16 0 0 1 16 16v70a16 16 0 0 1-16 16H102a16 16 0 0 1-16-16v-70a16 16 0 0 1 16-16Z', 'M141 109V91c0-12 10-22 22-22h10c12 0 22 10 22 22v18M164 145h12v28h-12z'],
  passport: ['M116 82h96c15 0 27 12 27 27v96c0 15-12 27-27 27h-96c-15 0-27-12-27-27v-96c0-15 12-27 27-27Z', 'M168 114a23 23 0 1 0 0 46 23 23 0 0 0 0-46Zm-37 72h74'],
  ticket: ['M82 128c12 0 22-10 22-22h132c0 12 10 22 22 22v42c-12 0-22 10-22 22H104c0-12-10-22-22-22v-42Z', 'M157 106v86M122 148h23m32 0h36'],
  station: ['M93 203v-62l75-47 75 47v62H93Z', 'M115 203v-37h27v37m19-37h18m21 0h27v37M83 203h170'],
  train: ['M107 101h122c18 0 32 14 32 32v45c0 18-14 32-32 32H107c-18 0-32-14-32-32v-45c0-18 14-32 32-32Z', 'M111 122h45v33h-45Zm56 0h45v33h-45ZM104 210l-18 22m46-22-18 22m96-22 18 22m-46-22 18 22'],
  plane: ['M75 153 187 123 242 82l13 12-33 57 34 14-9 13-41-7-26 45-12-7 7-46-61 15Z', ''],
  hotel: ['M106 85h124v122H106V85Z', 'M131 111h22v24h-22Zm0 39h22v24h-22Zm47-39h22v24h-22Zm0 39h22v24h-22Zm-19-65v122'],
  room: ['M96 201v-70h136v70h-24v-36h-88v36H96Z', 'M109 131V94h118v37M160 165h14'],
  map: ['M95 88 145 70l44 17 38-16v130l-38 16-44-17-50 18V88Z', 'M145 70v130m44-113v130'],
  museum: ['M84 121 168 73l84 48H84Zm22 15h124v71H106v-71Z', 'M126 136v71m42-71v71m42-71v71M95 207h146'],
  beach: ['M88 180c38-18 74-18 110 0 22 11 42 10 62-2v34H88v-32Z', 'M91 102a32 32 0 1 0 64 0 32 32 0 0 0-64 0Zm126 38 18 72m-55-72c28-16 56-16 84 0'],
  mountain: ['M78 210 143 99l40 66 27-43 53 88H78Z', 'M143 99l18 30 22 36m27-43 19 31'],
  house: ['M89 146 168 84l79 62v70H89v-70Z', 'M123 216v-55h39v55m29-55h31v31h-31z'],
  kitchen: ['M96 91h144v128H96V91Z', 'M113 111h110v37H113Zm0 55h46v36h-46Zm64 0h46v36h-46Z'],
  sofa: ['M93 153c0-20 16-36 36-36h78c20 0 36 16 36 36v51H93v-51Z', 'M107 172h122M104 204v22m128-22v22'],
  bed: ['M91 138h154v66H91v-66Z', 'M108 114h58v24h-58Zm69 0h58v24h-58ZM91 204v23m154-23v23'],
  lamp: ['M138 88h60l22 69H116l22-69Z', 'M168 157v55m-33 0h66'],
  door: ['M115 74h106v148H115V74Z', 'M140 96h56v126m5-74a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z'],
  window: ['M94 82h148v128H94V82Z', 'M168 82v128M94 146h148'],
  plate: ['M99 158a69 45 0 1 0 138 0 69 45 0 0 0-138 0Z', 'M128 158a40 24 0 1 0 80 0 40 24 0 0 0-80 0Z'],
  tech: ['M92 91h152v101H92V91Z', 'M142 213h52m-26-21v21M116 118h104'],
  money: ['M88 118h160v88H88v-88Z', 'M168 132a30 30 0 1 0 0 60 30 30 0 0 0 0-60Zm-79 18c18 0 32-14 32-32m95 0c0 18 14 32 32 32'],
  speech: ['M91 103h154v79H137l-34 34v-34H91v-79Z', 'M124 132h88m-88 25h58'],
  idea: ['M132 134c0-20 16-36 36-36s36 16 36 36c0 14-8 24-18 31-8 6-10 12-10 21h-16c0-16 5-25 16-33 7-5 12-11 12-19 0-11-9-20-20-20s-20 9-20 20h-16Z', 'M154 203h28m-23 18h18'],
  work: ['M96 116h144v93H96v-93Z', 'M136 116V95h64v21M96 150h144'],
  study: ['M91 104c36-18 72-18 108 0v95c-36-18-72-18-108 0v-95Zm108 0c24-12 48-15 72-8v96c-24-7-48-4-72 7v-95Z', 'M116 132h57m-57 25h57'],
  health: ['M168 89c26 0 47 21 47 47 0 38-47 78-47 78s-47-40-47-78c0-26 21-47 47-47Z', 'M168 117v56m-28-28h56'],
  grammar: ['M92 96h152v112H92V96Z', 'M124 132h88m-88 32h62M116 78l28 18m76-18-28 18'],
  action: ['M168 91a24 24 0 1 0 0 48 24 24 0 0 0 0-48Zm0 53v78m0-58-46 28m46-28 46 28', 'M130 97c-25 13-40 33-45 60m121-60c25 13 40 33 45 60'],
  quality: ['M168 82 195 137l61 9-44 43 10 60-54-28-54 28 10-60-44-43 61-9 27-55Z', ''],
};

function buildSvg(word, category, type) {
  const [start, end, main, secondary, line, accent] = THEMES[category] ?? THEMES.core;
  const icon = ICONS[type] ?? ICONS.idea;
  const seed = [...word.id].reduce((total, char) => total + char.charCodeAt(0), 0);
  const bubbleX = 62 + (seed % 40);
  const bubbleY = 52 + (seed % 26);
  const bubble2X = 232 - (seed % 34);
  const bubble2Y = 62 + (seed % 42);
  const rotate = (seed % 7) - 3;
  const scale = 0.93 + (seed % 10) * 0.01;

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240" fill="none">
  <defs>
    <linearGradient id="bg" x1="35" y1="18" x2="286" y2="224" gradientUnits="userSpaceOnUse">
      <stop stop-color="${start}"/>
      <stop offset="1" stop-color="${end}"/>
    </linearGradient>
  </defs>
  <rect width="320" height="240" rx="30" fill="url(#bg)"/>
  <circle cx="${bubbleX}" cy="${bubbleY}" r="28" fill="${secondary}" fill-opacity=".22"/>
  <circle cx="${bubble2X}" cy="${bubble2Y}" r="20" fill="${accent}" fill-opacity=".18"/>
  <rect x="18" y="18" width="284" height="204" rx="28" fill="#fff" fill-opacity=".30" stroke="#fff" stroke-opacity=".60"/>
  <g transform="rotate(${rotate} 168 154) scale(${scale}) translate(${(1 - scale) * 160} ${(1 - scale) * 120})">
    <path d="${icon[0]}" fill="${main}" stroke="${line}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    ${icon[1] ? `<path d="${icon[1]}" fill="${secondary}" stroke="${line}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
  </g>
</svg>`;
}

function svgToDataUrl(svg) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}`;
}

async function loadJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

const words = (await Promise.all(DATASET_FILES.map((file) => loadJson(file, [])))).flat();
const previousManifest = await loadJson(MANIFEST_PATH, {});
const nextManifest = {};
let preserved = 0;
let generated = 0;

for (const word of words) {
  const previous = previousManifest[word.id];
  const hasUsefulImage = previous?.imagePath || previous?.imageUrl;

  if (hasUsefulImage && previous.imageSource !== 'local:fallback') {
    nextManifest[word.id] = previous;
    preserved += 1;
    continue;
  }

  const category = getCategory(word);
  const illustrationType = getImageType(word);
  const imagePath = svgToDataUrl(buildSvg(word, category, illustrationType));

  nextManifest[word.id] = {
    imagePath,
    imageAlt: `${word.translation}: ${word.original}`,
    imagePackCategory: category,
    illustrationType,
    imageSource: 'local:fallback',
  };
  generated += 1;
}

await fs.mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(nextManifest, null, 2)}\n`);

console.log(JSON.stringify({ total: words.length, preserved, generated }, null, 2));
