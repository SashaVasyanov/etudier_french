export interface KanaChar {
  kana: string;
  hiragana: string;
  romaji: string;
  group: 'basic' | 'voiced';
}

// [katakana, hiragana, romaji] in gojūon order; ヲ is left out as it is
// practically unused in katakana words.
const BASIC: Array<[string, string, string]> = [
  ['ア', 'あ', 'a'], ['イ', 'い', 'i'], ['ウ', 'う', 'u'], ['エ', 'え', 'e'], ['オ', 'お', 'o'],
  ['カ', 'か', 'ka'], ['キ', 'き', 'ki'], ['ク', 'く', 'ku'], ['ケ', 'け', 'ke'], ['コ', 'こ', 'ko'],
  ['サ', 'さ', 'sa'], ['シ', 'し', 'shi'], ['ス', 'す', 'su'], ['セ', 'せ', 'se'], ['ソ', 'そ', 'so'],
  ['タ', 'た', 'ta'], ['チ', 'ち', 'chi'], ['ツ', 'つ', 'tsu'], ['テ', 'て', 'te'], ['ト', 'と', 'to'],
  ['ナ', 'な', 'na'], ['ニ', 'に', 'ni'], ['ヌ', 'ぬ', 'nu'], ['ネ', 'ね', 'ne'], ['ノ', 'の', 'no'],
  ['ハ', 'は', 'ha'], ['ヒ', 'ひ', 'hi'], ['フ', 'ふ', 'fu'], ['ヘ', 'へ', 'he'], ['ホ', 'ほ', 'ho'],
  ['マ', 'ま', 'ma'], ['ミ', 'み', 'mi'], ['ム', 'む', 'mu'], ['メ', 'め', 'me'], ['モ', 'も', 'mo'],
  ['ヤ', 'や', 'ya'], ['ユ', 'ゆ', 'yu'], ['ヨ', 'よ', 'yo'],
  ['ラ', 'ら', 'ra'], ['リ', 'り', 'ri'], ['ル', 'る', 'ru'], ['レ', 'れ', 're'], ['ロ', 'ろ', 'ro'],
  ['ワ', 'わ', 'wa'], ['ン', 'ん', 'n'],
];

const VOICED: Array<[string, string, string]> = [
  ['ガ', 'が', 'ga'], ['ギ', 'ぎ', 'gi'], ['グ', 'ぐ', 'gu'], ['ゲ', 'げ', 'ge'], ['ゴ', 'ご', 'go'],
  ['ザ', 'ざ', 'za'], ['ジ', 'じ', 'ji'], ['ズ', 'ず', 'zu'], ['ゼ', 'ぜ', 'ze'], ['ゾ', 'ぞ', 'zo'],
  ['ダ', 'だ', 'da'], ['デ', 'で', 'de'], ['ド', 'ど', 'do'],
  ['バ', 'ば', 'ba'], ['ビ', 'び', 'bi'], ['ブ', 'ぶ', 'bu'], ['ベ', 'べ', 'be'], ['ボ', 'ぼ', 'bo'],
  ['パ', 'ぱ', 'pa'], ['ピ', 'ぴ', 'pi'], ['プ', 'ぷ', 'pu'], ['ペ', 'ぺ', 'pe'], ['ポ', 'ぽ', 'po'],
];

export const KATAKANA: KanaChar[] = [
  ...BASIC.map(([kana, hiragana, romaji]) => ({ kana, hiragana, romaji, group: 'basic' as const })),
  ...VOICED.map(([kana, hiragana, romaji]) => ({ kana, hiragana, romaji, group: 'voiced' as const })),
];

export interface LoanWord {
  kana: string;
  romaji: string;
  translation: string;
}

// Everyday loanwords for reading practice: the words a learner meets on menus,
// signs and in shops. Long vowels are written as in the dictionary (koohii).
export const KATAKANA_WORDS: LoanWord[] = [
  { kana: 'コーヒー', romaji: 'koohii', translation: 'кофе' },
  { kana: 'テレビ', romaji: 'terebi', translation: 'телевизор' },
  { kana: 'ホテル', romaji: 'hoteru', translation: 'гостиница' },
  { kana: 'パン', romaji: 'pan', translation: 'хлеб' },
  { kana: 'カメラ', romaji: 'kamera', translation: 'фотоаппарат' },
  { kana: 'タクシー', romaji: 'takushii', translation: 'такси' },
  { kana: 'バス', romaji: 'basu', translation: 'автобус' },
  { kana: 'トイレ', romaji: 'toire', translation: 'туалет' },
  { kana: 'メニュー', romaji: 'menyuu', translation: 'меню' },
  { kana: 'ジュース', romaji: 'juusu', translation: 'сок' },
  { kana: 'ケーキ', romaji: 'keeki', translation: 'торт, пирожное' },
  { kana: 'ビール', romaji: 'biiru', translation: 'пиво' },
  { kana: 'ワイン', romaji: 'wain', translation: 'вино' },
  { kana: 'パソコン', romaji: 'pasokon', translation: 'компьютер' },
  { kana: 'スマホ', romaji: 'sumaho', translation: 'смартфон' },
  { kana: 'メール', romaji: 'meeru', translation: 'электронное письмо' },
  { kana: 'ニュース', romaji: 'nyuusu', translation: 'новости' },
  { kana: 'スポーツ', romaji: 'supootsu', translation: 'спорт' },
  { kana: 'サッカー', romaji: 'sakkaa', translation: 'футбол' },
  { kana: 'ピアノ', romaji: 'piano', translation: 'пианино' },
  { kana: 'ギター', romaji: 'gitaa', translation: 'гитара' },
  { kana: 'ドア', romaji: 'doa', translation: 'дверь' },
  { kana: 'ベッド', romaji: 'beddo', translation: 'кровать' },
  { kana: 'テーブル', romaji: 'teeburu', translation: 'стол' },
  { kana: 'エレベーター', romaji: 'erebeetaa', translation: 'лифт' },
  { kana: 'デパート', romaji: 'depaato', translation: 'универмаг' },
  { kana: 'スーパー', romaji: 'suupaa', translation: 'супермаркет' },
  { kana: 'レストラン', romaji: 'resutoran', translation: 'ресторан' },
  { kana: 'アパート', romaji: 'apaato', translation: 'квартира (в малоэтажном доме)' },
  { kana: 'ペン', romaji: 'pen', translation: 'ручка' },
  { kana: 'ノート', romaji: 'nooto', translation: 'тетрадь' },
  { kana: 'シャツ', romaji: 'shatsu', translation: 'рубашка' },
  { kana: 'ズボン', romaji: 'zubon', translation: 'брюки' },
  { kana: 'ネクタイ', romaji: 'nekutai', translation: 'галстук' },
  { kana: 'ラジオ', romaji: 'rajio', translation: 'радио' },
  { kana: 'ゲーム', romaji: 'geemu', translation: 'игра' },
  { kana: 'アニメ', romaji: 'anime', translation: 'аниме' },
  { kana: 'ロシア', romaji: 'roshia', translation: 'Россия' },
  { kana: 'フランス', romaji: 'furansu', translation: 'Франция' },
  { kana: 'アメリカ', romaji: 'amerika', translation: 'Америка' },
  { kana: 'カレー', romaji: 'karee', translation: 'карри' },
  { kana: 'ラーメン', romaji: 'raamen', translation: 'рамен' },
  { kana: 'チーズ', romaji: 'chiizu', translation: 'сыр' },
  { kana: 'トマト', romaji: 'tomato', translation: 'помидор' },
  { kana: 'バナナ', romaji: 'banana', translation: 'банан' },
];
