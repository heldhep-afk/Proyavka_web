"use strict";

const $ = (selector) => document.querySelector(selector);

const storage = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      toast("Не сохранилось: память браузера заполнена");
      return false;
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      return false;
    }
  },
};

function toast(text) {
  const element = $("#toast");
  element.textContent = text;
  element.style.display = "block";
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    element.style.display = "none";
  }, 2600);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (character) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[character];
  });
}

const CANVAS_WIDTH = 900;
const LIBRARY_MAX_WIDTH = 600;
const THUMB_WIDTH = 240;
const JPEG_QUALITY_DOWNLOAD = 0.92;
const JPEG_QUALITY_THUMB = 0.6;
const MIN_PASSWORD_LENGTH = 6;
const MAX_QTY = 500;
const LOOK_STICKER_SCALE = 0.45;
const DEFAULT_STICKER_SIZE = 0.18;

const FORMATS = [
  { label: "10×15 см", width: 100, height: 150, price: 25 },
  { label: "13×18 см", width: 130, height: 180, price: 45 },
  { label: "15×21 см", width: 150, height: 210, price: 60 },
  { label: "A4, 21×30 см", width: 210, height: 297, price: 150 },
  { label: "Документы 3×4", width: 30, height: 40, price: 120 },
];

const saturationMatrix = (value) => [
  0.213 + 0.787 * value, 0.715 - 0.715 * value, 0.072 - 0.072 * value,
  0.213 - 0.213 * value, 0.715 + 0.285 * value, 0.072 - 0.072 * value,
  0.213 - 0.213 * value, 0.715 - 0.715 * value, 0.072 + 0.928 * value,
];

const EFFECTS = {
  none: { name: "Без эффекта" },
  bw: {
    name: "Ч/б",
    matrix: [0.3, 0.59, 0.11, 0.3, 0.59, 0.11, 0.3, 0.59, 0.11],
    contrast: 1.1,
  },
  sepia: {
    name: "Старое фото",
    matrix: [0.393, 0.769, 0.189, 0.349, 0.686, 0.168, 0.272, 0.534, 0.131],
    contrast: 1,
  },
  warm: {
    name: "Теплее",
    matrix: [1.1, 0.05, 0, 0, 1, 0, 0, 0.05, 0.88],
    contrast: 1.05,
  },
  cool: {
    name: "Холоднее",
    matrix: [0.9, 0, 0.05, 0, 1, 0.05, 0.05, 0.05, 1.1],
    contrast: 1,
  },
  pop: { name: "Ярче", matrix: saturationMatrix(1.35), contrast: 1.3 },
  fade: {
    name: "Ретро",
    matrix: saturationMatrix(0.8),
    contrast: 0.88,
    brightness: 22,
  },
};

const STICKERS = ["🎩", "🕶️", "👑", "🎀", "🧢", "👒", "🎅", "🌸", "⭐", "❄️", "🎈", "🎉"];

const LOOKS = {
  "Офис": [
    { emoji: "🎩", x: 0.5, y: 0.12, size: 0.3 },
    { emoji: "🕶️", x: 0.5, y: 0.4, size: 0.32 },
  ],
  "Море": [
    { emoji: "👒", x: 0.5, y: 0.12, size: 0.34 },
    { emoji: "🕶️", x: 0.5, y: 0.4, size: 0.32 },
    { emoji: "🌴", x: 0.88, y: 0.86, size: 0.22 },
  ],
  "Праздник": [
    { emoji: "👑", x: 0.5, y: 0.1, size: 0.28 },
    { emoji: "🎉", x: 0.12, y: 0.88, size: 0.2 },
    { emoji: "🎈", x: 0.88, y: 0.2, size: 0.2 },
  ],
  "Новый год": [
    { emoji: "🎅", x: 0.5, y: 0.12, size: 0.3 },
    { emoji: "❄️", x: 0.12, y: 0.15, size: 0.15 },
    { emoji: "🎄", x: 0.88, y: 0.85, size: 0.22 },
  ],
};

const state = {
  image: null,
  imageVersion: 0,
  effect: "none",
  overlay: null,
  vignette: false,
  stickers: [],
  selected: -1,
  formatIndex: 0,
  landscape: false,
  frame: "none",
};

let user = storage.get("session", null);
let filterCache = { key: "", canvas: null };
let isRegisterMode = false;
let dragIndex = -1;

const canvas = $("#cv");

function getCanvasSize() {
  const format = FORMATS[state.formatIndex];
  let width = format.width;
  let height = format.height;
  if (state.landscape) [width, height] = [height, width];
  return [CANVAS_WIDTH, Math.round((CANVAS_WIDTH * height) / width)];
}

function resetFilterCache() {
  filterCache.key = "";
}

function getFilteredImage(iw, ih) {
  const key = [state.effect, iw, ih, state.imageVersion].join("|");
  if (filterCache.key === key) return filterCache.canvas;

  const result = document.createElement("canvas");
  result.width = iw;
  result.height = ih;
  const context = result.getContext("2d");

  const scale = Math.max(iw / state.image.width, ih / state.image.height);
  const width = state.image.width * scale;
  const height = state.image.height * scale;
  context.drawImage(state.image, (iw - width) / 2, (ih - height) / 2, width, height);

  const effect = EFFECTS[state.effect];
  if (effect.matrix) {
    const imageData = context.getImageData(0, 0, iw, ih);
    const pixels = imageData.data;
    const matrix = effect.matrix;
    const contrast = effect.contrast || 1;
    const brightness = effect.brightness || 0;

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      for (let channel = 0; channel < 3; channel++) {
        let value =
          r * matrix[channel * 3] +
          g * matrix[channel * 3 + 1] +
          b * matrix[channel * 3 + 2];
        value = (value - 128) * contrast + 128 + brightness;
        pixels[i + channel] = value < 0 ? 0 : value > 255 ? 255 : value;
      }
    }
    context.putImageData(imageData, 0, 0);
  }

  filterCache = { key, canvas: result };
  return result;
}

function drawCanvas(target) {
  const [width, height] = getCanvasSize();
  target.width = width;
  target.height = height;
  const context = target.getContext("2d");

  context.fillStyle = "#fff";
  context.fillRect(0, 0, width, height);

  const margin =
    state.frame === "polaroid" ? width * 0.05 : state.frame === "thin" ? width * 0.03 : 0;
  const marginBottom = state.frame === "polaroid" ? width * 0.16 : margin;
  const innerWidth = Math.round(width - 2 * margin);
  const innerHeight = Math.round(height - margin - marginBottom);

  if (state.image) {
    context.drawImage(getFilteredImage(innerWidth, innerHeight), margin, margin);

    if (state.vignette) {
      const gradient = context.createRadialGradient(
        width / 2,
        margin + innerHeight / 2,
        innerHeight * 0.3,
        width / 2,
        margin + innerHeight / 2,
        Math.max(innerWidth, innerHeight) * 0.75
      );
      gradient.addColorStop(0, "rgba(0,0,0,0)");
      gradient.addColorStop(1, "rgba(0,0,0,.55)");
      context.save();
      context.beginPath();
      context.rect(margin, margin, innerWidth, innerHeight);
      context.clip();
      context.fillStyle = gradient;
      context.fillRect(margin, margin, innerWidth, innerHeight);
      context.restore();
    }

    if (state.overlay) {
      context.drawImage(state.overlay, margin, margin, innerWidth, innerHeight);
    }
  } else {
    context.fillStyle = "#e7e5dc";
    context.fillRect(margin, margin, innerWidth, innerHeight);
  }

  context.textAlign = "center";
  context.textBaseline = "middle";
  state.stickers.forEach((sticker, index) => {
    context.font = `${sticker.size * width}px sans-serif`;
    context.fillText(sticker.emoji, sticker.x * width, sticker.y * width);

    if (index === state.selected) {
      context.strokeStyle = "#0E8FA8";
      context.lineWidth = 3;
      context.setLineDash([8, 6]);
      context.strokeRect(
        sticker.x * width - sticker.size * width * 0.6,
        sticker.y * width - sticker.size * width * 0.6,
        sticker.size * width * 1.2,
        sticker.size * width * 1.2
      );
      context.setLineDash([]);
    }
  });
}

function renderEditor() {
  drawCanvas(canvas);
  updatePrice();
}

function getQty() {
  const value = parseInt($("#qty").value, 10);
  return Number.isFinite(value) ? clamp(value, 1, MAX_QTY) : 1;
}

function updatePrice() {
  const basePrice = FORMATS[state.formatIndex].price;
  const paperFactor = Number($("#paper").value) || 1;
  $("#price").textContent = `${Math.round(basePrice * getQty() * paperFactor)} ₽`;
}

FORMATS.forEach((format, index) => {
  $("#fmt").add(new Option(`${format.label} — от ${format.price} ₽`, index));
});

$("#fxBtns").innerHTML = Object.keys(EFFECTS)
  .map(
    (key) =>
      `<button data-fx="${key}" aria-pressed="${key === "none"}">${EFFECTS[key].name}</button>`
  )
  .join("");

$("#looks").innerHTML =
  Object.keys(LOOKS)
    .map((name) => `<button data-look="${name}">${name}</button>`)
    .join("") +
  "<br>" +
  STICKERS.map(
    (emoji) =>
      `<button class="look" data-stk="${emoji}" aria-label="Наклейка ${emoji}">${emoji}</button>`
  ).join("");

$("#fxBtns").onclick = (event) => {
  const key = event.target.dataset.fx;
  if (!key) return;
  state.effect = key;
  document.querySelectorAll("[data-fx]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.fx === key));
  });
  renderEditor();
};

function applyLook(name) {
  const look = LOOKS[name];
  if (!look) return;
  const [width, height] = getCanvasSize();
  state.stickers = look.map((item) => ({
    emoji: item.emoji,
    x: item.x,
    y: (item.y * height) / width,
    size: item.size * LOOK_STICKER_SCALE,
  }));
  state.selected = -1;
}

function addSticker(emoji) {
  const [, height] = getCanvasSize();
  state.stickers.push({
    emoji,
    x: 0.5,
    y: height / CANVAS_WIDTH / 2,
    size: DEFAULT_STICKER_SIZE,
  });
  state.selected = state.stickers.length - 1;
  $("#sz").value = DEFAULT_STICKER_SIZE * 100;
}

$("#looks").onclick = (event) => {
  const lookName = event.target.dataset.look;
  const emoji = event.target.dataset.stk;
  if (lookName) {
    applyLook(lookName);
  } else if (emoji) {
    addSticker(emoji);
  } else {
    return;
  }
  renderEditor();
};

$("#sz").oninput = (event) => {
  if (state.selected < 0) return;
  state.stickers[state.selected].size = Number(event.target.value) / 100;
  renderEditor();
};

$("#delSt").onclick = () => {
  if (state.selected < 0) return;
  state.stickers.splice(state.selected, 1);
  state.selected = -1;
  renderEditor();
};

$("#clrSt").onclick = () => {
  state.stickers = [];
  state.selected = -1;
  renderEditor();
};

$("#fmt").onchange = (event) => {
  state.formatIndex = Number(event.target.value);
  resetFilterCache();
  renderEditor();
};

$("#frame").onchange = (event) => {
  state.frame = event.target.value;
  resetFilterCache();
  renderEditor();
};

$("#land").onchange = (event) => {
  state.landscape = event.target.checked;
  resetFilterCache();
  renderEditor();
};

$("#vig").onchange = (event) => {
  state.vignette = event.target.checked;
  renderEditor();
};

$("#qty").oninput = updatePrice;
$("#qty").onchange = () => {
  $("#qty").value = getQty();
  updatePrice();
};
$("#paper").onchange = updatePrice;

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Не получилось открыть фото"));
    image.src = source;
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Не получилось прочитать файл"));
    reader.readAsDataURL(file);
  });
}

$("#file").onchange = async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    state.image = await loadImage(await readFileAsDataUrl(file));
    state.imageVersion += 1;
    resetFilterCache();
    $("#hint").hidden = true;
    renderEditor();
  } catch (error) {
    toast(error.message);
  } finally {
    event.target.value = "";
  }
};

function pointerToCanvas(event) {
  const rect = canvas.getBoundingClientRect();
  const scale = canvas.width / rect.width;
  return [
    ((event.clientX - rect.left) * scale) / canvas.width,
    ((event.clientY - rect.top) * scale) / canvas.width,
  ];
}

canvas.onpointerdown = (event) => {
  const [x, y] = pointerToCanvas(event);
  dragIndex = -1;

  for (let i = state.stickers.length - 1; i >= 0; i--) {
    const sticker = state.stickers[i];
    if (Math.hypot(sticker.x - x, sticker.y - y) < sticker.size * 0.6) {
      dragIndex = i;
      break;
    }
  }

  state.selected = dragIndex;
  if (dragIndex >= 0) {
    $("#sz").value = Math.round(state.stickers[dragIndex].size * 100);
    canvas.setPointerCapture(event.pointerId);
  }
  renderEditor();
};

canvas.onpointermove = (event) => {
  if (dragIndex < 0) return;
  const [x, y] = pointerToCanvas(event);
  state.stickers[dragIndex].x = x;
  state.stickers[dragIndex].y = y;
  renderEditor();
};

canvas.onpointerup = () => {
  dragIndex = -1;
};

async function hashPassword(password) {
  if (!globalThis.crypto || !crypto.subtle) {
    throw new Error("Не получается войти. Откройте сайт по HTTPS или через localhost");
  }
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function clearAuthForm() {
  $("#aMail").value = "";
  $("#aPass").value = "";
  $("#aName").value = "";
}

function setAuthMode(register) {
  isRegisterMode = register;
  $("#nameRow").hidden = !register;
  $("#authTtl").textContent = register ? "Регистрация" : "Вход";
  $("#authGo").textContent = register ? "Зарегистрироваться" : "Войти";
  $("#authSw").textContent = register ? "Войти" : "Регистрация";
  $("#aPass").autocomplete = register ? "new-password" : "current-password";
}

$("#authSw").onclick = () => setAuthMode(!isRegisterMode);

$("#authGo").onclick = async () => {
  const mail = $("#aMail").value.trim().toLowerCase();
  const password = $("#aPass").value;
  const name = $("#aName").value.trim();

  if (!/^\S+@\S+\.\S+$/.test(mail)) return toast("Проверьте почту");
  if (password.length < MIN_PASSWORD_LENGTH) {
    return toast(`Пароль: минимум ${MIN_PASSWORD_LENGTH} символов`);
  }

  let passwordHash;
  try {
    passwordHash = await hashPassword(password);
  } catch (error) {
    return toast(error.message);
  }

  const users = storage.get("users", {});
  if (!users || typeof users !== "object") return toast("Не получилось прочитать аккаунты");

  if (isRegisterMode) {
    if (users[mail]) return toast("Такая почта уже есть");
    if (!name) return toast("Введите имя");
    users[mail] = { name, hash: passwordHash };
    if (!storage.set("users", users)) return;
  } else {
    const entry = users[mail];
    const storedHash = entry ? entry.hash || entry.h : "";
    if (!entry || storedHash !== passwordHash) {
      return toast("Почта или пароль не подходят");
    }
  }

  user = { mail, name: users[mail].name };
  if (!storage.set("session", user)) return;

  setAuthMode(false);
  clearAuthForm();
  toast(`Здравствуйте, ${user.name}`);
  location.hash = "#editor";
  renderRoute();
};

$("#out").onclick = () => {
  user = null;
  storage.remove("session");
  clearAuthForm();
  setAuthMode(false);
  location.hash = "#cabinet";
  renderRoute();
};

function libraryKey() {
  return "fx:" + user.mail;
}

function getLibrary() {
  if (!user) return [];
  const library = storage.get(libraryKey(), []);
  return Array.isArray(library) ? library : [];
}

function renderLibrary() {
  const library = getLibrary();
  const html = library
    .map(
      (source, index) =>
        `<div><img src="${source}" data-use="${index}" alt="Эффект ${index + 1}">` +
        `<b data-del="${index}" title="Удалить" aria-label="Удалить эффект ${index + 1}">×</b></div>`
    )
    .join("");

  $("#lib").innerHTML = html;
  $("#lib2").innerHTML = html;
  $("#libEmpty").hidden = library.length > 0;
}

$("#ovFile").onchange = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const image = await loadImage(await readFileAsDataUrl(file));
    state.overlay = image;
    renderEditor();

    if (!user) {
      toast("Эффект добавлен. Войдите, чтобы сохранить его");
      return;
    }

    const scale = Math.min(1, LIBRARY_MAX_WIDTH / image.width);
    const preview = document.createElement("canvas");
    preview.width = Math.round(image.width * scale);
    preview.height = Math.round(image.height * scale);
    preview.getContext("2d").drawImage(image, 0, 0, preview.width, preview.height);

    const library = getLibrary();
    library.push(preview.toDataURL("image/png"));
    if (storage.set(libraryKey(), library)) toast("Эффект сохранён");
    renderLibrary();
  } catch (error) {
    toast(error.message);
  } finally {
    event.target.value = "";
  }
};

document.addEventListener("click", async (event) => {
  if (!user) return;
  const useIndex = event.target.dataset.use;
  const deleteIndex = event.target.dataset.del;

  if (useIndex !== undefined) {
    try {
      state.overlay = await loadImage(getLibrary()[Number(useIndex)]);
      renderEditor();
    } catch (error) {
      toast(error.message);
    }
    return;
  }

  if (deleteIndex !== undefined) {
    const library = getLibrary();
    library.splice(Number(deleteIndex), 1);
    storage.set(libraryKey(), library);
    state.overlay = null;
    renderLibrary();
    renderEditor();
  }
});

function ordersKey() {
  return "orders:" + user.mail;
}

function getOrders() {
  if (!user) return [];
  const orders = storage.get(ordersKey(), []);
  return Array.isArray(orders) ? orders : [];
}

function nextOrderId(orders) {
  const maxId = orders.reduce((max, order) => Math.max(max, Number(order.id) || 0), 1000);
  return maxId + 1;
}

$("#send").onclick = () => {
  if (!state.image) return toast("Сначала загрузите фото");
  if (!user) {
    toast("Войдите, чтобы отправить заказ");
    location.hash = "#cabinet";
    return;
  }

  const [width, height] = getCanvasSize();
  const thumbnail = document.createElement("canvas");
  thumbnail.width = THUMB_WIDTH;
  thumbnail.height = Math.round((THUMB_WIDTH * height) / width);
  thumbnail.getContext("2d").drawImage(canvas, 0, 0, thumbnail.width, thumbnail.height);

  const orders = getOrders();
  const order = {
    id: nextOrderId(orders),
    date: new Date().toLocaleString("ru-RU"),
    fmt: FORMATS[state.formatIndex].label,
    paper: $("#paper").selectedOptions[0].text,
    qty: getQty(),
    recv: $("#recv").value,
    note: $("#note").value.trim(),
    sum: $("#price").textContent,
    fx: EFFECTS[state.effect].name,
    thumb: thumbnail.toDataURL("image/jpeg", JPEG_QUALITY_THUMB),
    status: "Принят",
  };

  orders.unshift(order);
  if (!storage.set(ordersKey(), orders)) return;

  toast(`Заказ №${order.id} принят`);
  location.hash = "#orders";
};

$("#dl").onclick = () => {
  if (!state.image) return toast("Сначала загрузите фото");
  const link = document.createElement("a");
  link.download = "maket.jpg";
  link.href = canvas.toDataURL("image/jpeg", JPEG_QUALITY_DOWNLOAD);
  link.click();
};

function renderOrders() {
  const element = $("#ordList");

  if (!user) {
    element.innerHTML =
      '<p class="empty">Чтобы увидеть заказы, <a href="#cabinet">войдите</a>.</p>';
    return;
  }

  const orders = getOrders();
  if (!orders.length) {
    element.innerHTML =
      '<p class="empty">Заказов пока нет.</p>';
    return;
  }

  element.innerHTML = orders
    .map((order) => {
      const thumbSource = order.thumb || order.th || "";
      const thumb = /^data:image\//.test(thumbSource) ? thumbSource : "";
      const status = order.status || order.st || "Принят";
      const note = order.note ? `<br>${escapeHtml(order.note)}` : "";

      return (
        `<div class="ord"><img src="${thumb}" alt="Фото заказа ${escapeHtml(order.id)}">` +
        `<div><b>Заказ №${escapeHtml(order.id)}</b> · ${escapeHtml(order.sum)}<br>` +
        `<small>${escapeHtml(order.fmt)}, ${escapeHtml(order.paper)}, ${escapeHtml(order.qty)} шт., ` +
        `эффект: ${escapeHtml(order.fx)}<br>${escapeHtml(order.recv)} · ${escapeHtml(order.date)}${note}</small></div>` +
        `<span class="st">${escapeHtml(status)}</span></div>`
      );
    })
    .join("");
}

const ROUTES = ["editor", "orders", "cabinet"];

function renderRoute() {
  const requested = location.hash.slice(1);
  const route = ROUTES.includes(requested) ? requested : "editor";

  ROUTES.forEach((name) => {
    $("#v-" + name).hidden = name !== route;
  });

  document.querySelectorAll("nav a").forEach((link) => link.removeAttribute("aria-current"));
  const currentLink = document.querySelector(`nav a[href="#${route}"]`);
  if (currentLink) currentLink.setAttribute("aria-current", "page");

  $("#navCab").textContent = user ? user.name : "Войти";
  $("#authBox").hidden = !!user;
  $("#cabBox").hidden = !user;
  if (user) {
    $("#cabName").textContent = user.name;
    $("#cabMail").textContent = user.mail;
  }

  renderLibrary();
  renderOrders();
  if (route === "editor") renderEditor();
}

addEventListener("hashchange", renderRoute);
renderRoute();
