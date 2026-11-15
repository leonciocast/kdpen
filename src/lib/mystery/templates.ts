/**
 * Case scaffolds from a setting. The stories are assembled from templates
 * (honestly labelled in the UI), so a book of 120 cases is possible.
 */
import { mulberry32, type Rng } from "../wordsearch/engine";
import type { CaseBook, CaseSpec, Person } from "./types";
import { uniqueTraits } from "./model";

export interface Setting {
  id: string;
  name: string;
  /** "the Grand Hotel" */
  the: string;
  blurb: string;
  places: string[];
  events: string[];
  valuables: string[];
  machines: string[];
  words: string[];
  missing: { word: string; clue: string }[];
}

export const SETTINGS: Setting[] = [
  {
    id: "hotel",
    name: "Grand Hotel",
    the: "the Grand Hotel",
    blurb: "Ballrooms, bellhops and a locked penthouse.",
    places: ["ballroom", "penthouse", "kitchen", "lobby", "wine cellar", "rooftop garden"],
    events: ["the anniversary gala", "the jazz evening", "the midnight buffet", "the charity auction"],
    valuables: ["sapphire brooch", "silver key", "pearl necklace", "gold watch"],
    machines: ["elevator", "dumbwaiter", "switchboard"],
    words: ["LOBBY", "BELLHOP", "CONCIERGE", "SUITE", "ELEVATOR", "LUGGAGE", "BALLROOM", "CHANDELIER", "VALET", "RECEPTION", "PENTHOUSE", "ROOMKEY", "BUFFET", "TERRACE", "DOORMAN", "CARPET", "MINIBAR", "LAUNDRY", "BANQUET", "REVOLVING", "TROLLEY", "MARBLE", "PORTER", "GUESTBOOK", "SKYLIGHT", "FOYER", "LOUNGE", "CURTAINS"],
    missing: [
      { word: "SWITCHBOARD", clue: "Where every call is connected" },
      { word: "DUMBWAITER", clue: "A tiny lift for trays" },
      { word: "SAFE", clue: "Where valuables are locked away" },
      { word: "TIPS", clue: "Coins left for good service" },
      { word: "NAPKIN", clue: "Folded beside every plate" },
      { word: "PILLOWCASE", clue: "Changed every morning" },
    ],
  },
  {
    id: "manor",
    name: "Country Manor",
    the: "Hollowmere Manor",
    blurb: "A stormy weekend, a hedge maze and a family will.",
    places: ["library", "conservatory", "drawing room", "hedge maze", "attic", "stables"],
    events: ["the reading of the will", "the hunt breakfast", "the birthday dinner", "the summer fete"],
    valuables: ["family will", "emerald ring", "silver candlestick", "rare stamp"],
    machines: ["grandfather clock", "music box", "dinner gong"],
    words: ["MANOR", "BUTLER", "PORTRAIT", "HEDGE", "MAZE", "ESTATE", "HEIRLOOM", "FIREPLACE", "STABLES", "GARDENER", "PANTRY", "GALLERY", "TAPESTRY", "STAIRWAY", "DECANTER", "SERVANT", "CROQUET", "ORCHARD", "FOUNTAIN", "TEAROOM", "ARMCHAIR", "FAMILY", "INHERIT", "GROUNDS", "CARRIAGE", "SCULLERY", "LANTERN", "SNUFFBOX"],
    missing: [
      { word: "WILL", clue: "It decides who inherits" },
      { word: "GONG", clue: "Struck to call everyone to dinner" },
      { word: "PASSAGE", clue: "Hidden behind a bookcase" },
      { word: "CODICIL", clue: "A late change to a will" },
      { word: "SIGNET", clue: "A ring used to seal letters" },
      { word: "QUILL", clue: "An old-fashioned pen" },
    ],
  },
  {
    id: "train",
    name: "Night Train",
    the: "the Midnight Express",
    blurb: "Sleeper cabins, a dining car and no way off.",
    places: ["dining car", "sleeper cabin", "luggage van", "observation car", "engine cab", "corridor"],
    events: ["the long tunnel", "the border crossing", "the late supper", "the snowstorm stop"],
    valuables: ["diamond tiepin", "diplomatic pouch", "travel journal", "ruby earrings"],
    machines: ["brakes", "signal lamp", "carriage lock"],
    words: ["TRAIN", "STATION", "PLATFORM", "TICKET", "CARRIAGE", "SLEEPER", "CONDUCTOR", "TUNNEL", "WHISTLE", "STEAM", "RAILS", "LUGGAGE", "TIMETABLE", "PASSPORT", "BORDER", "DINING", "COMPARTMENT", "BERTH", "ENGINE", "SIGNAL", "JOURNEY", "SNOWDRIFT", "COUPLING", "PORTER", "WAGON", "SCHEDULE", "VIADUCT", "BUFFER"],
    missing: [
      { word: "BRAKE", clue: "Pulled to stop the train" },
      { word: "STOWAWAY", clue: "A traveler without a ticket" },
      { word: "CABOOSE", clue: "The car at the very end" },
      { word: "SATCHEL", clue: "A courier's leather bag" },
      { word: "MAP", clue: "Shows the route ahead" },
      { word: "LANTERN", clue: "The guard's swinging light" },
    ],
  },
  {
    id: "museum",
    name: "Museum Gala",
    the: "the City Museum",
    blurb: "A gala night among mummies and masterpieces.",
    places: ["Egyptian hall", "sculpture court", "archive vault", "gift shop", "restoration lab", "roof terrace"],
    events: ["the opening gala", "the night tour", "the donors' dinner", "the lights-out drill"],
    valuables: ["golden scarab", "jade mask", "royal map", "tiny portrait"],
    machines: ["alarm panel", "display lights", "vault door"],
    words: ["MUSEUM", "EXHIBIT", "GALLERY", "CURATOR", "STATUE", "MUMMY", "FOSSIL", "ARTIFACT", "SCULPTURE", "PAINTING", "PEDESTAL", "VAULT", "ARCHIVE", "GUARD", "DONOR", "TAPESTRY", "MOSAIC", "POTTERY", "SCROLL", "AMULET", "PLAQUE", "GLASSCASE", "TOUR", "RELIC", "ANTIQUE", "BUST", "SARCOPHAGUS", "CATALOG"],
    missing: [
      { word: "REPLICA", clue: "A perfect copy left behind" },
      { word: "LASER", clue: "An invisible beam that guards" },
      { word: "VELVET", clue: "The soft rope around exhibits" },
      { word: "LABEL", clue: "The little card beside each piece" },
      { word: "FORGERY", clue: "A fake passed off as real" },
      { word: "KEYCARD", clue: "Opens the staff doors" },
    ],
  },
  {
    id: "circus",
    name: "Traveling Circus",
    the: "the Marvelo Circus",
    blurb: "Big top, sawdust and a vanished ringmaster's hat.",
    places: ["big top", "costume wagon", "menagerie tent", "ticket booth", "trapeze rig", "mirror maze"],
    events: ["the grand parade", "the evening show", "the trapeze finale", "the packing-up night"],
    valuables: ["ringmaster's hat", "cash box", "jeweled costume", "lucky horseshoe"],
    machines: ["trapeze", "cannon", "carousel"],
    words: ["CIRCUS", "TRAPEZE", "JUGGLER", "CLOWN", "ACROBAT", "TIGHTROPE", "RINGMASTER", "TENT", "POPCORN", "SAWDUST", "SPOTLIGHT", "UNICYCLE", "MAGICIAN", "WAGON", "BALLOON", "STILTS", "CAROUSEL", "PARADE", "DRUMROLL", "TICKETS", "CANNON", "TAMER", "CONFETTI", "SPANGLES", "CANDYFLOSS", "MEGAPHONE", "HOOPS", "RIBBON"],
    missing: [
      { word: "NET", clue: "It catches falling flyers" },
      { word: "WHIP", clue: "Cracked but never touching" },
      { word: "GREASEPAINT", clue: "A clown's face color" },
      { word: "TOPHAT", clue: "Worn by the ringmaster" },
      { word: "RIGGING", clue: "Ropes that hold the trapeze" },
      { word: "PRETZEL", clue: "A twisted salty snack" },
    ],
  },
  {
    id: "liner",
    name: "Ocean Liner",
    the: "the SS Coraline",
    blurb: "Five days at sea, a captain's table and fog.",
    places: ["captain's table", "promenade deck", "engine room", "first-class lounge", "radio room", "swimming pool"],
    events: ["the captain's dinner", "the costume ball", "the lifeboat drill", "the crossing of the equator"],
    valuables: ["navigation log", "diamond bracelet", "silver trophy", "sealed letter"],
    machines: ["radio", "ship's wheel", "foghorn"],
    words: ["LINER", "DECK", "CABIN", "PORTHOLE", "LIFEBOAT", "CAPTAIN", "STEWARD", "ANCHOR", "BRIDGE", "FUNNEL", "VOYAGE", "COMPASS", "GANGWAY", "PROPELLER", "STERN", "BOW", "LIFEJACKET", "HORIZON", "SEAGULL", "TELEGRAPH", "PURSER", "QUOIT", "BALLAST", "STARBOARD", "PORTSIDE", "PROMENADE", "KNOTS", "CREW"],
    missing: [
      { word: "MORSE", clue: "Dots and dashes on the radio" },
      { word: "HATCH", clue: "A door in the deck" },
      { word: "BINOCULARS", clue: "Used to watch the horizon" },
      { word: "MANIFEST", clue: "The list of cargo and passengers" },
      { word: "RUDDER", clue: "It steers the ship" },
    ],
  },
  {
    id: "lodge",
    name: "Ski Lodge",
    the: "Frostpeak Lodge",
    blurb: "Snowed in, fire crackling, one road out.",
    places: ["lounge", "ski room", "sauna", "cable car station", "kitchen", "boot room"],
    events: ["the blizzard", "the torchlight descent", "the fondue night", "the race weekend"],
    valuables: ["gold medal", "lodge keys", "silver flask", "race trophy"],
    machines: ["cable car", "generator", "snowmobile"],
    words: ["LODGE", "SKIS", "SLOPE", "CHALET", "BLIZZARD", "SNOWFALL", "FIREPLACE", "COCOA", "MITTENS", "GOGGLES", "SLEDGE", "AVALANCHE", "SUMMIT", "GONDOLA", "PINE", "ICICLE", "FONDUE", "SNOWSHOE", "BLANKET", "TOBOGGAN", "PEAK", "CABIN", "SCARF", "LIFT", "POWDER", "FROST", "LANTERN", "KINDLING"],
    missing: [
      { word: "TRACKS", clue: "Footprints in the snow" },
      { word: "THERMOS", clue: "Keeps the cocoa hot" },
      { word: "ROPE", clue: "Tied to every climber" },
      { word: "SNOWPLOW", clue: "Clears the only road" },
      { word: "WAX", clue: "Rubbed on skis" },
      { word: "FLASHLIGHT", clue: "Needed when the power fails" },
    ],
  },
  {
    id: "vineyard",
    name: "Vineyard Estate",
    the: "Château Lumiel",
    blurb: "Harvest season, old barrels and a family feud.",
    places: ["cellar", "tasting room", "vine rows", "pressing barn", "courtyard", "bottling room"],
    events: ["the harvest festival", "the grand tasting", "the family picnic", "the barrel auction"],
    valuables: ["prize ribbon", "secret recipe", "antique corkscrew", "deed to the land"],
    machines: ["grape press", "bottling machine", "cellar door"],
    words: ["VINEYARD", "GRAPES", "BARREL", "CELLAR", "HARVEST", "CORK", "BOTTLE", "VINE", "ORCHARD", "TRELLIS", "PRESS", "COURTYARD", "TASTING", "LABEL", "OAK", "VINTAGE", "BASKET", "SUNSHINE", "PICNIC", "CHATEAU", "TERRACE", "CASK", "HILLSIDE", "ESTATE", "SHEARS", "JUICE", "CRATE", "PERGOLA"],
    missing: [
      { word: "CORKSCREW", clue: "Opens every bottle" },
      { word: "STAIN", clue: "A purple mark on a sleeve" },
      { word: "DEED", clue: "Paper that proves who owns the land" },
      { word: "LEDGER", clue: "The estate's book of accounts" },
      { word: "SEAL", clue: "Wax pressed on the letter" },
      { word: "SECATEURS", clue: "Small shears for cutting grapes" },
    ],
  },
];

export const TEMPLATE_CAST: Person[] = [
  { name: "Ada Fairweather", role: "Heiress", traits: ["wears perfume", "wears glasses", "owns a dog"] },
  { name: "Bruno Castellan", role: "Chef", traits: ["has a beard", "whistles", "is left-handed"] },
  { name: "Clara Dunmore", role: "Journalist", traits: ["has inky fingers", "rides a bicycle", "wears a hat"] },
  { name: "Dorian Vale", role: "Violinist", traits: ["speaks French", "wears a red scarf", "carries an umbrella"] },
  { name: "Edwin Ashcombe", role: "Professor", traits: ["wears glasses", "has a beard", "carries an umbrella"] },
  { name: "Freya Linden", role: "Nurse", traits: ["whistles", "rides a bicycle", "wears rubber boots"] },
  { name: "Gustav Rook", role: "Colonel", traits: ["wears a hat", "owns a dog", "is left-handed"] },
  { name: "Helena Brisk", role: "Accountant", traits: ["wears glasses", "plays the piano", "wears a red scarf"] },
  { name: "Ivo Kestrel", role: "Pilot", traits: ["wears rubber boots", "speaks French", "has a beard"] },
  { name: "Lydia Fenwick", role: "Gardener", traits: ["smells of paint", "wears rubber boots", "owns a dog"] },
  { name: "Milo Hartley", role: "Chauffeur", traits: ["wears a hat", "whistles", "plays the piano"] },
  { name: "Nadia Sorel", role: "Sculptor", traits: ["smells of paint", "wears perfume", "is left-handed"] },
];

const VICTIMS = ["Mr. Albright", "Lady Wren", "Dr. Osgood", "Mrs. Pell", "Sir Rupert Lyle", "Miss Tamsin Gray", "Mr. Okafor", "Mrs. Ruiz", "Professor Ng", "Mr. Halloran", "Countess Vey", "Mr. Brightwater"];
const TIMES = ["just after midnight", "during the storm", "at the stroke of nine", "before breakfast", "while the band played", "when the lights flickered"];

const pick = <T,>(rng: Rng, a: T[]): T => a[Math.floor(rng() * a.length)];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const titleCase = (s: string) => s.replace(/\b[a-z]/g, (m) => m.toUpperCase());

interface Crime {
  title: (v: { item: string; place: string; machine: string; victim: string }) => string;
  story: (v: { item: string; place: string; machine: string; victim: string; event: string; time: string; setting: string }) => string;
}

const CRIMES: Crime[] = [
  {
    title: (v) => `The Vanishing ${titleCase(v.item)}`,
    story: (v) => `${cap(v.victim)}'s ${v.item} disappeared from the ${v.place} of ${v.setting} during ${v.event}. The door was locked and only three guests had a key.`,
  },
  {
    title: (v) => `Lights Out in the ${titleCase(v.place)}`,
    story: (v) => `${cap(v.victim)} was found lifeless in the ${v.place} ${v.time}, a cold cup of tea at the elbow. Three people were seen nearby that evening.`,
  },
  {
    title: (v) => `Sabotage of the ${titleCase(v.machine)}`,
    story: (v) => `The ${v.machine} at ${v.setting} failed ${v.time}, ruining ${v.event}. A loose panel shows it was no accident.`,
  },
  {
    title: (v) => `A Note for ${v.victim}`,
    story: (v) => `An unsigned note slipped under ${v.victim}'s door demanded the ${v.item} by dawn, or a secret would be told. The paper came from the ${v.place}.`,
  },
  {
    title: (v) => `The Sleeping Draught`,
    story: (v) => `${cap(v.victim)} dozed off in the ${v.place} during ${v.event} and woke hours later without the ${v.item}. The glass smelled faintly of lavender.`,
  },
  {
    title: (v) => `The Forged ${titleCase(v.item)}`,
    story: (v) => `The ${v.item} on show in the ${v.place} is a clever fake. The real one was swapped ${v.time}, and the swapper left in a hurry.`,
  },
];

export interface ScaffoldOptions {
  settings: string[];
  count: number;
  seed: number;
  words?: number;
}

/** Templated cases (with a cast and a book wrapper) for the chosen settings. */
export function scaffoldBook(opts: ScaffoldOptions, phrase = "CASE CLOSED"): CaseBook {
  const rng = mulberry32(opts.seed);
  const chosen = SETTINGS.filter((s) => opts.settings.includes(s.id));
  const list = chosen.length ? chosen : [SETTINGS[0]];
  const cases: CaseSpec[] = [];
  const titles = new Map<string, number>();
  for (let i = 0; i < opts.count; i++) {
    const st = list[i % list.length];
    const crime = CRIMES[(i + Math.floor(i / list.length)) % CRIMES.length];
    const v = { item: pick(rng, st.valuables), place: pick(rng, st.places), machine: pick(rng, st.machines), victim: pick(rng, VICTIMS), event: pick(rng, st.events), time: pick(rng, TIMES), setting: st.the };
    let title = crime.title(v);
    const seen = titles.get(title) ?? 0;
    titles.set(title, seen + 1);
    if (seen) title = `${title} (${["II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][seen - 1] ?? seen + 1})`;
    const missing = pick(rng, st.missing);
    const pool = st.words.filter((w) => !w.includes(missing.word) && !missing.word.includes(w));
    const words = shuffled(rng, pool).slice(0, opts.words ?? 13);
    // Culprit + a trait only they have among three suspects.
    let suspects: Person[] = [];
    let culprit: Person = TEMPLATE_CAST[0];
    for (let t = 0; t < 50; t++) {
      culprit = pick(rng, TEMPLATE_CAST);
      const others = shuffled(rng, TEMPLATE_CAST.filter((p) => p !== culprit)).slice(0, 2);
      if (uniqueTraits(culprit, [culprit, ...others]).length) {
        suspects = shuffled(rng, [culprit, ...others]);
        break;
      }
    }
    const next = list[(i + 1) % list.length];
    cases.push({
      title,
      story: crime.story(v),
      words,
      missing,
      suspects: suspects.map((p) => p.name),
      culprit: culprit.name,
      lead: i < opts.count - 1 ? `A clue points to the ${pick(rng, next.places)} of ${next.the}.` : "Every case is solved. Turn to your Case Board.",
      templated: true,
    });
  }
  return {
    title: list.length === 1 ? `Murder at ${titleCase(list[0].the.replace(/^the /, ""))}` : "The Case Files",
    intro: "Each case hides one letter of the final answer. Solve a case, then write its key letter in the numbered box below.",
    cast: TEMPLATE_CAST,
    cases,
    finale: { phrase, question: "What do the boxes spell?", epilogue: `The boxes spell ${phrase}.` },
  };
}

function shuffled<T>(rng: Rng, a: T[]): T[] {
  const out = a.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
