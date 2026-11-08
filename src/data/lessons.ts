import type { Lesson } from '../lib/types'

/** Starter lessons are authored from the handbook-aligned question bank. */
const STARTER_LESSONS = [
  { id:'values-democracy', chapter:1, topic:'Values', title:'Democracy and the rule of law', summary:'The principles that shape public life in the UK.', minutes:5, keywords:['democracy','law','values'], facts:[{heading:'Democracy',text:'Citizens elect representatives to make decisions in Parliament and local government.'},{heading:'Rule of law',text:'Everyone, including government, must follow the law.'}], memoryAid:{title:'Remember: D-L-R',text:'Democracy, Law, Respect: three ideas that often appear together in questions about UK values.'}, recall:{prompt:'What does the rule of law mean?',answer:'Everyone is subject to the law, including people in power.'}, questionIds:['c1-001','c1-002'] },
  { id:'uk-nations', chapter:2, topic:'The UK', title:'The four nations of the UK', summary:'Know the nations, capitals and what “Great Britain” means.', minutes:5, keywords:['nations','capitals','great britain'], facts:[{heading:'Four nations',text:'The UK contains England, Scotland, Wales and Northern Ireland.'},{heading:'Great Britain',text:'Great Britain means England, Scotland and Wales; it does not include Northern Ireland.'}], memoryAid:{title:'Use the map',text:'Picture Great Britain as the large island, then add Northern Ireland across the Irish Sea to make the UK.'}, recall:{prompt:'Which part of the UK is not in Great Britain?',answer:'Northern Ireland.'}, questionIds:['c2-001','c2-002'] },
  { id:'roman-britain', chapter:3, topic:'The Romans', title:'Roman Britain: 55 BC and AD 43', summary:'Separate Caesar’s failed invasion from Claudius’s successful conquest.', minutes:5, keywords:['romans','caesar','claudius','43'], facts:[{heading:'55 BC',text:'Julius Caesar led an unsuccessful invasion of Britain.'},{heading:'AD 43',text:'The Roman conquest began under Emperor Claudius.'}], memoryAid:{title:'Failed first, then forty-three',text:'Say “Caesar tried; Claudius conquered in 43.” This keeps the two events in order.'}, recall:{prompt:'Who led the successful Roman conquest and when?',answer:'Emperor Claudius in AD 43.'}, questionIds:['c3-002','c3-003'] },
  { id:'norman-conquest', chapter:3, topic:'The Normans', title:'The Norman Conquest', summary:'Understand the turning point of 1066 and its consequences.', minutes:6, keywords:['normans','1066','william'], facts:[{heading:'1066',text:'William, Duke of Normandy, defeated King Harold at the Battle of Hastings.'},{heading:'After the conquest',text:'The Normans built castles and changed land ownership and government.'}], memoryAid:{title:'1066 = William wins',text:'Link the famous date directly to William’s victory at Hastings.'}, recall:{prompt:'Who did William defeat at the Battle of Hastings?',answer:'King Harold.'}, questionIds:['c3-100','c3-101'] },
  { id:'tudors-reformation', chapter:3, topic:'The Tudors', title:'Henry VIII and the Reformation', summary:'Why Henry VIII broke with Rome and created a Church of England.', minutes:6, keywords:['tudors','henry','reformation','church'], facts:[{heading:'Break with Rome',text:'Henry VIII established the Church of England after the Pope would not grant his divorce.'},{heading:'Change',text:'This began the English Reformation and changed religious life.'}], memoryAid:{title:'Henry’s headline',text:'“Henry made his own church” is a useful starting phrase; then recall the reason and name.'}, recall:{prompt:'Which church did Henry VIII establish?',answer:'The Church of England.'}, questionIds:['c3-200','c3-201'] },
  { id:'industrial-revolution', chapter:3, topic:'Industrial Revolution', title:'The Industrial Revolution', summary:'Connect factories, cities and new transport.', minutes:5, keywords:['industrial','factories','railways'], facts:[{heading:'Industry',text:'Britain developed factories and became a leading industrial nation.'},{heading:'Change',text:'People moved to towns and cities, while canals and railways improved transport.'}], memoryAid:{title:'F-C-R',text:'Factories, Cities, Railways: use this sequence to recall the main changes.'}, recall:{prompt:'Name one major change caused by industrialisation.',answer:'For example, factory work, growing towns and cities, or improved transport.'}, questionIds:['c3-500','c3-501'] },
  { id:'uk-culture-sport', chapter:4, topic:'Culture', title:'Culture, traditions and sport', summary:'Learn key traditions in context rather than as isolated lists.', minutes:5, keywords:['culture','sport','traditions'], facts:[{heading:'Shared culture',text:'The UK has traditions and celebrations from all four nations and many communities.'},{heading:'Sport',text:'Sport is an important part of cultural life, with different sports popular across the UK.'}], memoryAid:{title:'Attach facts to places',text:'When learning a tradition, connect it to its nation or place before memorising the name.'}, recall:{prompt:'What is a useful first step when remembering a UK tradition?',answer:'Connect it to the relevant nation or place.'}, questionIds:['c4-001','c4-002'] },
  { id:'work-education', chapter:4, topic:'Everyday life', title:'Work, education and children', summary:'The basic structure of everyday responsibilities and services.', minutes:5, keywords:['work','education','children'], facts:[{heading:'Education',text:'Children are expected to receive full-time education between the legal school ages.'},{heading:'Work',text:'People have rights at work and responsibilities such as paying tax.'}], memoryAid:{title:'Think services and duties',text:'Pair each service you learn with the responsibility that helps support it.'}, recall:{prompt:'Name one responsibility connected with working in the UK.',answer:'For example, paying tax.'}, questionIds:['c4-100','c4-101'] },
  { id:'parliament-government', chapter:5, topic:'Government', title:'Parliament, government and the Prime Minister', summary:'Separate Parliament’s law-making role from the government’s day-to-day role.', minutes:6, keywords:['parliament','government','prime minister'], facts:[{heading:'Parliament',text:'Parliament debates and makes laws. It includes the House of Commons, House of Lords and the monarch.'},{heading:'Government',text:'The Prime Minister leads the government, which puts policies into action.'}], memoryAid:{title:'Make versus manage',text:'Parliament makes laws; government manages public policy.'}, recall:{prompt:'Who leads the UK government?',answer:'The Prime Minister.'}, questionIds:['c5-001','c5-002'] },
  { id:'voting-jury', chapter:5, topic:'Law and participation', title:'Voting, juries and civic duties', summary:'How people participate in democracy and the justice system.', minutes:5, keywords:['vote','jury','law'], facts:[{heading:'Voting',text:'Eligible citizens can vote in elections and should register to vote.'},{heading:'Jury service',text:'Eligible people may be called to serve on a jury, which helps decide some court cases.'}], memoryAid:{title:'Voice and verdict',text:'Voting gives a voice in elections; a jury helps reach a verdict in court.'}, recall:{prompt:'What is one civic duty an eligible person may be called to do?',answer:'Serve on a jury.'}, questionIds:['c5-100','c5-101'] },
] satisfies Omit<Lesson, 'source' | 'reviewedAt'>[]

/** Every starter lesson was editorially reviewed against the named handbook. */
const HANDBOOK_LESSONS: Lesson[] = STARTER_LESSONS.map((lesson) => ({
  ...lesson,
  source: 'Life in the United Kingdom: A Guide for New Residents',
  reviewedAt: '2026-09-05',
}))

const UPDATED_LESSONS: Lesson[] = [
  {
    id: 'current-test-day',
    chapter: 1,
    topic: 'Test preparation',
    title: 'Current test format and test-day checks',
    summary: 'The current official format, pass mark and identification rules.',
    minutes: 4,
    source: 'GOV.UK: Life in the UK Test',
    reviewedAt: '2026-11-08',
    keywords: ['test', 'format', 'identity', 'pass mark'],
    facts: [
      { heading: 'Format', text: 'The official test has 24 questions, lasts 45 minutes and requires at least 18 correct answers, which is 75%.' },
      { heading: 'On the day', text: 'Bring the same original identity document used to book. If you use an eVisa, follow the current share-code instructions on GOV.UK.' },
      { heading: 'Study source', text: 'Official test questions are based on the Guide for New Residents, not current affairs or a general knowledge syllabus.' },
    ],
    memoryAid: { title: '24 - 45 - 18', text: 'Remember 24 questions, 45 minutes and 18 correct answers to pass.' },
    recall: { prompt: 'What three numbers describe the official test?', answer: '24 questions, 45 minutes and 18 correct answers to pass.' },
    questionIds: ['c1-049', 'c1-050'],
  },
  {
    id: 'irish-famine-factory-reform',
    chapter: 3,
    topic: 'Victorian Britain',
    title: 'The Irish famine and factory reform',
    summary: 'Two major social changes in 19th-century Britain and Ireland.',
    minutes: 5,
    source: 'Life in the United Kingdom: A Guide for New Residents',
    reviewedAt: '2026-11-08',
    keywords: ['ireland', 'famine', 'potato', 'factories act', 'victorian'],
    facts: [
      { heading: 'Irish famine', text: 'Repeated failure of the potato crop in the mid-19th century caused famine. About a million people died and many others emigrated.' },
      { heading: 'Factories Act 1847', text: 'The Act limited the working day for women and children to 10 hours as part of wider factory reform.' },
    ],
    memoryAid: { title: 'Crop and clock', text: 'Link the famine to the potato crop, then link factory reform to the 10-hour clock.' },
    recall: { prompt: 'What crop failed, and what limit did the 1847 Act set?', answer: 'The potato crop failed, and the Act set a 10-hour working day for women and children.' },
    questionIds: ['c3-652', 'c3-654'],
  },
  {
    id: 'scottish-enlightenment',
    chapter: 3,
    topic: 'The Enlightenment',
    title: 'Adam Smith and David Hume',
    summary: 'Keep the two leading Scottish Enlightenment thinkers distinct.',
    minutes: 4,
    source: 'Life in the United Kingdom: A Guide for New Residents',
    reviewedAt: '2026-11-08',
    keywords: ['scotland', 'enlightenment', 'adam smith', 'david hume'],
    facts: [
      { heading: 'Adam Smith', text: 'Adam Smith is remembered for influential ideas about economics.' },
      { heading: 'David Hume', text: 'David Hume was a philosopher whose work examined human nature.' },
    ],
    memoryAid: { title: 'Smith studies markets; Hume studies humans', text: 'Use the subjects to connect Smith with economics and Hume with philosophy.' },
    recall: { prompt: 'Which thinker is linked to philosophy?', answer: 'David Hume. Adam Smith is linked to economics.' },
    questionIds: ['c3-656', 'c3-589'],
  },
  {
    id: 'institutions-and-mps',
    chapter: 5,
    topic: 'Government',
    title: 'Constitutional institutions and MPs',
    summary: 'The bodies that make the constitution work and what MPs do.',
    minutes: 6,
    source: 'Life in the United Kingdom: A Guide for New Residents',
    reviewedAt: '2026-11-08',
    keywords: ['constitution', 'institutions', 'parliament', 'mps', 'constituency'],
    facts: [
      { heading: 'Institutions', text: 'The main institutions include the monarchy, Parliament, the Prime Minister and Cabinet, courts, police, civil service and local government.' },
      { heading: 'MPs', text: 'An MP represents everyone in a constituency, helps make laws, scrutinises the government and debates national issues.' },
    ],
    memoryAid: { title: 'Represent, legislate, scrutinise, debate', text: 'Use these four verbs to recall the work of an MP.' },
    recall: { prompt: 'Does an MP represent only the people who voted for them?', answer: 'No. An MP represents everyone in the constituency.' },
    questionIds: ['c5-271', 'c5-274', 'c5-275'],
  },
  {
    id: 'uk-leaders-current',
    chapter: 5,
    topic: 'Current context',
    title: 'The UK today: monarch and Prime Minister',
    summary: 'Current office holders, kept separate from handbook mock exams.',
    minutes: 3,
    source: 'GOV.UK and The Royal Family official websites',
    reviewedAt: '2026-11-08',
    keywords: ['current', 'king', 'charles', 'prime minister', 'andy burnham'],
    facts: [
      { heading: 'Head of State', text: 'King Charles III is the monarch and Head of State. He acceded to the throne in September 2022.' },
      { heading: 'Head of Government', text: 'Andy Burnham became Prime Minister on 20 July 2026. This office holder can change and is current context, not handbook mock-test content.' },
    ],
    memoryAid: { title: 'State and government', text: 'The monarch is Head of State; the Prime Minister is Head of Government.' },
    recall: { prompt: 'Who currently holds the two roles?', answer: 'King Charles III is monarch, and Andy Burnham is Prime Minister as reviewed on 8 November 2026.' },
    questionIds: ['c5-083', 'c5-276'],
  },
]

export const LESSONS: Lesson[] = [...HANDBOOK_LESSONS, ...UPDATED_LESSONS]

export const lessonById = (id: string) => LESSONS.find((lesson) => lesson.id === id)
