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
    version: 6,
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

$("enterBtn").addEventListener("click", () => {
  $("landing").classList.add("hidden");
  $("workspace").classList.remove("hidden");
});

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
    const blob = await resizeImage(file, 1200, 1600, 0.82);
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
