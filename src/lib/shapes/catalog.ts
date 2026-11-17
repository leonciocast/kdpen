/**
 * Shape categories, animal sub-groups, and theme suggestions.
 * Every puzzle shape belongs to exactly one category.
 */
export type ShapeCategory =
  | "basic"
  | "stepped"
  | "hollow"
  | "clusters"
  | "letters"
  | "animals"
  | "nature"
  | "holiday"
  | "food"
  | "objects";

export type AnimalGroup = "farm" | "safari" | "pets" | "forest" | "birds" | "ocean" | "bugs" | "fantasy";

export const CATEGORIES: { id: ShapeCategory; label: string }[] = [
  { id: "basic", label: "Basic" },
  { id: "stepped", label: "Stepped & blocky" },
  { id: "hollow", label: "Hollow & rings" },
  { id: "clusters", label: "Clusters & islands" },
  { id: "letters", label: "Letters & numbers" },
  { id: "animals", label: "Animals" },
  { id: "nature", label: "Nature & weather" },
  { id: "holiday", label: "Holiday & seasons" },
  { id: "food", label: "Food" },
  { id: "objects", label: "Objects & places" },
];

export const ANIMAL_GROUPS: { id: AnimalGroup; label: string }[] = [
  { id: "farm", label: "Farm" },
  { id: "safari", label: "Wild / Safari" },
  { id: "pets", label: "Pets" },
  { id: "forest", label: "Forest" },
  { id: "birds", label: "Birds" },
  { id: "ocean", label: "Ocean" },
  { id: "bugs", label: "Bugs" },
  { id: "fantasy", label: "Dinosaurs & Fantasy" },
];

/** Existing + new non-animal shapes that are not defined in stepped.ts / objects.ts. */
export const LEGACY_CATEGORY: Record<string, ShapeCategory> = {
  square: "basic",
  rounded: "basic",
  landscape: "basic",
  portrait: "basic",
  circle: "basic",
  oval: "basic",
  triangle: "basic",
  diamond: "basic",
  pentagon: "basic",
  hexagon: "basic",
  octagon: "basic",
  star: "basic",
  cross: "basic",
  cloud: "nature",
  heart: "holiday",
  egg: "holiday",
  pumpkin: "holiday",
  tree: "holiday",
  apple: "food",
  house: "objects",
};

export const ANIMAL_GROUP: Record<string, AnimalGroup> = {
  horse: "farm", donkey: "farm", cow: "farm", bull: "farm", pig: "farm", sheep: "farm",
  goat: "farm", llama: "farm", chicken: "farm", rooster: "farm", turkey: "farm",
  elephant: "safari", zebra: "safari", camel: "safari", giraffe: "safari", hippo: "safari",
  rhino: "safari", lion: "safari", monkey: "safari", kangaroo: "safari", crocodile: "safari",
  ostrich: "safari", koala: "safari",
  cat: "pets", dog: "pets", rabbit: "pets",
  deer: "forest", moose: "forest", bear: "forest", wolf: "forest", fox: "forest",
  squirrel: "forest", mouse: "forest", hedgehog: "forest", raccoon: "forest", otter: "forest",
  bat: "forest", frog: "forest", snake: "forest",
  owl: "birds", eagle: "birds", duck: "birds", swan: "birds", goose: "birds",
  penguin: "birds", flamingo: "birds", parrot: "birds", pelican: "birds",
  fish: "ocean", whale: "ocean", dolphin: "ocean", shark: "ocean", seahorse: "ocean",
  octopus: "ocean", crab: "ocean", lobster: "ocean", turtle: "ocean", seal: "ocean",
  snail: "bugs", butterfly: "bugs", bee: "bugs", ladybug: "bugs", scorpion: "bugs",
  unicorn: "fantasy", trex: "fantasy", longneck: "fantasy", dragon: "fantasy",
};

/** Extra theme phrases → shape keys, used by the "Suggested for your theme" row. */
export const THEME_SHAPES: { match: RegExp; keys: string[] }[] = [
  { match: /weather|forecast|rainy|sunny|sky/, keys: ["cloud", "sunburst", "raindrop", "snowflake", "rainbow", "bolt", "moon"] },
  { match: /fruit|fruits|berry|orchard/, keys: ["apple", "pear", "cherry", "bowl"] },
  { match: /food|snack|treat|dessert|party/, keys: ["apple", "icecream", "cupcake", "pizza", "cherry"] },
  { match: /ice cream|icecream|gelato/, keys: ["icecream", "bowl"] },
  { match: /christmas|holiday|winter|snow/, keys: ["tree", "gift", "snowflake", "blocktree"] },
  { match: /halloween|spooky|october/, keys: ["pumpkin", "bat", "cat"] },
  { match: /valentine|love|heart/, keys: ["heart", "blockheart"] },
  { match: /easter/, keys: ["egg", "rabbit"] },
  { match: /st\.? ?patrick|irish|clover|shamrock/, keys: ["shamrock", "rainbow"] },
  { match: /ocean|sea|beach|marine|underwater/, keys: ["wave", "fish", "dolphin", "whale", "boat"] },
  { match: /space|rocket|planet|astronaut/, keys: ["rocket", "moon", "star"] },
  { match: /music|band|song|guitar/, keys: ["guitar", "star"] },
  { match: /travel|car|road|vehicle/, keys: ["car", "airplane", "boat"] },
  { match: /garden|flower|spring|bloom/, keys: ["petals", "leaf", "butterfly", "bee"] },
  { match: /name|letter|alphabet|initial/, keys: ["letterA", "letterB", "letterC"] },
  { match: /birthday|age|year|number/, keys: ["digit8", "digit5", "digit1", "gift"] },
  { match: /farm|barn|rural/, keys: ["horse", "cow", "pig", "chicken", "blockhouse"] },
];

export const OUTLINE_COLORS = [
  { id: "orange", label: "Orange", hex: "#e67a2e" },
  { id: "gold", label: "Gold", hex: "#c9a227" },
  { id: "black", label: "Black", hex: "#222222" },
  { id: "grey", label: "Grey", hex: "#6b7280" },
] as const;

export const DEFAULT_STEPPED_COLOR = OUTLINE_COLORS[0].hex;
