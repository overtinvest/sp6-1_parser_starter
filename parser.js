// Парсер страницы: собирает данные из DOM в структуру { meta, product, suggested, reviews }

const CURRENCY_CODES = {
  "$": "USD",
  "€": "EUR",
  "₽": "RUB",
};

function parsePage() {
  return {
    meta: parseMeta(),
    product: parseProduct(),
    suggested: parseSuggestedItems(),
    reviews: parseReviews(),
  };
}

// --- Метаданные страницы ---

function parseMeta() {
  return {
    title: cleanTitle(document.title),
    description: metaContent('meta[name="description"]'),
    keywords: metaContent('meta[name="keywords"]')
      .split(",")
      .map((keyword) => keyword.trim()),
    language: document.documentElement.lang || "en",
    opengraph: parseOpenGraph(),
  };
}

// Заголовок страницы имеет вид «Название — Имя сайта», оставляем только название
function cleanTitle(title) {
  return title.split("—").shift().trim();
}

function metaContent(selector) {
  const meta = document.querySelector(selector);
  return meta?.getAttribute("content") || "";
}

function parseOpenGraph() {
  return ["title", "image", "type"].reduce((opengraph, key) => {
    const value = metaContent(`meta[property="og:${key}"]`);
    opengraph[key] = key === "title" ? cleanTitle(value) : value;
    return opengraph;
  }, {});
}

// --- Товар ---

function parseProduct() {
  const product = document.querySelector(".product");

  return {
    id: product?.dataset.id || "",
    name: document.querySelector(".product h1")?.textContent || "",
    isLiked:
      document.querySelector(".product .preview .like")?.classList.contains("active") || false,
    tags: parseTags(),
    ...parsePrice(document.querySelector(".product .price")),
    properties: parseProperties(),
    description: cleanDescription(),
    images: parseImages(),
  };
}

// Ветки: color кодирует тип — green=категория, blue=название, red=скидка
function parseTags() {
  return {
    category: tagTexts("green"),
    discount: tagTexts("red"),
    label: tagTexts("blue"),
  };
}

function tagTexts(color) {
  const tags = document.querySelectorAll(`.about .tags .${color}`);
  return [...tags].map((tag) => tag.textContent.trim());
}

// Структура блока цены: текст «₽50», затем (если есть скидка) старая цена в <span>
function parsePrice(priceElement) {
  const priceText = priceElement?.childNodes[0]?.textContent.trim() || "";

  if (!priceText) {
    return {
      price: undefined,
      oldPrice: undefined,
      discount: undefined,
      discountPercent: undefined,
      currency: undefined,
    };
  }

  const hasOldPrice = Boolean(priceElement.children.length);
  const price = parseFloat(priceText.slice(1));
  const oldPrice = hasOldPrice
    ? parseFloat(priceElement.childNodes[1].textContent.trim().slice(1))
    : 0;

  return {
    price,
    oldPrice,
    discount: oldPrice ? oldPrice - price : 0,
    discountPercent: oldPrice ? `${(100 - (price / oldPrice) * 100).toFixed(2)}%` : "0%",
    currency: currencyCode(priceText[0]),
  };
}

function currencyCode(symbol) {
  return CURRENCY_CODES[symbol] || symbol;
}

function parseProperties() {
  const rows = document.querySelectorAll(".about .properties li");
  return Object.fromEntries(
    [...rows]
      .map((row) => [row.children[0]?.textContent.trim(), row.children[1]?.textContent.trim()])
      .filter(([key]) => key)
  );
}

// Сохраняем разметку, но удаляем все атрибуты у вложенных тегов
function cleanDescription() {
  const description = document.querySelector(".about .description");
  if (!description) {
    return "";
  }
  const clone = description.cloneNode(true);
  clone.querySelectorAll("*").forEach((element) =>
    [...element.attributes].forEach((attribute) => element.removeAttribute(attribute.name))
  );
  return clone.innerHTML.trim();
}

// Порядок сохранён: первый превью — тот, что показан по умолчанию
function parseImages() {
  const images = document.querySelectorAll(".preview nav img");
  return [...images].map((image) => ({
    preview: image.src || "",
    full: image.dataset.src || "",
    alt: image.alt || "",
  }));
}

// --- Рекомендуемые товары ---

function parseSuggestedItems() {
  const items = document.querySelectorAll(".suggested .items article");
  return [...items].map((item) => {
    const priceText = item.querySelector("b")?.textContent.trim();
    return {
      name: item.querySelector("h3")?.textContent || "",
      description: item.querySelector("p")?.textContent || "",
      image: item.querySelector("img")?.src || "",
      price: priceText?.slice(1),
      currency: CURRENCY_CODES[priceText?.[0]],
    };
  });
}

// --- Отзывы ---

function parseReviews() {
  const reviews = document.querySelectorAll(".reviews .items article");
  return [...reviews].map((review) => ({
    rating: review.querySelectorAll(".rating span.filled").length,
    author: {
      avatar: review.querySelector(".author img")?.src || "",
      name: review.querySelector(".author span")?.textContent || "",
    },
    title: review.querySelector("h3")?.textContent || "",
    description: review.querySelector("p")?.textContent || "",
    date: formatDate(review.querySelector(".author i")?.textContent || ""),
  }));
}

// Дата в разметке: «15/09/2024», в результате: «15.09.2024»
function formatDate(dateText) {
  return dateText.replaceAll("/", ".");
}
