// Prototype Speedfood — démo cliquable, sans backend.
// Toute donnée est stockée en localStorage. Rien n'est envoyé à un serveur.

seedIfNeeded();

const app = document.getElementById("app");
const cartCountEl = document.getElementById("cart-count");

const STATUS_ORDER = ["en_attente", "acceptee", "prete", "terminee"];
const STATUS_LABELS = {
  en_attente: "En attente",
  acceptee: "Acceptée",
  refusee: "Refusée",
  prete: "Prête",
  terminee: "Terminée",
  annulee: "Annulée",
};

function router() {
  const hash = location.hash || "#/";
  updateNavActive(hash);
  updateCartCount();

  const resultsMatch = hash.match(/^#\/resultats/);
  const restoMatch = hash.match(/^#\/restaurant\/([\w-]+)$/);
  const trackMatch = hash.match(/^#\/suivi\/([\w-]+)$/);

  if (hash === "#/" || hash === "") return renderHome();
  if (resultsMatch) return renderResults();
  if (restoMatch) return renderRestaurant(restoMatch[1]);
  if (hash === "#/panier") return renderCart();
  if (hash === "#/commande") return renderCheckout();
  if (hash === "#/resume") return renderSummary();
  if (trackMatch) return renderTracking(trackMatch[1]);
  if (hash === "#/restaurant-console") return renderConsole();
  if (hash === "#/mes-commandes") return renderMyOrders();
  if (hash === "#/favoris") return renderFavoris();

  renderNotFound();
}

function updateNavActive(hash) {
  const isConsole = hash.startsWith("#/restaurant-console");
  const isCart = hash === "#/panier";
  const isCommandes = hash.startsWith("#/mes-commandes") || hash.startsWith("#/suivi/");
  const isFavoris = hash.startsWith("#/favoris");
  document.querySelectorAll("[data-nav]").forEach((a) => {
    const nav = a.dataset.nav;
    const active = isConsole ? nav === "restaurant" : isCommandes ? nav === "commandes" : isFavoris ? nav === "favoris" : nav === "client";
    a.classList.toggle("active", active);
  });
  document.querySelectorAll("[data-tab]").forEach((a) => {
    const tab = a.dataset.tab;
    const active = isConsole ? tab === "restaurant" : isCart ? tab === "panier" : isCommandes ? tab === "commandes" : tab === "client";
    a.classList.toggle("active", active);
  });
}

function updateCartCount() {
  const cart = getCart();
  const count = cart.lignes.reduce((s, l) => s + l.quantite, 0);
  if (cartCountEl.textContent !== String(count)) {
    cartCountEl.textContent = count;
    cartCountEl.classList.remove("bump");
    void cartCountEl.offsetWidth; // relance l'animation
    cartCountEl.classList.add("bump");
  }

  const bottomCount = document.getElementById("bottom-cart-count");
  if (bottomCount) {
    bottomCount.textContent = count;
    bottomCount.hidden = count === 0;
  }

  renderStickyCartBar(cart);
  updateFavCount();
}

function updateFavCount() {
  const favCountEl = document.getElementById("fav-count");
  if (!favCountEl) return;
  const count = getFavoris().length;
  favCountEl.textContent = count;
  favCountEl.hidden = count === 0;
}

function renderStickyCartBar(cart) {
  const bar = document.getElementById("sticky-cart-bar");
  if (!bar) return;

  const onRestaurantPage = /^#\/restaurant\/[\w-]+$/.test(location.hash);
  const hideOn = ["#/panier", "#/commande", "#/resume", "#/restaurant-console"];
  const shouldHide = !cart.restaurantId || cart.lignes.length === 0 || hideOn.some((h) => location.hash.startsWith(h)) || !onRestaurantPage;

  if (shouldHide) {
    bar.hidden = true;
    bar.innerHTML = "";
    return;
  }

  const count = cart.lignes.reduce((s, l) => s + l.quantite, 0);
  const total = cart.lignes.reduce((s, l) => s + l.prix * l.quantite, 0);

  bar.hidden = false;
  bar.innerHTML = `
    <span class="label"><span class="count-chip">${count}</span> Voir le panier</span>
    <span class="total">${formatGNF(total)}</span>
  `;
  bar.onclick = () => navigate("#/panier");
}

function navigate(hash) {
  location.hash = hash;
}

window.addEventListener("hashchange", router);
document.getElementById("cart-btn").addEventListener("click", () => navigate("#/panier"));
document.getElementById("fav-btn").addEventListener("click", () => navigate("#/favoris"));

// ---------- PUB-01 / PUB-02 : accueil + résultats ----------

let filtreState = { q: "", categorie: null, quartier: null, ouvertSeulement: false };

function renderHome() {
  filtreState = { q: "", categorie: null, quartier: null, ouvertSeulement: false };
  renderDiscovery("Découvrez les restaurants de Conakry");
}

function renderResults() {
  renderDiscovery("Résultats");
}

function renderDiscovery(titre) {
  const restaurants = getRestaurants();

  app.innerHTML = `
    <h1>${titre}</h1>
    <div class="search-row">
      ${UI_ICONS.recherche}
      <input type="search" id="search-input" placeholder="Chercher un restaurant ou un plat" value="${escapeHtml(filtreState.q)}" aria-label="Rechercher" />
    </div>
    <div class="chip-row" id="chip-etat"></div>
    <div class="chip-row" id="chip-categories"></div>
    <div class="chip-row" id="chip-quartiers"></div>
    <div id="grid-restos"></div>
  `;

  const chipEtat = document.getElementById("chip-etat");
  chipEtat.innerHTML = `<button class="chip ${filtreState.ouvertSeulement ? "active" : ""}" data-etat="ouvert">${UI_ICONS.horloge} Ouvert maintenant</button>`;
  chipEtat.querySelector("[data-etat]").addEventListener("click", () => {
    filtreState.ouvertSeulement = !filtreState.ouvertSeulement;
    navigate("#/resultats");
    renderResults();
  });

  const chipCat = document.getElementById("chip-categories");
  chipCat.innerHTML = CATEGORIES.map(
    (c) => `<button class="chip ${filtreState.categorie === c ? "active" : ""}" data-cat="${c}">${c}</button>`
  ).join("");

  const chipQuart = document.getElementById("chip-quartiers");
  chipQuart.innerHTML = QUARTIERS.map(
    (q) => `<button class="chip ${filtreState.quartier === q ? "active" : ""}" data-quartier="${q}">${q}</button>`
  ).join("");

  chipCat.querySelectorAll("[data-cat]").forEach((btn) =>
    btn.addEventListener("click", () => {
      filtreState.categorie = filtreState.categorie === btn.dataset.cat ? null : btn.dataset.cat;
      navigate("#/resultats");
      renderResults();
    })
  );

  chipQuart.querySelectorAll("[data-quartier]").forEach((btn) =>
    btn.addEventListener("click", () => {
      filtreState.quartier = filtreState.quartier === btn.dataset.quartier ? null : btn.dataset.quartier;
      navigate("#/resultats");
      renderResults();
    })
  );

  const searchInput = document.getElementById("search-input");
  searchInput.addEventListener("input", (e) => {
    filtreState.q = e.target.value;
    if (location.hash !== "#/resultats") navigate("#/resultats");
    renderRestoGrid(restaurants);
  });

  renderRestoGrid(restaurants);
}

function restoCardHtml(r) {
  const style = categoryStyle(r.categorie);
  const fav = estFavori(r.id);
  return `
    <div class="card-resto-wrap">
    <a class="card-resto" href="#/restaurant/${r.id}">
      <div class="cover" style="background:${style.couleur}">${style.icon}</div>
      <div class="body">
        <h3>${r.nom}</h3>
        <p class="meta-line">${r.categorie} · ${r.quartier}</p>
        <div class="rating-row">
          <span class="rating-pill">${UI_ICONS.etoile} ${r.note.toFixed(1)}</span>
          <span class="dot-sep">·</span>
          <span class="eta-pill">${UI_ICONS.minuteur} ${r.tempsPreparation}</span>
        </div>
        <div class="badges">
          <span class="badge ${r.ouvert ? "badge-ouvert" : "badge-ferme"}">${r.ouvert ? "Ouvert" : "Fermé"}</span>
          <span class="badge badge-demo">Démo</span>
        </div>
      </div>
    </a>
    <button class="fav-btn" data-fav="${r.id}" aria-pressed="${fav}" aria-label="${fav ? "Retirer des favoris" : "Ajouter aux favoris"}">${fav ? UI_ICONS.coeurPlein : UI_ICONS.coeurVide}</button>
    </div>`;
}

function wireFavButtons(container, onToggle) {
  container.querySelectorAll("[data-fav]").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const nowFav = toggleFavori(btn.dataset.fav);
      updateFavCount();
      if (onToggle) onToggle(nowFav, btn);
      else {
        btn.innerHTML = nowFav ? UI_ICONS.coeurPlein : UI_ICONS.coeurVide;
        btn.setAttribute("aria-pressed", String(nowFav));
        btn.setAttribute("aria-label", nowFav ? "Retirer des favoris" : "Ajouter aux favoris");
      }
    })
  );
}

function renderFavoris() {
  const favoris = getFavoris();
  const restaurants = getRestaurants().filter((r) => favoris.includes(r.id));

  app.innerHTML = `
    <h1>Vos favoris</h1>
    <p class="meta-line" style="margin-bottom: var(--space-5)">Conservés dans ce navigateur uniquement (démo, sans compte).</p>
    <div id="favoris-grid"></div>
  `;

  const grid = document.getElementById("favoris-grid");

  if (restaurants.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        ${UI_ICONS.coeurVide}
        <p>Vous n'avez pas encore de restaurant favori.</p>
        <a class="btn btn-primary" href="#/">Découvrir les restaurants</a>
      </div>`;
    return;
  }

  grid.innerHTML = `<div class="grid">${restaurants.map(restoCardHtml).join("")}</div>`;

  wireFavButtons(grid, () => renderFavoris());
}

function renderRestoGrid(restaurants) {
  const grid = document.getElementById("grid-restos");
  const q = filtreState.q.trim().toLowerCase();

  const filtres = restaurants.filter((r) => {
    if (filtreState.ouvertSeulement && !r.ouvert) return false;
    if (filtreState.categorie && r.categorie !== filtreState.categorie) return false;
    if (filtreState.quartier && r.quartier !== filtreState.quartier) return false;
    if (q) {
      const hay = (r.nom + " " + r.categorie + " " + r.menu.map((m) => m.nom).join(" ")).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (filtres.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        ${UI_ICONS.vide}
        <p>Aucun restaurant ne correspond à votre recherche.</p>
        <button class="btn btn-secondary" id="reset-filters">Réinitialiser les filtres</button>
      </div>`;
    document.getElementById("reset-filters").addEventListener("click", () => {
      filtreState = { q: "", categorie: null, quartier: null };
      navigate("#/");
    });
    return;
  }

  grid.innerHTML = `<div class="grid">${filtres.map(restoCardHtml).join("")}</div>`;

  wireFavButtons(grid, () => renderRestoGrid(getRestaurants()));
}

// ---------- PUB-03 / PUB-04 : fiche restaurant + menu ----------

function renderRestaurant(id) {
  const restaurants = getRestaurants();
  const resto = restaurants.find((r) => r.id === id);

  if (!resto) return renderNotFound();

  const cart = getCart();
  const style = categoryStyle(resto.categorie);

  app.innerHTML = `
    <a href="#/" class="link-back">${UI_ICONS.retour} Retour aux restaurants</a>
    <div class="resto-hero" style="background:${style.couleur}">${style.icon}</div>
    <div class="resto-header">
      <h1>${resto.nom}</h1>
      <p class="meta-line">${resto.categorie} · ${resto.quartier}</p>
      <p class="meta-line">${resto.horaires}</p>
      <div class="rating-row">
        <span class="rating-pill">${UI_ICONS.etoile} ${resto.note.toFixed(1)}</span>
        <span class="dot-sep">·</span>
        <span class="eta-pill">${UI_ICONS.minuteur} ${resto.tempsPreparation}</span>
      </div>
      <div class="badges">
        <span class="badge ${resto.ouvert ? "badge-ouvert" : "badge-ferme"}">${resto.ouvert ? "Ouvert" : "Fermé"}</span>
        <span class="badge badge-demo">Démo</span>
      </div>
      ${resto.consignes ? `<p class="meta-line" style="margin-top:8px">${resto.consignes}</p>` : ""}
      <button class="fav-btn-inline" id="fav-toggle-detail" aria-pressed="${estFavori(resto.id)}">
        ${estFavori(resto.id) ? UI_ICONS.coeurPlein : UI_ICONS.coeurVide}
        <span>${estFavori(resto.id) ? "Dans vos favoris" : "Ajouter aux favoris"}</span>
      </button>
    </div>

    ${!resto.ouvert ? `<div class="banner-info">${UI_ICONS.info}<span>Ce restaurant est actuellement fermé. Vous pouvez consulter le menu mais pas commander.</span></div>` : ""}

    <div class="menu-section">
      <h3>Menu</h3>
      <div id="menu-list"></div>
    </div>
  `;

  document.getElementById("fav-toggle-detail").addEventListener("click", () => {
    toggleFavori(resto.id);
    renderRestaurant(resto.id);
  });

  const menuList = document.getElementById("menu-list");
  menuList.innerHTML = resto.menu
    .map((item) => {
      const ligneExistante = cart.restaurantId === resto.id ? cart.lignes.find((l) => l.itemId === item.id) : null;
      const qte = ligneExistante ? ligneExistante.quantite : 0;
      return `
      <div class="menu-item">
        <div class="info">
          <h4>${item.nom}</h4>
          <p>${item.description}</p>
          <p class="price">${formatGNF(item.prix)}</p>
          ${!item.disponible ? `<p class="field-error">Indisponible aujourd'hui</p>` : ""}
        </div>
        <div class="qty-control" data-item="${item.id}">
          ${
            !item.disponible || !resto.ouvert
              ? ""
              : qte === 0
              ? `<button class="btn btn-secondary" data-add="${item.id}">Ajouter</button>`
              : `
                <button class="step-btn" data-dec="${item.id}" aria-label="Retirer un ${item.nom}">−</button>
                <span aria-live="polite">${qte}</span>
                <button class="step-btn" data-inc="${item.id}" aria-label="Ajouter un ${item.nom}">+</button>
              `
          }
        </div>
      </div>`;
    })
    .join("");

  menuList.querySelectorAll("[data-add]").forEach((btn) =>
    btn.addEventListener("click", () => addToCart(resto, btn.dataset.add, 1))
  );
  menuList.querySelectorAll("[data-inc]").forEach((btn) =>
    btn.addEventListener("click", () => addToCart(resto, btn.dataset.inc, 1))
  );
  menuList.querySelectorAll("[data-dec]").forEach((btn) =>
    btn.addEventListener("click", () => addToCart(resto, btn.dataset.dec, -1))
  );
}

function addToCart(resto, itemId, delta) {
  const cart = getCart();

  if (cart.restaurantId && cart.restaurantId !== resto.id && cart.lignes.length > 0) {
    const confirmer = confirm(
      "Votre panier contient déjà des plats d'un autre restaurant. Voulez-vous le remplacer ? (Annuler pour revenir)"
    );
    if (!confirmer) return;
    cart.lignes = [];
  }

  cart.restaurantId = resto.id;
  const item = resto.menu.find((m) => m.id === itemId);
  let ligne = cart.lignes.find((l) => l.itemId === itemId);

  if (!ligne) {
    if (delta <= 0) return;
    ligne = { itemId, nom: item.nom, prix: item.prix, quantite: 0 };
    cart.lignes.push(ligne);
  }

  ligne.quantite += delta;
  if (ligne.quantite <= 0) {
    cart.lignes = cart.lignes.filter((l) => l.itemId !== itemId);
  }

  if (cart.lignes.length === 0) cart.restaurantId = null;

  saveCart(cart);
  renderRestaurant(resto.id);
  updateCartCount();
}

// ---------- PUB-05 / PUB-06 : panier ----------

function renderCart() {
  const cart = getCart();

  if (!cart.restaurantId || cart.lignes.length === 0) {
    app.innerHTML = `
      <h1>Votre panier</h1>
      <div class="empty-state">
        ${UI_ICONS.vide}
        <p>Votre panier est vide.</p>
        <a class="btn btn-primary" href="#/">Découvrir les restaurants</a>
      </div>`;
    return;
  }

  const resto = getRestaurants().find((r) => r.id === cart.restaurantId);
  const style = categoryStyle(resto.categorie);
  const sousTotal = cart.lignes.reduce((s, l) => s + l.prix * l.quantite, 0);

  app.innerHTML = `
    <a href="#/restaurant/${resto.id}" class="link-back">${UI_ICONS.retour} Continuer mes achats chez ${resto.nom}</a>
    <h1>Votre panier</h1>
    <div class="cart-resto-header">
      <div class="cart-resto-avatar" style="background:${style.couleur}">${style.icon}</div>
      <div>
        <h3>${resto.nom}</h3>
        <span class="meta-line">${resto.categorie} · ${resto.quartier}</span>
      </div>
    </div>
    <div id="cart-lines"></div>
    <div class="totals-box">
      <div class="totals-row"><span>Sous-total</span><span>${formatGNF(sousTotal)}</span></div>
      <div class="banner-info banner-info-compact">${UI_ICONS.info}<span>Frais de livraison à confirmer par le restaurant</span></div>
      <div class="totals-row total"><span>Total</span><span>${formatGNF(sousTotal)}</span></div>
    </div>
    <button class="btn btn-primary btn-block" id="go-checkout">Continuer</button>
  `;

  const linesEl = document.getElementById("cart-lines");
  linesEl.innerHTML = cart.lignes
    .map(
      (l) => `
    <div class="cart-line">
      <div class="cart-line-info">
        <span class="cart-line-nom">${l.nom}</span>
        <span class="cart-line-prix">${formatGNF(l.prix)} l'unité</span>
      </div>
      <div class="qty-control">
        <button class="step-btn" data-dec-cart="${l.itemId}" aria-label="Retirer un ${l.nom}">−</button>
        <span aria-live="polite">${l.quantite}</span>
        <button class="step-btn" data-inc-cart="${l.itemId}" aria-label="Ajouter un ${l.nom}">+</button>
      </div>
      <span class="cart-line-total">${formatGNF(l.prix * l.quantite)}</span>
    </div>`
    )
    .join("");

  linesEl.querySelectorAll("[data-inc-cart]").forEach((btn) =>
    btn.addEventListener("click", () => updateCartLineQuantity(btn.dataset.incCart, 1))
  );
  linesEl.querySelectorAll("[data-dec-cart]").forEach((btn) =>
    btn.addEventListener("click", () => updateCartLineQuantity(btn.dataset.decCart, -1))
  );

  document.getElementById("go-checkout").addEventListener("click", () => navigate("#/commande"));
}

function updateCartLineQuantity(itemId, delta) {
  const cart = getCart();
  const ligne = cart.lignes.find((l) => l.itemId === itemId);
  if (!ligne) return;

  ligne.quantite += delta;
  if (ligne.quantite <= 0) {
    cart.lignes = cart.lignes.filter((l) => l.itemId !== itemId);
  }
  if (cart.lignes.length === 0) cart.restaurantId = null;

  saveCart(cart);
  updateCartCount();
  renderCart();
}

// ---------- PUB-07 : coordonnées et mode ----------

function renderCheckout() {
  const cart = getCart();
  if (!cart.restaurantId || cart.lignes.length === 0) return navigate("#/");

  const resto = getRestaurants().find((r) => r.id === cart.restaurantId);
  const saved = JSON.parse(sessionStorage.getItem("sf_checkout_draft") || "{}");
  const mode = saved.mode || "retrait";

  app.innerHTML = `
    <a href="#/panier" class="link-back">${UI_ICONS.retour} Retour au panier</a>
    <h1>Vos coordonnées</h1>
    <div class="mode-toggle">
      <button data-mode="retrait" class="${mode === "retrait" ? "active" : ""}">Retrait sur place</button>
      <button data-mode="livraison" class="${mode === "livraison" ? "active" : ""}">Livraison</button>
    </div>
    <form id="checkout-form">
      <div class="field">
        <label for="nom">Votre nom</label>
        <input type="text" id="nom" name="nom" value="${escapeHtml(saved.nom || "")}" required />
      </div>
      <div class="field">
        <label for="telephone">Numéro de téléphone</label>
        <input type="tel" id="telephone" name="telephone" placeholder="622 00 00 00" value="${escapeHtml(saved.telephone || "")}" required />
      </div>
      <div class="field" id="adresse-field" style="display:${mode === "livraison" ? "flex" : "none"}">
        <label for="adresse">Adresse de livraison</label>
        <input type="text" id="adresse" name="adresse" placeholder="Quartier, repère" value="${escapeHtml(saved.adresse || "")}" />
      </div>
      ${mode === "livraison" ? `<div class="banner-info">${UI_ICONS.info}<span>Frais de livraison estimés : ${formatGNF(FRAIS_LIVRAISON_ESTIME)}. Le restaurant confirmera le montant exact.</span></div>` : ""}
      <button type="submit" class="btn btn-primary btn-block">Voir le résumé</button>
    </form>
  `;

  let modeActuel = mode;
  document.querySelectorAll("[data-mode]").forEach((btn) =>
    btn.addEventListener("click", () => {
      modeActuel = btn.dataset.mode;
      document.querySelectorAll("[data-mode]").forEach((b) => b.classList.toggle("active", b === btn));
      document.getElementById("adresse-field").style.display = modeActuel === "livraison" ? "flex" : "none";
    })
  );

  document.getElementById("checkout-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target;
    const draft = {
      nom: form.nom.value.trim(),
      telephone: form.telephone.value.trim(),
      mode: modeActuel,
      adresse: modeActuel === "livraison" ? form.adresse.value.trim() : "",
    };

    if (!draft.nom || !draft.telephone) return;
    if (modeActuel === "livraison" && !draft.adresse) {
      alert("Merci de préciser une adresse pour la livraison.");
      return;
    }

    sessionStorage.setItem("sf_checkout_draft", JSON.stringify(draft));
    navigate("#/resume");
  });
}

// ---------- PUB-08 / PUB-09 / PUB-10 : résumé, envoi, confirmation ----------

function renderSummary() {
  const cart = getCart();
  const draft = JSON.parse(sessionStorage.getItem("sf_checkout_draft") || "{}");
  if (!cart.restaurantId || !draft.nom) return navigate("#/");

  const resto = getRestaurants().find((r) => r.id === cart.restaurantId);
  const sousTotal = cart.lignes.reduce((s, l) => s + l.prix * l.quantite, 0);

  app.innerHTML = `
    <a href="#/commande" class="link-back">${UI_ICONS.retour} Modifier mes coordonnées</a>
    <h1>Résumé de votre demande</h1>
    <div class="totals-box">
      <p><strong>${resto.nom}</strong></p>
      <div id="lines"></div>
      <div class="totals-row"><span>Sous-total</span><span>${formatGNF(sousTotal)}</span></div>
      ${
        draft.mode === "livraison"
          ? `<div class="totals-row"><span>Frais de livraison (à confirmer)</span><span>~ ${formatGNF(FRAIS_LIVRAISON_ESTIME)}</span></div>`
          : `<div class="totals-row"><span>Mode</span><span>Retrait sur place</span></div>`
      }
      <div class="totals-row total"><span>Total estimé</span><span>${formatGNF(sousTotal + (draft.mode === "livraison" ? FRAIS_LIVRAISON_ESTIME : 0))}</span></div>
    </div>
    <div class="banner-info">
      ${UI_ICONS.info}
      <span><strong>${draft.nom}</strong> · ${draft.telephone} ${draft.adresse ? `· ${draft.adresse}` : ""}</span>
    </div>
    <p class="meta-line">En envoyant cette demande, vous acceptez qu'elle soit transmise au restaurant. Ce n'est ni un paiement ni une commande confirmée : le restaurant doit d'abord l'accepter.</p>
    <button class="btn btn-primary btn-block" id="send-order">Envoyer la demande</button>
  `;

  document.getElementById("lines").innerHTML = cart.lignes
    .map((l) => `<div class="totals-row"><span>${l.quantite} × ${l.nom}</span><span>${formatGNF(l.prix * l.quantite)}</span></div>`)
    .join("");

  const sendBtn = document.getElementById("send-order");
  sendBtn.addEventListener("click", () => {
    sendBtn.disabled = true;
    sendBtn.textContent = "Envoi en cours…";
    setTimeout(() => submitOrder(resto, cart, draft, sousTotal), 500);
  });
}

function submitOrder(resto, cart, draft, sousTotal) {
  const orders = getOrders();
  const order = {
    id: genRef(),
    token: genToken(),
    restaurantId: resto.id,
    restaurantNom: resto.nom,
    client: { nom: draft.nom, telephone: draft.telephone, adresse: draft.adresse || null },
    mode: draft.mode,
    lignes: cart.lignes,
    sousTotal,
    fraisLivraisonEstime: draft.mode === "livraison" ? FRAIS_LIVRAISON_ESTIME : 0,
    statut: "en_attente",
    creeLe: new Date().toISOString(),
  };
  orders.unshift(order);
  saveOrders(orders);

  saveCart({ restaurantId: null, lignes: [] });
  sessionStorage.removeItem("sf_checkout_draft");
  updateCartCount();

  navigate(`#/suivi/${order.token}`);
}

// ---------- PUB-11 : suivi ----------

function renderTracking(token) {
  const order = getOrders().find((o) => o.token === token);
  if (!order) return renderNotFound();

  const currentIndex = STATUS_ORDER.indexOf(order.statut);
  const resto = getRestaurants().find((r) => r.id === order.restaurantId);
  const enCoursActif = order.statut === "en_attente" || order.statut === "acceptee" || order.statut === "prete";

  app.innerHTML = `
    <h1>Suivi de votre commande</h1>
    <p class="meta-line">Référence : <strong>${order.id}</strong> · ${order.restaurantNom}</p>
    ${resto && enCoursActif ? `<p class="meta-line">${UI_ICONS.minuteur} Préparation estimée : ${resto.tempsPreparation}</p>` : ""}

    <div class="status-timeline" id="status-track"></div>

    ${
      order.statut === "refusee"
        ? `<div class="banner-info">${UI_ICONS.info}<span>Le restaurant a refusé cette demande. Aucun paiement n'a été effectué.</span></div>`
        : order.statut === "annulee"
        ? `<div class="banner-info">${UI_ICONS.info}<span>Cette commande a été annulée.</span></div>`
        : order.statut === "en_attente"
        ? `<p class="meta-line">Cette demande n'est ni acceptée ni payée tant que le restaurant n'a pas confirmé.</p>`
        : order.statut === "acceptee"
        ? `<p class="meta-line">Le restaurant a accepté votre commande et va la préparer.</p>`
        : order.statut === "prete"
        ? `<p class="meta-line">Votre commande est prête. Le règlement se fait directement avec le restaurant.</p>`
        : `<p class="meta-line">Commande terminée. Merci d'avoir utilisé Speedfood.</p>`
    }

    <div class="totals-box">
      <div id="lines"></div>
      <div class="totals-row total"><span>Total estimé</span><span>${formatGNF(order.sousTotal + order.fraisLivraisonEstime)}</span></div>
    </div>

    <p class="meta-line">Astuce démo : ouvrez l'<a href="#/restaurant-console">espace restaurant</a> dans un autre onglet pour accepter ou refuser cette commande et voir ce suivi se mettre à jour (actualisez la page).</p>

    <div class="order-actions">
      <a class="btn btn-secondary" href="#/">Retour à l'accueil</a>
      <a class="btn btn-secondary" href="#/mes-commandes">Mes commandes</a>
    </div>
  `;

  const STATUS_ICONS = { en_attente: UI_ICONS.horloge, acceptee: UI_ICONS.check, prete: UI_ICONS.paquet, terminee: UI_ICONS.check };

  const track = document.getElementById("status-track");
  if (order.statut === "refusee" || order.statut === "annulee") {
    track.innerHTML = `
      <div class="node refused">
        <span class="dot">${UI_ICONS.croix}</span>
        <span class="label">${STATUS_LABELS[order.statut]}</span>
      </div>`;
  } else {
    track.innerHTML = STATUS_ORDER.map((s, i) => {
      let cls = "node";
      if (i < currentIndex) cls += " done";
      else if (i === currentIndex) cls += " current";
      const icone = i <= currentIndex ? STATUS_ICONS[s] : String(i + 1);
      return `
        <div class="${cls}">
          <span class="dot">${icone}</span>
          <span class="label">${STATUS_LABELS[s]}</span>
        </div>`;
    }).join("");
  }

  document.getElementById("lines").innerHTML = order.lignes
    .map((l) => `<div class="totals-row"><span>${l.quantite} × ${l.nom}</span><span>${formatGNF(l.prix * l.quantite)}</span></div>`)
    .join("");
}

// ---------- Mes commandes (historique client, dans ce navigateur) ----------

function renderMyOrders() {
  const orders = getOrders().slice().sort((a, b) => new Date(b.creeLe) - new Date(a.creeLe));

  app.innerHTML = `
    <h1>Mes commandes</h1>
    <p class="meta-line" style="margin-bottom: var(--space-5)">Historique conservé dans ce navigateur uniquement (démo, sans compte).</p>
    <div id="my-orders-list"></div>
  `;

  const list = document.getElementById("my-orders-list");

  if (orders.length === 0) {
    list.innerHTML = `<div class="empty-state">${UI_ICONS.vide}<p>Vous n'avez pas encore passé de commande.</p><a class="btn btn-primary" href="#/">Découvrir les restaurants</a></div>`;
    return;
  }

  const restaurants = getRestaurants();

  list.innerHTML = orders
    .map((o) => {
      const total = o.sousTotal + o.fraisLivraisonEstime;
      const badgeClass =
        o.statut === "refusee" || o.statut === "annulee" ? "badge-ferme" : o.statut === "en_attente" ? "badge-demo" : "badge-ouvert";
      const date = new Date(o.creeLe).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
      const resto = restaurants.find((r) => r.id === o.restaurantId);
      const style = resto ? categoryStyle(resto.categorie) : { gradient: "var(--gradient-marque)", icon: "" };

      return `
      <div class="order-card my-order-card">
        <div class="top-row">
          <div class="my-order-identity">
            <div class="my-order-avatar" style="background:${style.couleur}">${style.icon}</div>
            <div>
              <h3 class="my-order-resto">${o.restaurantNom}</h3>
              <span class="meta-line">${UI_ICONS.horloge} ${date} · ${o.id}</span>
            </div>
          </div>
          <span class="badge ${badgeClass}">${STATUS_LABELS[o.statut]}</span>
        </div>
        <div class="my-order-items">${o.lignes.map((l) => `<span class="item-chip">${l.quantite} × ${l.nom}</span>`).join("")}</div>
        <div class="my-order-total"><span>Total estimé</span><strong>${formatGNF(total)}</strong></div>
        <div class="order-actions">
          <a class="btn btn-secondary" href="#/suivi/${o.token}">Voir le suivi</a>
          <a class="btn btn-primary" href="#/restaurant/${o.restaurantId}">Recommander</a>
        </div>
      </div>`;
    })
    .join("");
}

// ---------- Espace restaurant ----------

let consoleState = { restaurantId: null, tab: "commandes", sousTab: "en_cours" };

function renderConsole() {
  const restaurants = getRestaurants();
  if (!consoleState.restaurantId) consoleState.restaurantId = restaurants[0].id;

  const resto = restaurants.find((r) => r.id === consoleState.restaurantId);

  app.innerHTML = `
    <div class="console-header">
      <div>
        <h1>Espace restaurant</h1>
        <p class="meta-line">Connecté en tant que <strong>${resto.nom}</strong> (démo, sans authentification réelle)</p>
      </div>
      <div class="field" style="margin:0; min-width:200px">
        <label for="resto-select">Changer d'établissement (démo)</label>
        <select id="resto-select">
          ${restaurants.map((r) => `<option value="${r.id}" ${r.id === resto.id ? "selected" : ""}>${r.nom}</option>`).join("")}
        </select>
      </div>
    </div>

    <div class="console-tabs">
      <button data-tab="commandes" class="${consoleState.tab === "commandes" ? "active" : ""}">Commandes</button>
      <button data-tab="menu" class="${consoleState.tab === "menu" ? "active" : ""}">Menu</button>
      <button data-tab="profil" class="${consoleState.tab === "profil" ? "active" : ""}">Mon restaurant</button>
    </div>

    <div id="console-body"></div>
  `;

  document.getElementById("resto-select").addEventListener("change", (e) => {
    consoleState.restaurantId = e.target.value;
    renderConsole();
  });

  document.querySelectorAll(".console-tabs [data-tab]").forEach((btn) =>
    btn.addEventListener("click", () => {
      consoleState.tab = btn.dataset.tab;
      renderConsole();
    })
  );

  if (consoleState.tab === "commandes") renderConsoleOrders(resto);
  else if (consoleState.tab === "menu") renderConsoleMenu(resto);
  else renderConsoleProfil(resto);
}

function renderConsoleOrders(resto) {
  const body = document.getElementById("console-body");
  const orders = getOrders().filter((o) => o.restaurantId === resto.id);

  const enAttente = orders.filter((o) => o.statut === "en_attente").length;
  const enCours = orders.filter((o) => o.statut === "acceptee" || o.statut === "prete").length;
  const chiffreDuJour = orders
    .filter((o) => o.statut !== "refusee" && o.statut !== "annulee")
    .reduce((s, o) => s + o.sousTotal + o.fraisLivraisonEstime, 0);

  const statRow = `
    <div class="stat-row">
      <div class="stat-card"><div class="value">${enAttente}</div><div class="label">À traiter</div></div>
      <div class="stat-card"><div class="value">${enCours}</div><div class="label">En préparation</div></div>
      <div class="stat-card"><div class="value">${formatGNF(chiffreDuJour)}</div><div class="label">Estimé (démo)</div></div>
    </div>`;

  const ordersActifs = orders.filter((o) => o.statut === "en_attente" || o.statut === "acceptee" || o.statut === "prete");
  const ordersHistorique = orders.filter((o) => o.statut === "terminee" || o.statut === "refusee" || o.statut === "annulee");
  const ordersAffiches = consoleState.sousTab === "historique" ? ordersHistorique : ordersActifs;

  const sousTabsRow = `
    <div class="console-tabs" id="orders-sous-tabs" style="margin-bottom: var(--space-4)">
      <button data-sous-tab="en_cours" class="${consoleState.sousTab !== "historique" ? "active" : ""}">En cours (${ordersActifs.length})</button>
      <button data-sous-tab="historique" class="${consoleState.sousTab === "historique" ? "active" : ""}">Historique (${ordersHistorique.length})</button>
    </div>`;

  if (orders.length === 0) {
    body.innerHTML = `${statRow}<div class="empty-state">${UI_ICONS.vide}<p>Aucune commande reçue pour le moment.</p></div>`;
    return;
  }

  const listeHtml = ordersAffiches.length === 0
    ? `<div class="empty-state">${UI_ICONS.vide}<p>${consoleState.sousTab === "historique" ? "Aucune commande terminée pour le moment." : "Aucune commande en cours."}</p></div>`
    : ordersAffiches.map((o) => {
      const total = o.sousTotal + o.fraisLivraisonEstime;
      const badgeClass =
        o.statut === "refusee" || o.statut === "annulee" ? "badge-ferme" : o.statut === "en_attente" ? "badge-demo" : "badge-ouvert";
      return `
      <div class="order-card" data-order="${o.token}">
        <div class="top-row">
          <div>
            <strong>${o.id}</strong> · ${o.client.nom} · ${o.client.telephone}<br/>
            <span class="meta-line">${o.mode === "livraison" ? "Livraison — " + (o.client.adresse || "") : "Retrait sur place"}</span>
          </div>
          <span class="badge ${badgeClass}">${STATUS_LABELS[o.statut]}</span>
        </div>
        <div>${o.lignes.map((l) => `${l.quantite} × ${l.nom}`).join(", ")}</div>
        <p class="meta-line">Total estimé : ${formatGNF(total)}</p>
        <div class="order-actions">${renderOrderActions(o)}</div>
      </div>`;
    })
    .join("");

  body.innerHTML = statRow + sousTabsRow + listeHtml;

  document.getElementById("orders-sous-tabs").querySelectorAll("[data-sous-tab]").forEach((btn) =>
    btn.addEventListener("click", () => {
      consoleState.sousTab = btn.dataset.sousTab;
      renderConsoleOrders(resto);
    })
  );

  body.querySelectorAll("[data-action]").forEach((btn) =>
    btn.addEventListener("click", () => {
      updateOrderStatus(btn.dataset.token, btn.dataset.action);
      renderConsoleOrders(resto);
    })
  );
}

function renderOrderActions(order) {
  switch (order.statut) {
    case "en_attente":
      return `
        <button class="btn btn-primary" data-action="acceptee" data-token="${order.token}">Accepter</button>
        <button class="btn btn-danger" data-action="refusee" data-token="${order.token}">Refuser</button>`;
    case "acceptee":
      return `<button class="btn btn-primary" data-action="prete" data-token="${order.token}">Marquer prête</button>`;
    case "prete":
      return `<button class="btn btn-primary" data-action="terminee" data-token="${order.token}">Marquer terminée</button>`;
    default:
      return `<span class="meta-line">Aucune action disponible</span>`;
  }
}

function updateOrderStatus(token, nouveauStatut) {
  const orders = getOrders();
  const order = orders.find((o) => o.token === token);
  if (!order) return;
  order.statut = nouveauStatut;
  saveOrders(orders);
}

function renderConsoleMenu(resto) {
  const body = document.getElementById("console-body");
  body.innerHTML = `
    <div class="banner-info">${UI_ICONS.info}<span>Activez ou désactivez un plat selon la disponibilité réelle en cuisine.</span></div>
    <div id="menu-manage-list"></div>
  `;

  const list = document.getElementById("menu-manage-list");
  list.innerHTML = resto.menu
    .map(
      (item) => `
    <div class="menu-manage-row">
      <div>
        <strong>${item.nom}</strong>
        <p class="meta-line">${formatGNF(item.prix)}</p>
      </div>
      <button class="toggle-switch ${item.disponible ? "on" : ""}" data-toggle="${item.id}" aria-label="Disponibilité de ${item.nom}"></button>
    </div>`
    )
    .join("");

  list.querySelectorAll("[data-toggle]").forEach((btn) =>
    btn.addEventListener("click", () => {
      toggleDisponibilite(resto.id, btn.dataset.toggle);
      renderConsoleMenu(getRestaurants().find((r) => r.id === resto.id));
    })
  );
}

function toggleDisponibilite(restaurantId, itemId) {
  const restaurants = getRestaurants();
  const resto = restaurants.find((r) => r.id === restaurantId);
  const item = resto.menu.find((m) => m.id === itemId);
  item.disponible = !item.disponible;
  saveRestaurants(restaurants);
}

function renderConsoleProfil(resto) {
  const body = document.getElementById("console-body");
  body.innerHTML = `
    <div class="totals-box">
      <div class="field">
        <label>Nom de l'établissement</label>
        <input type="text" value="${escapeHtml(resto.nom)}" disabled />
      </div>
      <div class="field">
        <label>Quartier</label>
        <input type="text" value="${escapeHtml(resto.quartier)}" disabled />
      </div>
      <div class="field">
        <label>Horaires</label>
        <input type="text" value="${escapeHtml(resto.horaires)}" disabled />
      </div>
      <button class="btn btn-secondary" id="toggle-ouvert">${resto.ouvert ? "Fermer temporairement" : "Rouvrir"}</button>
    </div>
    <p class="meta-line">Modification du profil désactivée dans ce prototype (démo en lecture avec fermeture/ouverture uniquement).</p>
  `;

  document.getElementById("toggle-ouvert").addEventListener("click", () => {
    const restaurants = getRestaurants();
    const r = restaurants.find((x) => x.id === resto.id);
    r.ouvert = !r.ouvert;
    saveRestaurants(restaurants);
    renderConsole();
  });
}

// ---------- Utilitaires ----------

function renderNotFound() {
  app.innerHTML = `
    <div class="empty-state">
      <h1>Page introuvable</h1>
      <a class="btn btn-primary" href="#/">Retour à l'accueil</a>
    </div>`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

router();
