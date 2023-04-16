// ==========================================================================
// GLOBAL VARIABLES

// Default to not showing debug messages in the console
let report = console.log.bind(window.console);
let error = console.error.bind(window.console);

// Number of miliseconds to wait before retrying something
const retryIn = 50;

// Maximun number of times we should retry something
const retryAttempts = 100;

// Add nojank style to html tag
var htmlEl = document.getElementsByTagName("html")[0];
htmlEl.classList.add("simplify");

// The attribute used on wrappers around cards
let cardSelector, cardAttr;

// ==========================================================================
// UTILITIES

// Shorthand for getting first matching element; returns Node
const get = (selector, parent = "") => {
  if (parent === "") {
    return document.querySelector(selector);
  } else if (parent instanceof Node) {
    return parent.querySelector(selector);
  } else if (parent instanceof String) {
    return document.querySelector(`${parent} ${selector}`);
  } else {
    error("get() called with undefined parent.", selector, parent);
    return false;
  }
};

// Shorthand for getting elements; returns NodeList
const gets = (selector, parent = "") => {
  if (parent === "") {
    return document.querySelectorAll(selector);
  } else if (parent instanceof Node) {
    return parent.querySelectorAll(selector);
  } else if (parent instanceof String) {
    return document.querySelector(`${parent} ${selector}`);
  } else {
    error("gets() called with undefined parent.", selector, parent);
    return false;
  }
};

// Shorthand for seeing if an element exists
const exists = (selector, parent = "") => {
  if (parent === "") {
    // return document.querySelectorAll(selector).length > 0;
    return document.body.contains(document.querySelector(selector));
  } else if (parent instanceof Node) {
    return document.body.contains(parent.querySelector(selector));
  } else if (typeof parent === "string") {
    return document.body.contains(document.querySelector(`${parent} ${selector}`));
  } else {
    error("exists() called with undefined parent.", selector, parent);
    return null;
  }
};

// Make and return element(s) for appending to the DOM
const make = (selector, ...args) => {
  const attrs = typeof args[0] === "object" && !(args[0] instanceof HTMLElement) ? args.shift() : {};

  let classes = selector.split(".");
  if (classes.length > 0) selector = classes.shift();
  if (classes.length) attrs.className = classes.join(" ");

  let id = selector.split("#");
  if (id.length > 0) selector = id.shift();
  if (id.length) attrs.id = id[0];

  const node = document.createElement(selector.length > 0 ? selector : "div");
  for (let prop in attrs) {
    if (attrs.hasOwnProperty(prop) && attrs[prop] != undefined) {
      if (prop.indexOf("data-") == 0) {
        let dataProp = prop.substring(5).replace(/-([a-z])/g, function (g) {
          return g[1].toUpperCase();
        });
        node.dataset[dataProp] = attrs[prop];
      } else {
        node[prop] = attrs[prop];
      }
    }
  }

  const append = (child) => {
    if (Array.isArray(child)) return child.forEach(append);
    if (typeof child == "string") child = document.createTextNode(child);
    if (child) node.appendChild(child);
  };
  args.forEach(append);
  return node;
};

// Simulate clicking on an element
const clickOn = (element, withShift = false) => {
  if (!element) {
    report("clickOn failed - element not found.");
    return false;
  }

  const dispatchMouseEvent = (target, type) => {
    const event = new MouseEvent(type, {
      view: window,
      bubbles: true,
      cancelable: true,
      shiftKey: withShift,
    });
    target.dispatchEvent(event);
  };
  dispatchMouseEvent(element, "mouseover");
  dispatchMouseEvent(element, "mousedown");
  dispatchMouseEvent(element, "click");
  dispatchMouseEvent(element, "mouseup");
  dispatchMouseEvent(element, "mouseout");
  // report("Clicked on", element);
};

// Detect if the element is on screen
const elementInView = (el, partiallyVisible = true) => {
  const { top, left, bottom, right } = el.getBoundingClientRect();
  const { innerHeight, innerWidth } = window;
  return partiallyVisible
    ? ((top > 0 && top < innerHeight) || (bottom > 0 && bottom < innerHeight)) &&
        ((left > 0 && left < innerWidth) || (right > 0 && right < innerWidth))
    : top >= 0 && left >= 0 && bottom <= innerHeight && right <= innerWidth;
};

// ==========================================================================
// HANDLERS

// Add keyboard shortcut for toggling on/off custom style
const handleKeydown = (e) => {
  let noModifierKey = !e.altKey && !e.shiftKey && !e.metaKey && !e.ctrlKey;
  let altKeyOnly = e.altKey && !e.shiftKey && !e.metaKey && !e.ctrlKey;
  // let shiftKeyOk = !e.altKey && !e.metaKey && !e.ctrlKey;
  // let cmdKey = isMac ? e.metaKey : e.ctrlKey;
  // let ctrlKey = isMac ? e.ctrlKey : e.metaKey; // Flip to Win key for Windows so I make sure it isn't pressed
  // let cmdKeyOnly = cmdKey && !ctrlKey && !e.altKey && !e.shiftKey;
  // let shiftKeyOnly = e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey;
  // let cmdShiftKeys = cmdKey && e.shiftKey && !ctrlKey && !e.altKey;

  // If Option+S or Alt+S was pressed, toggle Simplify on/off
  if (altKeyOnly && e.code === "KeyS") {
    document.documentElement.classList.toggle("simplify");
    e.preventDefault();
    return;
  }

  if (e.code === "Escape" && noModifierKey) {
    const searchFocused = document.activeElement?.enterKeyHint === "search";
    const cancelButton = get("button[type='button']:has(+ button[type='submit'])");

    if (searchFocused) {
      document.activeElement.blur();
      e.preventDefault();
      return;
    }

    if (cancelButton) {
      clickOn(cancelButton);
      document.activeElement.blur();
      e.preventDefault();
      return;
    }

    // Else, remove keyboard focus on cards
    get("main").classList.remove("usingKeys");
  }

  // DON'T GO ANY FURTHER IF COMPOSING
  let composing = e.target.isContentEditable || e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA";
  if (composing) return;

  // Next post
  if (e.code === "KeyJ" && noModifierKey) {
    goNextPrev("next");
    e.preventDefault();
    return;
  }

  // Previous post
  if (e.code === "KeyK" && noModifierKey) {
    goNextPrev("prev");
    e.preventDefault();
    return;
  }

  // Compose new post
  if (e.code === "KeyC" && noModifierKey) {
    newPost();
    e.preventDefault();
    return;
  }

  // Open and focus search
  if (e.code === "Slash" && noModifierKey) {
    get("aside input[enterkeyhint]").focus();
    e.preventDefault();
    return;
  }

  // Like focused post
  if (e.code === "KeyL" && noModifierKey) {
    clickOn(get(".focusedCard button:has(path[d^='M5.65769 2.0083C3.58269'])"));
    e.preventDefault();
    return;
  }

  // Reply to focused message
  if (e.code === "Enter" && noModifierKey) {
    clickOn(get(".focusedCard button:has(path[d^='M17.8004 9.72508C17'])"));
    e.preventDefault();
    return;
  }

  // Repost focused message
  if (e.code === "KeyR" && noModifierKey) {
    clickOn(get(".focusedCard li button:has(path[d^='M12.0499 8.14987L15'])"));
    e.preventDefault();
    return;
  }

  // Repost focused message
  if (e.code === "KeyQ" && noModifierKey) {
    clickOn(get(".focusedCard li button:has(path[d^='M17.7083 17.5833H12'])"));
    e.preventDefault();
    return;
  }
};
window.addEventListener("keydown", handleKeydown, false);

const newPost = () => {
  if (location.pathname !== "/") {
    location.href = "https://t2.social/?compose=true";
  } else {
    const composeOuter = get(".relative.mb-3 > div");
    const composer = get(".relative.mb-3 textarea");

    composeOuter.classList.add("z-10");
    clickOn(composer);
    composer.focus();
  }
};

const updateCardAttr = () => {
  const currentAttr = get("main > hr + div:has(> .card)")?.attributes[0]?.name;
  if (currentAttr) {
    cardAttr = currentAttr;
    cardSelector = `main div[${currentAttr}]:has(> .card)`;
  }
  if (!exists(".focusedCard")) {
    get(cardSelector).classList.add("focusedCard");
  }
};

// function addCSS(newCss, pos) {
//   let position = pos ? pos : css.sheet.cssRules.length;
//   css.sheet.insertRule(newCss, position);
//   report("CSS added: " + css.sheet.cssRules[position].cssText);
// }

const goNextPrev = (dir) => {
  updateCardAttr();

  let currentCard = get(".focusedCard");
  let nextCard;
  let keepLooking = true;

  // Update the focusedCard first if no longer in view
  if (!currentCard || !elementInView(currentCard)) {
    const cards = gets(cardSelector);

    for (const card of cards) {
      if (elementInView(card)) {
        currentCard.classList.remove("focusedCard");
        currentCard = card;
        currentCard.classList.add("focusedCard");
        break;
      }
    }
  }

  nextCard = currentCard;
  keepLooking = true;
  while (keepLooking) {
    nextCard = dir === "next" ? nextCard.nextSibling : nextCard.previousSibling;
    if (!nextCard) {
      keepLooking = false;
      report("Couldn't find another card");
      return;
    }
    if (nextCard.attributes && nextCard.attributes[0] && nextCard.attributes[0].name === cardAttr) {
      keepLooking = false;
    }
  }

  // Move focused class name
  currentCard.classList.remove("focusedCard");
  nextCard.classList.add("focusedCard");
  get("main").classList.add("usingKeys");

  // Scroll to focused card
  document.documentElement.scrollTo({ top: nextCard.offsetTop - 48, behavior: "smooth" });
};

// ==========================================================================
// INIT

const init = () => {
  report("Simplify T2 loaded");

  // Add compose button
  const composeButton = make("div.compose");
  composeButton.addEventListener("click", newPost);
  get("nav").appendChild(composeButton);

  // Add style sheet
  // document.head.appendChild(make("style#simplifyCss", { type: "text/css" }));
  // simplifyCSS = get("style#simplifyCss")?.sheet;

  // Initialize the attribute used to find cards
  updateCardAttr();
};
window.addEventListener("load", init, false);
