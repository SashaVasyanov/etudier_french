import { getPackWords, STARTER_PACKS } from './wordPacks';
import type { LearningLanguage, Word, WordLevel, WordPack } from '../types';
import { createFallbackWordImage } from '../lib/wordImages';
import { deriveFrenchLatinTranscription } from '../lib/utils';

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
    'imagePath' | 'imageUrl' | 'imageAlt' | 'imagePackCategory' | 'illustrationType' | 'imagePrompt' | 'imageSource'
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
  return /^[aeiouyhàâæéèêëîïôœùûü]/i.test(value.trim());
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

function hasTag(word: Word, ...tags: string[]): boolean {
  return tags.some((tag) => word.tags.includes(tag));
}

function buildNounExample(word: Word): { example_original: string; example_translation: string } {
  const original = word.original;
  const definite = withArticle(original, 'definite');
  const definiteCap = withArticle(original, 'definite', true);
  const indefinite = withArticle(original, 'indefinite');
  const translation = word.translation.toLowerCase();
  const key = normalizeKey(original);

  const specific: Record<string, { example_original: string; example_translation: string }> = {
    addition: {
      example_original: "L'addition, s'il vous plaît.",
      example_translation: 'Счёт просят в ресторане после еды.',
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

  if (hasTag(word, 'work', 'service')) {
    return chooseVariantPair(word.id, [
      {
        example_original: `${definiteCap} parle avec un client.`,
        example_translation: `${word.translation} разговаривает с клиентом.`,
      },
      {
        example_original: `Tout le monde attend ${definite}.`,
        example_translation: `Все ждут ${translation}.`,
      },
      {
        example_original: `${definiteCap} connaît bien son travail.`,
        example_translation: `${word.translation} хорошо знает свою работу.`,
      },
    ]);
  }

  if (hasTag(word, 'food')) {
    if (hasTag(word, 'service')) {
      return chooseVariantPair(word.id, [
        {
          example_original: `${definiteCap} est déjà sur la table.`,
          example_translation: `${word.translation} уже на столе.`,
        },
        {
          example_original: `Je regarde ${definite} avant de commander.`,
          example_translation: `Я смотрю на ${translation} перед заказом.`,
        },
        {
          example_original: `Au restaurant, ${definite} change chaque jour.`,
          example_translation: `В ресторане ${translation} меняется каждый день.`,
        },
      ]);
    }

    return chooseVariantPair(word.id, [
      {
        example_original: `Au marché, j'achète ${indefinite}.`,
        example_translation: `На рынке я покупаю ${translation}.`,
      },
      {
        example_original: `Pour le dîner, nous préparons ${definite}.`,
        example_translation: `На ужин мы готовим ${translation}.`,
      },
      {
        example_original: `${definiteCap} est déjà sur la table.`,
        example_translation: `${word.translation} уже на столе.`,
      },
    ]);
  }

  if (hasTag(word, 'transport', 'travel')) {
    return chooseVariantPair(word.id, [
      {
        example_original: `Le matin, je prends ${definite} pour aller en ville.`,
        example_translation: `Утром я еду на ${translation} в город.`,
      },
      {
        example_original: `Nous attendons ${definite} près de la station.`,
        example_translation: `Мы ждём ${translation} возле станции.`,
      },
      {
        example_original: `${definiteCap} part dans quelques minutes.`,
        example_translation: `${word.translation} отправляется через несколько минут.`,
      },
    ]);
  }

  if (hasTag(word, 'home', 'objects')) {
    return chooseVariantPair(word.id, [
      {
        example_original: `${definiteCap} est près du mur.`,
        example_translation: `${word.translation} стоит у стены.`,
      },
      {
        example_original: `Je range ${definite} après usage.`,
        example_translation: `Я убираю ${translation} после использования.`,
      },
      {
        example_original: `Dans cette pièce, ${definite} est très utile.`,
        example_translation: `В этой комнате ${translation} очень полезен.`,
      },
    ]);
  }

  if (hasTag(word, 'home')) {
    return chooseVariantPair(word.id, [
      {
        example_original: `${definiteCap} est très calme le soir.`,
        example_translation: `${word.translation} очень тихий вечером.`,
      },
      {
        example_original: `Nous passons beaucoup de temps dans ${definite}.`,
        example_translation: `Мы проводим много времени в ${translation}.`,
      },
      {
        example_original: `${definiteCap} se trouve près de l'entrée.`,
        example_translation: `${word.translation} находится рядом со входом.`,
      },
    ]);
  }

  if (hasTag(word, 'city', 'service')) {
    return chooseVariantPair(word.id, [
      {
        example_original: `On se retrouve devant ${definite} à midi.`,
        example_translation: `Встретимся у ${translation} в полдень.`,
      },
      {
        example_original: `${definiteCap} est au centre du quartier.`,
        example_translation: `${word.translation} находится в центре района.`,
      },
      {
        example_original: `Je cherche ${definite} sur le plan de la ville.`,
        example_translation: `Я ищу ${translation} на плане города.`,
      },
    ]);
  }

  if (hasTag(word, 'people', 'family')) {
    return chooseVariantPair(word.id, [
      {
        example_original: `${definiteCap} arrive toujours à l'heure.`,
        example_translation: `${word.translation} всегда приходит вовремя.`,
      },
      {
        example_original: `Je parle avec ${definite} après le cours.`,
        example_translation: `Я разговариваю с ${translation} после занятия.`,
      },
      {
        example_original: `Tout le monde connaît ${definite}.`,
        example_translation: `Все знают ${translation}.`,
      },
    ]);
  }

  if (hasTag(word, 'study', 'work')) {
    if (hasTag(word, 'daily')) {
      return chooseVariantPair(word.id, [
        {
          example_original: `${definiteCap} ouvre ses portes à huit heures.`,
          example_translation: `${word.translation} открывается в восемь часов.`,
        },
        {
          example_original: `Beaucoup d'étudiants passent la journée à ${definite}.`,
          example_translation: `Многие студенты проводят день в ${translation}.`,
        },
        {
          example_original: `${definiteCap} organise un nouvel événement.`,
          example_translation: `${word.translation} организует новое мероприятие.`,
        },
      ]);
    }

    return chooseVariantPair(word.id, [
      {
        example_original: `Pendant le cours, ${definite} aide à comprendre le sujet.`,
        example_translation: `Во время занятия ${translation} помогает понять тему.`,
      },
      {
        example_original: `Au travail, j'utilise ${definite} chaque jour.`,
        example_translation: `На работе я использую ${translation} каждый день.`,
      },
      {
        example_original: `Le professeur prépare ${definite} avant la leçon.`,
        example_translation: `Преподаватель готовит ${translation} перед уроком.`,
      },
    ]);
  }

  if (hasTag(word, 'technology', 'media', 'communication')) {
    return chooseVariantPair(word.id, [
      {
        example_original: `J'utilise ${definite} tous les jours.`,
        example_translation: `Я использую ${translation} каждый день.`,
      },
      {
        example_original: `${definiteCap} reste sur le bureau.`,
        example_translation: `${word.translation} лежит на столе.`,
      },
      {
        example_original: `Je vérifie ${definite} avant de partir.`,
        example_translation: `Я проверяю ${translation} перед выходом.`,
      },
    ]);
  }

  if (hasTag(word, 'communication')) {
    return chooseVariantPair(word.id, [
      {
        example_original: `${definiteCap} continue après la réunion.`,
        example_translation: `${word.translation} продолжается после встречи.`,
      },
      {
        example_original: `Je relis ${definite} avant d'envoyer la réponse.`,
        example_translation: `Я перечитываю ${translation} перед тем, как отправить ответ.`,
      },
      {
        example_original: `${definiteCap} est plus clair maintenant.`,
        example_translation: `${word.translation} теперь яснее.`,
      },
    ]);
  }

  if (hasTag(word, 'nature')) {
    return chooseVariantPair(word.id, [
      {
        example_original: `Dans le jardin, ${definite} pousse bien au soleil.`,
        example_translation: `В саду ${translation} хорошо растёт на солнце.`,
      },
      {
        example_original: `Après la pluie, ${definite} a l'air plus frais.`,
        example_translation: `После дождя ${translation} выглядит свежее.`,
      },
      {
        example_original: `Je regarde ${definite} pendant la promenade.`,
        example_translation: `Я смотрю на ${translation} во время прогулки.`,
      },
    ]);
  }

  if (hasTag(word, 'health')) {
    if (hasTag(word, 'daily')) {
      return chooseVariantPair(word.id, [
        {
          example_original: `${definiteCap} me fait mal depuis ce matin.`,
          example_translation: `${word.translation} болит у меня с утра.`,
        },
        {
          example_original: `Le médecin examine ${definite} avec attention.`,
          example_translation: `Врач внимательно осматривает ${translation}.`,
        },
        {
          example_original: `${definiteCap} est important pour rester en forme.`,
          example_translation: `${word.translation} важен, чтобы оставаться в форме.`,
        },
      ]);
    }

    return chooseVariantPair(word.id, [
      {
        example_original: `Le médecin examine ${definite} avec attention.`,
        example_translation: `Врач внимательно осматривает ${translation}.`,
      },
      {
        example_original: `Après le sport, ${definite} a besoin de repos.`,
        example_translation: `После спорта ${translation} нуждается в отдыхе.`,
      },
      {
        example_original: `${definiteCap} va mieux aujourd'hui.`,
        example_translation: `Сегодня ${word.translation} чувствует себя лучше.`,
      },
    ]);
  }

  if (hasTag(word, 'time')) {
    if (hasTag(word, 'thinking')) {
      return chooseVariantPair(word.id, [
        {
          example_original: `${definiteCap} change notre façon de voir les choses.`,
          example_translation: `${word.translation} меняет наш взгляд на вещи.`,
        },
        {
          example_original: `Je réfléchis souvent à ${definite}.`,
          example_translation: `Я часто думаю о ${translation}.`,
        },
        {
          example_original: `${definiteCap} influence encore ses choix.`,
          example_translation: `${word.translation} всё ещё влияет на его выбор.`,
        },
      ]);
    }

    return chooseVariantPair(word.id, [
      {
        example_original: `${definiteCap} passe très vite aujourd'hui.`,
        example_translation: `Сегодня ${translation} проходит очень быстро.`,
      },
      {
        example_original: `Je note ${definite} dans mon agenda.`,
        example_translation: `Я записываю ${translation} в ежедневник.`,
      },
      {
        example_original: `${definiteCap} change tous nos plans.`,
        example_translation: `${word.translation} меняет все наши планы.`,
      },
    ]);
  }

  if (hasTag(word, 'shopping')) {
    return chooseVariantPair(word.id, [
      {
        example_original: `Je cherche ${definite} dans ce magasin.`,
        example_translation: `Я ищу ${translation} в этом магазине.`,
      },
      {
        example_original: `${definiteCap} coûte plus cher ici.`,
        example_translation: `${word.translation} здесь стоит дороже.`,
      },
      {
        example_original: `Avant d'acheter, j'essaie ${definite}.`,
        example_translation: `Перед покупкой я примеряю ${translation}.`,
      },
    ]);
  }

  if (hasTag(word, 'feelings')) {
    return chooseVariantPair(word.id, [
      {
        example_original: `${definiteCap} change tout dans cette histoire.`,
        example_translation: `${word.translation} меняет всё в этой истории.`,
      },
      {
        example_original: `On sent ${definite} dans sa voix.`,
        example_translation: `Это ${translation} слышно в его голосе.`,
      },
      {
        example_original: `${definiteCap} reste difficile à expliquer.`,
        example_translation: `${word.translation} всё ещё трудно объяснить.`,
      },
    ]);
  }

  if (hasTag(word, 'thinking')) {
    return chooseVariantPair(word.id, [
      {
        example_original: `${definiteCap} semble logique dans ce contexte.`,
        example_translation: `${word.translation} кажется логичным в этом контексте.`,
      },
      {
        example_original: `Nous discutons ${definite} pendant la réunion.`,
        example_translation: `Мы обсуждаем ${translation} во время встречи.`,
      },
      {
        example_original: `${definiteCap} aide à avancer plus vite.`,
        example_translation: `${word.translation} помогает двигаться быстрее.`,
      },
    ]);
  }

  return chooseVariantPair(word.id, [
    {
      example_original: `${definiteCap} joue un rôle important ici.`,
      example_translation: `Здесь ${translation} играет важную роль.`,
    },
    {
      example_original: `Dans cette situation, ${definite} est vraiment utile.`,
      example_translation: `В этой ситуации ${translation} действительно полезен.`,
    },
    {
      example_original: `Je pense souvent à ${definite}.`,
      example_translation: `Я часто думаю о ${translation}.`,
    },
  ]);
}

function buildFunctionWordExample(word: Word): { example_original: string; example_translation: string } {
  const original = word.original;
  const key = normalizeKey(original);

  if (word.part_of_speech === 'preposition') {
    const prepositions: Record<string, { example_original: string; example_translation: string }> = {
      avec: {
        example_original: 'Je viens avec mon ami au cinéma.',
        example_translation:
          'Предлог «avec» используют, когда нужно сказать «с кем?» или «с чем?»: сопровождение, совместность, средство.',
      },
      sans: {
        example_original: 'Elle sort sans parapluie malgré la pluie.',
        example_translation:
          'Предлог «sans» используют, чтобы показать отсутствие чего-то: «без кого?» или «без чего?».',
      },
      pour: {
        example_original: 'Ce cadeau est pour ma soeur.',
        example_translation:
          'Предлог «pour» часто вводит адресата, цель или назначение: «для кого?», «зачем?», «на какой срок?».',
      },
      dans: {
        example_original: 'Les clés sont dans le sac.',
        example_translation:
          'Предлог «dans» показывает нахождение внутри пространства или момент в будущем: «внутри», «через какое-то время».',
      },
      sur: {
        example_original: 'Le téléphone est sur la table.',
        example_translation:
          'Предлог «sur» используют для положения на поверхности или для темы речи: «на», «о».',
      },
      sous: {
        example_original: 'Le chat dort sous la chaise.',
        example_translation:
          'Предлог «sous» показывает положение под чем-то: «под кем?» или «под чем?».',
      },
      de: {
        example_original: 'Je parle de mon travail avec Paul.',
        example_translation:
          'Предлог «de» очень частотный: он вводит тему, происхождение, принадлежность и часто стоит после других слов по управлению.',
      },
      a: {
        example_original: 'Nous allons à Paris demain matin.',
        example_translation:
          'Предлог «à» используют для направления и места, а также в конструкциях типа «parler à quelqu’un», времени и грамматическом управлении.',
      },
      en: {
        example_original: 'Elle voyage en train et parle en français.',
        example_translation:
          'Предлог «en» используют для способа действия, языка, транспорта, страны женского рода и состояния: «en train», «en France», «en colère».',
      },
      par: {
        example_original: 'Je passe par le parc pour rentrer.',
        example_translation:
          'Предлог «par» показывает путь, способ или автора действия: «через», «посредством», «кем сделано».',
      },
      chez: {
        example_original: 'Nous dînons chez des amis ce soir.',
        example_translation:
          'Предлог «chez» используют, когда говорят о чьём-то доме, месте работы или круге людей: «у кого?», «к кому?».',
      },
      entre: {
        example_original: 'Le café est entre la banque et la poste.',
        example_translation:
          'Предлог «entre» показывает положение или выбор между двумя или несколькими объектами: «между».',
      },
      avant: {
        example_original: 'Je lis un peu avant de dormir.',
        example_translation:
          'Предлог «avant» указывает на предшествование по времени; с инфинитивом часто используется форма «avant de + infinitif».',
      },
      apres: {
        example_original: 'On se retrouve après le cours.',
        example_translation:
          'Предлог «après» показывает, что одно действие следует после другого: «после чего?».',
      },
      pendant: {
        example_original: 'Je prends des notes pendant la réunion.',
        example_translation:
          'Предлог «pendant» указывает длительность действия или период, в течение которого что-то происходит.',
      },
      depuis: {
        example_original: "J'habite ici depuis deux ans.",
        example_translation:
          'Предлог «depuis» используют для действия, которое началось в прошлом и продолжается до сих пор: «с какого времени?».',
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
        example_translation: 'Определитель «ce» ставят перед существительным мужского рода в единственном числе: «этот».',
      },
      cette: {
        example_original: 'Cette rue est très calme le soir.',
        example_translation: 'Определитель «cette» ставят перед существительным женского рода в единственном числе: «эта».',
      },
      ces: {
        example_original: 'Ces photos viennent de notre voyage.',
        example_translation: 'Определитель «ces» используют с существительными во множественном числе: «эти».',
      },
      le: {
        example_original: 'Le train arrive à huit heures.',
        example_translation: 'Артикль «le» указывает на конкретное существительное мужского рода в единственном числе.',
      },
      la: {
        example_original: 'La porte est déjà ouverte.',
        example_translation: 'Артикль «la» указывает на конкретное существительное женского рода в единственном числе.',
      },
      les: {
        example_original: 'Les enfants jouent dans le jardin.',
        example_translation: 'Артикль «les» используют с конкретными существительными во множественном числе.',
      },
      un: {
        example_original: "J'ai acheté un billet pour demain.",
        example_translation: 'Артикль «un» вводит новое или неопределённое существительное мужского рода в единственном числе.',
      },
      une: {
        example_original: "Elle cherche une réponse simple.",
        example_translation: 'Артикль «une» вводит новое или неопределённое существительное женского рода в единственном числе.',
      },
      des: {
        example_original: "Nous avons acheté des fruits au marché.",
        example_translation: 'Артикль «des» используют для неопределённого количества существительных во множественном числе.',
      },
      mon: {
        example_original: 'Mon bureau est près de la fenêtre.',
        example_translation: 'Определитель «mon» показывает принадлежность: «мой» перед существительным мужского рода или перед гласной.',
      },
      ma: {
        example_original: 'Ma soeur habite à Lyon.',
        example_translation: 'Определитель «ma» показывает принадлежность: «моя» перед существительным женского рода.',
      },
      mes: {
        example_original: 'Mes amis arrivent ce soir.',
        example_translation: 'Определитель «mes» означает «мои» и используется с существительными во множественном числе.',
      },
      ton: {
        example_original: 'Ton café est prêt.',
        example_translation: 'Определитель «ton» означает «твой» перед существительным мужского рода или перед гласной.',
      },
      ta: {
        example_original: 'Ta veste est sur la chaise.',
        example_translation: 'Определитель «ta» означает «твоя» перед существительным женского рода.',
      },
      tes: {
        example_original: 'Tes clés sont sur la table.',
        example_translation: 'Определитель «tes» означает «твои» и используется с существительными во множественном числе.',
      },
      son: {
        example_original: 'Son ordinateur est neuf.',
        example_translation: 'Определитель «son» означает «его/её» перед существительным мужского рода или перед гласной.',
      },
      sa: {
        example_original: 'Sa voiture est devant la maison.',
        example_translation: 'Определитель «sa» означает «его/её» перед существительным женского рода.',
      },
      ses: {
        example_original: 'Ses parents vivent à Marseille.',
        example_translation: 'Определитель «ses» означает «его/её» с существительными во множественном числе.',
      },
      notre: {
        example_original: 'Notre cours commence à neuf heures.',
        example_translation: 'Определитель «notre» означает «наш/наша» в единственном числе.',
      },
      votre: {
        example_original: 'Votre réservation est confirmée.',
        example_translation: 'Определитель «votre» означает «ваш/ваша» в единственном числе или в вежливой форме.',
      },
      leur: {
        example_original: 'Leur appartement est au troisième étage.',
        example_translation: 'Определитель «leur» означает «их» перед существительным в единственном числе.',
      },
      quel: {
        example_original: 'Quel film veux-tu voir ce soir ?',
        example_translation: 'Определитель «quel» используют в вопросах перед существительным мужского рода: «какой?».',
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
        example_translation: 'Местоимение «je» означает «я» и используется, когда говорящий говорит о себе как о подлежащем.',
      },
      tu: {
        example_original: 'Tu connais déjà ce mot ?',
        example_translation: 'Местоимение «tu» означает «ты» и используется в неформальном обращении к одному человеку.',
      },
      il: {
        example_original: 'Il travaille aujourd’hui à la maison.',
        example_translation: 'Местоимение «il» означает «он» и используется как подлежащее в мужском роде.',
      },
      elle: {
        example_original: 'Elle arrive après le déjeuner.',
        example_translation: 'Местоимение «elle» означает «она» и используется как подлежащее в женском роде.',
      },
      nous: {
        example_original: 'Nous révisons ensemble avant le test.',
        example_translation: 'Местоимение «nous» означает «мы» и используется, когда говорящий включает себя в группу.',
      },
      vous: {
        example_original: 'Vous avez une minute, madame ?',
        example_translation: 'Местоимение «vous» означает «вы» для множественного числа или вежливого обращения к одному человеку.',
      },
      ils: {
        example_original: 'Ils arrivent par le train de midi.',
        example_translation: 'Местоимение «ils» означает «они» для мужского рода или смешанной группы.',
      },
      elles: {
        example_original: 'Elles parlent de leur projet.',
        example_translation: 'Местоимение «elles» означает «они» для группы женского рода.',
      },
      on: {
        example_original: 'En France, on dit souvent bonjour en entrant.',
        example_translation: 'Местоимение «on» часто означает «мы» или безличное «кто-то/люди» в общем смысле.',
      },
      qui: {
        example_original: 'Qui vient avec nous ce soir ?',
        example_translation: 'Местоимение «qui» используют в вопросе о человеке: «кто?».',
      },
      quoi: {
        example_original: 'Tu cherches quoi exactement ?',
        example_translation: 'Местоимение «quoi» используют, когда спрашивают о предмете или действии: «что?».',
      },
      laquelle: {
        example_original: 'Laquelle de ces rues mène à la gare ?',
        example_translation: 'Местоимение «laquelle» используют, когда выбирают один предмет женского рода из нескольких: «какая именно?».',
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
        example_translation: 'Союз «et» соединяет слова или части предложения и добавляет новую информацию: «и».',
      },
      mais: {
        example_original: 'Je comprends la règle, mais j’ai besoin de pratique.',
        example_translation: 'Союз «mais» вводит противопоставление или ограничение: «но».',
      },
      ou: {
        example_original: 'On va au parc ou on reste à la maison ?',
        example_translation: 'Союз «ou» показывает выбор между вариантами: «или».',
      },
      si: {
        example_original: 'Si tu veux, on peut recommencer.',
        example_translation: 'Союз «si» вводит условие: «если».',
      },
      'parce que': {
        example_original: 'Je reste chez moi parce que je suis fatigué.',
        example_translation: 'Союз «parce que» вводит причину и отвечает на вопрос «почему?».',
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
        example_translation: 'Наречие «aujourd’hui» указывает на сегодняшний день и отвечает на вопрос «когда?».',
      },
      demain: {
        example_original: 'Demain, je passe un examen important.',
        example_translation: 'Наречие «demain» указывает на следующий день: «завтра».',
      },
      hier: {
        example_original: "Hier, j'ai vu Marie en ville.",
        example_translation: 'Наречие «hier» указывает на предыдущий день: «вчера».',
      },
      maintenant: {
        example_original: 'Maintenant, je comprends mieux la règle.',
        example_translation: 'Наречие «maintenant» указывает на момент речи: «сейчас».',
      },
      ici: {
        example_original: 'Vous pouvez attendre ici quelques minutes.',
        example_translation: 'Наречие «ici» показывает место рядом с говорящим: «здесь».',
      },
      'là': {
        example_original: 'Pose le sac là, près de la porte.',
        example_translation: 'Наречие «là» показывает место там, в указанной точке: «там/вот здесь».',
      },
      loin: {
        example_original: 'La gare n’est pas loin d’ici.',
        example_translation: 'Наречие «loin» показывает большое расстояние: «далеко».',
      },
      souvent: {
        example_original: 'Je relis souvent mes notes le soir.',
        example_translation: 'Наречие «souvent» указывает частоту действия: «часто».',
      },
      jamais: {
        example_original: 'Il ne voyage jamais sans son passeport.',
        example_translation: 'Наречие «jamais» обычно используется с отрицанием и означает «никогда».',
      },
      parfois: {
        example_original: 'Parfois, nous déjeunons au parc.',
        example_translation: 'Наречие «parfois» указывает, что действие происходит время от времени: «иногда».',
      },
      toujours: {
        example_original: 'Elle arrive toujours à l’heure.',
        example_translation: 'Наречие «toujours» означает постоянство или повторяемость: «всегда».',
      },
      encore: {
        example_original: 'Je dois encore apprendre dix mots.',
        example_translation: 'Наречие «encore» означает «ещё» или «снова» в зависимости от контекста.',
      },
      deja: {
        example_original: 'Nous avons déjà terminé le module.',
        example_translation: 'Наречие «déjà» показывает, что действие произошло раньше ожидаемого: «уже».',
      },
      ensemble: {
        example_original: 'Nous travaillons ensemble sur ce projet.',
        example_translation: 'Наречие «ensemble» показывает совместность действия: «вместе».',
      },
      comment: {
        example_original: 'Comment tu prononces ce mot ?',
        example_translation: 'Наречие «comment» используют в вопросах о способе действия: «как?».',
      },
      pourquoi: {
        example_original: 'Pourquoi tu changes de plan ?',
        example_translation: 'Наречие «pourquoi» используют, когда спрашивают о причине: «почему?».',
      },
      quand: {
        example_original: 'Quand commence la réunion ?',
        example_translation: 'Наречие «quand» используют в вопросах о времени: «когда?».',
      },
      ou: {
        example_original: 'Où as-tu mis le dictionnaire ?',
        example_translation: 'Наречие «où» используют в вопросах о месте: «где?», «куда?».',
      },
      oui: {
        example_original: 'Oui, je peux t’aider après le cours.',
        example_translation: 'Наречие «oui» выражает согласие или подтверждение: «да».',
      },
      non: {
        example_original: 'Non, ce n’est pas la bonne réponse.',
        example_translation: 'Наречие «non» выражает отрицание или несогласие: «нет».',
      },
      'peut-etre': {
        example_original: 'Peut-être qu’il arrive plus tard.',
        example_translation: 'Наречие «peut-être» выражает неуверенность или вероятность: «может быть».',
      },
      pres: {
        example_original: 'La pharmacie est tout près d’ici.',
        example_translation: 'Наречие «près» указывает на близкое расстояние: «близко, рядом».',
      },
      trop: {
        example_original: 'Ce sac est trop lourd pour moi.',
        example_translation: 'Наречие «trop» показывает избыточную степень: «слишком».',
      },
      tres: {
        example_original: 'Ce texte est très utile pour réviser.',
        example_translation: 'Наречие «très» усиливает признак или качество: «очень».',
      },
      assez: {
        example_original: 'Cette explication est assez claire.',
        example_translation: 'Наречие «assez» показывает достаточную или умеренную степень: «достаточно, довольно».',
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
    case 'adjective':
      return {
        example_original: chooseVariant(original, [
          `Ce choix est ${original}.`,
          `Le résultat paraît ${original}.`,
          `Aujourd’hui, tout semble ${original}.`,
        ]),
        example_translation: chooseVariant(original, [
          `Этот выбор ${word.translation.toLowerCase()}.`,
          `Результат кажется ${word.translation.toLowerCase()}.`,
          `Сегодня всё выглядит ${word.translation.toLowerCase()}.`,
        ]),
      };
    default:
      return buildExpressionExample(word);
  }
}

function improveWordExamples(word: Word): Pick<Word, 'example_original' | 'example_translation'> {
  if (word.source === 'custom' && !isGenericExample(word.example_original)) {
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
    imagePackCategory: word.imagePackCategory ?? undefined,
    illustrationType: word.illustrationType ?? undefined,
    imagePrompt: word.imagePrompt ?? undefined,
    imageSource: word.imageSource ?? undefined,
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

function sortWordsByCurriculum(words: Word[], language: LearningLanguage): Word[] {
  return [...words].sort((left, right) => {
    const levelDiff = LEVEL_ORDER[left.level] - LEVEL_ORDER[right.level];

    if (levelDiff !== 0) {
      return levelDiff;
    }

    return left.original.localeCompare(right.original, language === 'japanese' ? 'ja' : 'fr');
  });
}

export async function loadWords(language: LearningLanguage): Promise<Word[]> {
  const cached = wordsPromiseByLanguage.get(language);

  if (cached) {
    return cached;
  }

  const wordsPromise = (async () => {
    const wordImageManifestPromise = loadWordImageManifest();

    if (language === 'japanese') {
      const [{ JAPANESE_CORE_WORDS }, wordImageManifest] = await Promise.all([
        import('./japaneseWords'),
        wordImageManifestPromise,
      ]);

      return sortWordsByCurriculum(
        JAPANESE_CORE_WORDS.map((word) => normalizeWord({ ...word, ...wordImageManifest[word.id] })),
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
        ...getPackWords().map((word) => normalizeWord({ ...word, ...wordImageManifest[word.id] })),
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
