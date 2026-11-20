/* Каталог магазина. Этот файл пишет админка: gafarov.shop/admin → «Товары».
   Правки руками перезапишутся при следующем сохранении из админки. Поля товара описаны в index.html. */
const PRODUCTS = /*json*/[
  {
    "id": "tee-black",
    "type": "tee",
    "icon": "tee-boxy",
    "name": "NO POLITICS crop distress t-shirts black",
    "price": 990,
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "soldOut": [],
    "tag": "Мало",
    "colors": [
      "Чёрный"
    ],
    "photos": [
      "assets/items/tee-black-1.webp",
      "assets/items/tee-black-2.webp",
      "assets/items/tee-black-model.webp",
      "assets/items/tees-duo-model.webp"
    ],
    "preview": [
      "assets/items/tee-black-1.webp",
      "assets/items/tee-black-model.webp"
    ],
    "desc": "",
    "specs": []
  },
  {
    "id": "tee-white",
    "type": "tee",
    "icon": "tee-boxy",
    "name": "NO POLITICS crop distress t-shirts white",
    "price": 990,
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "soldOut": [],
    "tag": "",
    "colors": [
      "Белый"
    ],
    "photos": [
      "assets/items/tee-white-1.webp",
      "assets/items/tee-white-2.webp",
      "assets/items/tee-white-model.webp",
      "assets/items/tees-duo-model.webp"
    ],
    "preview": [
      "assets/items/tee-white-1.webp",
      "assets/items/tee-white-model.webp"
    ],
    "desc": "",
    "specs": []
  },
  {
    "id": "jeans-blue",
    "type": "jeans",
    "icon": "jeans",
    "name": "NO POLITICS bootcut jeans blue",
    "price": 2990,
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "soldOut": [],
    "tag": "",
    "colors": [
      "Синий"
    ],
    "photos": [
      "assets/items/jeans-blue-1.webp?v=2",
      "assets/items/jeans-blue-2.webp?v=2",
      "assets/items/jeans-blue-model-1.webp",
      "assets/items/jeans-blue-model-2.webp",
      "assets/items/jeans-blue-model-3.webp"
    ],
    "preview": [
      "assets/items/jeans-blue-1.webp?v=2",
      "assets/items/jeans-blue-model-1.webp"
    ],
    "desc": "",
    "specs": []
  },
  {
    "id": "hoodie-grey",
    "type": "hoodie",
    "icon": "sweater",
    "name": "NO POLITICS distress hoodie grey",
    "price": 2590,
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "soldOut": [],
    "tag": "",
    "colors": [
      "Серый"
    ],
    "photos": [
      "assets/items/hoodie-grey-1.webp",
      "assets/items/hoodie-grey-2.webp",
      "assets/items/hoodie-grey-model.webp"
    ],
    "preview": [
      "assets/items/hoodie-grey-1.webp",
      "assets/items/hoodie-grey-model.webp"
    ],
    "desc": "",
    "specs": []
  }
]/*json*/;

/* оттенки кружков рядом с названием цвета */
const COLORS = /*json*/{
  "Чёрный": "#141412",
  "Белый": "#ffffff",
  "Синий": "#34507a",
  "Серый": "#a6a6a2"
}/*json*/;

/* разделы каталога: в меню, подвале и фильтре */
const CATEGORIES = /*json*/{
  "tee": "Футболки",
  "jeans": "Джинсы",
  "hoodie": "Худи"
}/*json*/;
