/**
 * "The Saltmere Lantern" — the built-in starter pack: 24 connected,
 * family-friendly cases. Original story, characters and wording.
 */
import type { CaseBook, Person } from "./types";

export const SALTMERE_CAST: Person[] = [
  { name: "Agnes Thorne", role: "Baker", traits: ["wears glasses", "rides a bicycle", "owns a dog"] },
  { name: "Barnaby Quill", role: "Newspaper editor", traits: ["has inky fingers", "wears glasses", "wears a hat"] },
  { name: "Celeste Varga", role: "Florist", traits: ["wears perfume", "rides a bicycle", "wears a red scarf"] },
  { name: "Desmond Pike", role: "Fisherman", traits: ["has a beard", "wears rubber boots", "whistles"] },
  { name: "Elsie Moreau", role: "Piano teacher", traits: ["plays the piano", "speaks French", "wears a red scarf"] },
  { name: "Felix Grange", role: "Museum curator", traits: ["wears glasses", "carries an umbrella", "speaks French"] },
  { name: "Gideon Hale", role: "Harbor clerk", traits: ["wears a hat", "carries an umbrella", "is left-handed"] },
  { name: "Hattie Bloom", role: "Innkeeper", traits: ["owns a dog", "wears rubber boots", "wears perfume"] },
  { name: "Isaac Penrose", role: "Painter", traits: ["smells of paint", "has a beard", "is left-handed"] },
  { name: "Juniper Locke", role: "Town doctor", traits: ["whistles", "plays the piano", "rides a bicycle"] },
  { name: "Odette Marsh", role: "Lighthouse keeper", traits: ["wears rubber boots", "wears a hat", "wears a red scarf"] },
];

/** Shorter final phrases for smaller books (all true to the story). */
export const SALTMERE_PHRASES = ["THE KEEPER ODETTE MARSH LIED", "KEEPER ODETTE MARSH LIED", "ODETTE MARSH LIED", "THE KEEPER LIED", "ODETTE MARSH", "THE KEEPER", "ODETTE"];

export const SALTMERE: CaseBook = {
  title: "The Saltmere Lantern",
  intro:
    "On the night of the great storm, Captain Rowan Ashby, harbormaster of Saltmere Bay, fell on the harbor steps. Since then, strange things keep happening around town, and each culprit swears an unsigned note marked with a little lantern told them what to do. Solve every case, fill the boxes below, and find out who has been lighting the way.",
  cast: SALTMERE_CAST,
  finale: {
    phrase: "THE KEEPER ODETTE MARSH LIED",
    question: "Who wrote the lantern notes, and what really happened on the night of the storm?",
    epilogue:
      "Odette Marsh let the lighthouse go dark on the night of the storm so a smuggler's boat could slip past the sandbar. Captain Ashby saw it and confronted her on the harbor steps; he slipped in the struggle. To bury the truth she wrote the lantern notes, nudging each townsperson to hide one small piece of it, and swore the lamp had burned all night. The keeper lied.",
  },
  cases: [
    {
      title: "The Harbormaster's Last Watch",
      story: "Captain Rowan Ashby was found at the foot of the harbor steps the morning after the great storm. The logbook he never let out of his coat is gone, and three people were on the quay before dawn.",
      words: ["HARBOR", "QUAY", "STORM", "STEPS", "CAPTAIN", "LANTERN", "ROPE", "TIDE", "GULLS", "DAWN", "COAT", "ANCHOR", "PUDDLE", "BOLLARD"],
      missing: { word: "LOGBOOK", clue: "The book that never left the captain's coat" },
      suspects: ["Gideon Hale", "Desmond Pike", "Hattie Bloom"],
      culprit: "Gideon Hale",
      lead: "A torn page in the gutter carries the Gazette's letterhead.",
    },
    {
      title: "Ink on the Press",
      story: "Before the doctor had even finished her report, a front page was set in the night: \"Harbormaster Falls in Storm, an Accident.\" The press was still warm at sunrise.",
      words: ["PRESS", "INK", "PAPER", "HEADLINE", "EDITOR", "ROLLER", "COLUMN", "DEADLINE", "LETTERS", "BULLETIN", "DESK", "LAMP", "NEWSPRINT", "STAPLER"],
      missing: { word: "PROOF", clue: "The first copy, checked before printing" },
      suspects: ["Barnaby Quill", "Isaac Penrose", "Elsie Moreau"],
      culprit: "Barnaby Quill",
      lead: "Tucked into the proof is a pressed violet from the flower shop.",
    },
    {
      title: "The Wilting Wreath",
      story: "The memorial wreath for Captain Ashby was ruined overnight: every white lily stained gray and stinking of the sea. Loose petals lead from the shop door down Mill Lane.",
      words: ["WREATH", "LILY", "PETAL", "VASE", "RIBBON", "FERN", "SHEARS", "ORCHID", "BLOOM", "STEM", "THORN", "BOUQUET", "COUNTER", "TULIP"],
      missing: { word: "BRINE", clue: "Salty water that leaves a stain" },
      suspects: ["Celeste Varga", "Agnes Thorne", "Juniper Locke"],
      culprit: "Celeste Varga",
      lead: "In the shop's bin: a receipt from the Gull and Anchor Inn.",
    },
    {
      title: "A Room at the Gull and Anchor",
      story: "A traveling salesman who watched the storm from Room 4 has vanished, leaving his suitcase behind. The page of the guest ledger with his name on it has been neatly cut out.",
      words: ["LEDGER", "SUITCASE", "LOBBY", "STAIRCASE", "PILLOW", "BELL", "KETTLE", "HEARTH", "CURTAIN", "GUEST", "LOCKER", "MANTEL", "ATTIC", "CANDLE"],
      missing: { word: "PASSKEY", clue: "The innkeeper's key that opens every door" },
      suspects: ["Hattie Bloom", "Felix Grange", "Desmond Pike"],
      culprit: "Hattie Bloom",
      lead: "The suitcase holds one thing: a museum ticket stub.",
    },
    {
      title: "The Missing Compass",
      story: "Captain Ashby's brass compass, donated to the Saltmere Museum last spring, is gone from its glass case. The alarm never rang, and the label was put back perfectly straight.",
      words: ["GALLERY", "EXHIBIT", "CURATOR", "GLASS", "BRASS", "LABEL", "ARCHIVE", "CATALOG", "MAP", "TELESCOPE", "GLOBE", "VELVET", "ALARM", "SKETCH"],
      missing: { word: "PLINTH", clue: "The stand where the compass sat" },
      suspects: ["Felix Grange", "Barnaby Quill", "Agnes Thorne"],
      culprit: "Felix Grange",
      lead: "Fresh paint on the display case is the exact orange of a sunset.",
    },
    {
      title: "Portrait in Wet Paint",
      story: "The portrait of Captain Ashby in the studio window was painted over during the night. Under the new layer, scratched into the canvas, is a small map.",
      words: ["EASEL", "CANVAS", "BRUSH", "PORTRAIT", "STUDIO", "CRIMSON", "OCHRE", "SKYLIGHT", "FRAME", "SMOCK", "JAR", "PIGMENT", "LINSEED", "PALETTE"],
      missing: { word: "VARNISH", clue: "The glossy coat that seals a painting" },
      suspects: ["Isaac Penrose", "Elsie Moreau", "Celeste Varga"],
      culprit: "Isaac Penrose",
      lead: "The scratched map marks the old boathouse.",
    },
    {
      title: "The Boathouse Fire",
      story: "A small fire broke out in the boathouse at midnight. No one was hurt, but Captain Ashby's rowboat, and whatever was hidden under its seat, burned to cinders.",
      words: ["ROWBOAT", "OARS", "SMOKE", "EMBERS", "BUCKET", "SAND", "PIER", "SAIL", "NETS", "HULL", "CINDERS", "DINGHY", "HOOK", "SLIPWAY"],
      missing: { word: "MATCHES", clue: "A small box that strikes a flame" },
      suspects: ["Desmond Pike", "Gideon Hale", "Juniper Locke"],
      culprit: "Desmond Pike",
      lead: "A scorched sheet of piano music floats in the shallows.",
    },
    {
      title: "A Sour Note",
      story: "At the memorial recital in the town hall, the grand piano let out a dreadful twang on the very first chord. Someone had tampered with it during the interval.",
      words: ["PIANO", "RECITAL", "KEYS", "STOOL", "SONATA", "CHORD", "MELODY", "CONCERT", "ENCORE", "APPLAUSE", "STAGE", "BALLAD", "HYMN", "TEMPO"],
      missing: { word: "STRING", clue: "One was snipped inside the piano" },
      suspects: ["Elsie Moreau", "Juniper Locke", "Hattie Bloom"],
      culprit: "Elsie Moreau",
      lead: "Inside the piano lid, someone has drawn a lantern in chalk.",
    },
    {
      title: "The Doctor's Report",
      story: "The doctor's report on Captain Ashby says \"accidental fall,\" but the last line is in a different blue ink. Someone changed it at the surgery while the town slept.",
      words: ["SURGERY", "REPORT", "BANDAGE", "TONIC", "SATCHEL", "CLINIC", "PULSE", "FEVER", "SYRUP", "CABINET", "CHART", "PEN", "DIAGNOSIS", "LOCKET"],
      missing: { word: "SIGNATURE", clue: "The name at the bottom of the report" },
      suspects: ["Juniper Locke", "Isaac Penrose", "Barnaby Quill"],
      culprit: "Juniper Locke",
      lead: "A dusting of flour lies on the surgery windowsill.",
    },
    {
      title: "Flour on the Windowsill",
      story: "The bakery's order book shows a large night delivery to the lighthouse on the evening of the storm. That page has been sliced out with a bread knife.",
      words: ["BAKERY", "OVEN", "DOUGH", "FLOUR", "LOAF", "CRUST", "APRON", "YEAST", "BASKET", "PASTRY", "SUGAR", "BUTTER", "WINDOWSILL", "MUFFIN"],
      missing: { word: "SCONES", clue: "What was really in the night delivery" },
      suspects: ["Agnes Thorne", "Celeste Varga", "Felix Grange"],
      culprit: "Agnes Thorne",
      lead: "Bicycle tracks lead from the back door toward the cliffs.",
    },
    {
      title: "The Cliff Path",
      story: "Someone turned the warning signs on the cliff path the wrong way, and a walker nearly stepped off the edge in the fog. The fence posts were loosened with a careful hand.",
      words: ["CLIFF", "PATH", "GORSE", "HEATHER", "FENCE", "TRAIL", "BENCH", "LOOKOUT", "WIND", "PEBBLES", "SEABIRDS", "GATE", "BOULDER", "HILLTOP"],
      missing: { word: "SIGNPOST", clue: "It used to point away from the edge" },
      suspects: ["Celeste Varga", "Juniper Locke", "Gideon Hale"],
      culprit: "Gideon Hale",
      lead: "A glove dropped at the gate smells strongly of fish.",
    },
    {
      title: "Trouble at the Cannery",
      story: "The cannery line jammed on the busiest morning of the season, and a whole shipment of sardines spoiled. The foreman found the gears stopped dead.",
      words: ["CANNERY", "SARDINES", "CONVEYOR", "CRATES", "TINS", "LABELS", "GEARS", "LEVER", "FOREMAN", "SHIFT", "SIREN", "WHARF", "BARREL", "ICEBOX"],
      missing: { word: "WRENCH", clue: "Found jammed in the gears" },
      suspects: ["Desmond Pike", "Hattie Bloom", "Isaac Penrose"],
      culprit: "Isaac Penrose",
      lead: "The foreman's clipboard has a train timetable clipped to it.",
    },
    {
      title: "The 9:40 to Brackenford",
      story: "A parcel addressed from the lighthouse to the city vanished from the luggage van of the 9:40 train. The porter swears the van door was never left open.",
      words: ["STATION", "PLATFORM", "RAILS", "SIGNAL", "CONDUCTOR", "LUGGAGE", "CARRIAGE", "TIMETABLE", "PORTER", "BENCH", "STEAM", "CLOCK", "TUNNEL", "WHISTLE"],
      missing: { word: "TICKET", clue: "Punched, but never used" },
      suspects: ["Barnaby Quill", "Felix Grange", "Elsie Moreau"],
      culprit: "Barnaby Quill",
      lead: "The parcel's string turns up tied around a bundle of dance programs.",
    },
    {
      title: "The Harvest Dance",
      story: "During the harvest dance at the town hall, the lighthouse's repair records were taken from the archive room. Nobody left the ballroom, or so everyone says.",
      words: ["DANCE", "BALLROOM", "FIDDLE", "PUNCH", "WALTZ", "GOWN", "PEARLS", "BANNER", "PODIUM", "MAYOR", "CLOAKROOM", "CHANDELIER", "STREAMER", "SHAWL"],
      missing: { word: "FOLDER", clue: "It held the lighthouse papers" },
      suspects: ["Elsie Moreau", "Celeste Varga", "Agnes Thorne"],
      culprit: "Celeste Varga",
      lead: "A regatta ticket slips out from behind the archive shelf.",
    },
    {
      title: "Regatta Day",
      story: "The favorite boat in the Saltmere Regatta spun in circles at the starting gun. Someone had sawn halfway through a vital piece the night before.",
      words: ["REGATTA", "YACHT", "BUOY", "TROPHY", "FLAG", "MAST", "KEEL", "CREW", "BREEZE", "FINISH", "JETTY", "MEDAL", "SPYGLASS", "STARTER"],
      missing: { word: "RUDDER", clue: "What was sawn half through" },
      suspects: ["Desmond Pike", "Gideon Hale", "Felix Grange"],
      culprit: "Felix Grange",
      lead: "Through the spyglass, a light blinks from the old observatory.",
    },
    {
      title: "The Stopped Clock",
      story: "The observatory's tide clock stopped at 11:52 on the night of the storm, the minute the lighthouse went dark. Now the heavy piece that swings inside it is gone.",
      words: ["DOME", "STARS", "COMET", "ORBIT", "LENS", "MOON", "PLANET", "TRIPOD", "ECLIPSE", "NEBULA", "ZENITH", "TELESCOPE", "TIDES", "METEOR"],
      missing: { word: "PENDULUM", clue: "It stopped swinging at 11:52" },
      suspects: ["Juniper Locke", "Isaac Penrose", "Agnes Thorne"],
      culprit: "Juniper Locke",
      lead: "The missing piece turns up wrapped in a chapel hymn sheet.",
    },
    {
      title: "Silence at St. Brannoc's",
      story: "The chapel bell that warns ships off the rocks never rang during the storm. This morning the bell ringer found its clapper wrapped tight in thick wool.",
      words: ["CHAPEL", "BELFRY", "STEEPLE", "PEW", "ORGAN", "CHOIR", "ALTAR", "HYMNAL", "VESTRY", "LECTERN", "AISLE", "CANDLES", "ROPES", "PSALM"],
      missing: { word: "BLANKET", clue: "Wrapped around the bell's clapper" },
      suspects: ["Hattie Bloom", "Agnes Thorne", "Elsie Moreau"],
      culprit: "Hattie Bloom",
      lead: "Stitched in one corner of the wool: Saltmere Garden Club.",
    },
    {
      title: "The Garden Club Tea",
      story: "Six members of the garden club fell ill after tea in the greenhouse (all are recovering). The doctor says something pretty and purple ended up in the tea urn.",
      words: ["GREENHOUSE", "SEEDLINGS", "TROWEL", "POTS", "COMPOST", "IVY", "ORCHIDS", "TEAPOT", "URN", "GARDEN", "HOSE", "VINE", "TRELLIS", "MOSS"],
      missing: { word: "FOXGLOVE", clue: "A pretty purple flower with a dangerous secret" },
      suspects: ["Elsie Moreau", "Isaac Penrose", "Desmond Pike"],
      culprit: "Elsie Moreau",
      lead: "A pressed purple flower marks a page in a library book.",
    },
    {
      title: "Overdue at the Library",
      story: "The library's book of tides has a page torn out: the one for the night of the storm. The borrowing card was stamped by someone who signed with a paw print doodle.",
      words: ["LIBRARY", "SHELVES", "ATLAS", "NOVEL", "READER", "STAMP", "INDEX", "SPINE", "QUIET", "LADDER", "BOOKMARK", "POETRY", "JOURNAL", "BINDING"],
      missing: { word: "ALMANAC", clue: "A yearly book of tides and moons" },
      suspects: ["Barnaby Quill", "Felix Grange", "Agnes Thorne"],
      culprit: "Agnes Thorne",
      lead: "The torn page was used to wrap fish at the Saturday market.",
    },
    {
      title: "Market Day",
      story: "The old lighthouse lamp turned up for sale at the Saturday market, then vanished from the auction table before the bidding began. Its most precious part went with it.",
      words: ["MARKET", "STALLS", "AUCTION", "GAVEL", "BIDDER", "OYSTERS", "MACKEREL", "SCALES", "AWNING", "VENDOR", "BASKETS", "LOBSTER", "CHALKBOARD", "PRICE"],
      missing: { word: "PRISM", clue: "The cut glass heart of a lighthouse lamp" },
      suspects: ["Desmond Pike", "Hattie Bloom", "Barnaby Quill"],
      culprit: "Desmond Pike",
      lead: "The auction slip was signed with a ferry company pen.",
    },
    {
      title: "The Ferry Crossing",
      story: "The morning ferry ran aground on a sandbar that has not moved in a hundred years. The captain's chart had been changed, with neat notes written in French.",
      words: ["FERRY", "DECK", "FUNNEL", "LIFEBOAT", "GANGWAY", "PROPELLER", "HORN", "CABIN", "CHARTS", "PASSENGER", "RAILING", "BALLAST", "WAKE", "PORTHOLE"],
      missing: { word: "SANDBAR", clue: "Where the ferry came to a stop" },
      suspects: ["Elsie Moreau", "Gideon Hale", "Desmond Pike"],
      culprit: "Elsie Moreau",
      lead: "Under the French notes, a second hand has drawn a lantern.",
    },
    {
      title: "Signals in the Fog",
      story: "Ships at sea reported false light signals flashing from the end of the old pier, all spelling out \"safe passage.\" Footprints in the wet planks lead back to town.",
      words: ["FOGHORN", "SIGNAL", "PIER", "BEACON", "MORSE", "CODE", "FLARE", "HAZE", "REEF", "SHUTTER", "SEMAPHORE", "NIGHTFALL", "MIST", "PLANKS"],
      missing: { word: "MIRROR", clue: "Used to flash a false light" },
      suspects: ["Barnaby Quill", "Felix Grange", "Hattie Bloom"],
      culprit: "Barnaby Quill",
      lead: "The mirror is stamped with the name of the theater's dressing room.",
    },
    {
      title: "Curtain Call",
      story: "The Saltmere Players were to open a new play about the storm, until every copy of it vanished from the theater an hour before curtain up.",
      words: ["THEATER", "SPOTLIGHT", "COSTUME", "ACTOR", "USHER", "BALCONY", "REHEARSAL", "PROPS", "WINGS", "MAKEUP", "PROMPTER", "VELVET", "DIRECTOR", "MATINEE"],
      missing: { word: "SCRIPT", clue: "Every actor's lines, now missing" },
      suspects: ["Celeste Varga", "Desmond Pike", "Felix Grange"],
      culprit: "Celeste Varga",
      lead: "The play's last scene was set at the top of the lighthouse.",
    },
    {
      title: "The Lighthouse Stairs",
      story: "The lamp room record says the light burned all night of the storm. Yet the oil can is still full and the lamp has not been trimmed. Someone planted that record.",
      words: ["LIGHTHOUSE", "LAMPROOM", "SPIRAL", "RAILING", "OIL", "KEEPER", "BEAM", "SHUTTERS", "WINDOW", "LOGBOOK", "BRASS", "BEACON", "TOWER", "LADDER"],
      missing: { word: "WICK", clue: "It was never trimmed that night" },
      suspects: ["Agnes Thorne", "Juniper Locke", "Gideon Hale"],
      culprit: "Juniper Locke",
      lead: "Every case has pointed to one person. Turn to your Case Board.",
    },
  ],
};

/** Phrase that fits a book with `cases` key cases. */
export function phraseFor(cases: number, phrases = SALTMERE_PHRASES): string {
  const letters = (p: string) => p.replace(/[^A-Z]/g, "").length;
  return phrases.find((p) => letters(p) <= cases) ?? phrases[phrases.length - 1];
}

/**
 * The first `n` cases of the story for a smaller book: evenly spread, always
 * ending on the final case. Leads are kept only where the next case follows.
 */
export function starterCases(n: number) {
  const all = SALTMERE.cases;
  const count = Math.max(1, Math.min(all.length, Math.round(n)));
  if (count === all.length) return all.slice();
  const idx = count === 1 ? [all.length - 1] : Array.from({ length: count }, (_, i) => Math.round((i * (all.length - 1)) / (count - 1)));
  return idx.map((k, j) => ({ ...all[k], lead: j < idx.length - 1 && idx[j + 1] === k + 1 ? all[k].lead : j === idx.length - 1 ? all[k].lead : undefined }));
}
