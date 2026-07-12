const DB_NAME = "FilmRecipeNoteDB";
const DB_VERSION = 1;

const RECIPES_STORE = "recipes";
const IMAGES_STORE = "images";
const SETTINGS_STORE = "settings";

const LEGACY_STORAGE_KEY = "film-recipe-note-visual-v1";
const DEFAULT_SEED_KEY = "default-recipes-v5-installed";

const DEFAULT_COVER = "./assets/default-cover.jpg";
const APP_BACKGROUND_IMAGE_KEY = "appBackgroundImageId";
const APP_BACKGROUND_MODE_KEY = "appBackgroundMode";
const APP_BACKGROUND_COLOR_KEY = "appBackgroundColor";
const DEFAULT_BACKGROUND_COLOR = "#121212";
const BACKGROUND_TEXT_SCHEMES = {
  "#FFFFFF": {
    landingText: "#171717",
    landingMuted: "rgba(23,23,23,.68)",
    pillBg: "rgba(255,255,255,.64)",
    pillLine: "rgba(0,0,0,.14)",
    chromeText: "#171717",
    chromeMuted: "rgba(23,23,23,.64)",
    toolText: "#1E1E1E",
    toolBg: "rgba(255,255,255,.72)",
    toolLine: "rgba(0,0,0,.14)"
  },
  "#F5F5F7": {
    landingText: "#202124",
    landingMuted: "rgba(32,33,36,.66)",
    pillBg: "rgba(255,255,255,.55)",
    pillLine: "rgba(32,33,36,.14)",
    chromeText: "#202124",
    chromeMuted: "rgba(32,33,36,.62)",
    toolText: "#202124",
    toolBg: "rgba(255,255,255,.68)",
    toolLine: "rgba(32,33,36,.14)"
  },
  "#DCE4DE": {
    landingText: "#23332B",
    landingMuted: "rgba(35,51,43,.67)",
    pillBg: "rgba(255,255,255,.44)",
    pillLine: "rgba(35,51,43,.16)",
    chromeText: "#23332B",
    chromeMuted: "rgba(35,51,43,.66)",
    toolText: "#23332B",
    toolBg: "rgba(255,255,255,.52)",
    toolLine: "rgba(35,51,43,.16)"
  },
  "#1D2A3A": {
    landingText: "#F2F5F8",
    landingMuted: "rgba(226,234,241,.72)",
    pillBg: "rgba(7,14,23,.30)",
    pillLine: "rgba(220,230,240,.20)",
    chromeText: "#F2F5F8",
    chromeMuted: "rgba(226,234,241,.72)",
    toolText: "#F2F5F8",
    toolBg: "rgba(7,14,23,.36)",
    toolLine: "rgba(220,230,240,.18)"
  },
  "#121212": {
    landingText: "#F4EFE6",
    landingMuted: "rgba(244,239,230,.68)",
    pillBg: "rgba(0,0,0,.30)",
    pillLine: "rgba(244,239,230,.18)",
    chromeText: "#F4EFE6",
    chromeMuted: "rgba(244,239,230,.68)",
    toolText: "#F4EFE6",
    toolBg: "rgba(0,0,0,.40)",
    toolLine: "rgba(244,239,230,.16)"
  },
  "#FFECF1": {
    landingText: "#472430",
    landingMuted: "rgba(71,36,48,.65)",
    pillBg: "rgba(255,255,255,.50)",
    pillLine: "rgba(71,36,48,.15)",
    chromeText: "#472430",
    chromeMuted: "rgba(71,36,48,.62)",
    toolText: "#472430",
    toolBg: "rgba(255,255,255,.58)",
    toolLine: "rgba(71,36,48,.14)"
  },
  "#FFF9E6": {
    landingText: "#4A3A16",
    landingMuted: "rgba(74,58,22,.64)",
    pillBg: "rgba(255,255,255,.48)",
    pillLine: "rgba(74,58,22,.15)",
    chromeText: "#4A3A16",
    chromeMuted: "rgba(74,58,22,.61)",
    toolText: "#4A3A16",
    toolBg: "rgba(255,255,255,.55)",
    toolLine: "rgba(74,58,22,.14)"
  },
  "#040720": {
    landingText: "#E8ECFF",
    landingMuted: "rgba(214,220,255,.72)",
    pillBg: "rgba(0,0,0,.28)",
    pillLine: "rgba(214,220,255,.20)",
    chromeText: "#E8ECFF",
    chromeMuted: "rgba(214,220,255,.72)",
    toolText: "#E8ECFF",
    toolBg: "rgba(0,0,0,.38)",
    toolLine: "rgba(214,220,255,.18)"
  }
};

const $ = (id) => document.getElementById(id);

let db;
let recipes = [];
let currentCoverId = null;
let currentCoverPreviewUrl = DEFAULT_COVER;
let activeObjectUrls = new Set();
let backgroundObjectUrl = null;
let activeView = "notes";
let readerPreviewObjectUrl = null;
let pendingReaderRecipe = null;
let pendingReaderCoverBlob = null;

function uid() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : String(Date.now()) + Math.random().toString(16).slice(2);
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function openDatabase() {
  const request = indexedDB.open(DB_NAME, DB_VERSION);

  request.onupgradeneeded = () => {
    const database = request.result;

    if (!database.objectStoreNames.contains(RECIPES_STORE)) {
      const store = database.createObjectStore(RECIPES_STORE, { keyPath: "id" });
      store.createIndex("updatedAt", "updatedAt");
      store.createIndex("favorite", "favorite");
      store.createIndex("category", "category");
    }

    if (!database.objectStoreNames.contains(IMAGES_STORE)) {
      database.createObjectStore(IMAGES_STORE, { keyPath: "id" });
    }

    if (!database.objectStoreNames.contains(SETTINGS_STORE)) {
      database.createObjectStore(SETTINGS_STORE, { keyPath: "key" });
    }
  };

  db = await requestToPromise(request);
}

async function getAllRecipes() {
  const transaction = db.transaction(RECIPES_STORE, "readonly");
  const result = await requestToPromise(
    transaction.objectStore(RECIPES_STORE).getAll()
  );
  return result.map(normalizeRecipe);
}

async function putRecipe(recipe) {
  const transaction = db.transaction(RECIPES_STORE, "readwrite");
  transaction.objectStore(RECIPES_STORE).put(recipe);
  await transactionDone(transaction);
}

async function putRecipes(items) {
  const transaction = db.transaction(RECIPES_STORE, "readwrite");
  const store = transaction.objectStore(RECIPES_STORE);

  items.forEach((item) => store.put(item));
  await transactionDone(transaction);
}

async function deleteRecipeRecord(id) {
  const transaction = db.transaction(RECIPES_STORE, "readwrite");
  transaction.objectStore(RECIPES_STORE).delete(id);
  await transactionDone(transaction);
}

async function clearRecipes() {
  const transaction = db.transaction(RECIPES_STORE, "readwrite");
  transaction.objectStore(RECIPES_STORE).clear();
  await transactionDone(transaction);
}

async function putImage(blob, id = uid()) {
  const transaction = db.transaction(IMAGES_STORE, "readwrite");

  transaction.objectStore(IMAGES_STORE).put({
    id,
    blob,
    type: blob.type || "image/jpeg",
    updatedAt: new Date().toISOString()
  });

  await transactionDone(transaction);
  return id;
}

async function getImageRecord(id) {
  if (!id) return null;

  const transaction = db.transaction(IMAGES_STORE, "readonly");
  const result = await requestToPromise(
    transaction.objectStore(IMAGES_STORE).get(id)
  );

  return result || null;
}

async function deleteImageRecord(id) {
  if (!id) return;

  const transaction = db.transaction(IMAGES_STORE, "readwrite");
  transaction.objectStore(IMAGES_STORE).delete(id);
  await transactionDone(transaction);
}

async function clearImages() {
  const transaction = db.transaction(IMAGES_STORE, "readwrite");
  transaction.objectStore(IMAGES_STORE).clear();
  await transactionDone(transaction);
}

async function setSetting(key, value) {
  const transaction = db.transaction(SETTINGS_STORE, "readwrite");
  transaction.objectStore(SETTINGS_STORE).put({ key, value });
  await transactionDone(transaction);
}

async function getSetting(key) {
  const transaction = db.transaction(SETTINGS_STORE, "readonly");
  const result = await requestToPromise(
    transaction.objectStore(SETTINGS_STORE).get(key)
  );
  return result ? result.value : null;
}

function createTrackedObjectUrl(blob) {
  const url = URL.createObjectURL(blob);
  activeObjectUrls.add(url);
  return url;
}

function revokeObjectUrl(url) {
  if (url && url.startsWith("blob:")) {
    URL.revokeObjectURL(url);
    activeObjectUrls.delete(url);
  }
}

function clearTrackedObjectUrls() {
  activeObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  activeObjectUrls.clear();
}

function normalizeIso(value) {
  const text = String(value || "").toUpperCase();

  if (text.includes("500")) return "ISO500+";
  if (text.includes("250")) return "ISO250+";
  return "ISO125+";
}

function normalizeExposure(value) {
  const text = String(value ?? "0").trim();

  const exactMap = {
    "0.0": "0",
    "+0.0": "0",
    "-0.0": "0",
    "+1/3": "+1/3",
    "-1/3": "-1/3",
    "+2/3": "+2/3",
    "-2/3": "-2/3"
  };

  if (exactMap[text]) return exactMap[text];

  const numeric = Number(text);

  if (Number.isFinite(numeric)) {
    const thirds = Math.round(numeric * 3);
    return exposureValueFromThirds(Math.max(-9, Math.min(9, thirds)));
  }

  return "0";
}

function inferWhiteBalance(recipe) {
  if (recipe.whiteBalanceMode) {
    return {
      mode: recipe.whiteBalanceMode,
      temperature: recipe.colorTemperature || ""
    };
  }

  const value = String(recipe.whiteBalance || "Auto").trim();

  if (/^\d{4,5}K$/i.test(value)) {
    return {
      mode: "색 온도",
      temperature: value.replace(/K/i, "")
    };
  }

  const map = {
    "AUTO": "Auto",
    "DAYLIGHT": "일광",
    "CLOUDY": "흐린날"
  };

  return {
    mode: map[value.toUpperCase()] || "Auto",
    temperature: ""
  };
}

function isMonochromeSimulation(value) {
  const text = String(value || "").toLowerCase();
  return text === "acros" || text === "monochrome";
}

function blankRecipe() {
  return {
    id: "",
    name: "",
    description: "",
    category: "Daily",
    iso: "ISO125+",
    exposure: "0",
    filmSimulation: "PROVIA / STANDARD",
    monochromeFilter: "#N/A",
    monochromeWc: "0",
    monochromeMg: "0",
    grainStrength: "OFF",
    grainSize: "SMALL",
    colorChrome: "OFF",
    colorChromeBlue: "OFF",
    skinEffect: "OFF",
    whiteBalanceMode: "Auto",
    colorTemperature: "",
    wbRed: "0",
    wbBlue: "0",
    dynamicRange: "DR400",
    highlight: "0",
    shadow: "0",
    color: "0",
    sharpness: "0",
    highIsoNr: "0",
    clarity: "0",
    longExposureNr: "OFF",
    memo: "",
    favorite: false,
    coverId: null,
    updatedAt: new Date().toISOString()
  };
}

function normalizeRecipe(recipe) {
  const base = blankRecipe();
  const wb = inferWhiteBalance(recipe);
  const monochrome = isMonochromeSimulation(recipe.filmSimulation);

  const normalized = {
    ...base,
    ...recipe,
    iso: normalizeIso(recipe.iso),
    exposure: normalizeExposure(recipe.exposure),
    skinEffect: recipe.skinEffect || recipe.smoothSkin || "OFF",
    whiteBalanceMode: wb.mode,
    colorTemperature: wb.temperature,
    monochromeFilter: monochrome
      ? (recipe.monochromeFilter && recipe.monochromeFilter !== "#N/A"
          ? recipe.monochromeFilter
          : "STD")
      : "#N/A",
    monochromeWc: String(recipe.monochromeWc ?? "0"),
    monochromeMg: String(recipe.monochromeMg ?? "0"),
    longExposureNr: recipe.longExposureNr || "OFF",
    wbRed: String(recipe.wbRed ?? "0"),
    wbBlue: String(recipe.wbBlue ?? "0"),
    highlight: String(recipe.highlight ?? "0"),
    shadow: String(recipe.shadow ?? "0"),
    color: String(recipe.color ?? "0"),
    sharpness: String(recipe.sharpness ?? "0"),
    highIsoNr: String(recipe.highIsoNr ?? "0"),
    clarity: String(recipe.clarity ?? "0")
  };

  if (!recipe.grainStrength && recipe.grainEffect) {
    const value = String(recipe.grainEffect).toUpperCase();
    normalized.grainStrength = value.includes("STRONG")
      ? "STRONG"
      : value.includes("WEAK")
        ? "WEAK"
        : "OFF";
    normalized.grainSize = value.includes("LARGE") ? "LARGE" : "SMALL";
  }

  delete normalized.lmo;
  delete normalized.smoothSkin;
  delete normalized.whiteBalance;
  delete normalized.monochromeColor;
  delete normalized.grainEffect;

  return normalized;
}

function defaultRecipes() {
  const time = new Date().toISOString();

  return [
    {
      ...blankRecipe(),
      id: uid(),
      name: "Gray Concrete",
      description: "야경용 저채도, 붉은색 표현",
      category: "Night",
      iso: "ISO500+",
      filmSimulation: "Eterna Bleach Bypass",
      whiteBalanceMode: "색 온도",
      colorTemperature: "2500",
      wbRed: "9",
      wbBlue: "-9",
      dynamicRange: "DR400",
      highlight: "-2",
      shadow: "-1",
      color: "-2",
      sharpness: "-4",
      highIsoNr: "-4",
      skinEffect: "STRONG",
      clarity: "3",
      colorChrome: "OFF",
      colorChromeBlue: "OFF",
      grainStrength: "STRONG",
      grainSize: "SMALL",
      updatedAt: time
    },
    {
      ...blankRecipe(),
      id: uid(),
      name: "True Scene",
      description: "눈에 보이는 그대로의 색감",
      category: "Daily",
      iso: "ISO500+",
      filmSimulation: "REALA ACE",
      whiteBalanceMode: "색 온도",
      colorTemperature: "4490",
      wbRed: "5",
      wbBlue: "-3",
      dynamicRange: "DR400",
      highlight: "-2",
      shadow: "0.5",
      color: "1",
      sharpness: "4",
      highIsoNr: "-1",
      skinEffect: "STRONG",
      clarity: "0",
      colorChrome: "WEAK",
      colorChromeBlue: "OFF",
      grainStrength: "WEAK",
      grainSize: "SMALL",
      updatedAt: time
    },
    {
      ...blankRecipe(),
      id: uid(),
      name: "Lavender Ash",
      description: "보랏빛 도는 베이스 색감, 특수 필름 느낌",
      category: "Street",
      iso: "ISO500+",
      filmSimulation: "Classic Negative",
      whiteBalanceMode: "색 온도",
      colorTemperature: "4800",
      wbRed: "3",
      wbBlue: "7",
      dynamicRange: "DR400",
      highlight: "-2",
      shadow: "-0.5",
      color: "2",
      sharpness: "1",
      highIsoNr: "-4",
      skinEffect: "STRONG",
      clarity: "0",
      colorChrome: "OFF",
      colorChromeBlue: "OFF",
      grainStrength: "STRONG",
      grainSize: "SMALL",
      updatedAt: time
    },
    {
      ...blankRecipe(),
      id: uid(),
      name: "Glass Tint",
      description: "시안빛 베이스 암부, 유리창을 통해 보는 느낌의 레시피",
      category: "City",
      iso: "ISO500+",
      filmSimulation: "Classic Chrome",
      whiteBalanceMode: "색 온도",
      colorTemperature: "7450",
      wbRed: "-5",
      wbBlue: "4",
      dynamicRange: "DR100",
      highlight: "-2",
      shadow: "-1.5",
      color: "2",
      sharpness: "0",
      highIsoNr: "4",
      skinEffect: "STRONG",
      clarity: "0",
      colorChrome: "OFF",
      colorChromeBlue: "STRONG",
      grainStrength: "STRONG",
      grainSize: "SMALL",
      updatedAt: time
    },
    {
      ...blankRecipe(),
      id: uid(),
      name: "Evening Amber",
      description: "주광에 호박빛깔이 돌아 따뜻함을 표현하기 위한 레시피",
      category: "Sunny",
      iso: "ISO500+",
      filmSimulation: "PROVIA / STANDARD",
      whiteBalanceMode: "색 온도",
      colorTemperature: "5300",
      wbRed: "3",
      wbBlue: "-1",
      dynamicRange: "DR400",
      highlight: "-0.5",
      shadow: "-1.5",
      color: "2",
      sharpness: "4",
      highIsoNr: "-3",
      skinEffect: "STRONG",
      clarity: "0",
      colorChrome: "STRONG",
      colorChromeBlue: "STRONG",
      grainStrength: "STRONG",
      grainSize: "SMALL",
      updatedAt: time
    }
  ];
}

async function migrateLegacyLocalStorage() {
  const legacyText = localStorage.getItem(LEGACY_STORAGE_KEY);
  const existing = await getAllRecipes();

  if (existing.length > 0 || !legacyText) return;

  let legacyRecipes;

  try {
    legacyRecipes = JSON.parse(legacyText);
  } catch {
    return;
  }

  if (!Array.isArray(legacyRecipes)) return;

  const migrated = [];

  for (const legacy of legacyRecipes) {
    const normalized = normalizeRecipe(legacy);
    normalized.id = normalized.id || uid();

    if (legacy.cover && String(legacy.cover).startsWith("data:image/")) {
      try {
        normalized.coverId = await putImage(dataUrlToBlob(legacy.cover));
      } catch {
        normalized.coverId = null;
      }
    }

    delete normalized.cover;
    migrated.push(normalized);
  }

  await putRecipes(migrated);
}

async function seedDefaultRecipes() {
  const alreadyInstalled = await getSetting(DEFAULT_SEED_KEY);

  if (alreadyInstalled) return;

  recipes = await getAllRecipes();

  const removedSamples = [
    "Hanoi Blue Chrome",
    "Soft Portrait Negative",
    "Urban Bleach Memory"
  ];

  for (const sample of recipes.filter((item) => removedSamples.includes(item.name))) {
    await deleteRecipeRecord(sample.id);

    if (sample.coverId) {
      await deleteImageRecord(sample.coverId);
    }
  }

  recipes = await getAllRecipes();

  const existingNames = new Set(recipes.map((recipe) => recipe.name));
  const defaults = defaultRecipes().filter((recipe) => !existingNames.has(recipe.name));

  if (defaults.length) {
    await putRecipes(defaults);
  }

  await setSetting(DEFAULT_SEED_KEY, true);
}

async function loadRecipes() {
  recipes = await getAllRecipes();
}

async function getRecipeCoverUrl(recipe) {
  if (!recipe.coverId) return DEFAULT_COVER;

  const imageRecord = await getImageRecord(recipe.coverId);

  if (!imageRecord || !imageRecord.blob) return DEFAULT_COVER;

  return createTrackedObjectUrl(imageRecord.blob);
}

function hexLuminance(hex) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;

  const convert = (channel) =>
    channel <= 0.03928
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4);

  return 0.2126 * convert(r) + 0.7152 * convert(g) + 0.0722 * convert(b);
}


function applyBackgroundTextScheme(color, isImage = false) {
  const root = document.documentElement;

  const scheme = isImage
    ? BACKGROUND_TEXT_SCHEMES["#121212"]
    : (BACKGROUND_TEXT_SCHEMES[String(color).toUpperCase()]
      || BACKGROUND_TEXT_SCHEMES["#121212"]);

  root.style.setProperty("--landing-text", scheme.landingText);
  root.style.setProperty("--landing-muted", scheme.landingMuted);
  root.style.setProperty("--pill-bg", scheme.pillBg);
  root.style.setProperty("--pill-line", scheme.pillLine);
  root.style.setProperty("--chrome-text", scheme.chromeText);
  root.style.setProperty("--chrome-muted", scheme.chromeMuted);
  root.style.setProperty("--chrome-tool-text", scheme.toolText);
  root.style.setProperty("--chrome-tool-bg", scheme.toolBg);
  root.style.setProperty("--chrome-tool-line", scheme.toolLine);
}

async function applyAppBackground() {
  const backgroundElement = document.querySelector(".bg");
  let mode = await getSetting(APP_BACKGROUND_MODE_KEY);
  const imageId = await getSetting(APP_BACKGROUND_IMAGE_KEY);
  const color = await getSetting(APP_BACKGROUND_COLOR_KEY) || DEFAULT_BACKGROUND_COLOR;

  if (!mode) {
    mode = imageId ? "image" : "color";
    await setSetting(APP_BACKGROUND_MODE_KEY, mode);
  }

  if (backgroundObjectUrl) {
    URL.revokeObjectURL(backgroundObjectUrl);
    backgroundObjectUrl = null;
  }

  if (mode === "image" && imageId) {
    const imageRecord = await getImageRecord(imageId);

    if (imageRecord && imageRecord.blob) {
      backgroundObjectUrl = URL.createObjectURL(imageRecord.blob);
      backgroundElement.className = "bg image-mode";
      backgroundElement.style.backgroundColor = "";
      backgroundElement.style.backgroundImage =
        `linear-gradient(180deg, rgba(0,0,0,.10), rgba(0,0,0,.62)), ` +
        `url("${backgroundObjectUrl}")`;
      document.documentElement.dataset.bgTone = "dark";
      applyBackgroundTextScheme("#121212", true);
      return;
    }
  }

  backgroundElement.className = "bg color-mode";
  backgroundElement.style.backgroundImage = "none";
  backgroundElement.style.backgroundColor = color;
  document.documentElement.dataset.bgTone =
    hexLuminance(color) > 0.55 ? "light" : "dark";
  applyBackgroundTextScheme(color, false);
}

function populateSelect(selectId, values, formatter = (value) => String(value)) {
  const select = $(selectId);
  select.replaceChildren();

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = String(value);
    option.textContent = formatter(value);
    select.appendChild(option);
  });
}

function signedLabel(value) {
  const numeric = Number(value);
  return numeric > 0 ? `+${value}` : String(value);
}

function exposureValueFromThirds(thirds) {
  if (thirds === 0) return "0";

  const sign = thirds > 0 ? "+" : "-";
  const absolute = Math.abs(thirds);
  const whole = Math.floor(absolute / 3);
  const remainder = absolute % 3;

  if (whole === 0) {
    return `${sign}${remainder}/3`;
  }

  if (remainder === 0) {
    return `${sign}${whole}`;
  }

  return `${sign}${whole} ${remainder}/3`;
}

function initializeOptionLists() {
  populateSelect(
    "exposure",
    Array.from({ length: 19 }, (_, index) => index - 9),
    exposureValueFromThirds
  );

  const tintValues = Array.from({ length: 19 }, (_, index) => index - 9);
  populateSelect("wbRed", tintValues, signedLabel);
  populateSelect("wbBlue", tintValues, signedLabel);

  const monoValues = ["#N/A", ...tintValues];
  populateSelect("monochromeWc", monoValues, (value) =>
    value === "#N/A" ? "#N/A" : signedLabel(value)
  );
  populateSelect("monochromeMg", monoValues, (value) =>
    value === "#N/A" ? "#N/A" : signedLabel(value)
  );

  const toneValues = [];
  for (let value = -2; value <= 4; value += 0.5) {
    toneValues.push(String(value));
  }
  populateSelect("highlight", toneValues, signedLabel);
  populateSelect("shadow", toneValues, signedLabel);

  const detailValues = Array.from({ length: 9 }, (_, index) => index - 4);
  populateSelect("color", detailValues, signedLabel);
  populateSelect("sharpness", detailValues, signedLabel);
  populateSelect("highIsoNr", detailValues, signedLabel);

  const clarityValues = Array.from({ length: 11 }, (_, index) => index - 5);
  populateSelect("clarity", clarityValues, signedLabel);
}

function val(id) {
  const element = $(id);
  return element.type === "checkbox" ? element.checked : element.value;
}

function setVal(id, value) {
  const element = $(id);

  if (element.type === "checkbox") {
    element.checked = Boolean(value);
  } else {
    element.value = value ?? "";
  }
}

function formatSigned(number) {
  const numeric = Number(number);
  if (!Number.isFinite(numeric)) return "0";
  return numeric > 0 ? `+${numeric}` : String(numeric);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function updateMonochromeUI() {
  const enabled = isMonochromeSimulation(val("filmSimulation"));
  const block = $("monochromeBlock");
  const filter = $("monochromeFilter");
  const tabs = $("monochromeToneTabs");

  block.classList.toggle("disabled-field", !enabled);
  filter.disabled = !enabled;
  tabs.classList.toggle("hidden", !enabled);

  if (enabled) {
    if (filter.value === "#N/A") filter.value = "STD";

    $("monochromeWc").disabled = false;
    $("monochromeMg").disabled = false;

    if ($("monochromeWc").value === "#N/A") $("monochromeWc").value = "0";
    if ($("monochromeMg").value === "#N/A") $("monochromeMg").value = "0";
  } else {
    filter.value = "#N/A";
    $("monochromeWc").value = "#N/A";
    $("monochromeMg").value = "#N/A";
    $("monochromeWc").disabled = true;
    $("monochromeMg").disabled = true;
  }
}

function updateWhiteBalanceUI() {
  const temperatureMode = val("whiteBalanceMode") === "색 온도";
  const wrap = $("colorTemperatureWrap");
  const input = $("colorTemperature");

  wrap.classList.toggle("disabled-field", !temperatureMode);
  input.disabled = !temperatureMode;

  if (!temperatureMode) {
    input.value = "";
    input.placeholder = "#N/A";
  } else {
    input.placeholder = "예: 5300";
  }
}

function recipeText(recipe) {
  const monochrome = isMonochromeSimulation(recipe.filmSimulation);
  const wbText = recipe.whiteBalanceMode === "색 온도"
    ? `색 온도 ${recipe.colorTemperature || "-"}K`
    : recipe.whiteBalanceMode;

  return [
    recipe.name,
    recipe.description || "",
    `ISO: ${recipe.iso}`,
    `Exposure Compensation: ${recipe.exposure}`,
    `Film Simulation: ${recipe.filmSimulation}`,
    monochrome
      ? `Monochrome Filter: ${recipe.monochromeFilter} / WC ${recipe.monochromeWc} / MG ${recipe.monochromeMg}`
      : "Monochrome Color: #N/A",
    `Grain Effect: ${recipe.grainStrength} / ${recipe.grainSize}`,
    `Color Chrome Effect: ${recipe.colorChrome}`,
    `Color Chrome FX Blue: ${recipe.colorChromeBlue}`,
    `Smooth Skin Effect: ${recipe.skinEffect}`,
    `White Balance: ${wbText}`,
    `WB Shift: R${formatSigned(recipe.wbRed)} / B${formatSigned(recipe.wbBlue)}`,
    `Dynamic Range: ${recipe.dynamicRange}`,
    `Tone Curve: H${formatSigned(recipe.highlight)} / S${formatSigned(recipe.shadow)}`,
    `Color: ${formatSigned(recipe.color)}`,
    `Sharpness: ${formatSigned(recipe.sharpness)}`,
    `High ISO NR: ${formatSigned(recipe.highIsoNr)}`,
    `Clarity: ${formatSigned(recipe.clarity)}`,
    `Long Exposure NR: ${recipe.longExposureNr}`,
    recipe.memo ? `Memo: ${recipe.memo}` : ""
  ].filter(Boolean).join("\n");
}

async function render() {
  clearTrackedObjectUrls();
  await applyAppBackground();

  const query = $("searchInput").value.trim().toLowerCase();
  const category = $("categoryFilter").value;
  const list = $("recipeList");

  const filtered = recipes
    .filter((recipe) => !category || recipe.category === category)
    .filter((recipe) => {
      const text = [
        recipe.name,
        recipe.description,
        recipe.category,
        recipe.filmSimulation,
        recipe.whiteBalanceMode,
        recipe.memo
      ].join(" ").toLowerCase();

      return text.includes(query);
    })
    .sort((a, b) =>
      Number(b.favorite) - Number(a.favorite) ||
      (b.updatedAt || "").localeCompare(a.updatedAt || "")
    );

  if (!filtered.length) {
    list.innerHTML = `
      <div class="empty">
        조건에 맞는 레시피가 없습니다.<br>
        ＋ 버튼으로 새 레시피를 추가하세요.
      </div>
    `;
    return;
  }

  list.replaceChildren();

  for (const recipe of filtered) {
    const coverUrl = await getRecipeCoverUrl(recipe);

    const card = document.createElement("article");
    card.className = "recipe-card";
    card.innerHTML = `
      <div class="cover" style="background-image:url('${coverUrl}')"></div>
      <div class="recipe-content">
        <div class="recipe-kicker">
          ${recipe.favorite ? `<span class="star">★ FAVORITE</span>` : ""}
        </div>
        <div class="recipe-title-row">
          <h3>${escapeHtml(recipe.name || "Untitled Recipe")}</h3>
          <span class="category-badge">${escapeHtml(recipe.category || "Recipe")}</span>
        </div>
        <p class="recipe-description">${escapeHtml(recipe.description || "")}</p>
        <div class="recipe-meta">
          <span class="chip">${escapeHtml(recipe.filmSimulation || "-")}</span>
          <span class="chip">${escapeHtml(recipe.dynamicRange || "-")}</span>
          <span class="chip">${escapeHtml(recipe.whiteBalanceMode || "-")}</span>
          <span class="chip">R${formatSigned(recipe.wbRed)} B${formatSigned(recipe.wbBlue)}</span>
        </div>
      </div>
    `;

    card.addEventListener("click", () => openEditor(recipe.id));
    list.appendChild(card);
  }
}

async function openEditor(id = "") {
  const recipe = id
    ? recipes.find((item) => item.id === id)
    : blankRecipe();

  if (!recipe) return;

  const normalized = normalizeRecipe(recipe);

  $("dialogTitle").textContent = id ? normalized.name : "New Recipe";
  setVal("recipeId", normalized.id || "");
  setVal("name", normalized.name);
  setVal("description", normalized.description);
  setVal("category", normalized.category);
  setVal("iso", normalized.iso);
  setVal("exposure", normalized.exposure);
  setVal("filmSimulation", normalized.filmSimulation);
  setVal("monochromeFilter", normalized.monochromeFilter);
  setVal("monochromeWc", normalized.monochromeWc);
  setVal("monochromeMg", normalized.monochromeMg);
  setVal("grainStrength", normalized.grainStrength);
  setVal("grainSize", normalized.grainSize);
  setVal("colorChrome", normalized.colorChrome);
  setVal("colorChromeBlue", normalized.colorChromeBlue);
  setVal("skinEffect", normalized.skinEffect);
  setVal("whiteBalanceMode", normalized.whiteBalanceMode);
  setVal("colorTemperature", normalized.colorTemperature);
  setVal("wbRed", normalized.wbRed);
  setVal("wbBlue", normalized.wbBlue);
  setVal("dynamicRange", normalized.dynamicRange);
  setVal("highlight", normalized.highlight);
  setVal("shadow", normalized.shadow);
  setVal("color", normalized.color);
  setVal("sharpness", normalized.sharpness);
  setVal("highIsoNr", normalized.highIsoNr);
  setVal("clarity", normalized.clarity);
  setVal("longExposureNr", normalized.longExposureNr);
  setVal("memo", normalized.memo);
  setVal("favorite", normalized.favorite);

  updateMonochromeUI();
  updateWhiteBalanceUI();

  currentCoverId = normalized.coverId || null;

  revokeObjectUrl(currentCoverPreviewUrl);
  currentCoverPreviewUrl = DEFAULT_COVER;

  if (currentCoverId) {
    const imageRecord = await getImageRecord(currentCoverId);

    if (imageRecord && imageRecord.blob) {
      currentCoverPreviewUrl = createTrackedObjectUrl(imageRecord.blob);
    }
  }

  $("coverPreview").src = currentCoverPreviewUrl;
  $("deleteBtn").style.display = id ? "" : "none";
  $("duplicateBtn").style.display = id ? "" : "none";
  $("editor").showModal();
}

function formToRecipe(existingId = "") {
  const monochrome = isMonochromeSimulation(val("filmSimulation"));

  return {
    id: existingId || uid(),
    name: val("name").trim(),
    description: val("description").trim(),
    category: val("category"),
    iso: val("iso"),
    exposure: val("exposure"),
    filmSimulation: val("filmSimulation"),
    monochromeFilter: monochrome ? val("monochromeFilter") : "#N/A",
    monochromeWc: monochrome ? val("monochromeWc") : "0",
    monochromeMg: monochrome ? val("monochromeMg") : "0",
    grainStrength: val("grainStrength"),
    grainSize: val("grainSize"),
    colorChrome: val("colorChrome"),
    colorChromeBlue: val("colorChromeBlue"),
    skinEffect: val("skinEffect"),
    whiteBalanceMode: val("whiteBalanceMode"),
    colorTemperature:
      val("whiteBalanceMode") === "색 온도"
        ? val("colorTemperature").trim()
        : "",
    wbRed: val("wbRed"),
    wbBlue: val("wbBlue"),
    dynamicRange: val("dynamicRange"),
    highlight: val("highlight"),
    shadow: val("shadow"),
    color: val("color"),
    sharpness: val("sharpness"),
    highIsoNr: val("highIsoNr"),
    clarity: val("clarity"),
    longExposureNr: val("longExposureNr"),
    memo: val("memo"),
    favorite: val("favorite"),
    coverId: currentCoverId,
    updatedAt: new Date().toISOString()
  };
}

async function resizeImage(file, maxWidth = 1600, maxHeight = 2000, quality = 0.84) {
  const dataUrl = await readFileAsDataURL(file);
  const image = new Image();

  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = dataUrl;
  });

  const ratio = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
  const width = Math.round(image.width * ratio);
  const height = Math.round(image.height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Image conversion failed")),
      "image/jpeg",
      quality
    );
  });
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function dataUrlToBlob(dataUrl) {
  const [header, body] = dataUrl.split(",");
  const typeMatch = header.match(/data:(.*?);base64/);
  const type = typeMatch ? typeMatch[1] : "application/octet-stream";
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function copyCurrent() {
  const id = val("recipeId");
  const recipe = id
    ? recipes.find((item) => item.id === id)
    : formToRecipe("");

  const text = recipeText(recipe || formToRecipe(""));

  try {
    await navigator.clipboard.writeText(text);
    toastButton($("copyBtn"), "복사 완료");
  } catch {
    window.prompt("아래 내용을 복사하세요.", text);
  }
}

function toastButton(button, text) {
  const originalText = button.textContent;
  button.textContent = text;

  setTimeout(() => {
    button.textContent = originalText;
  }, 1100);
}

async function exportBackup() {
  const recipesWithImages = [];

  for (const recipe of recipes) {
    const copy = { ...recipe };

    if (recipe.coverId) {
      const record = await getImageRecord(recipe.coverId);

      if (record && record.blob) {
        copy.coverData = await blobToDataUrl(record.blob);
      }
    }

    delete copy.coverId;
    recipesWithImages.push(copy);
  }

  const backgroundMode =
    await getSetting(APP_BACKGROUND_MODE_KEY) || "color";
  const backgroundColor =
    await getSetting(APP_BACKGROUND_COLOR_KEY) || DEFAULT_BACKGROUND_COLOR;
  const backgroundImageId =
    await getSetting(APP_BACKGROUND_IMAGE_KEY);

  let backgroundData = null;

  if (backgroundMode === "image" && backgroundImageId) {
    const backgroundRecord = await getImageRecord(backgroundImageId);

    if (backgroundRecord && backgroundRecord.blob) {
      backgroundData = await blobToDataUrl(backgroundRecord.blob);
    }
  }

  const payload = {
    app: "Film Simulation Note",
    version: 7,
    exportedAt: new Date().toISOString(),
    backgroundMode,
    backgroundColor,
    backgroundData,
    recipes: recipesWithImages
  };

  const blob = new Blob(
    [JSON.stringify(payload, null, 2)],
    { type: "application/json" }
  );

  const anchor = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);

  anchor.href = URL.createObjectURL(blob);
  anchor.download = `film-recipes-backup-${date}.json`;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

async function importBackup(file) {
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const imported = Array.isArray(parsed) ? parsed : parsed.recipes;

    if (!Array.isArray(imported)) {
      throw new Error("Invalid backup");
    }

    await clearRecipes();
    await clearImages();

    const restored = [];

    for (const item of imported) {
      const normalized = normalizeRecipe(item);
      normalized.id = item.id || uid();
      normalized.updatedAt = item.updatedAt || new Date().toISOString();
      normalized.coverId = null;

      const coverData = item.coverData || item.cover;

      if (coverData && String(coverData).startsWith("data:image/")) {
        normalized.coverId = await putImage(dataUrlToBlob(coverData));
      }

      delete normalized.cover;
      delete normalized.coverData;
      restored.push(normalized);
    }

    await putRecipes(restored);

    if (parsed.backgroundData && String(parsed.backgroundData).startsWith("data:image/")) {
      const backgroundId = await putImage(dataUrlToBlob(parsed.backgroundData));
      await setSetting(APP_BACKGROUND_IMAGE_KEY, backgroundId);
      await setSetting(APP_BACKGROUND_MODE_KEY, "image");
    } else {
      await setSetting(APP_BACKGROUND_IMAGE_KEY, null);
      await setSetting(
        APP_BACKGROUND_COLOR_KEY,
        parsed.backgroundColor || DEFAULT_BACKGROUND_COLOR
      );
      await setSetting(APP_BACKGROUND_MODE_KEY, "color");
    }

    await loadRecipes();
    await render();
    alert("복구 완료");
  } catch (error) {
    console.error(error);
    alert("복구 실패: 백업 파일을 확인하세요.");
  } finally {
    $("restoreInput").value = "";
  }
}



/* ---------- v7 JPEG Reader integration ---------- */
const READER_TIFF_TYPES = { 1:1, 2:1, 3:2, 4:4, 5:8, 7:1, 9:4, 10:8 };
const READER_TAGS = {
  IFD0: {
    0x010F: "Make", 0x0110: "Model", 0x0131: "Software", 0x0132: "ModifyDate",
    0x8769: "ExifOffset", 0x8825: "GPSOffset"
  },
  EXIF: {
    0x829A: "ExposureTime", 0x829D: "FNumber", 0x8827: "ISO", 0x9003: "DateTimeOriginal",
    0x9204: "ExposureBias", 0x920A: "FocalLength", 0x927C: "MakerNote",
    0xA002: "PixelXDimension", 0xA003: "PixelYDimension", 0xA405: "FocalLengthIn35mmFilm",
    0xA434: "LensModel"
  }
};
const READER_FUJI_TAGS = {
  0x1001: "Sharpness", 0x1002: "WhiteBalance", 0x1003: "Color", 0x1005: "ColorTemperature",
  0x100A: "WhiteBalanceFineTune", 0x100E: "NoiseReduction", 0x100F: "Clarity", 0x1010: "FujiFlashMode",
  0x1040: "ShadowTone", 0x1041: "HighlightTone", 0x1047: "GrainEffectRoughness", 0x1048: "ColorChromeEffect",
  0x1049: "BWAdjustment", 0x104B: "BWMagentaGreen", 0x104C: "GrainEffectSize", 0x104E: "ColorChromeFXBlue",
  0x1050: "ShutterType", 0x1400: "DynamicRange", 0x1401: "FilmMode", 0x1402: "DynamicRangeSetting",
  0x1403: "DevelopmentDynamicRange", 0x140B: "AutoDynamicRange", 0x1436: "ImageGeneration",
  0x1443: "DRangePriority", 0x1444: "DRangePriorityAuto", 0x1445: "DRangePriorityFixed",
  0x1447: "FujiModel", 0x1448: "FujiModel2"
};
const READER_MAPS = {
  filmMode: {
    0x000: "PROVIA / STANDARD", 0x100: "PROVIA / STANDARD", 0x110: "PROVIA / STANDARD",
    0x120: "ASTIA / SOFT", 0x130: "ASTIA / SOFT", 0x200: "Velvia / VIVID", 0x300: "ASTIA / SOFT",
    0x400: "Velvia / VIVID", 0x500: "PRO Neg. Std", 0x501: "PRO Neg. Hi", 0x600: "CLASSIC CHROME",
    0x700: "ETERNA / Cinema", 0x800: "CLASSIC Neg.", 0x900: "ETERNA BLEACH BYPASS",
    0xA00: "NOSTALGIC Neg.", 0xB00: "REALA ACE"
  },
  bwFilmSimulation: {
    0x300: "MONOCHROME", 0x301: "MONOCHROME + R FILTER", 0x302: "MONOCHROME + Ye FILTER",
    0x303: "MONOCHROME + G FILTER", 0x310: "SEPIA", 0x500: "ACROS", 0x501: "ACROS + R FILTER",
    0x502: "ACROS + Ye FILTER", 0x503: "ACROS + G FILTER"
  },
  whiteBalance: {
    0x0:"Auto", 0x1:"Auto (White Priority)", 0x2:"Auto (Ambiance Priority)", 0x100:"Daylight", 0x200:"Cloudy",
    0x300:"Fluorescent 1 / Daylight", 0x301:"Fluorescent 2 / Day White", 0x302:"Fluorescent 3 / White",
    0x303:"Warm White Fluorescent", 0x304:"Living Room Warm White Fluorescent", 0x400:"Incandescent",
    0x500:"Flash", 0x600:"Underwater", 0xF00:"Custom", 0xF01:"Custom 2", 0xF02:"Custom 3",
    0xF03:"Custom 4", 0xF04:"Custom 5", 0xFF0:"Kelvin"
  },
  color: {
    0x0:"0", 0x80:"+1", 0x100:"+2", 0xC0:"+3", 0xE0:"+4", 0x180:"-1", 0x200:"-2", 0x4C0:"-3", 0x4E0:"-4",
    0x300:"Monochrome", 0x301:"Monochrome + R Filter", 0x302:"Monochrome + Ye Filter", 0x303:"Monochrome + G Filter",
    0x310:"Sepia", 0x500:"Acros", 0x501:"Acros + R Filter", 0x502:"Acros + Ye Filter", 0x503:"Acros + G Filter"
  },
  sharpness: {0x0:"-4", 0x1:"-3", 0x2:"-2", 0x82:"-1", 0x3:"0", 0x84:"+1", 0x4:"+2", 0x5:"+3", 0x6:"+4"},
  noiseReduction: {0x0:"0", 0x100:"+2", 0x180:"+1", 0x1C0:"+3", 0x1E0:"+4", 0x200:"-2", 0x280:"-1", 0x2C0:"-3", 0x2E0:"-4"},
  grainRoughness: {0:"Off", 32:"Weak", 64:"Strong"},
  grainSize: {0:"Off", 16:"Small", 32:"Large"},
  colorChrome: {0:"Off", 32:"Weak", 64:"Strong"},
  shutterType: {0:"Mechanical", 1:"Electronic", 2:"Electronic (Long Shutter)", 3:"Electronic Front Curtain"},
  dynamicRange: {1:"Standard", 3:"Wide"},
  dynamicRangeSetting: {0x0:"Auto", 0x1:"Manual", 0x100:"DR100", 0x200:"DR200 / Wide1 (230%)", 0x201:"DR400 / Wide2 (400%)"},
  developmentDynamicRange: {100:"DR100", 200:"DR200", 230:"DR200 / Wide1 (230%)", 400:"DR400"},
  imageGeneration: {0:"Original Image", 1:"Re-developed from RAW"},
  dRangePriority: {0:"Auto", 1:"Fixed"},
  dRangePriorityAuto: {1:"Weak", 2:"Strong", 3:"Plus"},
  dRangePriorityFixed: {1:"Weak", 2:"Strong"}
};

function setActiveView(view) {
  activeView = view === "reader" ? "reader" : "notes";
  $("notesView").classList.toggle("hidden", activeView !== "notes");
  $("readerView").classList.toggle("hidden", activeView !== "reader");
  $("notesTab").classList.toggle("active", activeView === "notes");
  $("readerTab").classList.toggle("active", activeView === "reader");
}

function readerSetStatus(type, title, text) {
  const card = $("readerStatus");
  card.className = `reader-status ${type}`;
  card.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span>`;
}

function readerMakeKVGrid(element, items) {
  element.replaceChildren();
  if (!items || !items.length) {
    element.innerHTML = `<div class="reader-kv-item"><div class="reader-kv-label">안내</div><div class="reader-kv-value reader-kv-empty">표시할 정보가 없습니다.</div></div>`;
    return;
  }
  for (const item of items) {
    const div = document.createElement("div");
    div.className = "reader-kv-item";
    const value = item.value || "—";
    div.innerHTML = `<div class="reader-kv-label">${escapeHtml(item.label)}</div><div class="reader-kv-value ${value === "—" ? "reader-kv-empty" : ""}">${escapeHtml(value)}</div>`;
    element.appendChild(div);
  }
}

function readerFormatExposureTime(value) {
  if (typeof value === "number") {
    if (value >= 1) return `${readerTrimZero(value.toFixed(1))} sec`;
    return `1/${Math.round(1 / value)}`;
  }
  return value;
}
function readerFormatFNumber(value) { return typeof value === "number" ? `f/${readerTrimZero(value.toFixed(1))}` : value; }
function readerFormatFocal(value) { return typeof value === "number" ? `${readerTrimZero(value.toFixed(1))}mm` : value; }
function readerFormatBias(value) { return typeof value === "number" ? `${value > 0 ? "+" : ""}${readerTrimZero(value.toFixed(2))} EV` : value; }
function readerTrimZero(text) { return String(text).replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1"); }
function readerFormatDimensions(w, h) { return w && h ? `${w} × ${h}` : "—"; }
function readerFormatFileSize(bytes) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / 1048576).toFixed(2)} MB`; }
function readerDecodeMap(value, map) { return value == null ? "—" : (map[value] ?? String(value)); }
function readerIsJpeg(file) { return /image\/jpeg/.test(file.type) || /\.(jpe?g)$/i.test(file.name); }

async function readerHandleFile(file) {
  pendingReaderRecipe = null;
  pendingReaderCoverBlob = null;
  $("readerSaveBtn").disabled = true;

  if (!readerIsJpeg(file)) {
    readerSetStatus("error", "지원되지 않는 파일", "JPEG(.jpg / .jpeg) 파일만 분석할 수 있습니다.");
    return;
  }

  $("readerFileName").textContent = file.name;
  if (readerPreviewObjectUrl) URL.revokeObjectURL(readerPreviewObjectUrl);
  readerPreviewObjectUrl = URL.createObjectURL(file);
  $("readerPreviewImage").src = readerPreviewObjectUrl;
  $("readerPreviewImage").hidden = false;
  $("readerPreviewPlaceholder").hidden = true;

  try {
    readerSetStatus("idle", "분석 중", "메타데이터를 읽는 중입니다...");
    const buffer = await file.arrayBuffer();
    const parsed = readerParseJpegExif(buffer);
    await readerRenderResult(parsed, file);
  } catch (error) {
    console.error(error);
    readerMakeKVGrid($("readerCameraInfo"), []);
    readerMakeKVGrid($("readerExposureInfo"), []);
    readerMakeKVGrid($("readerRecipeInfo"), []);
    readerMakeKVGrid($("readerExtraInfo"), []);
    readerSetStatus("error", "분석 실패", "메타데이터를 해석하지 못했습니다. 원본 Fujifilm JPEG인지 확인해 주세요.");
  }
}

function readerParseJpegExif(buffer) {
  const view = new DataView(buffer);
  if (view.getUint16(0) !== 0xFFD8) throw new Error("Not JPEG");
  const exifMeta = readerFindExifSegment(view);
  if (!exifMeta) throw new Error("No EXIF");
  const { tiffOffset } = exifMeta;
  const little = readerGetEndian(view, tiffOffset);
  const ifd0Offset = view.getUint32(tiffOffset + 4, little);
  const ifd0 = readerParseIFD(view, tiffOffset + ifd0Offset, little, tiffOffset, READER_TAGS.IFD0);
  const exif = ifd0.ExifOffset != null
    ? readerParseIFD(view, tiffOffset + ifd0.ExifOffset, little, tiffOffset, READER_TAGS.EXIF)
    : {};

  let maker = null;
  if (typeof exif.MakerNote === "object" && exif.MakerNote.absoluteOffset != null) {
    maker = readerParseFujiMakerNote(view, exif.MakerNote.absoluteOffset);
  }
  return { ifd0, exif, maker };
}

function readerFindExifSegment(view) {
  let offset = 2;
  while (offset < view.byteLength) {
    if (view.getUint8(offset) !== 0xFF) break;
    const marker = view.getUint8(offset + 1);
    if (marker === 0xDA || marker === 0xD9) break;
    const size = view.getUint16(offset + 2, false);
    if (marker === 0xE1 && readerReadAscii(view, offset + 4, 6) === "Exif\x00\x00") {
      return { tiffOffset: offset + 10 };
    }
    offset += 2 + size;
  }
  return null;
}

function readerGetEndian(view, offset) {
  const mark = readerReadAscii(view, offset, 2);
  if (mark === "II") return true;
  if (mark === "MM") return false;
  throw new Error("Invalid TIFF endian");
}

function readerParseIFD(view, dirOffset, little, baseOffset, tagNames = {}) {
  const result = {};
  const count = view.getUint16(dirOffset, little);
  for (let index = 0; index < count; index += 1) {
    const entry = dirOffset + 2 + index * 12;
    const tag = view.getUint16(entry, little);
    const type = view.getUint16(entry + 2, little);
    const itemCount = view.getUint32(entry + 4, little);
    const totalSize = (READER_TIFF_TYPES[type] || 0) * itemCount;
    let dataOffset = entry + 8;
    let absoluteOffset = null;
    if (totalSize > 4) {
      const relativeOffset = view.getUint32(entry + 8, little);
      dataOffset = baseOffset + relativeOffset;
      absoluteOffset = dataOffset;
    }
    const value = readerReadValue(view, dataOffset, type, itemCount, little);
    const name = tagNames[tag] || `Tag 0x${tag.toString(16).padStart(4, "0")}`;
    if (tag === 0x927C) {
      result[name] = { raw: value, absoluteOffset: totalSize > 4 ? absoluteOffset : entry + 8 };
    } else {
      result[name] = value;
    }
  }
  return result;
}

function readerReadValue(view, offset, type, count, little) {
  switch (type) {
    case 1: return count === 1 ? view.getUint8(offset) : Array.from({ length: count }, (_, index) => view.getUint8(offset + index));
    case 2: return readerReadAscii(view, offset, count).replace(/\x00+$/, "");
    case 3: return count === 1 ? view.getUint16(offset, little) : Array.from({ length: count }, (_, index) => view.getUint16(offset + index * 2, little));
    case 4: return count === 1 ? view.getUint32(offset, little) : Array.from({ length: count }, (_, index) => view.getUint32(offset + index * 4, little));
    case 5: return count === 1 ? readerReadRational(view, offset, little, false) : Array.from({ length: count }, (_, index) => readerReadRational(view, offset + index * 8, little, false));
    case 7: return { bytes: Array.from({ length: count }, (_, index) => view.getUint8(offset + index)) };
    case 9: return count === 1 ? view.getInt32(offset, little) : Array.from({ length: count }, (_, index) => view.getInt32(offset + index * 4, little));
    case 10: return count === 1 ? readerReadRational(view, offset, little, true) : Array.from({ length: count }, (_, index) => readerReadRational(view, offset + index * 8, little, true));
    default: return null;
  }
}

function readerReadRational(view, offset, little, signed) {
  const numerator = signed ? view.getInt32(offset, little) : view.getUint32(offset, little);
  const denominator = signed ? view.getInt32(offset + 4, little) : view.getUint32(offset + 4, little);
  return denominator ? numerator / denominator : 0;
}

function readerReadAscii(view, offset, count) {
  let output = "";
  for (let index = 0; index < count; index += 1) output += String.fromCharCode(view.getUint8(offset + index));
  return output;
}

function readerParseFujiMakerNote(view, makerOffset) {
  const header = readerReadAscii(view, makerOffset, 8);
  if (!header.startsWith("FUJIFILM")) return null;
  const ifdRel = view.getUint32(makerOffset + 8, true);
  return readerParseIFD(view, makerOffset + ifdRel, true, makerOffset, READER_FUJI_TAGS);
}

async function readerRenderResult(parsed, file) {
  const make = parsed.ifd0.Make || "";
  const isFuji = /FUJIFILM/i.test(make);
  const makerAvailable = !!parsed.maker;

  const cameraItems = [
    { label:"브랜드", value: parsed.ifd0.Make || "—" },
    { label:"카메라", value: parsed.ifd0.Model || "—" },
    { label:"렌즈", value: parsed.exif.LensModel || "—" },
    { label:"촬영일시", value: parsed.exif.DateTimeOriginal || parsed.ifd0.ModifyDate || "—" },
    { label:"이미지 크기", value: readerFormatDimensions(parsed.exif.PixelXDimension, parsed.exif.PixelYDimension) },
    { label:"소프트웨어", value: parsed.ifd0.Software || "—" }
  ];
  const exposureItems = [
    { label:"셔터속도", value: parsed.exif.ExposureTime != null ? readerFormatExposureTime(parsed.exif.ExposureTime) : "—" },
    { label:"조리개", value: parsed.exif.FNumber != null ? readerFormatFNumber(parsed.exif.FNumber) : "—" },
    { label:"ISO", value: parsed.exif.ISO != null ? String(parsed.exif.ISO) : "—" },
    { label:"노출 보정", value: parsed.exif.ExposureBias != null ? readerFormatBias(parsed.exif.ExposureBias) : "—" },
    { label:"초점거리", value: parsed.exif.FocalLength != null ? readerFormatFocal(parsed.exif.FocalLength) : "—" },
    { label:"35mm 환산", value: parsed.exif.FocalLengthIn35mmFilm != null ? `${parsed.exif.FocalLengthIn35mmFilm}mm` : "—" }
  ];

  readerMakeKVGrid($("readerCameraInfo"), cameraItems);
  readerMakeKVGrid($("readerExposureInfo"), exposureItems);
  readerMakeKVGrid($("readerRecipeInfo"), makerAvailable ? readerBuildRecipeItems(parsed.maker) : []);
  readerMakeKVGrid($("readerExtraInfo"), readerBuildExtraItems(parsed.maker, file));

  if (makerAvailable) {
    pendingReaderRecipe = readerBuildRecipeForNote(parsed, file);
    pendingReaderCoverBlob = await compressImageUnderBytes(file, 1024 * 1024, 1600, 0.86);
    $("readerSaveBtn").disabled = false;
  }

  if (!isFuji) {
    readerSetStatus("warn", "FUJIFILM 파일이 아닐 수 있음", "브랜드 정보가 FUJIFILM으로 확인되지 않았습니다. 일반 EXIF만 일부 표시됩니다.");
  } else if (!makerAvailable) {
    readerSetStatus("warn", "부분 분석", "후지 기본 EXIF는 읽었지만 MakerNote 레시피 값은 찾지 못했습니다. 편집된 JPEG일 수 있습니다.");
  } else if (parsed.maker.ImageGeneration === 1) {
    readerSetStatus("warn", "분석 완료 · 재현상 이미지", "후지 MakerNote를 읽었지만 카메라 내 RAW 재현상 이미지로 기록되어 있습니다.");
  } else {
    readerSetStatus("success", "분석 완료", "후지 MakerNote 레시피 정보를 읽었습니다. 노트에 저장할 수 있습니다.");
  }
}

function readerBuildRecipeItems(m) {
  const dr = readerDecodeDynamicRangeDetailed(m);
  return [
    { label:"필름 시뮬레이션", value: readerDecodeFilmSimulation(m) },
    { label:"화이트 밸런스", value: readerDecodeWhiteBalance(m.WhiteBalance, m.ColorTemperature) },
    { label:"WB 시프트", value: readerDecodeWBFineTune(m.WhiteBalanceFineTune) },
    { label:"DR 설정 방식", value: dr.mode },
    { label:"적용 DR 값", value: dr.applied },
    { label:"톤 곡선", value: readerDecodeToneCurve(m.HighlightTone, m.ShadowTone) },
    { label:"컬러 / 모노크롬", value: readerDecodeMap(m.Color, READER_MAPS.color) },
    { label:"모노크롬 색상", value: readerDecodeMonochromeColor(m.BWAdjustment, m.BWMagentaGreen) },
    { label:"그레인 효과", value: readerDecodeGrain(m.GrainEffectRoughness, m.GrainEffectSize) },
    { label:"컬러크롬 효과", value: readerDecodeMap(m.ColorChromeEffect, READER_MAPS.colorChrome) },
    { label:"컬러크롬 FX 블루", value: readerDecodeMap(m.ColorChromeFXBlue, READER_MAPS.colorChrome) },
    { label:"샤프니스", value: readerDecodeMap(m.Sharpness, READER_MAPS.sharpness) },
    { label:"고감도 노이즈 감소", value: readerDecodeMap(m.NoiseReduction, READER_MAPS.noiseReduction) },
    { label:"명료도", value: readerDecodeClarity(m.Clarity) },
    { label:"셔터 타입", value: readerDecodeMap(m.ShutterType, READER_MAPS.shutterType) }
  ];
}

function readerBuildExtraItems(maker, file) {
  const items = [
    { label:"파일명", value: file?.name || "—" },
    { label:"파일 크기", value: file ? readerFormatFileSize(file.size) : "—" }
  ];
  if (maker) {
    items.push(
      { label:"이미지 생성", value: readerDecodeMap(maker.ImageGeneration, READER_MAPS.imageGeneration) },
      { label:"Fuji Model", value: maker.FujiModel || maker.FujiModel2 || "—" },
      { label:"DR Priority", value: readerDecodeDynamicRangePriority(maker.DRangePriority, maker.DRangePriorityAuto, maker.DRangePriorityFixed) },
      { label:"DR Raw", value: readerFormatDRRaw(maker) },
      { label:"플래시 모드", value: maker.FujiFlashMode != null ? String(maker.FujiFlashMode) : "—" }
    );
  } else {
    items.push({ label:"MakerNote 상태", value:"레시피 데이터 없음 또는 해석 불가" });
  }
  return items;
}

function readerDecodeFilmSimulation(m) {
  if (m && m.Color != null && READER_MAPS.bwFilmSimulation[m.Color]) return READER_MAPS.bwFilmSimulation[m.Color];
  if (m && m.FilmMode != null) return READER_MAPS.filmMode[m.FilmMode] || `Unknown FilmMode (${m.FilmMode})`;
  return "—";
}
function readerDecodeWhiteBalance(mode, kelvin) {
  if (mode == null) return "—";
  const base = readerDecodeMap(mode, READER_MAPS.whiteBalance);
  if (mode === 0xFF0 && kelvin) return `${base} (${kelvin}K)`;
  return base;
}
function readerDecodeWBFineTune(values) {
  const shift = readerGetWBShift(values);
  if (!shift) return "—";
  return `R ${readerSignedNum(shift.r)} / B ${readerSignedNum(shift.b)}`;
}
function readerGetWBShift(values) {
  if (!Array.isArray(values) || values.length < 2) return null;
  const convert = (value) => Math.abs(value) > 9 ? value / 20 : value;
  return { r: convert(values[0]), b: convert(values[1]) };
}
function readerSignedNum(value) { return `${value > 0 ? "+" : ""}${readerTrimZero(Number(value).toFixed(2))}`; }
function readerDecodeGrain(roughness, size) {
  const r = readerDecodeMap(roughness, READER_MAPS.grainRoughness);
  const s = readerDecodeMap(size, READER_MAPS.grainSize);
  if (r === "—" && s === "—") return "—";
  if (r === "Off" || s === "Off") return "Off";
  return `${r} / ${s}`;
}
function readerDecodeToneCurve(highlight, shadow) {
  if (highlight == null && shadow == null) return "—";
  return `H ${readerDecodeTone(highlight)} / S ${readerDecodeTone(shadow)}`;
}
function readerDecodeTone(value) {
  if (value == null) return "—";
  const raw12Map = { "-48":"+4", "-36":"+3", "-24":"+2", "-12":"+1", "0":"0", "12":"-1", "24":"-2", "36":"-3", "48":"-4" };
  if (raw12Map[String(value)] != null) return raw12Map[String(value)];
  const raw16Map = { "-64":"+4", "-48":"+3", "-32":"+2", "-16":"+1", "0":"0", "16":"-1", "32":"-2", "48":"-3", "64":"-4" };
  if (raw16Map[String(value)] != null) return raw16Map[String(value)];
  if (Math.abs(value) <= 48 && value % 6 === 0) return readerSignedNum(-value / 12);
  if (Math.abs(value) % 16 === 0) return readerSignedNum(-value / 16);
  return `raw ${value}`;
}
function readerDecodeDynamicRangeDetailed(m) {
  const mode = readerDecodeMap(m.DynamicRangeSetting, READER_MAPS.dynamicRangeSetting);
  let applied = "—";
  if (m.DevelopmentDynamicRange != null) applied = READER_MAPS.developmentDynamicRange[m.DevelopmentDynamicRange] || `${m.DevelopmentDynamicRange}%`;
  else if (m.AutoDynamicRange != null) applied = READER_MAPS.developmentDynamicRange[m.AutoDynamicRange] || `${m.AutoDynamicRange}%`;
  else if (m.DynamicRangeSetting === 0x100) applied = "DR100";
  else if (m.DynamicRangeSetting === 0x200) applied = "DR200";
  else if (m.DynamicRangeSetting === 0x201) applied = "DR400";
  else if (m.DynamicRange != null) applied = readerDecodeMap(m.DynamicRange, READER_MAPS.dynamicRange);
  const priority = readerDecodeDynamicRangePriority(m.DRangePriority, m.DRangePriorityAuto, m.DRangePriorityFixed);
  if (priority !== "—") applied = applied === "—" ? `DR Priority: ${priority}` : `${applied} / DR Priority: ${priority}`;
  return { mode, applied };
}
function readerDecodeDynamicRangePriority(pr, pra, prf) {
  if (pr == null) return "—";
  const mode = readerDecodeMap(pr, READER_MAPS.dRangePriority);
  if (pr === 0 && pra != null) return `${mode} (${readerDecodeMap(pra, READER_MAPS.dRangePriorityAuto)})`;
  if (pr === 1 && prf != null) return `${mode} (${readerDecodeMap(prf, READER_MAPS.dRangePriorityFixed)})`;
  return mode;
}
function readerFormatDRRaw(m) {
  const parts = [];
  if (m.DynamicRangeSetting != null) parts.push(`Setting:${m.DynamicRangeSetting}`);
  if (m.DevelopmentDynamicRange != null) parts.push(`Development:${m.DevelopmentDynamicRange}`);
  if (m.AutoDynamicRange != null) parts.push(`Auto:${m.AutoDynamicRange}`);
  if (m.DynamicRange != null) parts.push(`Basic:${m.DynamicRange}`);
  return parts.length ? parts.join(" / ") : "—";
}
function readerDecodeMonochromeColor(wc, mg) {
  if (wc == null && mg == null) return "—";
  return `WC ${readerSignedNum(wc || 0)} / MG ${readerSignedNum(mg || 0)}`;
}
function readerDecodeClarity(value) {
  if (value == null) return "—";
  const converted = Math.abs(value) > 10 ? value / 1000 : value;
  return readerSignedNum(converted).replace(".00", "");
}

function readerCleanSignedValue(value, fallback = "0") {
  if (value == null || value === "—") return fallback;
  return String(value).replace(/^\+/, "").trim();
}
function readerNormalizeLevel(value) {
  const text = String(value || "").toUpperCase();
  if (text.includes("STRONG")) return "STRONG";
  if (text.includes("WEAK")) return "WEAK";
  return "OFF";
}
function readerNormalizeGrainSize(value) {
  const text = String(value || "").toUpperCase();
  if (text.includes("LARGE")) return "LARGE";
  return "SMALL";
}
function readerNormalizeFilmSimulation(value) {
  const text = String(value || "").toLowerCase();
  if (text.includes("acros")) return "ACROS";
  if (text.includes("monochrome")) return "Monochrome";
  if (text.includes("sepia")) return "Sepia";
  if (text.includes("classic") && text.includes("chrome")) return "Classic Chrome";
  if (text.includes("classic") && text.includes("neg")) return "Classic Negative";
  if (text.includes("nostalgic")) return "Nostalgic Neg.";
  if (text.includes("bleach")) return "Eterna Bleach Bypass";
  if (text.includes("eterna")) return "Eterna";
  if (text.includes("reala")) return "REALA ACE";
  if (text.includes("pro neg") && text.includes("hi")) return "PRO Neg. Hi";
  if (text.includes("pro neg") && text.includes("std")) return "PRO Neg. Std";
  if (text.includes("velvia")) return "Velvia / VIVID";
  if (text.includes("astia")) return "ASTIA / SOFT";
  return "PROVIA / STANDARD";
}
function readerMonochromeFilter(value) {
  const text = String(value || "").toLowerCase();
  if (text.includes("+ r")) return "R";
  if (text.includes("+ ye")) return "Ye";
  if (text.includes("+ g")) return "G";
  return "STD";
}
function readerWhiteBalanceForNote(mode, kelvin) {
  if (mode === 0xFF0 || kelvin) return { mode: "색 온도", temperature: kelvin ? String(kelvin) : "" };
  const label = readerDecodeMap(mode, READER_MAPS.whiteBalance).toLowerCase();
  if (label.includes("white priority")) return { mode: "Auto 화이트우선", temperature: "" };
  if (label.includes("ambiance")) return { mode: "Auto 분위기 우선", temperature: "" };
  if (label.includes("daylight")) return { mode: "일광", temperature: "" };
  if (label.includes("cloudy")) return { mode: "흐린날", temperature: "" };
  if (label.includes("fluorescent 1")) return { mode: "형광등1", temperature: "" };
  if (label.includes("fluorescent 2")) return { mode: "형광등2", temperature: "" };
  if (label.includes("fluorescent 3")) return { mode: "형광등3", temperature: "" };
  if (label.includes("incandescent")) return { mode: "전구", temperature: "" };
  if (label.includes("underwater")) return { mode: "수중", temperature: "" };
  return { mode: "Auto", temperature: "" };
}
function readerDynamicRangeForNote(m) {
  const dr = readerDecodeDynamicRangeDetailed(m).applied;
  const match = String(dr).match(/DR(100|200|400)/);
  if (match) return `DR${match[1]}`;
  return "AUTO";
}
function readerIsoForNote(iso) {
  const value = Number(iso || 0);
  if (value >= 500) return "ISO500+";
  if (value >= 250) return "ISO250+";
  return "ISO125+";
}
function readerBuildRecipeForNote(parsed, file) {
  const maker = parsed.maker || {};
  const filmText = readerDecodeFilmSimulation(maker);
  const wb = readerWhiteBalanceForNote(maker.WhiteBalance, maker.ColorTemperature);
  const shift = readerGetWBShift(maker.WhiteBalanceFineTune) || { r: 0, b: 0 };
  const grainText = readerDecodeGrain(maker.GrainEffectRoughness, maker.GrainEffectSize);
  const drDetail = readerDecodeDynamicRangeDetailed(maker);
  const nameBase = readerNormalizeFilmSimulation(filmText);
  const sourceDate = parsed.exif.DateTimeOriginal || parsed.ifd0.ModifyDate || "";
  const memoLines = [
    `JPEG Reader에서 가져옴: ${file.name}`,
    parsed.ifd0.Model ? `Camera: ${parsed.ifd0.Model}` : "",
    parsed.exif.LensModel ? `Lens: ${parsed.exif.LensModel}` : "",
    parsed.exif.DateTimeOriginal ? `Date: ${parsed.exif.DateTimeOriginal}` : "",
    `Original Film Simulation Tag: ${filmText}`,
    `DR Mode: ${drDetail.mode}`,
    `DR Applied: ${drDetail.applied}`,
    maker.ImageGeneration != null ? `Image Generation: ${readerDecodeMap(maker.ImageGeneration, READER_MAPS.imageGeneration)}` : ""
  ].filter(Boolean);

  const recipe = {
    ...blankRecipe(),
    id: uid(),
    name: `${nameBase} · ${file.name.replace(/\.[^.]+$/, "")}`,
    description: "원본 JPEG에서 읽어온 레시피",
    category: "Test",
    iso: readerIsoForNote(parsed.exif.ISO),
    exposure: normalizeExposure(parsed.exif.ExposureBias ?? 0),
    filmSimulation: nameBase,
    monochromeFilter: isMonochromeSimulation(nameBase) ? readerMonochromeFilter(filmText) : "#N/A",
    monochromeWc: isMonochromeSimulation(nameBase) ? readerCleanSignedValue(maker.BWAdjustment, "0") : "0",
    monochromeMg: isMonochromeSimulation(nameBase) ? readerCleanSignedValue(maker.BWMagentaGreen, "0") : "0",
    grainStrength: readerNormalizeLevel(grainText),
    grainSize: readerNormalizeGrainSize(grainText),
    colorChrome: readerNormalizeLevel(readerDecodeMap(maker.ColorChromeEffect, READER_MAPS.colorChrome)),
    colorChromeBlue: readerNormalizeLevel(readerDecodeMap(maker.ColorChromeFXBlue, READER_MAPS.colorChrome)),
    skinEffect: "OFF",
    whiteBalanceMode: wb.mode,
    colorTemperature: wb.temperature,
    wbRed: readerCleanSignedValue(shift.r, "0"),
    wbBlue: readerCleanSignedValue(shift.b, "0"),
    dynamicRange: readerDynamicRangeForNote(maker),
    highlight: readerCleanSignedValue(readerDecodeTone(maker.HighlightTone), "0"),
    shadow: readerCleanSignedValue(readerDecodeTone(maker.ShadowTone), "0"),
    color: readerCleanSignedValue(readerDecodeMap(maker.Color, READER_MAPS.color), "0"),
    sharpness: readerCleanSignedValue(readerDecodeMap(maker.Sharpness, READER_MAPS.sharpness), "0"),
    highIsoNr: readerCleanSignedValue(readerDecodeMap(maker.NoiseReduction, READER_MAPS.noiseReduction), "0"),
    clarity: readerCleanSignedValue(readerDecodeClarity(maker.Clarity), "0"),
    longExposureNr: "OFF",
    memo: memoLines.join("\n"),
    favorite: false,
    coverId: null,
    source: "jpeg-reader",
    sourceFileName: file.name,
    sourceDate,
    updatedAt: new Date().toISOString()
  };

  return normalizeRecipe(recipe);
}

async function compressImageUnderBytes(file, maxBytes = 1024 * 1024, startMaxSide = 1600, startQuality = 0.86) {
  let maxSide = startMaxSide;
  let quality = startQuality;
  let bestBlob = null;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const blob = await resizeImage(file, maxSide, maxSide, quality);
    bestBlob = blob;
    if (blob.size <= maxBytes) return blob;

    if (quality > 0.66) {
      quality -= 0.07;
    } else {
      maxSide = Math.max(760, maxSide - 220);
      quality = 0.82;
    }
  }

  return bestBlob;
}

async function saveReaderRecipeToNote() {
  if (!pendingReaderRecipe) return;

  try {
    const recipe = { ...pendingReaderRecipe, id: uid(), updatedAt: new Date().toISOString() };

    if (pendingReaderCoverBlob) {
      recipe.coverId = await putImage(pendingReaderCoverBlob);
    }

    await putRecipe(recipe);
    await loadRecipes();
    await render();
    setActiveView("notes");
    await openEditor(recipe.id);
    readerSetStatus("success", "노트에 저장 완료", "새 레시피로 저장했습니다. 열린 편집창에서 이름과 카테고리를 수정하세요.");
  } catch (error) {
    console.error(error);
    readerSetStatus("error", "저장 실패", "레시피를 노트에 저장하지 못했습니다.");
  }
}

$("enterBtn").addEventListener("click", () => {
  $("landing").classList.add("hidden");
  $("workspace").classList.remove("hidden");
});

$("notesTab").addEventListener("click", () => setActiveView("notes"));
$("readerTab").addEventListener("click", () => setActiveView("reader"));
$("readerFileInput").addEventListener("change", (event) => {
  const file = event.target.files && event.target.files[0];
  if (file) readerHandleFile(file);
});
$("readerDropZone").addEventListener("dragover", (event) => {
  event.preventDefault();
  $("readerDropZone").classList.add("dragover");
});
$("readerDropZone").addEventListener("dragleave", () => {
  $("readerDropZone").classList.remove("dragover");
});
$("readerDropZone").addEventListener("drop", (event) => {
  event.preventDefault();
  $("readerDropZone").classList.remove("dragover");
  const file = event.dataTransfer.files && event.dataTransfer.files[0];
  if (file) readerHandleFile(file);
});
$("readerSaveBtn").addEventListener("click", saveReaderRecipeToNote);
$("readerHelpBtn").addEventListener("click", () => $("readerHelpDialog").showModal());
$("readerHelpCloseBtn").addEventListener("click", () => $("readerHelpDialog").close());


$("newBtn").addEventListener("click", () => openEditor());
$("closeDialog").addEventListener("click", () => $("editor").close());

$("searchInput").addEventListener("input", render);
$("categoryFilter").addEventListener("change", render);

$("filmSimulation").addEventListener("change", updateMonochromeUI);
$("whiteBalanceMode").addEventListener("change", updateWhiteBalanceUI);

$("recipeForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const id = val("recipeId");
  const previous = id
    ? recipes.find((item) => item.id === id)
    : null;

  const recipe = formToRecipe(id);

  if (!recipe.name) return;

  await putRecipe(recipe);

  if (
    previous &&
    previous.coverId &&
    previous.coverId !== recipe.coverId
  ) {
    await deleteImageRecord(previous.coverId);
  }

  await loadRecipes();
  await render();
  $("editor").close();
});

$("deleteBtn").addEventListener("click", async () => {
  const id = val("recipeId");

  if (!id) return;
  if (!confirm("이 레시피를 삭제할까요?")) return;

  const recipe = recipes.find((item) => item.id === id);

  await deleteRecipeRecord(id);

  if (recipe && recipe.coverId) {
    await deleteImageRecord(recipe.coverId);
  }

  await loadRecipes();
  await render();
  $("editor").close();
});

$("duplicateBtn").addEventListener("click", async () => {
  const recipe = formToRecipe("");
  recipe.name = `${recipe.name || "Recipe"} Copy`;

  if (currentCoverId) {
    const imageRecord = await getImageRecord(currentCoverId);

    if (imageRecord && imageRecord.blob) {
      recipe.coverId = await putImage(imageRecord.blob);
    }
  }

  await putRecipe(recipe);
  await loadRecipes();
  await render();
  $("editor").close();
});

$("copyBtn").addEventListener("click", copyCurrent);
$("backupBtn").addEventListener("click", exportBackup);
$("restoreInput").addEventListener("change", (event) => {
  importBackup(event.target.files[0]);
});

$("photoInput").addEventListener("change", async (event) => {
  const file = event.target.files[0];

  if (!file) return;

  try {
    const blob = await compressImageUnderBytes(file, 1024 * 1024, 1600, 0.86);
    const newImageId = await putImage(blob);

    if (currentCoverId) {
      await deleteImageRecord(currentCoverId);
    }

    currentCoverId = newImageId;

    revokeObjectUrl(currentCoverPreviewUrl);
    currentCoverPreviewUrl = createTrackedObjectUrl(blob);
    $("coverPreview").src = currentCoverPreviewUrl;
  } catch (error) {
    console.error(error);
    alert("이미지를 불러오지 못했습니다.");
  } finally {
    $("photoInput").value = "";
  }
});

$("removePhotoBtn").addEventListener("click", async () => {
  if (currentCoverId) {
    await deleteImageRecord(currentCoverId);
  }

  currentCoverId = null;
  revokeObjectUrl(currentCoverPreviewUrl);
  currentCoverPreviewUrl = DEFAULT_COVER;
  $("coverPreview").src = DEFAULT_COVER;
});

$("backgroundInput").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const control = $("backgroundInput").closest(".text-tool");
  const originalLabel = control
    ? control.childNodes[0].textContent
    : "배경";

  try {
    if (control) control.childNodes[0].textContent = "처리중";

    const previousId = await getSetting(APP_BACKGROUND_IMAGE_KEY);
    const blob = await resizeImage(file, 1800, 2600, 0.86);
    const newId = await putImage(blob);

    await setSetting(APP_BACKGROUND_IMAGE_KEY, newId);
    await setSetting(APP_BACKGROUND_MODE_KEY, "image");
    await applyAppBackground();

    if (previousId && previousId !== newId) {
      await deleteImageRecord(previousId);
    }

    if (control) {
      control.childNodes[0].textContent = "완료";
      setTimeout(() => {
        control.childNodes[0].textContent = originalLabel;
      }, 1200);
    }
  } catch (error) {
    console.error(error);

    if (control) control.childNodes[0].textContent = originalLabel;

    alert("배경 이미지를 불러오지 못했습니다.");
  } finally {
    $("backgroundInput").value = "";
  }
});

$("resetBackgroundBtn").addEventListener("click", () => {
  $("colorPaletteDialog").showModal();
});

$("paletteCloseBtn").addEventListener("click", () => {
  $("colorPaletteDialog").close();
});

document.querySelectorAll(".color-swatch").forEach((button) => {
  button.addEventListener("click", async () => {
    const color = button.dataset.color;
    const previousId = await getSetting(APP_BACKGROUND_IMAGE_KEY);

    await setSetting(APP_BACKGROUND_COLOR_KEY, color);
    await setSetting(APP_BACKGROUND_MODE_KEY, "color");
    await setSetting(APP_BACKGROUND_IMAGE_KEY, null);

    if (previousId) {
      await deleteImageRecord(previousId);
    }

    await applyAppBackground();
    $("colorPaletteDialog").close();
    toastButton($("resetBackgroundBtn"), "완료");
  });
});

async function initializeApp() {
  try {
    initializeOptionLists();
    await openDatabase();
    await migrateLegacyLocalStorage();
    await seedDefaultRecipes();
    await loadRecipes();

    const backgroundMode = await getSetting(APP_BACKGROUND_MODE_KEY);
    const existingBackgroundImage = await getSetting(APP_BACKGROUND_IMAGE_KEY);

    if (!backgroundMode) {
      await setSetting(
        APP_BACKGROUND_MODE_KEY,
        existingBackgroundImage ? "image" : "color"
      );
    }

    const existingColor = await getSetting(APP_BACKGROUND_COLOR_KEY);

    if (!existingColor) {
      await setSetting(APP_BACKGROUND_COLOR_KEY, DEFAULT_BACKGROUND_COLOR);
    }

    await render();
  } catch (error) {
    console.error(error);
    alert("앱 저장소를 초기화하지 못했습니다.");
  }
}

initializeApp();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}
