import type { Word, WordPack } from '../types';
import { createPackCoverImage, createWordImage } from '../lib/wordImages';

type PackCategory = 'plants' | 'animals' | 'food' | 'travel' | 'home';

interface PackWordSeed {
  id: string;
  original: string;
  translation: string;
  transcription: string;
  exampleOriginal: string;
  exampleTranslation: string;
  partOfSpeech: string;
  tags: string[];
  illustrationType?: string;
}

function getDefaultIllustrationType(category: PackCategory): string {
  switch (category) {
    case 'plants':
      return 'leaf';
    case 'animals':
      return 'cat';
    case 'food':
      return 'bread';
    case 'travel':
      return 'train';
    case 'home':
      return 'house';
  }
}

function createPackWordFactory(packId: string, category: PackCategory, accent: string) {
  return ({
    id,
    original,
    translation,
    transcription,
    exampleOriginal,
    exampleTranslation,
    partOfSpeech,
    tags,
    illustrationType,
  }: PackWordSeed): Word => ({
    id: `${packId}-${id}`,
    original,
    translation,
    transcription,
    audio_original: '',
    example_original: exampleOriginal,
    example_translation: exampleTranslation,
    part_of_speech: partOfSpeech,
    level: 'A1',
    tags,
    packIds: [packId],
    source: 'pack',
    ...createWordImage(category, original, translation, illustrationType ?? getDefaultIllustrationType(category), accent),
  });
}

function createPack(
  id: string,
  title: string,
  description: string,
  accent: string,
  category: PackCategory,
  coverIllustrationType: string | PackWordSeed[],
  maybeWords?: PackWordSeed[],
): WordPack {
  const createWord = createPackWordFactory(id, category, accent);
  const words = Array.isArray(coverIllustrationType) ? coverIllustrationType : maybeWords ?? [];
  const coverType = Array.isArray(coverIllustrationType) ? getDefaultIllustrationType(category) : coverIllustrationType;

  return {
    id,
    title,
    description,
    accent,
    words: words.map(createWord),
    ...createPackCoverImage(category, title, coverType, accent),
  };
}

export const STARTER_PACKS: WordPack[] = [
  createPack('pack-plants', 'Растения', 'Французские слова про деревья, цветы, сад и базовую лексику о природе.', '#6ca66a', 'plants', 'tree', [
    { id: 'arbre', original: 'arbre', translation: 'дерево', transcription: '[aʁbʁ]', exampleOriginal: "L'arbre est vieux.", exampleTranslation: 'Это дерево старое.', partOfSpeech: 'noun', tags: ['природа', 'сад'], illustrationType: 'tree' },
    { id: 'fleur', original: 'fleur', translation: 'цветок', transcription: '[flœʁ]', exampleOriginal: 'La fleur sent bon.', exampleTranslation: 'Цветок приятно пахнет.', partOfSpeech: 'noun', tags: ['природа', 'сад'], illustrationType: 'flower' },
    { id: 'feuille', original: 'feuille', translation: 'лист', transcription: '[fœj]', exampleOriginal: 'La feuille tombe en automne.', exampleTranslation: 'Лист падает осенью.', partOfSpeech: 'noun', tags: ['природа'], illustrationType: 'leaf' },
    { id: 'racine', original: 'racine', translation: 'корень', transcription: '[ʁasin]', exampleOriginal: 'La racine est sous la terre.', exampleTranslation: 'Корень находится под землей.', partOfSpeech: 'noun', tags: ['ботаника'], illustrationType: 'root' },
    { id: 'graine', original: 'graine', translation: 'семя', transcription: '[ɡʁɛn]', exampleOriginal: 'Je plante une graine.', exampleTranslation: 'Я сажаю семя.', partOfSpeech: 'noun', tags: ['сад'], illustrationType: 'seed' },
    { id: 'herbe', original: 'herbe', translation: 'трава', transcription: '[ɛʁb]', exampleOriginal: "L'herbe est verte.", exampleTranslation: 'Трава зеленая.', partOfSpeech: 'noun', tags: ['природа'], illustrationType: 'grass' },
    { id: 'rose', original: 'rose', translation: 'роза', transcription: '[ʁoz]', exampleOriginal: 'La rose est rouge.', exampleTranslation: 'Роза красная.', partOfSpeech: 'noun', tags: ['цветы'], illustrationType: 'flower' },
    { id: 'tulipe', original: 'tulipe', translation: 'тюльпан', transcription: '[tylip]', exampleOriginal: 'La tulipe fleurit au printemps.', exampleTranslation: 'Тюльпан цветет весной.', partOfSpeech: 'noun', tags: ['цветы'], illustrationType: 'flower' },
    { id: 'forêt', original: 'forêt', translation: 'лес', transcription: '[fɔʁɛ]', exampleOriginal: 'Nous marchons dans la forêt.', exampleTranslation: 'Мы гуляем по лесу.', partOfSpeech: 'noun', tags: ['природа'], illustrationType: 'forest' },
    { id: 'branche', original: 'branche', translation: 'ветка', transcription: '[bʁɑ̃ʃ]', exampleOriginal: 'Un oiseau est sur la branche.', exampleTranslation: 'Птица сидит на ветке.', partOfSpeech: 'noun', tags: ['природа'], illustrationType: 'branch' },
    { id: 'tronc', original: 'tronc', translation: 'ствол', transcription: '[tʁɔ̃]', exampleOriginal: "Le tronc de l'arbre est large.", exampleTranslation: 'Ствол дерева широкий.', partOfSpeech: 'noun', tags: ['ботаника'], illustrationType: 'tree' },
    { id: 'jardin', original: 'jardin', translation: 'сад', transcription: '[ʒaʁdɛ̃]', exampleOriginal: 'Le jardin est derrière la maison.', exampleTranslation: 'Сад находится за домом.', partOfSpeech: 'noun', tags: ['сад'], illustrationType: 'flower' },
    { id: 'potager', original: 'potager', translation: 'огород', transcription: '[pɔtaʒe]', exampleOriginal: 'Mon grand-père a un potager.', exampleTranslation: 'У моего дедушки есть огород.', partOfSpeech: 'noun', tags: ['сад'], illustrationType: 'leaf' },
    { id: 'mousse', original: 'mousse', translation: 'мох', transcription: '[mus]', exampleOriginal: 'La pierre est couverte de mousse.', exampleTranslation: 'Камень покрыт мхом.', partOfSpeech: 'noun', tags: ['природа'], illustrationType: 'grass' },
    { id: 'champignon', original: 'champignon', translation: 'гриб', transcription: '[ʃɑ̃piɲɔ̃]', exampleOriginal: 'Le champignon pousse après la pluie.', exampleTranslation: 'Гриб растет после дождя.', partOfSpeech: 'noun', tags: ['лес'], illustrationType: 'flower' },
    { id: 'plante', original: 'plante', translation: 'растение', transcription: '[plɑ̃t]', exampleOriginal: 'Cette plante a besoin de soleil.', exampleTranslation: 'Этому растению нужно солнце.', partOfSpeech: 'noun', tags: ['ботаника'], illustrationType: 'leaf' },
    { id: 'rosier', original: 'rosier', translation: 'куст роз', transcription: '[ʁozje]', exampleOriginal: 'Le rosier est devant la fenêtre.', exampleTranslation: 'Розовый куст стоит перед окном.', partOfSpeech: 'noun', tags: ['цветы'], illustrationType: 'bouquet' },
    { id: 'pin', original: 'pin', translation: 'сосна', transcription: '[pɛ̃]', exampleOriginal: 'Le pin reste vert en hiver.', exampleTranslation: 'Сосна остается зеленой зимой.', partOfSpeech: 'noun', tags: ['деревья'], illustrationType: 'tree' },
    { id: 'chêne', original: 'chêne', translation: 'дуб', transcription: '[ʃɛn]', exampleOriginal: 'Le chêne est très solide.', exampleTranslation: 'Дуб очень крепкий.', partOfSpeech: 'noun', tags: ['деревья'], illustrationType: 'tree' },
    { id: 'bouquet', original: 'bouquet', translation: 'букет', transcription: '[bukɛ]', exampleOriginal: "J'offre un bouquet à ma mère.", exampleTranslation: 'Я дарю букет маме.', partOfSpeech: 'noun', tags: ['цветы'], illustrationType: 'bouquet' },
  ]),
  createPack('pack-animals', 'Животные', 'Базовый набор французских слов про домашних, диких и фермерских животных.', '#d77b5e', 'animals', 'cat', [
    { id: 'chien', original: 'chien', translation: 'собака', transcription: '[ʃjɛ̃]', exampleOriginal: 'Le chien dort près de la porte.', exampleTranslation: 'Собака спит у двери.', partOfSpeech: 'noun', tags: ['животные'], illustrationType: 'dog' },
    { id: 'chat', original: 'chat', translation: 'кот', transcription: '[ʃa]', exampleOriginal: 'Le chat aime le soleil.', exampleTranslation: 'Кот любит солнце.', partOfSpeech: 'noun', tags: ['животные'], illustrationType: 'cat' },
    { id: 'oiseau', original: 'oiseau', translation: 'птица', transcription: '[wazo]', exampleOriginal: "L'oiseau chante le matin.", exampleTranslation: 'Птица поет утром.', partOfSpeech: 'noun', tags: ['природа'], illustrationType: 'bird' },
    { id: 'poisson', original: 'poisson', translation: 'рыба', transcription: '[pwasɔ̃]', exampleOriginal: 'Le poisson nage vite.', exampleTranslation: 'Рыба быстро плавает.', partOfSpeech: 'noun', tags: ['животные'], illustrationType: 'fish' },
    { id: 'cheval', original: 'cheval', translation: 'лошадь', transcription: '[ʃəval]', exampleOriginal: 'Le cheval court dans le champ.', exampleTranslation: 'Лошадь бежит по полю.', partOfSpeech: 'noun', tags: ['ферма'], illustrationType: 'horse' },
    { id: 'vache', original: 'vache', translation: 'корова', transcription: '[vaʃ]', exampleOriginal: "La vache mange de l'herbe.", exampleTranslation: 'Корова ест траву.', partOfSpeech: 'noun', tags: ['ферма'] },
    { id: 'mouton', original: 'mouton', translation: 'овца', transcription: '[mutɔ̃]', exampleOriginal: 'Le mouton a une laine douce.', exampleTranslation: 'У овцы мягкая шерсть.', partOfSpeech: 'noun', tags: ['ферма'] },
    { id: 'lapin', original: 'lapin', translation: 'кролик', transcription: '[lapɛ̃]', exampleOriginal: 'Le lapin aime les carottes.', exampleTranslation: 'Кролик любит морковь.', partOfSpeech: 'noun', tags: ['животные'] },
    { id: 'renard', original: 'renard', translation: 'лиса', transcription: '[ʁənaʁ]', exampleOriginal: 'Le renard est rusé.', exampleTranslation: 'Лиса хитрая.', partOfSpeech: 'noun', tags: ['дикие'] },
    { id: 'ours', original: 'ours', translation: 'медведь', transcription: '[uʁs]', exampleOriginal: "L'ours vit dans la forêt.", exampleTranslation: 'Медведь живет в лесу.', partOfSpeech: 'noun', tags: ['дикие'] },
    { id: 'loup', original: 'loup', translation: 'волк', transcription: '[lu]', exampleOriginal: 'Le loup hurle la nuit.', exampleTranslation: 'Волк воет ночью.', partOfSpeech: 'noun', tags: ['дикие'] },
    { id: 'lion', original: 'lion', translation: 'лев', transcription: '[ljɔ̃]', exampleOriginal: 'Le lion est le roi des animaux.', exampleTranslation: 'Лев — король зверей.', partOfSpeech: 'noun', tags: ['дикие'] },
    { id: 'tigre', original: 'tigre', translation: 'тигр', transcription: '[tiɡʁ]', exampleOriginal: 'Le tigre a des rayures.', exampleTranslation: 'У тигра есть полосы.', partOfSpeech: 'noun', tags: ['дикие'] },
    { id: 'singe', original: 'singe', translation: 'обезьяна', transcription: '[sɛ̃ʒ]', exampleOriginal: 'Le singe grimpe vite.', exampleTranslation: 'Обезьяна быстро лазает.', partOfSpeech: 'noun', tags: ['дикие'] },
    { id: 'grenouille', original: 'grenouille', translation: 'лягушка', transcription: '[ɡʁənuj]', exampleOriginal: "La grenouille saute dans l'eau.", exampleTranslation: 'Лягушка прыгает в воду.', partOfSpeech: 'noun', tags: ['природа'] },
    { id: 'canard', original: 'canard', translation: 'утка', transcription: '[kanaʁ]', exampleOriginal: 'Le canard nage sur le lac.', exampleTranslation: 'Утка плавает по озеру.', partOfSpeech: 'noun', tags: ['ферма'] },
    { id: 'poule', original: 'poule', translation: 'курица', transcription: '[pul]', exampleOriginal: 'La poule pond un œuf.', exampleTranslation: 'Курица несет яйцо.', partOfSpeech: 'noun', tags: ['ферма'] },
    { id: 'cochon', original: 'cochon', translation: 'свинья', transcription: '[kɔʃɔ̃]', exampleOriginal: 'Le cochon vit à la ferme.', exampleTranslation: 'Свинья живет на ферме.', partOfSpeech: 'noun', tags: ['ферма'] },
    { id: 'âne', original: 'âne', translation: 'осёл', transcription: '[an]', exampleOriginal: "L'âne porte un sac.", exampleTranslation: 'Осел несет мешок.', partOfSpeech: 'noun', tags: ['ферма'] },
    { id: 'écureuil', original: 'écureuil', translation: 'белка', transcription: '[ekyʁœj]', exampleOriginal: "L'écureuil cache des noix.", exampleTranslation: 'Белка прячет орехи.', partOfSpeech: 'noun', tags: ['лес'] },
  ]),
  createPack('pack-food', 'Еда', 'Повседневная французская лексика про продукты, блюда и напитки.', '#d5a443', 'food', [
    { id: 'pain', original: 'pain', translation: 'хлеб', transcription: '[pɛ̃]', exampleOriginal: 'Je coupe le pain frais.', exampleTranslation: 'Я режу свежий хлеб.', partOfSpeech: 'noun', tags: ['еда'] },
    { id: 'fromage', original: 'fromage', translation: 'сыр', transcription: '[fʁɔmaʒ]', exampleOriginal: 'Le fromage est sur la table.', exampleTranslation: 'Сыр лежит на столе.', partOfSpeech: 'noun', tags: ['еда'] },
    { id: 'beurre', original: 'beurre', translation: 'масло', transcription: '[bœʁ]', exampleOriginal: 'Je mets du beurre sur le pain.', exampleTranslation: 'Я намазываю масло на хлеб.', partOfSpeech: 'noun', tags: ['еда'] },
    { id: 'soupe', original: 'soupe', translation: 'суп', transcription: '[sup]', exampleOriginal: 'La soupe est chaude.', exampleTranslation: 'Суп горячий.', partOfSpeech: 'noun', tags: ['еда'] },
    { id: 'salade', original: 'salade', translation: 'салат', transcription: '[salad]', exampleOriginal: 'La salade est très fraîche.', exampleTranslation: 'Салат очень свежий.', partOfSpeech: 'noun', tags: ['еда'] },
    { id: 'pomme', original: 'pomme', translation: 'яблоко', transcription: '[pɔm]', exampleOriginal: 'Je mange une pomme rouge.', exampleTranslation: 'Я ем красное яблоко.', partOfSpeech: 'noun', tags: ['фрукты'] },
    { id: 'poire', original: 'poire', translation: 'груша', transcription: '[pwaʁ]', exampleOriginal: 'La poire est sucrée.', exampleTranslation: 'Груша сладкая.', partOfSpeech: 'noun', tags: ['фрукты'] },
    { id: 'raisin', original: 'raisin', translation: 'виноград', transcription: '[ʁɛzɛ̃]', exampleOriginal: 'Le raisin est dans le bol.', exampleTranslation: 'Виноград в миске.', partOfSpeech: 'noun', tags: ['фрукты'] },
    { id: 'carotte', original: 'carotte', translation: 'морковь', transcription: '[kaʁɔt]', exampleOriginal: 'La carotte est orange.', exampleTranslation: 'Морковь оранжевая.', partOfSpeech: 'noun', tags: ['овощи'] },
    { id: 'tomate', original: 'tomate', translation: 'помидор', transcription: '[tɔmat]', exampleOriginal: 'La tomate est mûre.', exampleTranslation: 'Помидор спелый.', partOfSpeech: 'noun', tags: ['овощи'] },
    { id: 'pomme de terre', original: 'pomme de terre', translation: 'картофель', transcription: '[pɔm də tɛʁ]', exampleOriginal: 'La pomme de terre cuit au four.', exampleTranslation: 'Картофель запекается в духовке.', partOfSpeech: 'noun', tags: ['овощи'] },
    { id: 'riz', original: 'riz', translation: 'рис', transcription: '[ʁi]', exampleOriginal: 'Le riz accompagne le poisson.', exampleTranslation: 'Рис подается к рыбе.', partOfSpeech: 'noun', tags: ['еда'] },
    { id: 'pâtes', original: 'pâtes', translation: 'макароны', transcription: '[pat]', exampleOriginal: 'Les pâtes sont prêtes.', exampleTranslation: 'Макароны готовы.', partOfSpeech: 'noun', tags: ['еда'] },
    { id: 'poulet', original: 'poulet', translation: 'курица', transcription: '[pulɛ]', exampleOriginal: 'Le poulet est au four.', exampleTranslation: 'Курица в духовке.', partOfSpeech: 'noun', tags: ['мясо'] },
    { id: 'poisson-grill', original: 'poisson grillé', translation: 'жареная рыба', transcription: '[pwasɔ̃ ɡʁije]', exampleOriginal: 'Le poisson grillé sent bon.', exampleTranslation: 'Жареная рыба вкусно пахнет.', partOfSpeech: 'noun', tags: ['еда'] },
    { id: 'eau', original: 'eau', translation: 'вода', transcription: '[o]', exampleOriginal: "Je bois un verre d'eau.", exampleTranslation: 'Я пью стакан воды.', partOfSpeech: 'noun', tags: ['напитки'] },
    { id: 'jus', original: 'jus', translation: 'сок', transcription: '[ʒy]', exampleOriginal: 'Le jus est froid.', exampleTranslation: 'Сок холодный.', partOfSpeech: 'noun', tags: ['напитки'] },
    { id: 'thé', original: 'thé', translation: 'чай', transcription: '[te]', exampleOriginal: 'Nous buvons du thé le soir.', exampleTranslation: 'Мы пьем чай вечером.', partOfSpeech: 'noun', tags: ['напитки'] },
    { id: 'café', original: 'café', translation: 'кофе', transcription: '[kafe]', exampleOriginal: 'Le café est très fort.', exampleTranslation: 'Кофе очень крепкий.', partOfSpeech: 'noun', tags: ['напитки'] },
    { id: 'dessert', original: 'dessert', translation: 'десерт', transcription: '[dezɛʁ]', exampleOriginal: 'Le dessert est délicieux.', exampleTranslation: 'Десерт очень вкусный.', partOfSpeech: 'noun', tags: ['еда'] },
  ]),
  createPack('pack-travel', 'Путешествия', 'Слова для поездок: транспорт, маршрут, проживание и ориентация в городе.', '#5d88d6', 'travel', [
    { id: 'voyage', original: 'voyage', translation: 'путешествие', transcription: '[vwajaʒ]', exampleOriginal: 'Le voyage commence demain.', exampleTranslation: 'Путешествие начинается завтра.', partOfSpeech: 'noun', tags: ['поездка'] },
    { id: 'valise', original: 'valise', translation: 'чемодан', transcription: '[valiz]', exampleOriginal: 'Ma valise est prête.', exampleTranslation: 'Мой чемодан готов.', partOfSpeech: 'noun', tags: ['поездка'] },
    { id: 'passeport', original: 'passeport', translation: 'паспорт', transcription: '[paspɔʁ]', exampleOriginal: 'Je garde mon passeport ici.', exampleTranslation: 'Я держу паспорт здесь.', partOfSpeech: 'noun', tags: ['документы'] },
    { id: 'billet', original: 'billet', translation: 'билет', transcription: '[bijɛ]', exampleOriginal: "J'achète un billet de train.", exampleTranslation: 'Я покупаю билет на поезд.', partOfSpeech: 'noun', tags: ['транспорт'] },
    { id: 'gare', original: 'gare', translation: 'вокзал', transcription: '[ɡaʁ]', exampleOriginal: 'La gare est au centre-ville.', exampleTranslation: 'Вокзал находится в центре города.', partOfSpeech: 'noun', tags: ['транспорт'] },
    { id: 'train', original: 'train', translation: 'поезд', transcription: '[tʁɛ̃]', exampleOriginal: 'Le train arrive à midi.', exampleTranslation: 'Поезд прибывает в полдень.', partOfSpeech: 'noun', tags: ['транспорт'] },
    { id: 'avion', original: 'avion', translation: 'самолет', transcription: '[avjɔ̃]', exampleOriginal: "L'avion décolle à l'heure.", exampleTranslation: 'Самолет взлетает вовремя.', partOfSpeech: 'noun', tags: ['транспорт'] },
    { id: 'aéroport', original: 'aéroport', translation: 'аэропорт', transcription: '[aeʁɔpɔʁ]', exampleOriginal: "L'aéroport est loin.", exampleTranslation: 'Аэропорт находится далеко.', partOfSpeech: 'noun', tags: ['транспорт'] },
    { id: 'hôtel', original: 'hôtel', translation: 'отель', transcription: '[otɛl]', exampleOriginal: "L'hôtel est près du musée.", exampleTranslation: 'Отель рядом с музеем.', partOfSpeech: 'noun', tags: ['проживание'] },
    { id: 'chambre', original: 'chambre', translation: 'номер', transcription: '[ʃɑ̃bʁ]', exampleOriginal: 'La chambre donne sur la rue.', exampleTranslation: 'Номер выходит на улицу.', partOfSpeech: 'noun', tags: ['проживание'] },
    { id: 'réservation', original: 'réservation', translation: 'бронь', transcription: '[ʁezeʁvasjɔ̃]', exampleOriginal: "J'ai une réservation pour ce soir.", exampleTranslation: 'У меня бронь на этот вечер.', partOfSpeech: 'noun', tags: ['проживание'] },
    { id: 'carte', original: 'carte', translation: 'карта', transcription: '[kaʁt]', exampleOriginal: 'Je regarde la carte de la ville.', exampleTranslation: 'Я смотрю карту города.', partOfSpeech: 'noun', tags: ['навигация'] },
    { id: 'itinéraire', original: 'itinéraire', translation: 'маршрут', transcription: '[itinɛʁɛʁ]', exampleOriginal: "L'itinéraire est simple.", exampleTranslation: 'Маршрут простой.', partOfSpeech: 'noun', tags: ['навигация'] },
    { id: 'musée', original: 'musée', translation: 'музей', transcription: '[myze]', exampleOriginal: 'Le musée ouvre à dix heures.', exampleTranslation: 'Музей открывается в десять.', partOfSpeech: 'noun', tags: ['город'] },
    { id: 'plage', original: 'plage', translation: 'пляж', transcription: '[plaʒ]', exampleOriginal: 'La plage est magnifique.', exampleTranslation: 'Пляж великолепный.', partOfSpeech: 'noun', tags: ['отдых'] },
    { id: 'montagne', original: 'montagne', translation: 'гора', transcription: '[mɔ̃taɲ]', exampleOriginal: 'Nous allons à la montagne.', exampleTranslation: 'Мы едем в горы.', partOfSpeech: 'noun', tags: ['природа'] },
    { id: 'guide', original: 'guide', translation: 'гид', transcription: '[ɡid]', exampleOriginal: 'Le guide parle français.', exampleTranslation: 'Гид говорит по-французски.', partOfSpeech: 'noun', tags: ['город'] },
    { id: 'touriste', original: 'touriste', translation: 'турист', transcription: '[tuʁist]', exampleOriginal: 'Le touriste prend des photos.', exampleTranslation: 'Турист делает фотографии.', partOfSpeech: 'noun', tags: ['поездка'] },
    { id: 'départ', original: 'départ', translation: 'отправление', transcription: '[depaʁ]', exampleOriginal: 'Le départ est annoncé.', exampleTranslation: 'Отправление объявлено.', partOfSpeech: 'noun', tags: ['транспорт'] },
    { id: 'arrivée', original: 'arrivée', translation: 'прибытие', transcription: '[aʁive]', exampleOriginal: "L'arrivée est prévue à 18 heures.", exampleTranslation: 'Прибытие запланировано на 18 часов.', partOfSpeech: 'noun', tags: ['транспорт'] },
  ]),
  createPack('pack-home', 'Дом и быт', 'Практичная французская лексика для дома, мебели, комнат и повседневных дел.', '#8f76cb', 'home', [
    { id: 'maison', original: 'maison', translation: 'дом', transcription: '[mɛzɔ̃]', exampleOriginal: 'La maison est lumineuse.', exampleTranslation: 'Дом светлый.', partOfSpeech: 'noun', tags: ['дом'] },
    { id: 'appartement', original: 'appartement', translation: 'квартира', transcription: '[apaʁtəmɑ̃]', exampleOriginal: "L'appartement est au troisième étage.", exampleTranslation: 'Квартира на третьем этаже.', partOfSpeech: 'noun', tags: ['дом'] },
    { id: 'cuisine', original: 'cuisine', translation: 'кухня', transcription: '[kɥizin]', exampleOriginal: 'La cuisine est propre.', exampleTranslation: 'Кухня чистая.', partOfSpeech: 'noun', tags: ['дом'] },
    { id: 'salon', original: 'salon', translation: 'гостиная', transcription: '[salɔ̃]', exampleOriginal: 'Nous regardons un film dans le salon.', exampleTranslation: 'Мы смотрим фильм в гостиной.', partOfSpeech: 'noun', tags: ['дом'] },
    { id: 'chambre', original: 'chambre', translation: 'спальня', transcription: '[ʃɑ̃bʁ]', exampleOriginal: 'La chambre est calme.', exampleTranslation: 'Спальня тихая.', partOfSpeech: 'noun', tags: ['дом'] },
    { id: 'salle de bain', original: 'salle de bain', translation: 'ванная', transcription: '[sal də bɛ̃]', exampleOriginal: 'La salle de bain est à gauche.', exampleTranslation: 'Ванная слева.', partOfSpeech: 'noun', tags: ['дом'] },
    { id: 'table', original: 'table', translation: 'стол', transcription: '[tabl]', exampleOriginal: 'Le livre est sur la table.', exampleTranslation: 'Книга на столе.', partOfSpeech: 'noun', tags: ['мебель'] },
    { id: 'chaise', original: 'chaise', translation: 'стул', transcription: '[ʃɛz]', exampleOriginal: 'La chaise est près de la fenêtre.', exampleTranslation: 'Стул рядом с окном.', partOfSpeech: 'noun', tags: ['мебель'] },
    { id: 'lit', original: 'lit', translation: 'кровать', transcription: '[li]', exampleOriginal: 'Le lit est confortable.', exampleTranslation: 'Кровать удобная.', partOfSpeech: 'noun', tags: ['мебель'] },
    { id: 'armoire', original: 'armoire', translation: 'шкаф', transcription: '[aʁmwaʁ]', exampleOriginal: "L'armoire est blanche.", exampleTranslation: 'Шкаф белый.', partOfSpeech: 'noun', tags: ['мебель'] },
    { id: 'canapé', original: 'canapé', translation: 'диван', transcription: '[kanape]', exampleOriginal: 'Le canapé est neuf.', exampleTranslation: 'Диван новый.', partOfSpeech: 'noun', tags: ['мебель'] },
    { id: 'lampe', original: 'lampe', translation: 'лампа', transcription: '[lɑ̃p]', exampleOriginal: 'La lampe éclaire la pièce.', exampleTranslation: 'Лампа освещает комнату.', partOfSpeech: 'noun', tags: ['дом'] },
    { id: 'porte', original: 'porte', translation: 'дверь', transcription: '[pɔʁt]', exampleOriginal: 'La porte est ouverte.', exampleTranslation: 'Дверь открыта.', partOfSpeech: 'noun', tags: ['дом'] },
    { id: 'fenêtre', original: 'fenêtre', translation: 'окно', transcription: '[fənɛtʁ]', exampleOriginal: 'La fenêtre donne sur la cour.', exampleTranslation: 'Окно выходит во двор.', partOfSpeech: 'noun', tags: ['дом'] },
    { id: 'balai', original: 'balai', translation: 'веник', transcription: '[balɛ]', exampleOriginal: 'Je prends le balai.', exampleTranslation: 'Я беру веник.', partOfSpeech: 'noun', tags: ['быт'] },
    { id: 'aspirateur', original: 'aspirateur', translation: 'пылесос', transcription: '[aspiʁatœʁ]', exampleOriginal: "L'aspirateur est dans le placard.", exampleTranslation: 'Пылесос в шкафу.', partOfSpeech: 'noun', tags: ['быт'] },
    { id: 'lessive', original: 'lessive', translation: 'стирка', transcription: '[lɛsiv]', exampleOriginal: 'Je fais la lessive samedi.', exampleTranslation: 'Я стираю в субботу.', partOfSpeech: 'noun', tags: ['быт'] },
    { id: 'vaisselle', original: 'vaisselle', translation: 'посуда', transcription: '[vɛsɛl]', exampleOriginal: 'La vaisselle est propre.', exampleTranslation: 'Посуда чистая.', partOfSpeech: 'noun', tags: ['быт'] },
    { id: 'serviette', original: 'serviette', translation: 'полотенце', transcription: '[sɛʁvjɛt]', exampleOriginal: 'La serviette est sèche.', exampleTranslation: 'Полотенце сухое.', partOfSpeech: 'noun', tags: ['быт'] },
    { id: 'étagère', original: 'étagère', translation: 'полка', transcription: '[etaʒɛʁ]', exampleOriginal: "L'étagère porte beaucoup de livres.", exampleTranslation: 'Полка держит много книг.', partOfSpeech: 'noun', tags: ['мебель'] },
  ]),
];

export function getPackWords(): Word[] {
  return STARTER_PACKS.flatMap((pack) => pack.words);
}
