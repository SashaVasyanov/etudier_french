import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import kuromoji from 'kuromoji';

const WORDS_SOURCE = process.env.JAPANESE_WORDS_SOURCE ?? 'src/data/japaneseWords.ts';
const JAPANESE_SENTENCES_SOURCE = process.env.TATOEBA_JAPANESE_SENTENCES ?? '/tmp/etudier-jpn-sentences.tsv';
const RUSSIAN_SENTENCES_SOURCE = process.env.TATOEBA_RUSSIAN_SENTENCES ?? '/tmp/etudier-rus-sentences.tsv';
const LINKS_SOURCE = process.env.TATOEBA_JAPANESE_RUSSIAN_LINKS ?? '/tmp/etudier-jpn-rus-links.tsv';
const TRANSCRIPTIONS_SOURCE = process.env.TATOEBA_TRANSCRIPTIONS ?? '/tmp/etudier-transcriptions.csv';
const OUTPUT = process.env.JAPANESE_EXAMPLES_OUTPUT ?? 'src/data/japaneseExamples.ts';
const KUROMOJI_DICTIONARY_PATH = fileURLToPath(new URL('../node_modules/kuromoji/dict/', import.meta.url));
const HIRAGANA_READING_OVERRIDES = {
  '彼は私に１人で行けと命令した。': 'かれはわたしにひとりでいけとめいれいした。',
  'あの仔猫にはタマと名付けました。': 'あのこねこにはたまとなづけました。',
  '昔々その村に１人のけちな老人が住んでいました。': 'むかしむかしそのむらにひとりのけちなろうじんがすんでいました。',
};
const TATOEBA_EXPORTS = {
  [JAPANESE_SENTENCES_SOURCE]: 'https://downloads.tatoeba.org/exports/per_language/jpn/jpn_sentences.tsv.bz2',
  [RUSSIAN_SENTENCES_SOURCE]: 'https://downloads.tatoeba.org/exports/per_language/rus/rus_sentences.tsv.bz2',
  [LINKS_SOURCE]: 'https://downloads.tatoeba.org/exports/per_language/jpn/jpn-rus_links.tsv.bz2',
};

const MANUAL_EXAMPLES = {
  何: ['何を探しているの？', 'Что ты ищешь?'],
  あ: ['あ、電車が来ました。', 'А, поезд пришёл.'],
  あなた: ['あなたに会えてうれしいです。', 'Я рад встрече с вами.'],
  言: ['彼の言を信じました。', 'Я поверил его словам.'],
  行: ['次の行を読んでください。', 'Прочитайте следующую строку.'],
  人: ['公園にたくさんの人がいます。', 'В парке много людей.'],
  事: ['大切な事を忘れないでください。', 'Пожалуйста, не забывайте о важном деле.'],
  彼女: ['彼女は毎朝コーヒーを飲みます。', 'Она каждое утро пьёт кофе.'],
  お前: ['お前ならきっとできる。', 'Ты наверняка справишься.'],
  話: ['祖父から面白い話を聞きました。', 'Я услышал от дедушки интересную историю.'],
  者: ['参加する者は名前を書いてください。', 'Те, кто участвует, пожалуйста, напишите своё имя.'],
  死: ['その事故で多くの人が死を意識しました。', 'Из-за той аварии многие задумались о смерти.'],
  時: ['子供の時、よく海で泳ぎました。', 'В детстве я часто плавал в море.'],
  ああ: ['ああ、今日は本当に疲れました。', 'Ах, сегодня я действительно устал.'],
  前: ['駅の前で友達を待っています。', 'Я жду друга перед вокзалом.'],
  中: ['かばんの中に鍵があります。', 'В сумке лежит ключ.'],
  必要: ['旅行にはパスポートが必要です。', 'Для поездки необходим паспорт.'],
  あの: ['あの青い建物は図書館です。', 'То синее здание — библиотека.'],
  気: ['今日は気がとても楽です。', 'Сегодня у меня очень спокойно на душе.'],
  大丈夫: ['少し休めば大丈夫です。', 'Если немного отдохнуть, всё будет в порядке.'],
  自分: ['自分の気持ちを大切にしてください。', 'Берегите свои чувства.'],
  本当: ['それは本当の話です。', 'Это правдивая история.'],
  時間: ['朝は本を読む時間があります。', 'Утром у меня есть время почитать книгу.'],
  我々: ['我々は同じ目標に向かっています。', 'Мы движемся к одной цели.'],
  一: ['一からゆっくり始めましょう。', 'Давайте неспешно начнём с самого начала.'],
  ありがとう: ['手伝ってくれて、ありがとう。', 'Спасибо, что помогли.'],
  家: ['私たちは美しい家に住んでいます。', 'Мы живём в красивом доме.'],
  日: ['今日はとても暖かい日です。', 'Сегодня очень тёплый день.'],
  年: ['この年は素晴らしい一年でした。', 'Этот год прошёл замечательно.'],
  仕事: ['新しい仕事は来月始まります。', 'Новая работа начнётся в следующем месяце.'],
  一緒: ['週末は一緒に映画を見ましょう。', 'Давайте вместе посмотрим фильм на выходных.'],
  後: ['仕事の後で友達に会います。', 'После работы я встречусь с другом.'],
  他: ['他に質問はありますか。', 'Есть ли другие вопросы?'],
  電話: ['夜に母へ電話をかけました。', 'Вечером я позвонил маме.'],
  分: ['駅まであと五分です。', 'До станции осталось пять минут.'],
  車: ['父は青い車を運転しています。', 'Отец ведёт синюю машину.'],
  同じ: ['私たちは同じ本を読みました。', 'Мы прочитали одну и ту же книгу.'],
  場所: ['ここは静かで美しい場所です。', 'Это тихое и красивое место.'],
  問題: ['この問題を一緒に解きましょう。', 'Давайте решим эту задачу вместе.'],
  子供: ['子供たちは庭で遊んでいます。', 'Дети играют во дворе.'],
  愛: ['家族の愛は大きな力になります。', 'Любовь семьи придаёт огромную силу.'],
  名前: ['紙に名前を書いてください。', 'Пожалуйста, напишите имя на бумаге.'],
  さあ: ['さあ、出発しましょう。', 'Ну что же, отправляемся.'],
  少し: ['窓を少し開けてください。', 'Пожалуйста, немного откройте окно.'],
  全て: ['準備は全て終わりました。', 'Все приготовления завершены.'],
  世界: ['いつか世界を旅したいです。', 'Когда-нибудь я хочу путешествовать по миру.'],
  通り: ['この通りには小さな店が並んでいます。', 'На этой улице расположились маленькие магазины.'],
  来る: ['明日は友達が家に来る予定です。', 'Завтра друг собирается прийти ко мне домой.'],
  あれ: ['あれは私の新しい自転車です。', 'Вон там мой новый велосипед.'],
  じゃあ: ['じゃあ、駅で六時に会いましょう。', 'Тогда встретимся на станции в шесть.'],
  あげ: ['このスカートのあげを直してください。', 'Пожалуйста, поправьте подгиб этой юбки.'],
  あっ: ['あっ、財布を家に忘れました。', 'Ой, я забыл кошелёк дома.'],
  あら: ['あら、もうこんな時間です。', 'Ой, уже так поздно.'],
  あり: ['庭で大きなありを見つけました。', 'Во дворе я заметил большого муравья.'],
  アップ: ['旅行の写真をブログにアップしました。', 'Я загрузил фотографии из поездки в блог.'],
  アイス: ['暑い日は冷たいアイスが食べたいです。', 'В жаркий день хочется холодного мороженого.'],
  アレ: ['アレは誰のかばんですか。', 'Чья вон та сумка?'],
  意味: ['この話の意味がよく分かりました。', 'Я хорошо понял смысл этой истории.'],
  言葉: ['彼女の優しい言葉に励まされました。', 'Её добрые слова меня поддержали.'],
  移動: ['会議の後、隣の部屋へ移動しました。', 'После совещания мы перешли в соседнюю комнату.'],
  連中: ['あの連中は毎週ここに集まります。', 'Эта компания собирается здесь каждую неделю.'],
  警備: ['警察が駅の周辺を警備しています。', 'Полиция охраняет территорию вокруг станции.'],
  作戦: ['チームは新しい作戦を考えました。', 'Команда придумала новую стратегию.'],
  品: ['この店の品はどれも質が高いです。', 'Все товары в этом магазине высокого качества.'],
  警部: ['警部が事件の状況を説明しました。', 'Инспектор полиции объяснил обстоятельства дела.'],
  施設: ['この施設は九時から利用できます。', 'Этим учреждением можно пользоваться с девяти часов.'],
  何者: ['入口にいる人は何者ですか。', 'Кто этот человек у входа?'],
  管理: ['私がこの建物を管理しています。', 'Я управляю этим зданием.'],
  映像: ['旅で撮った映像を家族に見せました。', 'Я показал семье видео, снятое в путешествии.'],
  議員: ['その議員は市民の質問に答えました。', 'Этот депутат ответил на вопросы жителей.'],
  器: ['料理を白い器に盛り付けました。', 'Блюдо подали в белой посуде.'],
  保安: ['空港では保安検査が行われます。', 'В аэропорту проводят проверку безопасности.'],
  将軍: ['将軍は兵士たちに命令を出しました。', 'Генерал отдал приказ солдатам.'],
  司令: ['司令は部隊に出発を命じました。', 'Командующий приказал отряду выступать.'],
  園: ['園の中には季節の花が咲いています。', 'В саду цветут сезонные цветы.'],
  巨人: ['物語には心の優しい巨人が登場します。', 'В этой истории появляется добрый великан.'],
  アア: ['アア、やっと仕事が終わりました。', 'Ах, работа наконец закончилась.'],
  アクセス: ['このサイトには無料でアクセスできます。', 'К этому сайту можно получить бесплатный доступ.'],
  ア: ['ア、傘を電車に忘れました。', 'Ах, я забыл зонт в поезде.'],
  応答: ['呼びかけても応答がありませんでした。', 'На наш зов не последовало ответа.'],
  安定: ['午後には天気が安定するでしょう。', 'К вечеру погода, вероятно, стабилизируется.'],
  手がかり: ['警察は現場で重要な手がかりを見つけました。', 'Полиция обнаружила на месте важную улику.'],
  無線: ['船とは無線で連絡を取りました。', 'С кораблём связались по радио.'],
  本部: ['調査チームは本部へ報告しました。', 'Исследовательская группа доложила в штаб.'],
  医療: ['この地域では医療サービスが充実しています。', 'В этом районе хорошо развита медицинская помощь.'],
  馬場: ['朝の馬場で馬がゆっくり走っています。', 'Утром лошади неспешно бегают по манежу.'],
  艦隊: ['艦隊は夜明けに港を出発しました。', 'Флот покинул порт на рассвете.'],
  公: ['公の利益を第一に考えるべきです。', 'Следует прежде всего думать об общественном благе.'],
  仕業: ['散らかった部屋は猫の仕業でした。', 'Беспорядок в комнате оказался проделкой кота.'],
  王国: ['山の向こうに小さな王国がありました。', 'За горами находилось маленькое королевство.'],
  神父: ['神父は静かに祈りを捧げました。', 'Священник тихо вознёс молитву.'],
  エイリアン: ['映画に青いエイリアンが登場しました。', 'В фильме появился синий инопланетянин.'],
  優先: ['今日は安全を優先して行動します。', 'Сегодня мы будем действовать, ставя безопасность на первое место.'],
  機密: ['この書類には機密情報が含まれています。', 'В этом документе содержится секретная информация.'],
  暗殺: ['王の暗殺計画は事前に阻止されました。', 'План покушения на короля был заранее сорван.'],
  貴女: ['貴女の意見を聞かせてください。', 'Позвольте узнать ваше мнение.'],
  要請: ['市は住民の要請を受け入れました。', 'Городские власти приняли просьбу жителей.'],
  記者: ['記者は監督に試合の感想を尋ねました。', 'Журналист спросил тренера о впечатлениях от матча.'],
  畜生: ['畜生、また電車に乗り遅れた。', 'Чёрт, я снова опоздал на поезд.'],
  民: ['この国の民は長い伝統を守っています。', 'Народ этой страны хранит давние традиции.'],
  アホ: ['そんなアホなことを言わないで。', 'Не говори таких глупостей.'],
  有難う: ['遠くまで来てくれて有難う。', 'Спасибо, что приехали издалека.'],
  強力: ['この機械には強力なモーターが付いています。', 'В этой машине установлен мощный двигатель.'],
  大尉: ['大尉は部隊の状況を確認しました。', 'Капитан проверил состояние подразделения.'],
  援護: ['仲間の援護を受けて前へ進みました。', 'Мы продвинулись вперёд при поддержке товарищей.'],
  動機: ['警察は事件の動機を調べています。', 'Полиция выясняет мотив преступления.'],
  売春: ['その法律は売春を厳しく禁じています。', 'Этот закон строго запрещает проституцию.'],
  中尉: ['中尉は地図で現在地を示しました。', 'Лейтенант показал на карте наше местоположение.'],
  動揺: ['突然の知らせに大きな動揺が広がりました。', 'Неожиданная новость вызвала сильное волнение.'],
  回収: ['使用済みの容器は店で回収します。', 'Использованную тару собирают в магазине.'],
  送信: ['確認してからメールを送信してください。', 'Проверьте письмо перед отправкой.'],
  人殺し: ['彼は人殺しの罪で裁かれました。', 'Его судили за убийство.'],
  配置: ['机の配置を少し変えました。', 'Мы немного изменили расположение столов.'],
  不能: ['大雪で道路は通行不能になりました。', 'Из-за сильного снегопада дорога стала непроезжей.'],
  阻止: ['警察は事故を未然に阻止しました。', 'Полиция предотвратила происшествие.'],
  処分: ['古い家具を適切に処分しました。', 'Старую мебель утилизировали надлежащим образом.'],
  少佐: ['少佐は作戦の変更を伝えました。', 'Майор сообщил об изменении операции.'],
  共有: ['家族と写真を共有しました。', 'Я поделился фотографиями с семьёй.'],
  権限: ['この設定を変える権限がありません。', 'У меня нет полномочий менять эту настройку.'],
  集団: ['鳥の集団が南へ飛んでいきました。', 'Стая птиц улетела на юг.'],
  解除: ['安全を確認して警報を解除しました。', 'После проверки безопасности тревогу отключили.'],
  通常: ['この店は通常九時に開きます。', 'Обычно этот магазин открывается в девять.'],
  巡査: ['巡査が道を丁寧に教えてくれました。', 'Полицейский подробно объяснил мне дорогу.'],
  一族: ['一族は毎年この家に集まります。', 'Вся семья каждый год собирается в этом доме.'],
  反逆: ['王は反逆の計画を知りました。', 'Король узнал о плане мятежа.'],
  進行: ['工事は予定通り進行しています。', 'Строительство идёт по плану.'],
  民間: ['民間の会社が新しいサービスを始めました。', 'Частная компания запустила новую услугу.'],
  尾行: ['探偵は容疑者の尾行を続けました。', 'Детектив продолжил слежку за подозреваемым.'],
  軍事: ['両国は軍事協力について話し合いました。', 'Две страны обсудили военное сотрудничество.'],
  女房: ['女房と一緒に夕食を作りました。', 'Я приготовил ужин вместе с женой.'],
  軍人: ['その軍人は家族に手紙を書きました。', 'Этот военнослужащий написал письмо семье.'],
  通過: ['急行列車はこの駅を通過します。', 'Скорый поезд проезжает эту станцию без остановки.'],
};

function parseTsv(path) {
  return fs.readFileSync(path, 'utf8').trim().split('\n').map((line) => line.split('\t'));
}

function katakanaToHiragana(value) {
  return [...value]
    .map((character) => {
      const code = character.charCodeAt(0);
      return code >= 0x30a1 && code <= 0x30f6 ? String.fromCharCode(code - 0x60) : character;
    })
    .join('');
}

function createTokenizer() {
  return new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath: KUROMOJI_DICTIONARY_PATH }).build((error, tokenizer) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(tokenizer);
    });
  });
}

function createHiraganaReading(tokenizer, sentence) {
  return tokenizer
    .tokenize(sentence)
    .map((token) => katakanaToHiragana(token.reading && token.reading !== '*' ? token.reading : token.surface_form))
    .join('');
}

function parseTatoebaHiraganaTranscription(value) {
  const withoutAnnotations = value.replace(/\[([^|\]]+)\|([^\]]*)\]/g, (_match, surface, reading) => (
    reading ? reading.replaceAll('|', '') : surface
  ));
  return katakanaToHiragana(withoutAnnotations);
}

async function ensureTatoebaSource(path, url) {
  if (fs.existsSync(path)) return;

  const archivePath = `${path}.bz2`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Unable to download ${url}: HTTP ${response.status}`);
  }

  fs.writeFileSync(archivePath, Buffer.from(await response.arrayBuffer()));
  const decompressed = execFileSync('bzip2', ['-dc', archivePath], { maxBuffer: 256 * 1024 * 1024 });
  fs.writeFileSync(path, decompressed);
}

async function ensureTatoebaTranscriptions() {
  if (fs.existsSync(TRANSCRIPTIONS_SOURCE)) return;

  const archivePath = `${TRANSCRIPTIONS_SOURCE}.tar.bz2`;
  const response = await fetch('https://downloads.tatoeba.org/exports/transcriptions.tar.bz2');

  if (!response.ok) {
    throw new Error(`Unable to download Tatoeba transcriptions: HTTP ${response.status}`);
  }

  fs.writeFileSync(archivePath, Buffer.from(await response.arrayBuffer()));
  const extracted = execFileSync('tar', ['-xOf', archivePath, 'transcriptions.csv'], { maxBuffer: 256 * 1024 * 1024 });
  fs.writeFileSync(TRANSCRIPTIONS_SOURCE, extracted);
}

function parseWords() {
  const source = fs.readFileSync(WORDS_SOURCE, 'utf8');

  return [...source.matchAll(/createJapaneseWord\((\{.*?\})\),/g)].map((match) => JSON.parse(match[1]));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getDictionaryStem(original) {
  if (original.endsWith('する')) return original.slice(0, -2);
  if (original.endsWith('る')) return original.slice(0, -1);
  return original;
}

function getWordMatchQuality(word, japanese) {
  if (japanese.includes(word.original)) return 3;

  if (word.part_of_speech !== 'verb') return 0;
  const stem = getDictionaryStem(word.original);

  if (!stem) return 0;
  const escapedStem = escapeRegExp(stem);

  if (word.original.endsWith('する')) {
    if (new RegExp(`${escapedStem}(?:し|せ|さ)`).test(japanese)) return 2;
    return japanese.includes(stem) ? 1 : 0;
  }

  if (word.original.endsWith('る')) {
    return new RegExp(`${escapedStem}(?:ます|ました|ません|ない|なかった|た|て|られ|させ)`).test(japanese) ? 2 : 0;
  }

  return 0;
}

function isUsableSentence(word, japanese, russian) {
  if (getWordMatchQuality(word, japanese) === 0) return false;
  if (japanese.length < 5 || japanese.length > 48 || russian.length < 5 || russian.length > 120) return false;
  if (/[\r\n\t]/.test(japanese) || /[\r\n\t]/.test(russian)) return false;
  if (/言葉|単語|意味/.test(japanese) || /\b(?:слово|означает|переводится)\b/i.test(russian)) return false;

  if (word.original.length === 1 && /\p{Script=Han}/u.test(word.original)) {
    const index = japanese.indexOf(word.original);
    const previous = japanese[index - 1] ?? '';
    const next = japanese[index + 1] ?? '';

    if (/\p{Script=Han}/u.test(previous) || /\p{Script=Han}/u.test(next)) return false;
  }

  if (word.original.length === 1 && /[\u3040-\u30ff]/.test(word.original)) return false;
  return true;
}

function scoreSentence(word, japanese, russian) {
  const targetLength = word.level === 'A1' ? 16 : word.level === 'A2' ? 22 : 28;
  const lengthPenalty = Math.abs(japanese.length - targetLength) * 2 + Math.max(0, russian.length - 80);
  const punctuationBonus = /[。！？]$/.test(japanese) ? 8 : 0;
  const politeBonus = /(?:です|ます|ました|ません)[。！？]$/.test(japanese) ? 4 : 0;
  const targetBonus = japanese.split(word.original).length === 2 ? 3 : 0;

  return (getWordMatchQuality(word, japanese) * 20) + punctuationBonus + politeBonus + targetBonus - lengthPenalty;
}

for (const [path, url] of Object.entries(TATOEBA_EXPORTS)) {
  await ensureTatoebaSource(path, url);
}
await ensureTatoebaTranscriptions();

const words = parseWords();
const russianSentences = new Map(parseTsv(RUSSIAN_SENTENCES_SOURCE).map(([id, , text]) => [id, text]));
const japaneseSentences = parseTsv(JAPANESE_SENTENCES_SOURCE);
const japaneseIdByText = new Map(japaneseSentences.map(([id, , text]) => [text, id]));
const hiraganaBySentenceId = new Map(
  parseTsv(TRANSCRIPTIONS_SOURCE)
    .filter(([, language, script]) => language === 'jpn' && script === 'Hrkt')
    .map(([id, , , , transcription]) => [id, parseTatoebaHiraganaTranscription(transcription)]),
);
const russianIdsByJapaneseId = new Map();

for (const [japaneseId, russianId] of parseTsv(LINKS_SOURCE)) {
  const ids = russianIdsByJapaneseId.get(japaneseId) ?? [];
  ids.push(russianId);
  russianIdsByJapaneseId.set(japaneseId, ids);
}

const linkedSentences = japaneseSentences.flatMap(([id, , text]) => {
  const russianIds = russianIdsByJapaneseId.get(id) ?? [];

  return russianIds
    .map((russianId) => russianSentences.get(russianId))
    .filter(Boolean)
    .map((russian) => ({ japaneseId: id, japanese: text, russian }));
});

const examples = {};
let sourcedCount = 0;

for (const word of words) {
  const manual = MANUAL_EXAMPLES[word.original]
    ?? (word.original.endsWith('する') ? MANUAL_EXAMPLES[getDictionaryStem(word.original)] : undefined);

  if (manual) {
    examples[word.original] = {
      original: manual[0],
      translation: manual[1],
      sentenceId: japaneseIdByText.get(manual[0]),
      source: 'curated',
    };
    continue;
  }

  const best = linkedSentences
    .filter(({ japanese, russian }) => isUsableSentence(word, japanese, russian))
    .sort((left, right) => scoreSentence(word, right.japanese, right.russian) - scoreSentence(word, left.japanese, left.russian))[0];

  if (best) {
    examples[word.original] = {
      original: best.japanese,
      translation: best.russian,
      sentenceId: best.japaneseId,
      source: 'tatoeba',
    };
    sourcedCount += 1;
  }
}

const unresolved = words.filter((word) => !examples[word.original]);
if (unresolved.length > 0) {
  console.log(`Unresolved: ${unresolved.length}`);
  console.log(unresolved.map((word) => `${word.original} (${word.translation})`).join('\n'));
  throw new Error('Every Japanese word must have a contextual example');
}

const tokenizer = await createTokenizer();
const serialized = words
  .map((word) => {
    const example = examples[word.original];
    const reading = HIRAGANA_READING_OVERRIDES[example.original]
      ?? hiraganaBySentenceId.get(example.sentenceId)
      ?? createHiraganaReading(tokenizer, example.original);
    return `  ${JSON.stringify(word.original)}: [${JSON.stringify(example.original)}, ${JSON.stringify(reading)}, ${JSON.stringify(example.translation)}],`;
  })
  .join('\n');

fs.writeFileSync(
  OUTPUT,
  `// Tatoeba examples are used under CC BY 2.0 FR: https://tatoeba.org/eng/terms_of_use\n// Examples are keyed by the displayed dictionary form so dictionary regeneration cannot shift them to another word.\nexport const JAPANESE_EXAMPLES: Readonly<Record<string, readonly [original: string, reading: string, translation: string]>> = {\n${serialized}\n};\n`,
);

console.log(`Generated ${Object.keys(examples).length} examples (${sourcedCount} from Tatoeba, ${Object.keys(MANUAL_EXAMPLES).length} curated).`);
console.log('Unresolved: 0');
