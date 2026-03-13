import fs from 'node:fs/promises';
import path from 'node:path';

const outputDir = path.resolve(process.cwd(), 'public/data');

function parseList(raw, defaults = {}) {
  return raw
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [original, translation, partOfSpeech = defaults.partOfSpeech ?? 'noun', level = defaults.level ?? 'A1', tags = defaults.tags ?? 'daily', phraseForm = original] = line.split('|');

      return {
        original,
        translation,
        part_of_speech: partOfSpeech,
        level,
        tags: tags.split(',').filter(Boolean),
        phraseForm,
      };
    });
}

function slugify(value) {
  return value
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function phoneticize(value) {
  return `[${value
    .toLocaleLowerCase('fr')
    .replace(/eaux/g, 'o')
    .replace(/eau/g, 'o')
    .replace(/eille/g, 'эй')
    .replace(/ille/g, 'ий')
    .replace(/ou/g, 'у')
    .replace(/oi/g, 'уа')
    .replace(/ai/g, 'э')
    .replace(/ei/g, 'э')
    .replace(/au/g, 'о')
    .replace(/eu/g, 'ё')
    .replace(/ch/g, 'ш')
    .replace(/gn/g, 'нь')
    .replace(/ph/g, 'ф')
    .replace(/qu/g, 'к')
    .replace(/th/g, 'т')
    .replace(/on/g, 'он')
    .replace(/an/g, 'ан')
    .replace(/en/g, 'ан')
    .replace(/in/g, 'эн')
    .replace(/un/g, 'ен')
    .replace(/ç/g, 'с')
    .replace(/[àâ]/g, 'а')
    .replace(/[éèêë]/g, 'е')
    .replace(/[îï]/g, 'и')
    .replace(/[ô]/g, 'о')
    .replace(/[ùûü]/g, 'ю')
    .replace(/œ/g, 'ё')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()}]`;
}

function sentenceFor(entry) {
  if (entry.part_of_speech === 'verb') {
    return {
      example_original: `Je veux ${entry.original} aujourd'hui.`,
      example_translation: `Я хочу ${entry.translation.toLocaleLowerCase('ru-RU')} сегодня.`,
    };
  }

  if (entry.part_of_speech === 'adjective') {
    return {
      example_original: `Ce mot est ${entry.original}.`,
      example_translation: `Это слово ${entry.translation.toLocaleLowerCase('ru-RU')}.`,
    };
  }

  if (entry.part_of_speech === 'expression' || entry.part_of_speech === 'interjection') {
    return {
      example_original: `On dit souvent : « ${entry.original} ».`,
      example_translation: `Мы часто говорим: « ${entry.translation} ».`,
    };
  }

  if (entry.part_of_speech === 'adverb' || entry.part_of_speech === 'preposition' || entry.part_of_speech === 'conjunction') {
    return {
      example_original: `Il utilise « ${entry.original} » dans une phrase simple.`,
      example_translation: `Он использует « ${entry.translation} » в простом предложении.`,
    };
  }

  return {
    example_original: `Je vois ${entry.phraseForm} aujourd'hui.`,
    example_translation: `Я вижу ${entry.translation.toLocaleLowerCase('ru-RU')} сегодня.`,
  };
}

function createWord(entry, index) {
  const examples = sentenceFor(entry);

  return {
    id: `${entry.level.toLocaleLowerCase()}-${slugify(entry.original)}-${index}`,
    original: entry.original,
    translation: entry.translation,
    transcription: phoneticize(entry.original),
    audio_original: '',
    example_original: examples.example_original,
    example_translation: examples.example_translation,
    part_of_speech: entry.part_of_speech,
    level: entry.level,
    tags: entry.tags,
  };
}

const nouns = parseList(`
bonjour|здравствуйте|interjection|A1|greeting,daily|bonjour
salut|привет|interjection|A1|greeting,daily|salut
merci|спасибо|interjection|A1|greeting,daily|merci
oui|да|adverb|A1|daily,answer|oui
non|нет|adverb|A1|daily,answer|non
au revoir|до свидания|expression|A1|greeting,daily|au revoir
s'il vous plaît|пожалуйста|expression|A1|greeting,daily|s'il vous plaît
pardon|извините|interjection|A1|greeting,daily|pardon
maison|дом|noun|A1|home,daily|la maison
appartement|квартира|noun|A1|home,daily|l'appartement
chambre|комната|noun|A1|home,daily|la chambre
porte|дверь|noun|A1|home,objects|la porte
fenêtre|окно|noun|A1|home,objects|la fenêtre
table|стол|noun|A1|home,objects|la table
chaise|стул|noun|A1|home,objects|la chaise
lit|кровать|noun|A1|home,objects|le lit
cuisine|кухня|noun|A1|home,daily|la cuisine
salle de bain|ванная|noun|A1|home,daily|la salle de bain
jardin|сад|noun|A1|home,nature|le jardin
ville|город|noun|A1|city,daily|la ville
village|деревня|noun|A1|city,daily|le village
rue|улица|noun|A1|city,daily|la rue
route|дорога|noun|A1|travel,city|la route
gare|вокзал|noun|A1|travel,city|la gare
aéroport|аэропорт|noun|A2|travel,city|l'aéroport
station|станция|noun|A1|travel,city|la station
bus|автобус|noun|A1|travel,transport|le bus
train|поезд|noun|A1|travel,transport|le train
métro|метро|noun|A1|travel,transport|le métro
vélo|велосипед|noun|A1|travel,transport|le vélo
voiture|машина|noun|A1|travel,transport|la voiture
taxi|такси|noun|A1|travel,transport|le taxi
billet|билет|noun|A1|travel,transport|le billet
hôtel|отель|noun|A1|travel,city|l'hôtel
travail|работа|noun|A1|work,daily|le travail
bureau|офис|noun|A1|work,daily|le bureau
école|школа|noun|A1|study,daily|l'école
université|университет|noun|A2|study,daily|l'université
classe|класс|noun|A1|study,daily|la classe
livre|книга|noun|A1|study,objects|le livre
cahier|тетрадь|noun|A1|study,objects|le cahier
stylo|ручка|noun|A1|study,objects|le stylo
papier|бумага|noun|A1|study,objects|le papier
ordinateur|компьютер|noun|A1|study,technology|l'ordinateur
téléphone|телефон|noun|A1|technology,daily|le téléphone
écran|экран|noun|A2|technology,daily|l'écran
clavier|клавиатура|noun|A2|technology,work|le clavier
internet|интернет|noun|A1|technology,daily|internet
message|сообщение|noun|A1|communication,daily|le message
question|вопрос|noun|A1|communication,daily|la question
réponse|ответ|noun|A1|communication,daily|la réponse
ami|друг|noun|A1|people,daily|un ami
amie|подруга|noun|A1|people,daily|une amie
famille|семья|noun|A1|people,daily|la famille
père|отец|noun|A1|people,family|le père
mère|мать|noun|A1|people,family|la mère
frère|брат|noun|A1|people,family|le frère
sœur|сестра|noun|A1|people,family|la sœur
enfant|ребёнок|noun|A1|people,family|un enfant
homme|мужчина|noun|A1|people,daily|un homme
femme|женщина|noun|A1|people,daily|une femme
personne|человек|noun|A1|people,daily|une personne
voisin|сосед|noun|A2|people,home|un voisin
professeur|учитель|noun|A1|study,people|le professeur
élève|ученик|noun|A1|study,people|un élève
médecin|врач|noun|A1|health,people|le médecin
serveur|официант|noun|A2|work,service|le serveur
client|клиент|noun|A2|work,service|le client
chef|начальник|noun|A2|work,people|le chef
collègue|коллега|noun|A2|work,people|un collègue
temps|время|noun|A1|time,daily|le temps
jour|день|noun|A1|time,daily|le jour
semaine|неделя|noun|A1|time,daily|la semaine
mois|месяц|noun|A1|time,daily|le mois
année|год|noun|A1|time,daily|l'année
matin|утро|noun|A1|time,daily|le matin
soir|вечер|noun|A1|time,daily|le soir
nuit|ночь|noun|A1|time,daily|la nuit
heure|час|noun|A1|time,daily|l'heure
minute|минута|noun|A1|time,daily|la minute
aujourd'hui|сегодня|adverb|A1|time,daily|aujourd'hui
demain|завтра|adverb|A1|time,daily|demain
hier|вчера|adverb|A1|time,daily|hier
maintenant|сейчас|adverb|A1|time,daily|maintenant
tout de suite|сразу|expression|A2|time,daily|tout de suite
eau|вода|noun|A1|food,daily|de l'eau
café|кофе|noun|A1|food,daily|le café
thé|чай|noun|A1|food,daily|le thé
pain|хлеб|noun|A1|food,daily|le pain
fromage|сыр|noun|A1|food,daily|le fromage
lait|молоко|noun|A1|food,daily|le lait
beurre|масло|noun|A1|food,daily|le beurre
sucre|сахар|noun|A1|food,daily|le sucre
sel|соль|noun|A1|food,daily|le sel
viande|мясо|noun|A1|food,daily|la viande
poisson|рыба|noun|A1|food,daily|le poisson
poulet|курица|noun|A1|food,daily|le poulet
salade|салат|noun|A1|food,daily|la salade
soupe|суп|noun|A1|food,daily|la soupe
riz|рис|noun|A1|food,daily|le riz
pâtes|макароны|noun|A1|food,daily|les pâtes
pomme|яблоко|noun|A1|food,daily|une pomme
banane|банан|noun|A1|food,daily|une banane
orange|апельсин|noun|A1|food,daily|une orange
fraise|клубника|noun|A2|food,daily|une fraise
légume|овощ|noun|A1|food,daily|un légume
tomate|помидор|noun|A1|food,daily|une tomate
pomme de terre|картофель|noun|A2|food,daily|la pomme de terre
repas|приём пищи|noun|A1|food,daily|le repas
petit-déjeuner|завтрак|noun|A1|food,daily|le petit-déjeuner
déjeuner|обед|noun|A1|food,daily|le déjeuner
dîner|ужин|noun|A1|food,daily|le dîner
restaurant|ресторан|noun|A1|food,city|le restaurant
menu|меню|noun|A1|food,service|le menu
addition|счёт|noun|A2|food,service|l'addition
prix|цена|noun|A1|shopping,daily|le prix
argent|деньги|noun|A1|shopping,daily|l'argent
magasin|магазин|noun|A1|shopping,city|le magasin
marché|рынок|noun|A2|shopping,city|le marché
vêtement|одежда|noun|A2|shopping,daily|le vêtement
chemise|рубашка|noun|A2|shopping,daily|la chemise
pantalon|брюки|noun|A2|shopping,daily|le pantalon
chaussure|обувь|noun|A2|shopping,daily|la chaussure
sac|сумка|noun|A1|shopping,daily|le sac
clé|ключ|noun|A1|home,objects|la clé
carte|карта|noun|A1|travel,objects|la carte
photo|фотография|noun|A1|daily,media|la photo
musique|музыка|noun|A1|media,daily|la musique
film|фильм|noun|A1|media,daily|le film
série|сериал|noun|A2|media,daily|la série
journal|газета|noun|A2|media,daily|le journal
nouvelle|новость|noun|A2|media,daily|la nouvelle
santé|здоровье|noun|A2|health,daily|la santé
corps|тело|noun|A1|health,daily|le corps
tête|голова|noun|A1|health,daily|la tête
main|рука|noun|A1|health,daily|la main
bras|рука до плеча|noun|A2|health,daily|le bras
jambe|нога|noun|A1|health,daily|la jambe
yeux|глаза|noun|A1|health,daily|les yeux
bouche|рот|noun|A1|health,daily|la bouche
cœur|сердце|noun|A2|health,daily|le cœur
visage|лицо|noun|A2|health,daily|le visage
amour|любовь|noun|A2|feelings,daily|l'amour
bonheur|счастье|noun|A2|feelings,daily|le bonheur
peur|страх|noun|A2|feelings,daily|la peur
problème|проблема|noun|A2|thinking,daily|le problème
solution|решение|noun|A2|thinking,daily|la solution
idée|идея|noun|A2|thinking,daily|l'idée
besoin|потребность|noun|A2|daily,thinking|le besoin
choix|выбор|noun|A2|thinking,daily|le choix
rêve|мечта|noun|A2|feelings,daily|le rêve
chance|удача|noun|A2|daily,feelings|la chance
avenir|будущее|noun|B1|time,thinking|l'avenir
passé|прошлое|noun|B1|time,thinking|le passé
changement|изменение|noun|B1|thinking,daily|le changement
expérience|опыт|noun|B1|thinking,work|l'expérience
habitude|привычка|noun|B1|daily,thinking|l'habitude
confiance|доверие|noun|B1|feelings,people|la confiance
relation|отношение|noun|B1|people,daily|la relation
conversation|разговор|noun|B1|communication,daily|la conversation
voyage|путешествие|noun|A2|travel,daily|le voyage
vacances|каникулы|noun|A2|travel,daily|les vacances
plage|пляж|noun|A2|travel,nature|la plage
montagne|гора|noun|A2|travel,nature|la montagne
mer|море|noun|A2|travel,nature|la mer
soleil|солнце|noun|A1|nature,daily|le soleil
pluie|дождь|noun|A1|nature,daily|la pluie
vent|ветер|noun|A2|nature,daily|le vent
neige|снег|noun|A2|nature,daily|la neige
animal|животное|noun|A1|nature,daily|un animal
chien|собака|noun|A1|nature,daily|le chien
chat|кот|noun|A1|nature,daily|le chat
oiseau|птица|noun|A2|nature,daily|l'oiseau
fleur|цветок|noun|A1|nature,daily|la fleur
arbre|дерево|noun|A1|nature,daily|l'arbre
couleur|цвет|noun|A1|daily,qualities|la couleur
rouge|красный|adjective|A1|colors,daily|rouge
bleu|синий|adjective|A1|colors,daily|bleu
vert|зелёный|adjective|A1|colors,daily|vert
blanc|белый|adjective|A1|colors,daily|blanc
noir|чёрный|adjective|A1|colors,daily|noir
grand|большой|adjective|A1|qualities,daily|grand
petit|маленький|adjective|A1|qualities,daily|petit
jeune|молодой|adjective|A1|people,qualities|jeune
vieux|старый|adjective|A2|qualities,daily|vieux
nouveau|новый|adjective|A1|qualities,daily|nouveau
bon|хороший|adjective|A1|qualities,daily|bon
mauvais|плохой|adjective|A1|qualities,daily|mauvais
beau|красивый|adjective|A1|qualities,daily|beau
joli|милый|adjective|A2|qualities,daily|joli
important|важный|adjective|A2|qualities,daily|important
possible|возможный|adjective|A2|qualities,thinking|possible
facile|лёгкий|adjective|A1|study,qualities|facile
difficile|трудный|adjective|A1|study,qualities|difficile
rapide|быстрый|adjective|A1|qualities,daily|rapide
lent|медленный|adjective|A2|qualities,daily|lent
chaud|тёплый|adjective|A1|nature,daily|chaud
froid|холодный|adjective|A1|nature,daily|froid
content|довольный|adjective|A2|feelings,daily|content
triste|грустный|adjective|A1|feelings,daily|triste
heureux|счастливый|adjective|A1|feelings,daily|heureux
fatigué|уставший|adjective|A2|feelings,daily|fatigué
prêt|готовый|adjective|A2|daily,qualities|prêt
occupé|занятый|adjective|A2|work,daily|occupé
libre|свободный|adjective|A2|daily,qualities|libre
calme|спокойный|adjective|A2|feelings,daily|calme
fort|сильный|adjective|A2|qualities,daily|fort
faible|слабый|adjective|B1|qualities,daily|faible
sûr|уверенный|adjective|B1|feelings,thinking|sûr
clair|ясный|adjective|B1|thinking,qualities|clair
simple|простой|adjective|A2|qualities,daily|simple
utile|полезный|adjective|A2|qualities,daily|utile
vrai|настоящий|adjective|A2|thinking,daily|vrai
faux|ложный|adjective|B1|thinking,daily|faux
souvent|часто|adverb|A1|daily,time|souvent
parfois|иногда|adverb|A1|daily,time|parfois
toujours|всегда|adverb|A1|daily,time|toujours
jamais|никогда|adverb|A1|daily,time|jamais
déjà|уже|adverb|A1|daily,time|déjà
encore|ещё|adverb|A1|daily,time|encore
très|очень|adverb|A1|daily,qualities|très
trop|слишком|adverb|A2|daily,qualities|trop
assez|достаточно|adverb|A2|daily,qualities|assez
peut-être|может быть|adverb|A2|thinking,daily|peut-être
ici|здесь|adverb|A1|daily,space|ici
là|там|adverb|A1|daily,space|là
loin|далеко|adverb|A2|daily,space|loin
près|близко|adverb|A2|daily,space|près
ensemble|вместе|adverb|A1|people,daily|ensemble
seul|один|adjective|A2|people,daily|seul
`); 

const verbs = parseList(`
être|быть|verb|A1|daily,grammar|être
avoir|иметь|verb|A1|daily,grammar|avoir
aller|идти|verb|A1|travel,daily|aller
venir|приходить|verb|A1|travel,daily|venir
faire|делать|verb|A1|daily,work|faire
dire|говорить|verb|A1|communication,daily|dire
parler|говорить|verb|A1|communication,daily|parler
écouter|слушать|verb|A1|communication,daily|écouter
regarder|смотреть|verb|A1|daily,media|regarder
voir|видеть|verb|A1|daily,space|voir
trouver|находить|verb|A2|daily,thinking|trouver
chercher|искать|verb|A1|daily,thinking|chercher
comprendre|понимать|verb|A2|study,thinking|comprendre
apprendre|учить|verb|A1|study,daily|apprendre
connaître|знать|verb|A2|thinking,daily|connaître
savoir|знать|verb|A1|thinking,daily|savoir
penser|думать|verb|A2|thinking,daily|penser
croire|верить|verb|B1|thinking,daily|croire
vouloir|хотеть|verb|A1|daily,feelings|vouloir
pouvoir|мочь|verb|A1|daily,grammar|pouvoir
devoir|быть должным|verb|A2|daily,grammar|devoir
falloir|нужно|verb|A2|daily,grammar|falloir
prendre|брать|verb|A1|daily,shopping|prendre
mettre|класть|verb|A2|daily,home|mettre
porter|носить|verb|A2|daily,shopping|porter
ouvrir|открывать|verb|A1|home,daily|ouvrir
fermer|закрывать|verb|A1|home,daily|fermer
entrer|входить|verb|A1|daily,space|entrer
sortir|выходить|verb|A1|daily,space|sortir
rester|оставаться|verb|A2|daily,space|rester
commencer|начинать|verb|A1|daily,time|commencer
finir|заканчивать|verb|A1|daily,time|finir
continuer|продолжать|verb|A2|daily,time|continuer
attendre|ждать|verb|A1|daily,time|attendre
arriver|прибывать|verb|A1|travel,daily|arriver
partir|уезжать|verb|A1|travel,daily|partir
monter|подниматься|verb|A2|travel,daily|monter
descendre|спускаться|verb|A2|travel,daily|descendre
manger|есть|verb|A1|food,daily|manger
boire|пить|verb|A1|food,daily|boire
cuisiner|готовить|verb|A2|food,home|cuisiner
acheter|покупать|verb|A1|shopping,daily|acheter
payer|платить|verb|A1|shopping,daily|payer
gagner|зарабатывать|verb|A2|work,daily|gagner
travailler|работать|verb|A1|work,daily|travailler
étudier|учиться|verb|A1|study,daily|étudier
écrire|писать|verb|A1|study,daily|écrire
lire|читать|verb|A1|study,daily|lire
répéter|повторять|verb|A2|study,daily|répéter
jouer|играть|verb|A1|daily,leisure|jouer
marcher|идти пешком|verb|A1|daily,travel|marcher
courir|бежать|verb|A2|daily,health|courir
nager|плавать|verb|A2|daily,health|nager
dormir|спать|verb|A1|daily,health|dormir
se réveiller|просыпаться|verb|A2|daily,health|se réveiller
vivre|жить|verb|A1|daily,people|vivre
aimer|любить|verb|A1|feelings,daily|aimer
adorer|обожать|verb|A2|feelings,daily|adorer
préférer|предпочитать|verb|A2|daily,thinking|préférer
aider|помогать|verb|A1|people,daily|aider
rencontrer|встречать|verb|A2|people,daily|rencontrer
inviter|приглашать|verb|A2|people,daily|inviter
visiter|посещать|verb|A2|travel,daily|visiter
téléphoner|звонить|verb|A2|communication,daily|téléphoner
envoyer|отправлять|verb|A2|communication,daily|envoyer
recevoir|получать|verb|A2|communication,daily|recevoir
utiliser|использовать|verb|A2|daily,technology|utiliser
changer|менять|verb|A2|daily,thinking|changer
essayer|пробовать|verb|A2|daily,thinking|essayer
choisir|выбирать|verb|A2|daily,thinking|choisir
oublier|забывать|verb|A2|thinking,daily|oublier
se souvenir|вспоминать|verb|B1|thinking,daily|se souvenir
expliquer|объяснять|verb|B1|communication,study|expliquer
proposer|предлагать|verb|B1|communication,work|proposer
décider|решать|verb|B1|thinking,daily|décider
espérer|надеяться|verb|B1|feelings,daily|espérer
réussir|успевать|verb|B1|study,work|réussir
améliorer|улучшать|verb|B1|study,work|améliorer
organiser|организовывать|verb|B1|work,daily|organiser
préparer|готовить, подготавливать|verb|A2|daily,work|préparer
partager|делиться|verb|B1|people,communication|partager
`); 

const grammarWords = parseList(`
je|я|pronoun|A1|grammar,daily|je
tu|ты|pronoun|A1|grammar,daily|tu
il|он|pronoun|A1|grammar,daily|il
elle|она|pronoun|A1|grammar,daily|elle
nous|мы|pronoun|A1|grammar,daily|nous
vous|вы|pronoun|A1|grammar,daily|vous
ils|они|pronoun|A1|grammar,daily|ils
elles|они (ж.)|pronoun|A1|grammar,daily|elles
on|мы, кто-то|pronoun|A1|grammar,daily|on
mon|мой|determiner|A1|grammar,daily|mon
ma|моя|determiner|A1|grammar,daily|ma
mes|мои|determiner|A1|grammar,daily|mes
ton|твой|determiner|A1|grammar,daily|ton
ta|твоя|determiner|A1|grammar,daily|ta
tes|твои|determiner|A1|grammar,daily|tes
son|его, её|determiner|A1|grammar,daily|son
sa|его, её|determiner|A1|grammar,daily|sa
ses|его, её|determiner|A1|grammar,daily|ses
notre|наш|determiner|A1|grammar,daily|notre
votre|ваш|determiner|A1|grammar,daily|votre
leur|их|determiner|A1|grammar,daily|leur
ce|этот|determiner|A1|grammar,daily|ce
cette|эта|determiner|A1|grammar,daily|cette
ces|эти|determiner|A1|grammar,daily|ces
un|один, какой-то|determiner|A1|grammar,daily|un
une|одна, какая-то|determiner|A1|grammar,daily|une
des|некоторые|determiner|A1|grammar,daily|des
le|определённый артикль|determiner|A1|grammar,daily|le
la|определённый артикль|determiner|A1|grammar,daily|la
les|определённый артикль мн.ч.|determiner|A1|grammar,daily|les
de|из, от|preposition|A1|grammar,daily|de
à|в, к|preposition|A1|grammar,daily|à
en|в, на, из|preposition|A1|grammar,daily|en
dans|внутри|preposition|A1|grammar,daily|dans
sur|на|preposition|A1|grammar,daily|sur
sous|под|preposition|A1|grammar,daily|sous
avec|с|preposition|A1|grammar,daily|avec
sans|без|preposition|A1|grammar,daily|sans
pour|для|preposition|A1|grammar,daily|pour
par|через, по|preposition|A2|grammar,daily|par
chez|у, к|preposition|A2|grammar,daily|chez
entre|между|preposition|A2|grammar,daily|entre
avant|до, перед|preposition|A1|time,grammar|avant
après|после|preposition|A1|time,grammar|après
pendant|во время|preposition|A2|time,grammar|pendant
depuis|с, начиная с|preposition|A2|time,grammar|depuis
et|и|conjunction|A1|grammar,daily|et
ou|или|conjunction|A1|grammar,daily|ou
mais|но|conjunction|A1|grammar,daily|mais
parce que|потому что|conjunction|A2|grammar,daily|parce que
si|если|conjunction|A2|grammar,daily|si
quand|когда|adverb|A1|grammar,time|quand
où|где|adverb|A1|grammar,space|où
pourquoi|почему|adverb|A1|grammar,thinking|pourquoi
comment|как|adverb|A1|grammar,communication|comment
qui|кто|pronoun|A1|grammar,communication|qui
quoi|что|pronoun|A1|grammar,communication|quoi
quel|какой|determiner|A1|grammar,communication|quel
laquelle|которая|pronoun|B1|grammar,communication|laquelle
personne ne|никто не|expression|B1|grammar,communication|personne ne
quelque chose|что-то|expression|A2|grammar,daily|quelque chose
`); 

const manualExpressions = parseList(`
ça va|всё в порядке|expression|A1|greeting,daily|ça va
comment ça va|как дела|expression|A1|greeting,daily|comment ça va
à bientôt|до скорого|expression|A1|greeting,daily|à bientôt
bonne journée|хорошего дня|expression|A1|greeting,daily|bonne journée
bonne soirée|хорошего вечера|expression|A1|greeting,daily|bonne soirée
bonne nuit|спокойной ночи|expression|A1|greeting,daily|bonne nuit
je ne sais pas|я не знаю|expression|A1|daily,communication|je ne sais pas
je comprends|я понимаю|expression|A1|study,communication|je comprends
je suis prêt|я готов|expression|A2|daily,feelings|je suis prêt
je suis fatigué|я устал|expression|A2|daily,feelings|je suis fatigué
je suis content|я доволен|expression|A2|daily,feelings|je suis content
je suis désolé|мне жаль|expression|A2|daily,communication|je suis désolé
je pense que|я думаю, что|expression|A2|thinking,daily|je pense que
je crois que|я считаю, что|expression|B1|thinking,daily|je crois que
il y a|есть, имеется|expression|A1|daily,grammar|il y a
il faut|нужно|expression|A2|daily,grammar|il faut
ça dépend|это зависит|expression|B1|daily,thinking|ça dépend
pas du tout|совсем нет|expression|A2|daily,communication|pas du tout
bien sûr|конечно|expression|A2|daily,communication|bien sûr
d'accord|согласен|expression|A1|daily,communication|d'accord
pas mal|неплохо|expression|A2|daily,communication|pas mal
en fait|на самом деле|expression|B1|daily,communication|en fait
par exemple|например|expression|A2|study,communication|par exemple
à côté de|рядом с|expression|A2|space,daily|à côté de
en face de|напротив|expression|A2|space,daily|en face de
à droite|справа|expression|A1|space,daily|à droite
à gauche|слева|expression|A1|space,daily|à gauche
au centre|в центре|expression|A2|space,daily|au centre
tout le monde|все|expression|A2|people,daily|tout le monde
n'importe quoi|что угодно|expression|B1|communication,daily|n'importe quoi
à mon avis|по моему мнению|expression|B1|thinking,daily|à mon avis
de temps en temps|время от времени|expression|B1|time,daily|de temps en temps
une fois|один раз|expression|A1|time,daily|une fois
deux fois|два раза|expression|A1|time,daily|deux fois
à demain|до завтра|expression|A1|greeting,time|à demain
bon appétit|приятного аппетита|expression|A1|food,daily|bon appétit
à la maison|дома|expression|A1|home,daily|à la maison
au travail|на работе|expression|A1|work,daily|au travail
en vacances|в отпуске|expression|A2|travel,daily|en vacances
à pied|пешком|expression|A1|travel,daily|à pied
en voiture|на машине|expression|A1|travel,daily|en voiture
en train|на поезде|expression|A1|travel,daily|en train
en retard|с опозданием|expression|A2|time,daily|en retard
à l'heure|вовремя|expression|A2|time,daily|à l'heure
pour le moment|пока что|expression|B1|time,daily|pour le moment
au début|в начале|expression|B1|time,daily|au début
à la fin|в конце|expression|A2|time,daily|à la fin
de plus en plus|всё больше и больше|expression|B1|time,daily|de plus en plus
de moins en moins|всё меньше и меньше|expression|B1|time,daily|de moins en moins
avoir besoin de|нуждаться в|expression|A2|daily,thinking|avoir besoin de
avoir envie de|хотеть|expression|A2|feelings,daily|avoir envie de
prendre soin de|заботиться о|expression|B1|people,daily|prendre soin de
faire attention|быть внимательным|expression|A2|daily,thinking|faire attention
avoir raison|быть правым|expression|B1|thinking,daily|avoir raison
avoir tort|ошибаться|expression|B1|thinking,daily|avoir tort
se sentir bien|чувствовать себя хорошо|expression|A2|feelings,daily|se sentir bien
se sentir mal|чувствовать себя плохо|expression|A2|feelings,daily|se sentir mal
prendre une décision|принять решение|expression|B1|thinking,work|prendre une décision
faire une pause|сделать паузу|expression|A2|work,daily|faire une pause
`); 

const nounPhraseSource = nouns.filter((entry) => entry.part_of_speech === 'noun').slice(0, 60);
const placeSource = nounPhraseSource.filter((entry) => entry.tags.includes('city') || entry.tags.includes('travel')).slice(0, 20);
const adjectiveSource = nouns.filter((entry) => entry.part_of_speech === 'adjective').slice(0, 35);
const verbSource = verbs.slice(0, 60);

function createGeneratedEntries() {
  const generated = [];

  nounPhraseSource.forEach((entry) => {
    generated.push(
      {
        original: `j'aime ${entry.phraseForm}`,
        translation: `мне нравится ${entry.translation.toLocaleLowerCase('ru-RU')}`,
        part_of_speech: 'expression',
        level: entry.level,
        tags: [...entry.tags, 'phrase'],
        phraseForm: `« ${entry.original} »`,
      },
      {
        original: `je cherche ${entry.phraseForm}`,
        translation: `я ищу ${entry.translation.toLocaleLowerCase('ru-RU')}`,
        part_of_speech: 'expression',
        level: entry.level === 'B1' ? 'B1' : 'A2',
        tags: [...entry.tags, 'phrase'],
        phraseForm: `« ${entry.original} »`,
      },
      {
        original: `je vois ${entry.phraseForm}`,
        translation: `я вижу ${entry.translation.toLocaleLowerCase('ru-RU')}`,
        part_of_speech: 'expression',
        level: entry.level,
        tags: [...entry.tags, 'phrase'],
        phraseForm: `« ${entry.original} »`,
      },
      {
        original: `il y a ${entry.phraseForm}`,
        translation: `есть ${entry.translation.toLocaleLowerCase('ru-RU')}`,
        part_of_speech: 'expression',
        level: entry.level,
        tags: [...entry.tags, 'phrase'],
        phraseForm: `« ${entry.original} »`,
      },
      {
        original: `où est ${entry.phraseForm} ?`,
        translation: `где ${entry.translation.toLocaleLowerCase('ru-RU')}?`,
        part_of_speech: 'expression',
        level: 'A2',
        tags: [...entry.tags, 'phrase', 'question'],
        phraseForm: `« ${entry.original} »`,
      },
    );
  });

  placeSource.forEach((entry) => {
    generated.push(
      {
        original: `je vais à ${entry.phraseForm.replace(/^l'/, "l'").replace(/^(le|la|les)\s/, '')}`,
        translation: `я иду в ${entry.translation.toLocaleLowerCase('ru-RU')}`,
        part_of_speech: 'expression',
        level: 'A1',
        tags: [...entry.tags, 'phrase', 'travel'],
        phraseForm: entry.phraseForm,
      },
      {
        original: `je suis à ${entry.phraseForm.replace(/^l'/, "l'").replace(/^(le|la|les)\s/, '')}`,
        translation: `я нахожусь в ${entry.translation.toLocaleLowerCase('ru-RU')}`,
        part_of_speech: 'expression',
        level: 'A2',
        tags: [...entry.tags, 'phrase', 'travel'],
        phraseForm: entry.phraseForm,
      },
      {
        original: `nous arrivons à ${entry.phraseForm.replace(/^l'/, "l'").replace(/^(le|la|les)\s/, '')}`,
        translation: `мы прибываем в ${entry.translation.toLocaleLowerCase('ru-RU')}`,
        part_of_speech: 'expression',
        level: 'B1',
        tags: [...entry.tags, 'phrase', 'travel'],
        phraseForm: entry.phraseForm,
      },
    );
  });

  verbSource.forEach((entry) => {
    generated.push(
      {
        original: `je veux ${entry.original}`,
        translation: `я хочу ${entry.translation.toLocaleLowerCase('ru-RU')}`,
        part_of_speech: 'expression',
        level: 'A1',
        tags: [...entry.tags, 'phrase'],
        phraseForm: entry.original,
      },
      {
        original: `je peux ${entry.original}`,
        translation: `я могу ${entry.translation.toLocaleLowerCase('ru-RU')}`,
        part_of_speech: 'expression',
        level: 'A1',
        tags: [...entry.tags, 'phrase'],
        phraseForm: entry.original,
      },
      {
        original: `il faut ${entry.original}`,
        translation: `нужно ${entry.translation.toLocaleLowerCase('ru-RU')}`,
        part_of_speech: 'expression',
        level: 'A2',
        tags: [...entry.tags, 'phrase'],
        phraseForm: entry.original,
      },
      {
        original: `nous allons ${entry.original}`,
        translation: `мы собираемся ${entry.translation.toLocaleLowerCase('ru-RU')}`,
        part_of_speech: 'expression',
        level: 'B1',
        tags: [...entry.tags, 'phrase'],
        phraseForm: entry.original,
      },
    );
  });

  adjectiveSource.forEach((entry) => {
    generated.push(
      {
        original: `c'est ${entry.original}`,
        translation: `это ${entry.translation.toLocaleLowerCase('ru-RU')}`,
        part_of_speech: 'expression',
        level: entry.level,
        tags: [...entry.tags, 'phrase'],
        phraseForm: entry.original,
      },
      {
        original: `très ${entry.original}`,
        translation: `очень ${entry.translation.toLocaleLowerCase('ru-RU')}`,
        part_of_speech: 'expression',
        level: entry.level,
        tags: [...entry.tags, 'phrase'],
        phraseForm: entry.original,
      },
      {
        original: `trop ${entry.original}`,
        translation: `слишком ${entry.translation.toLocaleLowerCase('ru-RU')}`,
        part_of_speech: 'expression',
        level: entry.level === 'A1' ? 'A2' : entry.level,
        tags: [...entry.tags, 'phrase'],
        phraseForm: entry.original,
      },
      {
        original: `assez ${entry.original}`,
        translation: `довольно ${entry.translation.toLocaleLowerCase('ru-RU')}`,
        part_of_speech: 'expression',
        level: 'B1',
        tags: [...entry.tags, 'phrase'],
        phraseForm: entry.original,
      },
    );
  });

  return generated;
}

const allEntries = [...nouns, ...verbs, ...grammarWords, ...manualExpressions, ...createGeneratedEntries()];
const uniqueEntries = Array.from(
  new Map(allEntries.map((entry) => [`${entry.level}:${entry.original}`, entry])).values(),
);

const words = uniqueEntries.map((entry, index) => createWord(entry, index + 1));
const a1 = words.filter((word) => word.level === 'A1');
const a2 = words.filter((word) => word.level === 'A2');
const b1 = words.filter((word) => word.level === 'B1');

await fs.mkdir(outputDir, { recursive: true });
await Promise.all([
  fs.writeFile(path.join(outputDir, 'words.json'), JSON.stringify(words, null, 2)),
  fs.writeFile(path.join(outputDir, 'words_a1.json'), JSON.stringify(a1, null, 2)),
  fs.writeFile(path.join(outputDir, 'words_a2.json'), JSON.stringify(a2, null, 2)),
  fs.writeFile(path.join(outputDir, 'words_b1.json'), JSON.stringify(b1, null, 2)),
]);

console.log(
  JSON.stringify(
    {
      total: words.length,
      a1: a1.length,
      a2: a2.length,
      b1: b1.length,
    },
    null,
    2,
  ),
);
