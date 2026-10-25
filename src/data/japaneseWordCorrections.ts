import type { Word } from '../types';

type JapaneseWordCorrection = Partial<
  Pick<
    Word,
    | 'original'
    | 'translation'
    | 'transcription'
    | 'part_of_speech'
    | 'example_original'
    | 'example_reading'
    | 'example_translation'
  >
>;

// A shared kanji can resolve to the wrong dictionary sense. These concise
// learning meanings stay separate from generated data so regeneration cannot
// restore rare, truncated or contextually incorrect glosses.
const JAPANESE_WORD_CORRECTIONS: Readonly<Record<string, JapaneseWordCorrection>> = {
  '何': { translation: 'что?' },
  'あ': { translation: 'ах! / ой!' },
  'あなた': { translation: 'вы / ты' },
  '言': { translation: 'слово / высказывание' },
  '人': { translation: 'человек / люди' },
  '事': { translation: 'дело / факт / вещь' },
  '彼女': { translation: 'она / девушка' },
  'お前': { translation: 'ты (грубо)' },
  '話': { translation: 'разговор / история' },
  '者': { translation: 'человек / тот, кто…' },
  '時': { translation: 'время / момент' },
  'ああ': { translation: 'ах / да' },
  '前': { translation: 'перед / впереди / раньше', transcription: '[まえ · mae]' },
  '中': { translation: 'внутри / среди' },
  '必要': { translation: 'необходимый / необходимость', part_of_speech: 'adjective' },
  'あの': { translation: 'тот (вон там)', part_of_speech: 'determiner' },
  '気': { translation: 'дух / настроение / ощущение' },
  '大丈夫': { translation: 'всё в порядке / безопасно', part_of_speech: 'adjective' },
  '自分': { translation: 'сам / себя' },
  '本当': { translation: 'правда / настоящий' },
  '時間': { translation: 'время / час' },
  '一緒': { translation: 'вместе', part_of_speech: 'adverb' },
  '後': { translation: 'после / сзади', part_of_speech: 'noun' },
  '他': { translation: 'другой / остальной' },
  '入': {
    original: '入る',
    translation: 'входить',
    transcription: '[はいる · hairu]',
    part_of_speech: 'verb',
    example_original: '部屋に入る前に靴を脱ぎます。',
    example_reading: 'へやにはいるまえにくつをぬぎます。',
    example_translation: 'Перед тем как войти в комнату, я снимаю обувь.',
  },
  '電話': { translation: 'телефон / звонок' },
  '目': { translation: 'глаз' },
  '様': { translation: 'господин / госпожа (вежливо)', transcription: '[さま · sama]' },
  '車': { translation: 'машина / автомобиль' },
  '所': { translation: 'место; там, где…', transcription: '[ところ · tokoro]' },
  '度': { translation: 'раз / градус' },
  '同じ': { translation: 'такой же / одинаковый', part_of_speech: 'adjective' },
  '問題': { translation: 'вопрос / проблема / задача' },
  '子供': { translation: 'ребёнок / дети' },
  '金': { translation: 'деньги', transcription: '[かね · kane]' },
  '子': { translation: 'ребёнок', transcription: '[こ · ko]' },
  'さあ': { translation: 'ну / итак' },
  '少し': { translation: 'немного' },
  '全て': { translation: 'всё / все' },
  '世界': { translation: 'мир (весь свет)' },
  '教え': {
    original: '教える',
    translation: 'учить / преподавать',
    transcription: '[おしえる · oshieru]',
    part_of_speech: 'verb',
  },
  '通り': { translation: 'улица / дорога', part_of_speech: 'noun' },
  '来る': { translation: 'приходить / приезжать' },
  '上': { translation: 'на / над / сверху' },
  '人間': { translation: 'человек / человечество' },
  '今日': { translation: 'сегодня' },
  'あれ': { translation: 'то (вон там)' },
  'じゃあ': { translation: 'тогда / ну что же' },
  '心配する': { translation: 'беспокоиться / волноваться' },
  '連れ': { translation: 'спутник / сопровождающий' },
  '外': { translation: 'снаружи / вне' },
  '家族': { translation: 'семья' },
  '意味する': {
    translation: 'означать',
    example_original: 'この言葉は何を意味しますか。',
    example_reading: 'このことばはなにをいみしますか。',
    example_translation: 'Что означает это слово?',
  },
  '神': { translation: 'бог / божество' },
  '力': { translation: 'сила / способность' },
  '最後': { translation: 'последний / конец' },
  '作': {
    original: '作る',
    translation: 'делать / создавать',
    transcription: '[つくる · tsukuru]',
    part_of_speech: 'verb',
  },
  '次': { translation: 'следующий / затем' },
  '全部': { translation: 'всё / полностью' },
  '間': { translation: 'между / промежуток / время' },
  '書': {
    original: '書く',
    translation: 'писать',
    transcription: '[かく · kaku]',
    part_of_speech: 'verb',
  },
  '捜査': { translation: 'расследование', part_of_speech: 'noun' },
  '回': { translation: 'раз / случай' },
  '情報': { translation: 'информация / сведения' },
  '理由': { translation: 'причина / основание' },
  '数': {
    original: '数える',
    translation: 'считать',
    transcription: '[かぞえる · kazoeru]',
    part_of_speech: 'verb',
  },
  '一人': { translation: 'один человек / один' },
  '部屋': { translation: 'комната' },
  '以上': { translation: 'не менее / больше / выше' },
  '人生': { translation: 'жизнь (человеческая судьба)' },
  '急': {
    original: '急に',
    translation: 'внезапно / резко',
    transcription: '[きゅうに · kyuuni]',
    part_of_speech: 'adverb',
  },
  '女性': { translation: 'женщина / женский' },
  '事件': { translation: 'происшествие / дело' },
  '始め': {
    original: '始める',
    translation: 'начинать',
    transcription: '[はじめる · hajimeru]',
    part_of_speech: 'verb',
  },
  '最初': { translation: 'сначала / первый' },
  '連絡する': { translation: 'связываться / сообщать' },
  '安全': { translation: 'безопасный / безопасность' },
  '殺人する': { translation: 'совершать убийство' },
  '下': { translation: 'под / внизу', transcription: '[した · shita]' },
  '万': { translation: 'десять тысяч', part_of_speech: 'noun' },
  '友達': { translation: 'друг / приятель' },
  '約束する': { translation: 'обещать / договариваться' },
  '二': { translation: 'два' },
  '結婚する': { translation: 'жениться / выходить замуж' },
  '無理': { translation: 'невозможно / чрезмерно' },
  '感じ': { translation: 'чувство / впечатление' },
  '得': { translation: 'выгода / польза' },
  '最高': { translation: 'лучший / высший' },
  '計画する': { translation: 'планировать' },
  '仲間': { translation: 'товарищ / группа' },
  '先': { translation: 'впереди / раньше', transcription: '[さき · saki]' },
  '可能': { translation: 'возможный / возможно' },
  'あいつ': { translation: 'он / она (грубо)' },
  'なあ': { translation: 'ну / эй / ведь', part_of_speech: 'interjection' },
  'あと': { translation: 'после / сзади' },
  '明日': { translation: 'завтра' },
  '確認する': { translation: 'проверять / подтверждать' },
  '命': { translation: 'жизнь (живое существо)' },
  '全員': { translation: 'все / весь состав' },
  '理解する': { translation: 'понимать' },
  '二人': { translation: 'два человека / вдвоём' },
  '友人': { translation: 'друг' },
  '大': { translation: 'большой / великий' },
  '写真': { translation: 'фотография' },
  '一番': { translation: 'самый / номер один' },
  '状況': { translation: 'ситуация / положение' },
  '了解': { translation: 'понятно / принято' },
  '一体': { translation: 'вообще / же', part_of_speech: 'adverb' },
  '店': { translation: 'магазин / заведение' },
  '光': { translation: 'свет / сияние' },
  '大きな': { translation: 'большой' },
  '実際': { translation: 'на самом деле / фактически', part_of_speech: 'adverb' },
  '解決する': { translation: 'решать / разрешать' },
  '結果する': {
    original: '結果',
    translation: 'результат',
    transcription: '[けっか · kekka]',
    part_of_speech: 'noun',
  },
  '運転する': { translation: 'водить / управлять' },
  '１人': { translation: 'один человек / в одиночку' },
  '近く': { translation: 'рядом / поблизости' },
  '不明': { translation: 'неизвестный / неясный', part_of_speech: 'adjective' },
  '映画': { translation: 'фильм / кино' },
  '現場': { translation: 'место происшествия / объект' },
  '身': { translation: 'тело / сам человек' },
  '非常': {
    original: '非常に',
    translation: 'очень / чрезвычайно',
    transcription: '[ひじょうに · hijouni]',
    part_of_speech: 'adverb',
  },
  '今回': { translation: 'на этот раз / нынешний' },
  '結構': { translation: 'достаточно / подходит / хорошо' },
  '予定する': {
    original: '予定',
    translation: 'план / расписание',
    transcription: '[よてい · yotei]',
    part_of_speech: 'noun',
  },
  '最悪': { translation: 'худший / ужасно' },
  '日本': { translation: 'Япония' },
  '小さな': { translation: 'маленький' },
  '向こう': { translation: 'там / на той стороне' },
  '無し': { translation: 'без / отсутствует' },
  '技術': { translation: 'техника / навык / технология' },
  '世話': { translation: 'забота / помощь' },
  '幸運': { translation: 'удача / везение' },
  '主': {
    original: '持ち主',
    translation: 'владелец / хозяин',
    transcription: '[もちぬし · mochinushi]',
    part_of_speech: 'noun',
  },
  // Data cleanup (2026-10): dictionary glosses that leaked through as Japanese
  // text, English-only or empty translations, wrong readings and examples that
  // used a different word than the entry.
  '信頼する': { translation: 'доверять, полагаться (на кого-л.)' },
  '未来': { translation: 'будущее' },
  '部下': { translation: 'подчинённый' },
  '行き': { translation: 'поездка туда; «…行き» — «до …» (о направлении)' },
  '契約する': { translation: 'заключать договор' },
  '大人': { translation: 'взрослый', part_of_speech: 'noun' },
  'アクセスする': { translation: 'заходить (на сайт), получать доступ' },
  '高校': { translation: 'старшая школа' },
  '具合': { translation: 'состояние, самочувствие' },
  '試合する': { translation: 'проводить матч, соревноваться' },
  '手がかり': { translation: 'зацепка, ключ к разгадке' },
  '納得する': { translation: 'соглашаться, принимать (довод)' },
  '約': { translation: 'около, приблизительно' },
  '注文する': { translation: 'заказывать' },
  'アップする': { translation: 'выкладывать (в сеть); повышать' },
  'アイデア': { translation: 'идея' },
  '始まり': { translation: 'начало' },
  '貴女': { translation: 'вы (к женщине)' },
  '白人': { translation: 'белый человек (европеоид)' },
  '国境': { translation: 'государственная граница' },
  'アイス': { translation: 'мороженое; лёд' },
  '民間': { translation: 'частный, гражданский (не государственный)' },
  '軍人': { translation: 'военный (человек)' },
  'あり': { translation: 'муравей' },
  'エイリアン': { translation: 'инопланетянин' },
  '何事': { translation: 'что-то; что случилось' },
  '殺害する': { translation: 'убивать (официально)' },
  '単なる': { translation: 'всего лишь, не более чем' },
  '保障する': { translation: 'гарантировать (права, безопасность)' },
  '保証する': { translation: 'гарантировать, ручаться (за качество)' },
  '平和': { translation: 'мир (без войны), спокойствие' },
  '身体': { translation: 'тело, организм' },
  '生まれ': { translation: 'происхождение; место рождения' },
  '位': { translation: 'примерно; ранг, разряд' },
  '初': { translation: 'первый (раз), начальный' },
  '人殺し': { translation: 'убийца; убийство' },
  'あっち': { translation: 'туда, там (разг.)' },
  '行': {
    translation: 'строка',
    example_original: '次の行を読んでください。',
    example_reading: 'つぎのぎょうをよんでください。',
    example_translation: 'Прочитайте следующую строку.',
  },
  '生': {
    translation: 'сырой; живой (о звуке, трансляции)',
    part_of_speech: 'adjective',
    example_original: '魚を生で食べるのは好きですか。',
    example_reading: 'さかなをなまでたべるのはすきですか。',
    example_translation: 'Вы любите есть рыбу сырой?',
  },
  '公': {
    original: '君',
    translation: 'ты (к равному или младшему)',
    transcription: '[きみ · kimi]',
    example_original: '君の名前は何ですか。',
    example_reading: 'きみのなまえはなんですか。',
    example_translation: 'Как тебя зовут?',
  },
  '表': {
    translation: 'лицевая сторона; поверхность',
    example_original: '紙の表に名前を書いてください。',
    example_reading: 'かみのおもてになまえをかいてください。',
    example_translation: 'Напишите имя на лицевой стороне листа.',
  },
};

/**
 * Entries that should not be studied at all: duplicates of another entry
 * (あぁ / あー / アア / ア for ああ, 有難う for ありがとう), fragments without a
 * usable meaning (あげ, 上げ), and entries whose kanji, reading and example
 * belong to different words (重, 科).
 */
export const JAPANESE_EXCLUDED_WORDS: ReadonlySet<string> = new Set(['あぁ', 'あー', 'アア', 'ア', '有難う', 'あげ', '上げ', '重', '科']);

export function applyJapaneseWordCorrection(word: Word): Word {
  const correction = JAPANESE_WORD_CORRECTIONS[word.original];
  return correction ? { ...word, ...correction } : word;
}

/**
 * Generic cleanup of generated entries: a katakana word is read exactly as
 * written (ドア, not どあ), and a leftover sense number («1. природа») is dropped.
 */
export function cleanJapaneseEntry(word: Word): Word {
  const translation = word.translation.replace(/^\d+\.\s*/, '');
  const katakana = /^[\u30a0-\u30ff]+(する)?$/.test(word.original);
  const romaji = katakana ? word.transcription.match(/·\s*([^\]]+)\]/)?.[1]?.trim() : undefined;
  return {
    ...word,
    translation,
    transcription: romaji ? `[${word.original} · ${romaji}]` : word.transcription,
  };
}
