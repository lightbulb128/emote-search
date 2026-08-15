// @ts-check
import { readdirSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EMOTES_DIR = join(__dirname, "..", "public", "emotes");
const OUTPUT_FILE = join(__dirname, "..", "src", "data", "manifest.json");

/**
 * @typedef {Object} EmoteEntry
 * @property {string} id
 * @property {string} character
 * @property {string} name
 * @property {string} action
 * @property {string} variant
 * @property {string[]} tags
 * @property {string} filename
 * @property {string} url
 */

// Auto-discover character folders from public/emotes/
const CHARACTERS = existsSync(EMOTES_DIR)
  ? readdirSync(EMOTES_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
  : [];

/**
 * Parse a filename like "Eat (Donut).gif" into { action: "Eat", variant: "Donut" }
 * Also handles: "Cry 1.gif" → { action: "Cry", variant: "1" }
 * And: "Angry.gif" → { action: "Angry", variant: "" }
 */
function parseFilename(filename) {
  const nameWithoutExt = filename.replace(/\.gif$/i, "");

  // Match "Action (Variant)" pattern
  const parenMatch = nameWithoutExt.match(/^(.+?)\s*\((.+)\)$/);
  if (parenMatch) {
    return {
      action: parenMatch[1].trim(),
      variant: parenMatch[2].trim(),
    };
  }

  // Match "Action Number" pattern (e.g., "Cry 1", "Luv 2")
  const numMatch = nameWithoutExt.match(/^(.+?)\s+(\d+)$/);
  if (numMatch) {
    return {
      action: numMatch[1].trim(),
      variant: numMatch[2].trim(),
    };
  }

  // Single word action
  return {
    action: nameWithoutExt.trim(),
    variant: "",
  };
}

/**
 * Generate tags from action and variant names.
 * This provides baseline tags; the enrichment map can override/add.
 */
function generateBaseTags(action, variant) {
  const tags = new Set();

  // Add lowercase action words
  action
    .toLowerCase()
    .split(/\s+/)
    .forEach((w) => tags.add(w));

  // Add variant words
  if (variant) {
    variant
      .toLowerCase()
      .split(/[\s()]+/)
      .filter(Boolean)
      .forEach((w) => tags.add(w));
  }

  return [...tags];
}

/**
 * Enrichment map — manually maintained synonyms and extra tags.
 * Key = exact action name (as in filename). Value = extra tags to add.
 */
const TAG_ENRICHMENT = {
  "Angry": ["mad", "rage", "upset", "furious"],
  "Alert Bits": ["bits", "twitch", "streaming"],
  "Alert Donation": ["donation", "donate", "twitch", "streaming"],
  "Alert Heart": ["heart", "love", "twitch", "streaming"],
  "Alert Like": ["like", "twitch", "streaming"],
  "Alert Star": ["star", "twitch", "streaming"],
  "Arrive": ["enter", "entrance", "welcome", "hello"],
  "Bell": ["ring", "notification"],
  "Blep": ["tongue", "tease", "silly", "cute"],
  "Bonk": ["hit", "bonk", "joke"],
  "Boop": ["nose", "poke", "cute"],
  "Bug": ["error", "glitch", "insect"],
  "Button": ["press", "click", "interact"],
  "Cake": ["birthday", "cake", "celebrate", "food"],
  "Card Swipe": ["card", "swipe", "credit", "payment"],
  "Caught in 4K": ["exposed", "caught", "camera", "evidence"],
  "Celebration": ["celebrate", "party", "yay", "confetti"],
  "Cheer": ["cheer", "celebrate", "yay", "happy"],
  "Cheek Squeeze": ["cheek", "squeeze", "pinch", "squish", "cute"],
  "Cheers": ["cheers", "toast", "drink", "celebrate"],
  "Cheese Slap": ["cheese", "slap", "funny"],
  "Clown": ["clown", "joke", "funny", "circus"],
  "Coke Shake": ["coke", "cola", "shake", "drink", "funny"],
  "Copium": ["cope", "copium", "sad", "cry", "denial"],
  "Crowbar": ["crowbar", "weapon", "hit", "bonk"],
  "Cry": ["cry", "sad", "tears", "upset"],
  "Cut": ["scissors", "snip", "craft"],
  "Dance": ["dance", "dancing", "music", "fun"],
  "Dead": ["dead", "death", "rip", "ded"],
  "Dizzy": ["dizzy", "confused", "spin"],
  "Drink": ["drink", "beverage", "thirsty"],
  "Drive": ["drive", "car", "driving"],
  "Drooling": ["drool", "hungry", "food", "want"],
  "Dum": ["dumb", "stupid", "silly", "funny"],
  "Easter": ["easter", "egg", "holiday"],
  "Eat": ["eat", "food", "hungry", "nom"],
  "Electric Fan": ["fan", "cool", "electric"],
  "Exclamation": ["exclamation", "alert", "surprise", "notice"],
  "Fire": ["fire", "hot", "flame", "lit"],
  "Folding Fans": ["fan", "folding", "traditional"],
  "Game": ["game", "gaming", "play"],
  "Get Hit": ["hit", "ouch", "bonk", "hurt"],
  "Gift": ["gift", "present", "give"],
  "Greeting": ["hello", "greeting", "wave", "welcome"],
  "Guitar": ["guitar", "music", "play"],
  "Gun": ["gun", "shoot", "weapon", "pew"],
  "Head Nod": ["nod", "yes", "agree"],
  "Head Shake": ["shake", "no", "disagree", "deny"],
  "Hypnosis": ["hypnosis", "hypnotize", "spiral", "mesmerize"],
  "Idea": ["idea", "think", "lightbulb", "eureka"],
  "Jail": ["jail", "prison", "locked", "cell"],
  "Knife": ["knife", "stab", "weapon"],
  "Laugh": ["laugh", "funny", "haha", "lol"],
  "Lick": ["lick", "taste", "tongue"],
  "Lightstick": ["lightstick", "glow", "concert", "fan"],
  "Loading": ["wait", "buffer", "progress"],
  "Love Letter": ["love", "letter", "romance", "mail"],
  "Lurk": ["lurk", "watching", "hide", "peek"],
  "Luv": ["love", "luv", "heart", "like"],
  "Magic": ["magic", "spell", "wizard"],
  "Megaphone": ["megaphone", "shout", "loud", "announce"],
  "Money": ["money", "cash", "rich", "dollar"],
  "Mute": ["mute", "quiet", "silence", "shh"],
  "Need Food": ["hungry", "food", "need", "starving"],
  "Nervous": ["nervous", "anxious", "sweat", "worry"],
  "Noted": ["noted", "write", "note", "ok"],
  "Paid Break": ["paid", "break", "rest", "vacation"],
  "Pat": ["pat", "pet", "headpat", "cute"],
  "PNGTuber Idle": ["pngtuber", "idle", "vtuber"],
  "PNGTuber Loading": ["pngtuber", "loading", "vtuber"],
  "PNGTuber Talk": ["pngtuber", "talk", "speak", "vtuber"],
  "PNGTuber Yap": ["pngtuber", "yap", "talk", "vtuber"],
  "Point": ["point", "you", "finger"],
  "Popcat": ["popcat", "meme", "pop"],
  "Press": ["push", "squish", "interact"],
  "Question": ["question", "ask", "what", "confused"],
  "Raid": ["raid", "twitch", "streaming"],
  "RedPacket": ["redpacket", "red", "packet", "gift", "money"],
  "Reverse": ["reverse", "backward", "uno"],
  "Rose": ["rose", "flower", "love", "romantic"],
  "Rub": ["pet", "comfort", "cute"],
  "Scared": ["scared", "fear", "frightened", "shock"],
  "Score": ["score", "point", "game", "number"],
  "Shy": ["shy", "blush", "embarrassed", "cute"],
  "Sing": ["sing", "song", "music", "karaoke"],
  "Six Seven": ["67", "number", "meme"],
  "Sleep": ["sleep", "tired", "zzz", "nap"],
  "Slipper": ["slipper", "hit", "bonk", "chancla"],
  "Sparkling": ["sparkle", "shine", "glitter", "pretty"],
  "Spray": ["spray", "clean", "water"],
  "Stops Working": ["stop", "error", "broken", "crash"],
  "Sunglasses": ["sunglasses", "cool", "shades", "glasses"],
  "Surprise": ["surprise", "shock", "wow", "omg"],
  "Swatter": ["swatter", "fly", "hit"],
  "Sweat": ["sweat", "nervous", "hot", "anxious"],
  "Tablet": ["tablet", "ipad", "draw", "device"],
  "Take My Money": ["money", "take", "shutup", "buy"],
  "Tape": ["tape", "seal", "sticky"],
  "Tea": ["drink", "beverage", "relax"],
  "Think": ["think", "ponder", "hmm", "consider"],
  "This Is Fine": ["fine", "fire", "meme", "cope", "thisisfine"],
  "Thumb Down": ["dislike", "down", "no", "bad"],
  "Thumb Up": ["like", "up", "yes", "good"],
  "Trash Bin": ["trash", "delete", "bin", "garbage"],
  "TrashTuber Idle": ["trashtuber", "idle", "vtuber", "trash"],
  "TrashTuber Talk": ["trashtuber", "talk", "vtuber", "trash"],
  "TrashTuber Yap": ["trashtuber", "yap", "vtuber", "trash"],
  "Trophy": ["winner", "win", "award", "victory"],
  "Type": ["type", "keyboard", "coding", "work"],
  "Wink": ["wink", "flirt", "cute"],
  "Work": ["work", "job", "busy", "typing"],
  "Yay": ["cheer", "celebrate", "happy"],
};

function main() {
  // In CI (no GIFs checked in), skip generation and keep committed manifest
  if (!existsSync(EMOTES_DIR)) {
    console.log("⚠ public/emotes/ not found — skipping manifest generation (using committed version)");
    return;
  }

  /** @type {EmoteEntry[]} */
  const entries = [];

  for (const character of CHARACTERS) {
    const charDir = join(EMOTES_DIR, character);
    if (!existsSync(charDir)) {
      console.warn(`⚠ Directory not found: ${charDir}`);
      continue;
    }

    const files = readdirSync(charDir).filter((f) => f.endsWith(".gif"));

    for (const file of files) {
      const { action, variant } = parseFilename(file);

      // Build display name: action + variant if present
      const name =
        variant
          ? `${action} (${variant})`
          : action;

      // Generate base tags from the filename
      const baseTags = generateBaseTags(action, variant);

      // Add enrichment tags for the action
      const enrichment = TAG_ENRICHMENT[action] || [];
      const tags = [...new Set([...baseTags, ...enrichment])];

      // Unique ID: character-action-variant (slugified)
      const slug = `${character}-${action}-${variant}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      // Always use local path; R2 URL substitution happens at Astro build time
      const urlPath = `${character}/${encodeURI(file)}`;

      entries.push({
        id: slug,
        character,
        name,
        action,
        variant: variant || "",
        tags,
        filename: file,
        url: `/emotes/${urlPath}`,
        localUrl: `/emotes/${urlPath}`,
      });
    }
  }

  // Sort: by character, then by action
  entries.sort((a, b) => {
    if (a.character !== b.character) return a.character.localeCompare(b.character);
    return a.action.localeCompare(b.action);
  });

  console.log(`✅ Generated manifest with ${entries.length} emotes:`);
  for (const character of CHARACTERS) {
    const count = entries.filter((e) => e.character === character).length;
    console.log(`   ${character}: ${count}`);
  }

  // Ensure output directory exists
  const outDir = dirname(OUTPUT_FILE);
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  writeFileSync(OUTPUT_FILE, JSON.stringify(entries, null, 2));
  console.log(`📄 Written to ${OUTPUT_FILE}`);
}

main();
