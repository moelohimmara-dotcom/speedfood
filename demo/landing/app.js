// Landing page Speedfood — démo, aucune donnée envoyée à un serveur réel.
// Les inscriptions sont conservées en localStorage, dans ce navigateur uniquement.

let roleActuel = "client";

const roleToggle = document.getElementById("role-toggle");
const fieldRestaurant = document.getElementById("field-restaurant");

roleToggle.querySelectorAll("[data-role]").forEach((btn) => {
  btn.addEventListener("click", () => {
    roleActuel = btn.dataset.role;
    roleToggle.querySelectorAll("button").forEach((b) => {
      b.classList.toggle("active", b === btn);
      b.setAttribute("aria-pressed", String(b === btn));
    });
    fieldRestaurant.hidden = roleActuel !== "restaurateur";
    document.getElementById("su-resto").required = roleActuel === "restaurateur";
  });
});

document.getElementById("signup-form").addEventListener("submit", (e) => {
  e.preventDefault();

  const inscription = {
    role: roleActuel,
    nom: document.getElementById("su-nom").value.trim(),
    telephone: document.getElementById("su-tel").value.trim(),
    restaurant: roleActuel === "restaurateur" ? document.getElementById("su-resto").value.trim() : null,
    quartier: document.getElementById("su-quartier").value,
    creeLe: new Date().toISOString(),
  };

  const liste = JSON.parse(localStorage.getItem("sf_landing_signups") || "[]");
  liste.push(inscription);
  localStorage.setItem("sf_landing_signups", JSON.stringify(liste));

  document.getElementById("signup-form").hidden = true;
  document.getElementById("signup-confirm").hidden = false;
});
