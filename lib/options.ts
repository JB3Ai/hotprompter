export type Draft = Record<string, string>;

export type FieldDef = {
  key: string;
  label: string;
  group: string;
  options: string[];
  explicit?: boolean;
};

export const EXPLICIT_GROUP = "Adult Explicit (18+)";
export const ADULT_STYLE_GROUP = "Adult Styling & Camera (18+)";
export const ADULT_THEME_GROUP = "Adult Theme & Personality (18+)";

export const GROUPS = [
  "Render Style",
  "Character",
  "Hair",
  "Look",
  "Scene & Action",
  "Technical",
  ADULT_STYLE_GROUP,
  ADULT_THEME_GROUP,
  EXPLICIT_GROUP
] as const;

export const FIELD_DEFS: FieldDef[] = [
  // ---------- Render Style ----------
  { key: "renderStyle", label: "Art / Render Style", group: "Render Style", options: [
    "photorealistic photograph", "hyperrealistic photo", "cinematic photograph",
    "editorial fashion photograph", "35mm film photograph", "polaroid snapshot",
    "anime illustration (seinen style)", "retro 90s anime style", "manga style",
    "digital painting", "fantasy oil painting", "watercolor illustration",
    "3D render (Unreal Engine)", "stylized 3D animated look",
    "cyberpunk concept art", "gothic dark art", "pixel art"
  ]},
  { key: "persona", label: "Persona", group: "Render Style", options: [
    "woman", "man", "androgynous person", "nonbinary person"
  ]},
  { key: "fantasyRace", label: "Race / Species (optional)", group: "Render Style", options: [
    "human", "elf", "dark elf", "orc", "tiefling", "vampire", "angel", "demon",
    "android", "cat-person", "mermaid", "fairy"
  ]},
  { key: "age", label: "Age (adults only)", group: "Render Style", options: [
    "21", "25", "30", "35", "40", "45", "50", "55", "60", "65"
  ]},

  // ---------- Character ----------
  { key: "heritage", label: "Heritage / Country", group: "Character", options: [
    "Japanese", "Korean", "Chinese", "Thai", "Vietnamese", "Filipino",
    "Indian", "Pakistani", "Iranian", "Turkish", "Egyptian", "Moroccan",
    "Nigerian", "Ethiopian", "Kenyan", "African-American", "Afro-Caribbean",
    "Brazilian", "Mexican", "Colombian", "Argentinian", "Cuban",
    "Italian", "Spanish", "French", "German", "British", "Irish",
    "Swedish", "Norwegian", "Danish", "Polish", "Ukrainian", "Russian",
    "Greek", "Australian", "Māori", "Samoan", "Inuit", "Kazakh", "Mongolian"
  ]},
  { key: "body", label: "Build / Body Type", group: "Character", options: [
    "slim", "lean and toned", "athletic", "muscular", "curvy", "voluptuous",
    "petite", "tall and statuesque", "plus-size", "average build"
  ]},
  { key: "eyeColor", label: "Eye Color", group: "Character", options: [
    "dark brown", "amber", "hazel", "green", "blue", "grey",
    "heterochromia (one blue, one gold)", "crimson red", "metallic gold"
  ]},
  { key: "features", label: "Distinguishing Features", group: "Character", options: [
    "none", "freckles", "beauty mark", "arm tattoos", "full sleeve tattoos",
    "delicate piercings", "stylish glasses", "subtle scar", "dimples"
  ]},

  // ---------- Hair ----------
  { key: "hairColor", label: "Hair Color", group: "Hair", options: [
    "jet black", "dark brown", "chestnut brown", "auburn", "copper red",
    "bright red", "strawberry blonde", "golden blonde", "ash blonde",
    "platinum blonde", "silver", "grey", "white", "pastel pink",
    "lavender", "violet", "blue", "teal", "mint green", "two-tone black and red"
  ]},
  { key: "hairTexture", label: "Hair Texture", group: "Hair", options: [
    "straight", "wavy", "curly", "coily", "kinky", "slicked-back"
  ]},
  { key: "hairLength", label: "Hair Length", group: "Hair", options: [
    "buzz cut", "pixie cut", "short", "chin-length bob", "shoulder-length",
    "mid-back length", "waist-length"
  ]},
  { key: "hairStyle", label: "Hairstyle", group: "Hair", options: [
    "worn loose", "high ponytail", "low ponytail", "messy bun", "sleek bun",
    "single french braid", "twin braids", "dreadlocks", "afro",
    "undercut", "wolf cut", "layered cut", "hime cut with blunt bangs",
    "curtain bangs", "side-swept bangs", "top knot"
  ]},

  // ---------- Look ----------
  { key: "outfit", label: "Outfit", group: "Look", options: [
    "pajamas", "swimsuit", "gothic fashion", "e-girl fashion", "maid outfit",
    "nurse outfit", "college casual", "librarian style", "business attire",
    "police uniform", "military uniform", "pilot uniform", "chef whites",
    "scientist outfit", "futuristic scientist", "cyberpunk fashion",
    "fantasy outfit", "royal attire", "nun habit", "cowgirl outfit",
    "elegant fashion", "glamorous fashion", "party outfit", "dancer outfit",
    "fitness wear", "tennis outfit", "streetwear", "skater style",
    "hipster style", "punk style", "rocker style", "biker style",
    "bohemian style", "vintage fashion", "artist outfit", "traveler outfit"
  ]},
  { key: "mood", label: "Mood", group: "Look", options: [
    "confident", "romantic", "playful", "mysterious", "dramatic",
    "sensual", "serene", "melancholic", "empowering", "mischievous", "calm"
  ]},

  // ---------- Scene & Action ----------
  { key: "scene", label: "Scene / Location", group: "Scene & Action", options: [
    "bedroom", "living room", "shower", "disco", "mountain viewpoint", "park",
    "public transport", "fantasy dungeon", "beach", "desert", "swimming pool",
    "city", "graveyard", "restaurant", "dojo", "church", "cave", "casino",
    "pool-table room", "garage", "shopping mall", "castle courtyard", "waterfall",
    "forest", "inside a car", "airplane cabin", "cinema", "office", "restroom",
    "jacuzzi", "sauna", "bathroom", "tent", "yacht", "penthouse suite",
    "hot spring", "rooftop terrace", "beach bungalow", "kitchen", "art loft",
    "wine cellar", "chalet", "library", "outdoor lounge", "treehouse", "castle hall"
  ]},
  { key: "action", label: "Action / Pose", group: "Scene & Action", options: [
    "kneeling", "sitting", "stretching", "lying down", "squatting", "twerking",
    "dancing", "ready to kiss", "kissing", "lying on stomach", "on all fours",
    "arched back", "against the wall", "both legs raised", "one leg raised",
    "sleeping", "mirror selfie", "standing from behind", "looking over the shoulder"
  ]},
  { key: "background", label: "Background", group: "Scene & Action", options: [
    "blurred city bokeh", "sunset sky", "glowing neon signs",
    "rain-streaked window", "cherry blossoms", "ocean horizon",
    "floor-to-ceiling bookshelf", "minimalist concrete wall",
    "gradient studio backdrop", "warm string lights", "drifting autumn leaves",
    "starry night sky", "waterfall mist"
  ]},
  { key: "expression", label: "Expression", group: "Scene & Action", options: [
    "neutral", "happy", "laughing", "shy", "serious", "sad", "angry",
    "flirty", "exhausted", "shocked"
  ]},

  // ---------- Technical ----------
  { key: "lighting", label: "Lighting", group: "Technical", options: [
    "golden hour sunlight", "soft window light", "warm low-key lighting",
    "neon rim lighting", "high-key softbox lighting", "overcast diffused light",
    "cool moonlight", "flickering candlelight", "dramatic chiaroscuro",
    "sunset backlight", "blue hour ambient light"
  ]},
  { key: "camera", label: "Camera / Framing", group: "Technical", options: [
    "35mm lens", "50mm lens", "85mm portrait lens", "100mm macro lens",
    "wide-angle lens", "shallow depth of field", "deep focus",
    "cinematic framing", "editorial framing", "symmetrical composition"
  ]},

  // ---------- Adult Styling & Camera (18+) ----------
  { key: "wearing", label: "Wearing", group: ADULT_STYLE_GROUP, explicit: true, options: [
    "naked", "underwear", "lingerie", "stockings", "pantyhose", "towel",
    "swimsuit", "latex outfit", "dominatrix outfit", "gothic outfit", "e-girl outfit",
    "bunny outfit", "maid outfit", "nurse roleplay outfit", "business attire",
    "police roleplay outfit", "military outfit", "pilot outfit", "fantasy outfit",
    "royal attire", "nun roleplay outfit", "cowgirl outfit", "elegant outfit",
    "glamorous outfit", "party outfit", "dancer outfit", "fitness outfit"
  ]},
  { key: "cameraAngle", label: "Camera Angle", group: ADULT_STYLE_GROUP, explicit: true, options: [
    "eye level", "low angle", "high angle", "POV", "over-the-shoulder",
    "close-up", "medium shot", "full body", "side profile", "selfie",
    "top-down", "focus blur", "cinematic framing"
  ]},
  { key: "breastSize", label: "Breast Size", group: ADULT_STYLE_GROUP, explicit: true, options: [
    "small breasts", "medium breasts", "large breasts", "extra-large breasts", "very large breasts"
  ]},
  { key: "buttSize", label: "Butt Size", group: ADULT_STYLE_GROUP, explicit: true, options: [
    "small butt", "slim butt", "athletic butt", "firm butt", "large butt", "very large butt"
  ]},

  // ---------- Adult Theme & Personality (18+) ----------
  { key: "adultAction", label: "Adult Act / Pose", group: ADULT_THEME_GROUP, explicit: true, options: [
    "breast reveal", "breast grab", "squeezing breasts", "spreading buttocks",
    "spreading vulva", "fingering", "squirting", "riding a dildo", "striptease",
    "lap dance", "footjob", "handjob", "oral sex while kneeling", "deep throat",
    "titjob", "facial", "creampie", "ejaculate on body", "bukkake", "gangbang",
    "missionary position", "mating press", "doggystyle", "cowgirl position",
    "reverse cowgirl", "squatting on top", "spooning", "anal sex", "69 position",
    "facesitting", "rimming", "fingered by partner"
  ]},
  { key: "additionalTheme", label: "Additional Theme", group: ADULT_THEME_GROUP, explicit: true, options: [
    "consensual BDSM", "brat taming roleplay", "breeding fantasy", "cuckolding fantasy",
    "femdom", "foot fetish", "furry fantasy", "trans / futanari fantasy",
    "guided masturbation", "lesbian scene", "lingerie fantasy", "RPG fantasy",
    "goth fantasy", "mafia fantasy", "travel romance"
  ]},
  { key: "relationshipDynamic", label: "Relationship / Scenario", group: ADULT_THEME_GROUP, explicit: true, options: [
    "best friends", "coworkers", "girlfriends", "gym partners", "long-distance partners",
    "neighbors", "roommates", "first date", "holiday getaway", "outdoor adventure",
    "workplace crush", "coffee-shop date", "cozy night in"
  ]},
  { key: "personality", label: "Personality", group: ADULT_THEME_GROUP, explicit: true, options: [
    "surprise me", "seductive", "playful", "dominant", "submissive", "passionate",
    "loyal", "mysterious", "kinky", "rebellious", "adventurous", "sweet", "shy",
    "empathetic", "creative", "quirky", "witty", "nerdy"
  ]},

  // ---------- Adult Explicit (18+) ----------
  { key: "nudityLevel", label: "Nudity Level", group: EXPLICIT_GROUP, explicit: true, options: [
    "fully clothed", "lingerie / boudoir attire", "implied nudity, strategically covered",
    "partial nudity", "full nudity, artistic", "full nudity, natural"
  ]},
  { key: "intimacy", label: "Intimacy Context", group: EXPLICIT_GROUP, explicit: true, options: [
    "solo portrait", "romantic couple embracing", "intimate couple, consensual adults",
    "passionate kiss", "sensual dance for a partner", "lovers in afterglow, relaxed"
  ]},
  { key: "adultTheme", label: "Adult Theme", group: EXPLICIT_GROUP, explicit: true, options: [
    "boudoir photography session", "erotic fine art study", "romantic evening together",
    "sensual morning light", "candlelit bedroom scene", "luxurious bath scene"
  ]},
  { key: "composition", label: "Framing / Composition", group: EXPLICIT_GROUP, explicit: true, options: [
    "tasteful crop", "full-body composition", "close-up on expression",
    "over-the-shoulder silhouette", "mirror reflection", "sheet-draped recline"
  ]}
];

export const EXPLICIT_KEYS = new Set(
  FIELD_DEFS.filter((f) => f.explicit).map((f) => f.key)
);

export const emptyDraft: Draft = Object.fromEntries(FIELD_DEFS.map((f) => [f.key, ""]));

export function randomizeDraft(): Draft {
  const d: Draft = {};
  for (const f of FIELD_DEFS) {
    d[f.key] = f.options[Math.floor(Math.random() * f.options.length)];
  }
  if (d.fantasyRace === "human") d.fantasyRace = "";
  if (d.features === "none") d.features = "";
  return d;
}

export function hasExplicitSelections(draft: Draft): boolean {
  return Object.entries(draft).some(([k, v]) => EXPLICIT_KEYS.has(k) && v !== "");
}

/** Whitelist + length-cap submitted drafts. Drops explicit keys unless allowed. */
export function sanitizeDraft(body: unknown, allowExplicit: boolean): Draft {
  const allowedKeys = new Set(
    FIELD_DEFS.filter((f) => allowExplicit || !f.explicit).map((f) => f.key)
  );
  return Object.fromEntries(
    Object.entries((body ?? {}) as Record<string, unknown>)
      .filter(([k]) => allowedKeys.has(k))
      .map(([k, v]) => [k, String(v).slice(0, 200)])
  );
}
