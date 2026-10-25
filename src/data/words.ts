import { getPackWords, STARTER_PACKS } from './wordPacks';
import type { JlptLevel, LearningLanguage, Word, WordLevel, WordPack } from '../types';
import { getStudyLevelRank } from '../lib/levels';
import { createFallbackWordImage } from '../lib/wordImages';
import { deriveFrenchLatinTranscription } from '../lib/utils';
import { FRENCH_H_ASPIRE, FRENCH_NOUN_GENDERS } from './frenchNounGenders';

const DATASET_URLS = ['/data/words_a1.json', '/data/words_a2.json', '/data/words_b1.json'] as const;
const FETCH_TIMEOUT_MS = 10_000;
const LEVEL_ORDER: Record<WordLevel, number> = {
  A1: 0,
  A2: 1,
  B1: 2,
};

const wordsPromiseByLanguage = new Map<LearningLanguage, Promise<Word[]>>();

const CORE_STABLE_EXPRESSIONS = new Set([
  'au revoir',
  "s'il vous plaît",
  'ça va',
  'comment ça va',
  'à bientôt',
  'bonne journée',
  'bonne soirée',
  'bonne nuit',
  'je ne sais pas',
  'je comprends',
  "d'accord",
  'à droite',
  'à gauche',
  'une fois',
  'deux fois',
  'à demain',
  'bon appétit',
  'à la maison',
  'au travail',
  'à pied',
  'en voiture',
  'en train',
  'il y a',
  'pas du tout',
  'bien sûr',
  'pas mal',
  'par exemple',
  'à côté de',
  'en face de',
  'au centre',
  'tout le monde',
  'en vacances',
  'en retard',
  "à l'heure",
  'à la fin',
  'avoir besoin de',
  'avoir envie de',
  'faire attention',
  'se sentir bien',
  'se sentir mal',
  'faire une pause',
  "je pense que",
  'il faut',
  'de temps en temps',
  'pour le moment',
  'au début',
  'de plus en plus',
  'de moins en moins',
  'prendre soin de',
  'avoir raison',
  'avoir tort',
  'prendre une décision',
  'ça dépend',
  'en fait',
  "n'importe quoi",
  'à mon avis',
].map((value) => normalizePhrase(value)));

const SYNTHETIC_EXPRESSION_PREFIXES = [
  "j'aime ",
  'je vois ',
  'je cherche ',
  'où est ',
  'je vais à ',
  'je suis à ',
  'nous arrivons à ',
  'je veux ',
  'je peux ',
  'il faut ',
  'nous allons ',
  "c'est ",
  'très ',
  'trop ',
  'assez ',
].map((value) => normalizePhrase(value));

type WordImageManifest = Record<
  string,
  Pick<
    Word,
    | 'imagePath'
    | 'imageUrl'
    | 'imageAlt'
    | 'imagePackCategory'
    | 'illustrationType'
    | 'imagePrompt'
    | 'imageSource'
    | 'imageSourceTitle'
    | 'imageProvider'
    | 'imageLicense'
    | 'imageLicenseUrl'
    | 'imageAttribution'
    | 'imageAssociationWordId'
  >
>;

function isGenericExample(text: string): boolean {
  return /On dit souvent/.test(text);
}

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function chooseVariant(value: string, variants: string[]): string {
  const seed = [...value].reduce((total, char) => total + char.charCodeAt(0), 0);
  return variants[seed % variants.length];
}

function chooseVariantPair(
  value: string,
  variants: Array<{ example_original: string; example_translation: string }>,
): { example_original: string; example_translation: string } {
  return variants[[...value].reduce((total, char) => total + char.charCodeAt(0), 0) % variants.length];
}

function startsWithVowelSound(value: string): boolean {
  const word = value.trim().toLowerCase();
  if (/^y[aeiouéèêàâôû]/.test(word)) return false; // le yaourt, le yoga
  return /^[aeiouyhàâæéèêëîïôœùûü]/i.test(word) && !FRENCH_H_ASPIRE.has(word.split(/[\s-]/)[0]) && !FRENCH_H_ASPIRE.has(word);
}

function isLikelyPluralNoun(value: string): boolean {
  const normalized = normalizeKey(value);

  if (normalized.includes(' ')) {
    return false;
  }

  if (['bus', 'cours', 'temps', 'pays', 'prix', 'bras'].includes(normalized)) {
    return false;
  }

  return /(?:s|x)$/.test(normalized);
}

function isLikelyFeminineNoun(value: string): boolean {
  const normalized = normalizeKey(value);

  return /(?:tion|sion|te|tte|ette|ance|ence|ie|ure|euse|eure|aison|esse|ette|iere|iere|erie|ade|ance|ette|eur|e)$/.test(
    normalized,
  ) && !/(?:age|ege|isme|ment|oir|phone|scope|ome|eau)$/.test(normalized);
}

function getFrenchArticle(word: string, mode: 'definite' | 'indefinite'): string {
  const trimmed = word.trim();
  const gender = FRENCH_NOUN_GENDERS[trimmed.toLowerCase()];

  if (gender) {
    if (gender === 'pl') return mode === 'definite' ? 'les' : 'des';
    if (mode === 'definite' && startsWithVowelSound(trimmed)) return "l'";
    if (gender === 'f') return mode === 'definite' ? 'la' : 'une';
    return mode === 'definite' ? 'le' : 'un';
  }

  if (isLikelyPluralNoun(trimmed)) {
    return mode === 'definite' ? 'les' : 'des';
  }

  if (mode === 'definite' && startsWithVowelSound(trimmed)) {
    return "l'";
  }

  return isLikelyFeminineNoun(trimmed)
    ? mode === 'definite'
      ? 'la'
      : 'une'
    : mode === 'definite'
      ? 'le'
      : 'un';
}

function withArticle(word: string, mode: 'definite' | 'indefinite', capitalized = false): string {
  const article = getFrenchArticle(word, mode);
  const separator = article.endsWith("'") ? '' : ' ';
  const phrase = `${article}${separator}${word}`;
  return capitalized ? phrase.charAt(0).toUpperCase() + phrase.slice(1) : phrase;
}

const MASS_NOUNS = new Set(`sang riz lait eau neige pluie sable sel sucre beurre farine huile miel vin biere cafe the jus fromage pain
viande poulet boeuf porc agneau jambon thon saumon soupe confiture chocolat creme yaourt vinaigre poivre ail persil basilic menthe
sirop limonade laine soie coton cuir bois papier argent monnaie air ciel terre herbe mais linge`.split(/\s+/));
const ABSTRACT_NOUNS = new Set(`soif faim colere stress age calme courage patience honte joie peur fatigue amour amitie bonheur confiance
curiosite fierte jalousie tristesse tendresse liberte paix silence sommeil attention importance sante chance ennui envie espoir
inquietude respect responsabilite securite verite memoire douleur fievre toux grippe rhume`.split(/\s+/));

function buildNounExample(word: Word): { example_original: string; example_translation: string } {
  const original = word.original;
  const definite = withArticle(original, 'definite');
  const definiteCap = withArticle(original, 'definite', true);
  const indefinite = withArticle(original, 'indefinite');
  const key = normalizeKey(original);

  const specific: Record<string, { example_original: string; example_translation: string }> = {
    addition: {
      example_original: "L'addition, s'il vous plaît.",
      example_translation: 'Счёт, пожалуйста.',
    },
    aeroport: {
      example_original: "L'aéroport est à trente minutes du centre.",
      example_translation: 'Аэропорт находится в тридцати минутах от центра.',
    },
    amour: {
      example_original: "L'amour demande du temps et de la confiance.",
      example_translation: 'Любовь требует времени и доверия.',
    },
    appartement: {
      example_original: "L'appartement est au troisième étage.",
      example_translation: 'Квартира находится на третьем этаже.',
    },
    argent: {
      example_original: "Je n'ai pas assez d'argent pour ce voyage.",
      example_translation: 'У меня недостаточно денег для этой поездки.',
    },
    avenir: {
      example_original: "Il pense souvent à son avenir professionnel.",
      example_translation: 'Он часто думает о своём будущем в профессии.',
    },
    billet: {
      example_original: "J'achète un billet pour le train de demain.",
      example_translation: 'Я покупаю билет на завтрашний поезд.',
    },
    bonheur: {
      example_original: "Le bonheur ne dépend pas seulement de l'argent.",
      example_translation: 'Счастье зависит не только от денег.',
    },
    bureau: {
      example_original: "Le bureau ouvre à neuf heures le matin.",
      example_translation: 'Офис открывается в девять утра.',
    },
    carte: {
      example_original: "Je regarde la carte avant de partir.",
      example_translation: 'Я смотрю на карту перед выходом.',
    },
    chambre: {
      example_original: "La chambre donne sur le jardin.",
      example_translation: 'Комната выходит в сад.',
    },
    changement: {
      example_original: "Ce changement améliore notre organisation.",
      example_translation: 'Это изменение улучшает нашу организацию.',
    },
    choix: {
      example_original: "Ce choix semble raisonnable pour tout le monde.",
      example_translation: 'Этот выбор кажется разумным для всех.',
    },
    classe: {
      example_original: "La classe commence dans cinq minutes.",
      example_translation: 'Урок начинается через пять минут.',
    },
    confiance: {
      example_original: "La confiance se construit avec le temps.",
      example_translation: 'Доверие строится со временем.',
    },
    conversation: {
      example_original: "La conversation devient plus intéressante.",
      example_translation: 'Разговор становится интереснее.',
    },
    couleur: {
      example_original: "La couleur de ce mur est très douce.",
      example_translation: 'Цвет этой стены очень мягкий.',
    },
    cuisine: {
      example_original: "La cuisine est juste à côté du salon.",
      example_translation: 'Кухня находится рядом с гостиной.',
    },
    ecole: {
      example_original: "L'école est fermée pendant les vacances.",
      example_translation: 'Школа закрыта на каникулах.',
    },
    ecran: {
      example_original: "L'écran est trop sombre pour travailler.",
      example_translation: 'Экран слишком тёмный для работы.',
    },
    experience: {
      example_original: "Cette expérience m'aide beaucoup au travail.",
      example_translation: 'Этот опыт очень помогает мне в работе.',
    },
    question: {
      example_original: "J'ai une question sur cet exercice.",
      example_translation: 'У меня есть вопрос по этому упражнению.',
    },
    famille: {
      example_original: "Toute la famille se réunit le dimanche.",
      example_translation: 'Вся семья собирается в воскресенье.',
    },
    reponse: {
      example_original: 'La réponse est au bas de la page.',
      example_translation: 'Ответ находится внизу страницы.',
    },
    gare: {
      example_original: "La gare est en face de l'hôtel.",
      example_translation: 'Вокзал находится напротив отеля.',
    },
    habitude: {
      example_original: "Cette habitude me fait gagner du temps.",
      example_translation: 'Эта привычка помогает мне экономить время.',
    },
    heure: {
      example_original: "L'heure du rendez-vous a changé.",
      example_translation: 'Время встречи изменилось.',
    },
    hotel: {
      example_original: "L'hôtel est près de la mer.",
      example_translation: 'Отель находится рядом с морем.',
    },
    idee: {
      example_original: "J'ai une idée pour ce projet.",
      example_translation: 'У меня есть идея для этого проекта.',
    },
    internet: {
      example_original: "L'internet ne marche pas ce matin.",
      example_translation: 'Интернет не работает этим утром.',
    },
    jardin: {
      example_original: "Le jardin est plein de fleurs au printemps.",
      example_translation: 'Весной сад полон цветов.',
    },
    journal: {
      example_original: "Je lis le journal pendant le petit-déjeuner.",
      example_translation: 'Я читаю газету за завтраком.',
    },
    magasin: {
      example_original: "Le magasin ferme à dix-neuf heures.",
      example_translation: 'Магазин закрывается в семь вечера.',
    },
    marche: {
      example_original: "Le marché est très animé le samedi matin.",
      example_translation: 'Рынок очень оживлён в субботу утром.',
    },
    menu: {
      example_original: "Le menu du jour est écrit à l'entrée.",
      example_translation: 'Меню дня написано у входа.',
    },
    mer: {
      example_original: "La mer est calme aujourd'hui.",
      example_translation: 'Море сегодня спокойное.',
    },
    message: {
      example_original: "Je t'envoie un message après le cours.",
      example_translation: 'Я отправлю тебе сообщение после занятия.',
    },
    minute: {
      example_original: "Attends une minute, j'arrive.",
      example_translation: 'Подожди минуту, я иду.',
    },
    montagne: {
      example_original: "La montagne est couverte de neige.",
      example_translation: 'Гора покрыта снегом.',
    },
    musique: {
      example_original: "La musique est trop forte dans ce café.",
      example_translation: 'Музыка в этом кафе слишком громкая.',
    },
    nouvelle: {
      example_original: "La nouvelle a surpris toute l'équipe.",
      example_translation: 'Новость удивила всю команду.',
    },
    ordinateur: {
      example_original: "Mon ordinateur démarre très lentement aujourd'hui.",
      example_translation: 'Мой компьютер сегодня запускается очень медленно.',
    },
    passe: {
      example_original: "Le passé influence parfois nos décisions.",
      example_translation: 'Прошлое иногда влияет на наши решения.',
    },
    peur: {
      example_original: "La peur disparaît quand on comprend la situation.",
      example_translation: 'Страх исчезает, когда понимаешь ситуацию.',
    },
    photo: {
      example_original: "La photo est accrochée au mur du salon.",
      example_translation: 'Фотография висит на стене в гостиной.',
    },
    plage: {
      example_original: "La plage est presque vide ce matin.",
      example_translation: 'Пляж этим утром почти пустой.',
    },
    prix: {
      example_original: "Le prix de ce livre est raisonnable.",
      example_translation: 'Цена этой книги разумная.',
    },
    probleme: {
      example_original: "Le problème paraît plus simple maintenant.",
      example_translation: 'Проблема сейчас кажется проще.',
    },
    restaurant: {
      example_original: "Le restaurant est complet ce soir.",
      example_translation: 'Ресторан сегодня вечером полностью занят.',
    },
    reve: {
      example_original: "Ce rêve revient souvent dans ses pensées.",
      example_translation: 'Эта мечта часто возвращается в его мысли.',
    },
    route: {
      example_original: "La route est glissante après la pluie.",
      example_translation: 'Дорога скользкая после дождя.',
    },
    rue: {
      example_original: "La rue est calme à cette heure-ci.",
      example_translation: 'Улица в это время тихая.',
    },
    'salle de bain': {
      example_original: "La salle de bain est au fond du couloir.",
      example_translation: 'Ванная находится в конце коридора.',
    },
    sante: {
      example_original: "La santé passe avant le travail.",
      example_translation: 'Здоровье важнее работы.',
    },
    serie: {
      example_original: "La série devient meilleure au troisième épisode.",
      example_translation: 'Сериал становится лучше к третьей серии.',
    },
    solution: {
      example_original: "La solution proposée est assez simple.",
      example_translation: 'Предложенное решение достаточно простое.',
    },
    station: {
      example_original: "La station est juste derrière ce bâtiment.",
      example_translation: 'Станция находится сразу за этим зданием.',
    },
    telephone: {
      example_original: 'Mon téléphone sonne pendant la pause.',
      example_translation: 'Мой телефон звонит во время перерыва.',
    },
    travail: {
      example_original: "Le travail prend beaucoup de temps cette semaine.",
      example_translation: 'Работа занимает много времени на этой неделе.',
    },
    universite: {
      example_original: "L'université organise une conférence demain.",
      example_translation: 'Университет проводит конференцию завтра.',
    },
    vacances: {
      example_original: "Les vacances commencent à la fin du mois.",
      example_translation: 'Каникулы начинаются в конце месяца.',
    },
    village: {
      example_original: "Le village est entouré de collines.",
      example_translation: 'Деревня окружена холмами.',
    },
    ville: {
      example_original: "La ville est plus calme le dimanche.",
      example_translation: 'Город спокойнее по воскресеньям.',
    },
    voisin: {
      example_original: "Le voisin nous a aidés à porter la table.",
      example_translation: 'Сосед помог нам донести стол.',
    },
    voyage: {
      example_original: "Le voyage dure environ six heures.",
      example_translation: 'Путешествие длится около шести часов.',
    },
    fenetre: {
      example_original: 'La fenêtre est ouverte malgré le vent.',
      example_translation: 'Окно открыто, несмотря на ветер.',
    },
    voiture: {
      example_original: 'La voiture est garée devant la maison.',
      example_translation: 'Машина припаркована перед домом.',
    },
    yeux: {
      example_original: 'Ses yeux brillent quand elle sourit.',
      example_translation: 'Её глаза сияют, когда она улыбается.',
    },
  };

  if (specific[key]) {
    return specific[key];
  }

  // Generic sentences must stay grammatical in BOTH languages. Russian nouns
  // inflect, so only templates that keep the translation in the nominative
  // case are used (no «Я разговариваю с ученик»).
  const shortTranslation = word.translation.split(/\s*[/;,(]\s*/)[0].trim() || word.translation;
  const plural = getFrenchArticle(original, 'definite') === 'les';
  const capitalizedTranslation = shortTranslation.charAt(0).toUpperCase() + shortTranslation.slice(1);
  const important = { example_original: `${definiteCap}, c'est important.`, example_translation: `${capitalizedTranslation} — это важно.` };
  const where = { example_original: `Où ${plural ? 'sont' : 'est'} ${definite} ?`, example_translation: `Где ${shortTranslation}?` };
  // «un sang», «une soif» are wrong: uncountable and abstract nouns only get
  // templates with the definite article.
  if (ABSTRACT_NOUNS.has(key)) return important;
  if (MASS_NOUNS.has(key)) return chooseVariantPair(word.id, [where, important]);
  return chooseVariantPair(word.id, [
    { example_original: `Voici ${indefinite}.`, example_translation: `Вот ${shortTranslation}.` },
    where,
    { example_original: `Il y a ${indefinite} ici.`, example_translation: `Здесь есть ${shortTranslation}.` },
    important,
  ]);
}

function buildFunctionWordExample(word: Word): { example_original: string; example_translation: string } {
  const original = word.original;
  const key = normalizeKey(original);

  if (word.part_of_speech === 'preposition') {
    const prepositions: Record<string, { example_original: string; example_translation: string }> = {
      avec: {
        example_original: 'Je viens avec mon ami au cinéma.',
        example_translation: 'Я иду в кино со своим другом.',
      },
      sans: {
        example_original: 'Elle sort sans parapluie malgré la pluie.',
        example_translation: 'Она выходит без зонта, несмотря на дождь.',
      },
      pour: {
        example_original: 'Ce cadeau est pour ma soeur.',
        example_translation: 'Этот подарок для моей сестры.',
      },
      dans: {
        example_original: 'Les clés sont dans le sac.',
        example_translation: 'Ключи в сумке.',
      },
      sur: {
        example_original: 'Le téléphone est sur la table.',
        example_translation: 'Телефон на столе.',
      },
      sous: {
        example_original: 'Le chat dort sous la chaise.',
        example_translation: 'Кот спит под стулом.',
      },
      de: {
        example_original: 'Je parle de mon travail avec Paul.',
        example_translation: 'Я говорю с Полем о своей работе.',
      },
      a: {
        example_original: 'Nous allons à Paris demain matin.',
        example_translation: 'Завтра утром мы едем в Париж.',
      },
      en: {
        example_original: 'Elle voyage en train et parle en français.',
        example_translation: 'Она путешествует на поезде и говорит по-французски.',
      },
      par: {
        example_original: 'Je passe par le parc pour rentrer.',
        example_translation: 'По дороге домой я прохожу через парк.',
      },
      chez: {
        example_original: 'Nous dînons chez des amis ce soir.',
        example_translation: 'Сегодня вечером мы ужинаем у друзей.',
      },
      entre: {
        example_original: 'Le café est entre la banque et la poste.',
        example_translation: 'Кафе находится между банком и почтой.',
      },
      avant: {
        example_original: 'Je lis un peu avant de dormir.',
        example_translation: 'Я немного читаю перед сном.',
      },
      apres: {
        example_original: 'On se retrouve après le cours.',
        example_translation: 'Встретимся после занятия.',
      },
      pendant: {
        example_original: 'Je prends des notes pendant la réunion.',
        example_translation: 'Я делаю заметки во время встречи.',
      },
      depuis: {
        example_original: "J'habite ici depuis deux ans.",
        example_translation: 'Я живу здесь уже два года.',
      },
    };

    return prepositions[key] ?? {
      example_original: `Exemple clair avec ${original} dans une phrase simple.`,
      example_translation: `Предлог «${original}» показывает связь между словами и задаёт контекст места, времени, направления или способа.`,
    };
  }

  if (word.part_of_speech === 'determiner') {
    const determiners: Record<string, { example_original: string; example_translation: string }> = {
      ce: {
        example_original: 'Ce livre est facile à lire.',
        example_translation: 'Эту книгу легко читать.',
      },
      cette: {
        example_original: 'Cette rue est très calme le soir.',
        example_translation: 'Вечером на этой улице очень тихо.',
      },
      ces: {
        example_original: 'Ces photos viennent de notre voyage.',
        example_translation: 'Эти фотографии из нашей поездки.',
      },
      le: {
        example_original: 'Le train arrive à huit heures.',
        example_translation: 'Поезд прибывает в восемь часов.',
      },
      la: {
        example_original: 'La porte est déjà ouverte.',
        example_translation: 'Дверь уже открыта.',
      },
      les: {
        example_original: 'Les enfants jouent dans le jardin.',
        example_translation: 'Дети играют в саду.',
      },
      un: {
        example_original: "J'ai acheté un billet pour demain.",
        example_translation: 'Я купил билет на завтра.',
      },
      une: {
        example_original: "Elle cherche une réponse simple.",
        example_translation: 'Она ищет простой ответ.',
      },
      des: {
        example_original: "Nous avons acheté des fruits au marché.",
        example_translation: 'Мы купили фрукты на рынке.',
      },
      mon: {
        example_original: 'Mon bureau est près de la fenêtre.',
        example_translation: 'Мой письменный стол стоит у окна.',
      },
      ma: {
        example_original: 'Ma soeur habite à Lyon.',
        example_translation: 'Моя сестра живёт в Лионе.',
      },
      mes: {
        example_original: 'Mes amis arrivent ce soir.',
        example_translation: 'Мои друзья приезжают сегодня вечером.',
      },
      ton: {
        example_original: 'Ton café est prêt.',
        example_translation: 'Твой кофе готов.',
      },
      ta: {
        example_original: 'Ta veste est sur la chaise.',
        example_translation: 'Твоя куртка на стуле.',
      },
      tes: {
        example_original: 'Tes clés sont sur la table.',
        example_translation: 'Твои ключи на столе.',
      },
      son: {
        example_original: 'Son ordinateur est neuf.',
        example_translation: 'Его компьютер новый.',
      },
      sa: {
        example_original: 'Sa voiture est devant la maison.',
        example_translation: 'Его машина стоит перед домом.',
      },
      ses: {
        example_original: 'Ses parents vivent à Marseille.',
        example_translation: 'Его родители живут в Марселе.',
      },
      notre: {
        example_original: 'Notre cours commence à neuf heures.',
        example_translation: 'Наше занятие начинается в девять часов.',
      },
      votre: {
        example_original: 'Votre réservation est confirmée.',
        example_translation: 'Ваше бронирование подтверждено.',
      },
      leur: {
        example_original: 'Leur appartement est au troisième étage.',
        example_translation: 'Их квартира на третьем этаже.',
      },
      quel: {
        example_original: 'Quel film veux-tu voir ce soir ?',
        example_translation: 'Какой фильм ты хочешь посмотреть сегодня вечером?',
      },
    };

    return determiners[key] ?? {
      example_original: `Exemple avec ${original} devant un nom.`,
      example_translation: `Определитель «${original}» ставят перед существительным, чтобы показать род, число, принадлежность или указание.`,
    };
  }

  if (word.part_of_speech === 'pronoun') {
    const pronouns: Record<string, { example_original: string; example_translation: string }> = {
      je: {
        example_original: 'Je commence la leçon maintenant.',
        example_translation: 'Я начинаю урок сейчас.',
      },
      tu: {
        example_original: 'Tu connais déjà ce mot ?',
        example_translation: 'Ты уже знаешь это слово?',
      },
      il: {
        example_original: 'Il travaille aujourd’hui à la maison.',
        example_translation: 'Сегодня он работает дома.',
      },
      elle: {
        example_original: 'Elle arrive après le déjeuner.',
        example_translation: 'Она придёт после обеда.',
      },
      nous: {
        example_original: 'Nous révisons ensemble avant le test.',
        example_translation: 'Мы вместе повторяем материал перед тестом.',
      },
      vous: {
        example_original: 'Vous avez une minute, madame ?',
        example_translation: 'У вас есть минутка, мадам?',
      },
      ils: {
        example_original: 'Ils arrivent par le train de midi.',
        example_translation: 'Они приезжают полуденным поездом.',
      },
      elles: {
        example_original: 'Elles parlent de leur projet.',
        example_translation: 'Они говорят о своём проекте.',
      },
      on: {
        example_original: 'En France, on dit souvent bonjour en entrant.',
        example_translation: 'Во Франции часто здороваются, когда входят.',
      },
      qui: {
        example_original: 'Qui vient avec nous ce soir ?',
        example_translation: 'Кто пойдёт с нами сегодня вечером?',
      },
      quoi: {
        example_original: 'Tu cherches quoi exactement ?',
        example_translation: 'Что именно ты ищешь?',
      },
      laquelle: {
        example_original: 'Laquelle de ces rues mène à la gare ?',
        example_translation: 'Какая из этих улиц ведёт к вокзалу?',
      },
    };

    return pronouns[key] ?? {
      example_original: `Exemple naturel avec ${original} comme pronom.`,
      example_translation: `Местоимение «${original}» заменяет существительное или участника речи и зависит от роли в предложении.`,
    };
  }

  if (word.part_of_speech === 'conjunction') {
    const conjunctions: Record<string, { example_original: string; example_translation: string }> = {
      et: {
        example_original: 'Je prends un café et je commence à travailler.',
        example_translation: 'Я пью кофе и начинаю работать.',
      },
      mais: {
        example_original: 'Je comprends la règle, mais j’ai besoin de pratique.',
        example_translation: 'Я понимаю правило, но мне нужна практика.',
      },
      ou: {
        example_original: 'On va au parc ou on reste à la maison ?',
        example_translation: 'Пойдём в парк или останемся дома?',
      },
      si: {
        example_original: 'Si tu veux, on peut recommencer.',
        example_translation: 'Если хочешь, можно начать заново.',
      },
      'parce que': {
        example_original: 'Je reste chez moi parce que je suis fatigué.',
        example_translation: 'Я остаюсь дома, потому что устал.',
      },
    };

    return conjunctions[key] ?? {
      example_original: `Exemple clair avec ${original} pour relier deux idées.`,
      example_translation: `Союз «${original}» связывает части высказывания и показывает их смысловую связь.`,
    };
  }

  if (word.part_of_speech === 'adverb') {
    const adverbs: Record<string, { example_original: string; example_translation: string }> = {
      "aujourd'hui": {
        example_original: "Aujourd'hui, nous finissons plus tôt.",
        example_translation: 'Сегодня мы заканчиваем раньше.',
      },
      demain: {
        example_original: 'Demain, je passe un examen important.',
        example_translation: 'Завтра я сдаю важный экзамен.',
      },
      hier: {
        example_original: "Hier, j'ai vu Marie en ville.",
        example_translation: 'Вчера я видел Мари в городе.',
      },
      maintenant: {
        example_original: 'Maintenant, je comprends mieux la règle.',
        example_translation: 'Теперь я лучше понимаю правило.',
      },
      ici: {
        example_original: 'Vous pouvez attendre ici quelques minutes.',
        example_translation: 'Вы можете подождать здесь несколько минут.',
      },
      la: {
        example_original: 'Pose le sac là, près de la porte.',
        example_translation: 'Поставь сумку туда, возле двери.',
      },
      loin: {
        example_original: 'La gare n’est pas loin d’ici.',
        example_translation: 'Вокзал недалеко отсюда.',
      },
      souvent: {
        example_original: 'Je relis souvent mes notes le soir.',
        example_translation: 'Я часто перечитываю свои заметки вечером.',
      },
      jamais: {
        example_original: 'Il ne voyage jamais sans son passeport.',
        example_translation: 'Он никогда не путешествует без своего паспорта.',
      },
      parfois: {
        example_original: 'Parfois, nous déjeunons au parc.',
        example_translation: 'Иногда мы обедаем в парке.',
      },
      toujours: {
        example_original: 'Elle arrive toujours à l’heure.',
        example_translation: 'Она всегда приходит вовремя.',
      },
      encore: {
        example_original: 'Je dois encore apprendre dix mots.',
        example_translation: 'Мне нужно выучить ещё десять слов.',
      },
      deja: {
        example_original: 'Nous avons déjà terminé le module.',
        example_translation: 'Мы уже закончили модуль.',
      },
      ensemble: {
        example_original: 'Nous travaillons ensemble sur ce projet.',
        example_translation: 'Мы вместе работаем над этим проектом.',
      },
      comment: {
        example_original: 'Comment tu prononces ce mot ?',
        example_translation: 'Как ты произносишь это слово?',
      },
      pourquoi: {
        example_original: 'Pourquoi tu changes de plan ?',
        example_translation: 'Почему ты меняешь план?',
      },
      quand: {
        example_original: 'Quand commence la réunion ?',
        example_translation: 'Когда начинается встреча?',
      },
      ou: {
        example_original: 'Où as-tu mis le dictionnaire ?',
        example_translation: 'Куда ты положил словарь?',
      },
      oui: {
        example_original: 'Oui, je peux t’aider après le cours.',
        example_translation: 'Да, я могу помочь тебе после занятия.',
      },
      non: {
        example_original: 'Non, ce n’est pas la bonne réponse.',
        example_translation: 'Нет, это неправильный ответ.',
      },
      'peut-etre': {
        example_original: 'Peut-être qu’il arrive plus tard.',
        example_translation: 'Возможно, он придёт позже.',
      },
      pres: {
        example_original: 'La pharmacie est tout près d’ici.',
        example_translation: 'Аптека совсем рядом.',
      },
      trop: {
        example_original: 'Ce sac est trop lourd pour moi.',
        example_translation: 'Эта сумка слишком тяжёлая для меня.',
      },
      tres: {
        example_original: 'Ce texte est très utile pour réviser.',
        example_translation: 'Этот текст очень полезен для повторения.',
      },
      assez: {
        example_original: 'Cette explication est assez claire.',
        example_translation: 'Это объяснение довольно понятное.',
      },
    };

    return adverbs[key] ?? {
      example_original: `Exemple naturel avec ${original} dans une phrase complète.`,
      example_translation: `Наречие «${original}» уточняет действие, время, место, степень или частоту.`,
    };
  }

  return {
    example_original: `Exemple avec « ${original} ».`,
    example_translation: `Значение слова «${original}» зависит от контекста предложения.`,
  };
}

function buildExpressionExample(word: Word): { example_original: string; example_translation: string } {
  const original = word.original;
  const key = normalizeKey(original);

  const specific: Record<string, { example_original: string; example_translation: string }> = {
    'bonjour': { example_original: 'Je dis bonjour à mes collègues le matin.', example_translation: 'Я говорю «bonjour» коллегам утром.' },
    'salut': { example_original: 'Je dis salut à mon ami dans la rue.', example_translation: 'Я говорю другу «salut» на улице.' },
    'merci': { example_original: 'Je dis merci pour ton aide.', example_translation: 'Я говорю «спасибо» за твою помощь.' },
    'au revoir': { example_original: 'On dit au revoir avant de partir.', example_translation: 'Мы говорим «до свидания» перед уходом.' },
    "s'il vous plaît": { example_original: 'Un café, s’il vous plaît.', example_translation: 'Один кофе, пожалуйста.' },
    'pardon': { example_original: 'Pardon, je cherche la gare.', example_translation: 'Извините, я ищу вокзал.' },
    'ça va': { example_original: 'Salut, ça va aujourd’hui ?', example_translation: 'Привет, как дела сегодня?' },
    'comment ça va': { example_original: 'Comment ça va après le voyage ?', example_translation: 'Как дела после поездки?' },
    'je ne sais pas': { example_original: 'Je ne sais pas où il habite.', example_translation: 'Я не знаю, где он живёт.' },
    'je comprends': { example_original: 'Oui, je comprends cette règle.', example_translation: 'Да, я понимаю это правило.' },
    'il y a': { example_original: 'Il y a un café près de la station.', example_translation: 'Рядом со станцией есть кафе.' },
    "d'accord": { example_original: 'D’accord, on commence maintenant.', example_translation: 'Хорошо, начинаем сейчас.' },
    'bon appetit': { example_original: 'Le dîner est prêt, bon appétit !', example_translation: 'Ужин готов, приятного аппетита!' },
  };

  if (specific[key]) {
    return specific[key];
  }

  if (key.startsWith("j'aime ")) {
    return {
      example_original: `${original}, surtout quand je suis de bonne humeur.`,
      example_translation: `Эту фразу используют, когда прямо говорят о том, что нравится.`,
    };
  }

  if (key.startsWith('je vois ')) {
    return {
      example_original: `${original} depuis le bus.`,
      example_translation: `Эту фразу используют, когда описывают то, что человек видит прямо сейчас.`,
    };
  }

  if (key.startsWith('je cherche ') || key.startsWith('où est ')) {
    return {
      example_original: `${original} quand je dois me repérer rapidement.`,
      example_translation: `Так говорят, когда ищут предмет, место или человека и хотят уточнить, где он находится.`,
    };
  }

  if (key.startsWith('je veux ') || key.startsWith('je peux ')) {
    return {
      example_original: `${original} avant la fin de la journée.`,
      example_translation: `Такую конструкцию используют, когда говорят о желании или возможности выполнить действие.`,
    };
  }

  if (key.startsWith('il faut ')) {
    return {
      example_original: `${original} vérifier l’adresse avant de partir.`,
      example_translation: `Выражение «il faut ...» используют, когда говорят о необходимости, правиле или обязательности.`,
    };
  }

  if (key.startsWith('nous allons ') || key.startsWith('nous arrivons ')) {
    return {
      example_original: `${original} ensemble après le déjeuner.`,
      example_translation: `Такую конструкцию используют, когда группа людей говорит о плане или перемещении.`,
    };
  }

  if (key.startsWith("c'est ") || key.startsWith('tres ') || key.startsWith('trop ') || key.startsWith('assez ')) {
    return {
      example_original: `${original} dans cette situation.`,
      example_translation: `Эту модель используют, чтобы описать качество, дать оценку или указать степень признака.`,
    };
  }

  return chooseVariantPair(word.id, [
    {
      example_original: `Dans ce contexte, on dit : « ${original} ».`,
      example_translation: `Это выражение используют как готовую фразу в типичной бытовой ситуации.`,
    },
    {
      example_original: `Dans une conversation naturelle, on peut dire : « ${original} ».`,
      example_translation: `Такую фразу используют в живой речи как готовое выражение.`,
    },
    {
      example_original: `Cette expression s'utilise telle quelle dans un échange courant : « ${original} ».`,
      example_translation: `Это устойчивое выражение вставляют целиком в подходящий разговорный контекст.`,
    },
  ]);
}

// Determiner-like adjectives do not fit a predicate template («Il est même»).
const ADJECTIVE_EXAMPLES: Record<string, { example_original: string; example_translation: string }> = {
  meme: { example_original: 'Nous avons le même livre.', example_translation: 'У нас одна и та же книга.' },
  autre: { example_original: 'Je voudrais un autre café.', example_translation: 'Я бы хотел ещё один кофе.' },
  dernier: { example_original: "C'est le dernier train ce soir.", example_translation: 'Это последний поезд сегодня вечером.' },
  prochain: { example_original: 'À la semaine prochaine !', example_translation: 'До следующей недели!' },
  premier: { example_original: "C'est mon premier jour ici.", example_translation: 'Это мой первый день здесь.' },
  seul: { example_original: 'Il habite seul.', example_translation: 'Он живёт один.' },
  chaque: { example_original: 'Je cours chaque matin.', example_translation: 'Я бегаю каждое утро.' },
  plusieurs: { example_original: "J'ai plusieurs amis à Paris.", example_translation: 'У меня несколько друзей в Париже.' },
  certain: { example_original: "J'en suis certain.", example_translation: 'Я в этом уверен.' },
  tout: { example_original: 'Tout le monde est là.', example_translation: 'Все здесь.' },
};

function buildLexicalExample(word: Word): { example_original: string; example_translation: string } {
  const original = word.original;

  switch (word.part_of_speech) {
    case 'noun':
      return buildNounExample(word);
    case 'verb':
      return {
        example_original: chooseVariant(original, [
          `Je peux ${original} maintenant.`,
          `Nous allons ${original} ensemble.`,
          `Il faut ${original} avec attention.`,
        ]),
        example_translation: chooseVariant(original, [
          `Я могу ${word.translation.toLowerCase()} сейчас.`,
          `Мы будем ${word.translation.toLowerCase()} вместе.`,
          `Нужно ${word.translation.toLowerCase()} внимательно.`,
        ]),
      };
    case 'adjective': {
      const specificAdjective = ADJECTIVE_EXAMPLES[normalizeKey(original)];
      if (specificAdjective) return specificAdjective;
      // A masculine subject in both languages keeps the dictionary forms correct.
      return {
        example_original: `Il est ${original}.`,
        example_translation: `Он ${word.translation.split(/\s*[/;,(]\s*/)[0].trim().toLowerCase()}.`,
      };
    }
    default:
      return buildExpressionExample(word);
  }
}

function improveWordExamples(word: Word): Pick<Word, 'example_original' | 'example_translation'> {
  // Pack and custom words come with hand-written examples: keep them. Only the
  // generated core dataset gets template sentences.
  if (word.source !== 'core' && word.example_original.trim() && !isGenericExample(word.example_original)) {
    return {
      example_original: word.example_original.trim(),
      example_translation: word.example_translation.trim(),
    };
  }

  if (['preposition', 'determiner', 'pronoun', 'conjunction', 'adverb'].includes(word.part_of_speech)) {
    return buildFunctionWordExample(word);
  }

  if (word.part_of_speech === 'expression' || word.part_of_speech === 'interjection') {
    return buildExpressionExample(word);
  }

  return buildLexicalExample(word);
}

function normalizeWord(word: Word): Word {
  const fallbackImage =
    word.imagePath || word.imageUrl
      ? null
      : word.language === 'japanese'
        ? {
            src: '/generated-word-images/ja-association-matter.jpg',
            alt: `Ассоциативное изображение: ${word.translation}`,
            category: 'japanese',
            illustrationType: 'photo-association',
          }
        : createFallbackWordImage(word);
  const improvedExamples =
    word.language === 'french'
      ? improveWordExamples(word)
      : {
          example_original: word.example_original.trim(),
          example_translation: word.example_translation.trim(),
        };
  const transcription =
    word.language === 'french'
      ? deriveFrenchLatinTranscription(word.original, word.transcription ?? '')
      : word.transcription?.trim() || word.original.trim();

  return {
    ...word,
    audio_original: word.audio_original ?? '',
    tags: Array.isArray(word.tags) ? word.tags : [],
    packIds: Array.isArray(word.packIds) ? word.packIds : [],
    source: word.source ?? 'core',
    language: word.language ?? 'french',
    transcription,
    example_original: improvedExamples.example_original,
    example_translation: improvedExamples.example_translation,
    imagePath: word.imagePath ?? word.imageUrl ?? fallbackImage?.src ?? undefined,
    imageUrl: word.imageUrl ?? fallbackImage?.src ?? undefined,
    imageAlt: word.imageAlt ?? fallbackImage?.alt ?? undefined,
    imagePackCategory: word.imagePackCategory ?? fallbackImage?.category,
    illustrationType: word.illustrationType ?? fallbackImage?.illustrationType,
    imagePrompt: word.imagePrompt ?? undefined,
    imageSource:
      word.imageSource
      ?? (fallbackImage
        ? word.language === 'japanese'
          ? 'generated:openai-imagegen:fallback'
          : 'generated:semantic-svg-v2'
        : undefined),
  };
}

async function loadWordImageManifest(): Promise<WordImageManifest> {
  try {
    const manifest = await fetchJson<unknown>('/data/word_images.json');

    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
      return {};
    }

    return manifest as WordImageManifest;
  } catch {
    return {};
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'force-cache',
      credentials: 'same-origin',
    });

    if (!response.ok) {
      throw new Error(`Resource unavailable: ${url}`);
    }

    return (await response.json()) as T;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function frequencyRank(word: Word): number {
  const match = /^ja-(\d+)$/.exec(word.id);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function sortWordsByCurriculum(words: Word[], language: LearningLanguage): Word[] {
  return [...words].sort((left, right) => {
    const levelDiff = language === 'japanese'
      ? getStudyLevelRank(left) - getStudyLevelRank(right)
      : LEVEL_ORDER[left.level] - LEVEL_ORDER[right.level];

    if (levelDiff !== 0) {
      return levelDiff;
    }

    // Within a JLPT level the more frequent words come first.
    if (language === 'japanese') {
      const frequencyDiff = frequencyRank(left) - frequencyRank(right);
      if (frequencyDiff !== 0) return frequencyDiff;
    }

    return left.original.localeCompare(right.original, language === 'japanese' ? 'ja' : 'fr');
  });
}

function withJlptLevel(word: Word, levels: Readonly<Record<string, JlptLevel>>): Word {
  const jlpt = levels[word.original] ?? (word.original.endsWith('する') ? levels[word.original.slice(0, -2)] : undefined);
  return jlpt ? { ...word, jlpt } : word;
}

export async function loadWords(language: LearningLanguage): Promise<Word[]> {
  const cached = wordsPromiseByLanguage.get(language);

  if (cached) {
    return cached;
  }

  const wordsPromise = (async () => {
    const wordImageManifestPromise = loadWordImageManifest();

    if (language === 'japanese') {
      const [
        { JAPANESE_CORE_WORDS },
        { applyJapaneseWordCorrection, JAPANESE_EXCLUDED_WORDS, cleanJapaneseEntry },
        { JAPANESE_JLPT_LEVELS },
        wordImageManifest,
      ] = await Promise.all([
        import('./japaneseWords'),
        import('./japaneseWordCorrections'),
        import('./japaneseJlpt'),
        wordImageManifestPromise,
      ]);

      return sortWordsByCurriculum(
        [
          ...JAPANESE_CORE_WORDS.filter((word) => !JAPANESE_EXCLUDED_WORDS.has(word.original)).map((word) =>
            normalizeWord(cleanJapaneseEntry(applyJapaneseWordCorrection({ ...word, ...wordImageManifest[word.id] }))),
          ),
          ...getPackWords('japanese').map((word) => normalizeWord({ ...word, ...wordImageManifest[word.id] })),
        ].map((word) => withJlptLevel(word, JAPANESE_JLPT_LEVELS)),
        language,
      );
    }

    const [datasetResults, wordImageManifest] = await Promise.all([
      Promise.allSettled(
        DATASET_URLS.map((url) =>
          fetchJson<Array<Omit<Word, 'packIds' | 'source' | 'language'>>>(url),
        ),
      ),
      wordImageManifestPromise,
    ]);
    const parts = datasetResults
      .filter((result): result is PromiseFulfilledResult<Array<Omit<Word, 'packIds' | 'source' | 'language'>>> => result.status === 'fulfilled')
      .map((result) => result.value);

    if (parts.length === 0) {
      throw new Error('Word datasets are unavailable');
    }

    return sortWordsByCurriculum(
      [
        ...parts
          .flat()
          .map((word) =>
            normalizeWord({ ...word, language: 'french', ...wordImageManifest[word.id], packIds: [], source: 'core' } as Word),
          )
          .filter((word) => isSupportedCoreWord(word)),
        ...getPackWords('french').map((word) => normalizeWord({ ...word, ...wordImageManifest[word.id] })),
      ],
      language,
    );
  })();
  const recoverablePromise = wordsPromise.catch((error: unknown) => {
    wordsPromiseByLanguage.delete(language);
    throw error;
  });

  wordsPromiseByLanguage.set(language, recoverablePromise);
  return recoverablePromise;
}

export function getStarterPacks(language: LearningLanguage): WordPack[] {
  return STARTER_PACKS.filter((pack) => pack.language === language);
}

function normalizePhrase(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function isWordInCoreLessonPool(word: Word): boolean {
  if (!isSupportedCoreWord(word)) {
    return false;
  }

  if (word.source !== 'core' || word.part_of_speech !== 'expression') {
    return true;
  }

  return !SYNTHETIC_EXPRESSION_PREFIXES.some((prefix) => normalizePhrase(word.original).startsWith(prefix));
}

function isSupportedCoreWord(word: Word): boolean {
  if (word.source !== 'core') {
    return true;
  }

  if (word.part_of_speech !== 'expression') {
    return true;
  }

  return CORE_STABLE_EXPRESSIONS.has(normalizePhrase(word.original));
}

export function getLessonPoolWords(words: Word[]): Word[] {
  return words.filter((word) => isWordInCoreLessonPool(word));
}
