// ---------- Storage ----------
const STORE_KEY = "finance_tracker_v1";

function loadState() {
  const raw = localStorage.getItem(STORE_KEY);
  if (!raw) {
    return {
      categories: ["Essen", "Miete", "Transport", "Shopping", "Freizeit", "Gesundheit", "Sonstiges"],
      transactions: []
    };
  }
  try {
    return JSON.parse(raw);
  } catch {
    return {
      categories: ["Essen", "Miete", "Transport", "Shopping", "Freizeit", "Gesundheit", "Sonstiges"],
      transactions: []
    };
  }
}

function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

let state = loadState();

// ---------- Helpers ----------
function toEuro(n) {
  const x = Number(n) || 0;
  return x.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function monthISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

function isSameMonth(dateISO, monthISOVal) {
  return (dateISO || "").slice(0, 7) === monthISOVal;
}

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

// ---------- DOM ----------
const txForm = document.getElementById("txForm");
const txType = document.getElementById("txType");
const txAmount = document.getElementById("txAmount");
const txCategory = document.getElementById("txCategory");
const txDate = document.getElementById("txDate");
const txNote = document.getElementById("txNote");

const monthFilter = document.getElementById("monthFilter");

const sumIncome = document.getElementById("sumIncome");
const sumExpense = document.getElementById("sumExpense");
const sumBalance = document.getElementById("sumBalance");

const categoryStats = document.getElementById("categoryStats");
const txList = document.getElementById("txList");

const catForm = document.getElementById("catForm");
const catName = document.getElementById("catName");
const categoryList = document.getElementById("categoryList");

const clearAllBtn = document.getElementById("clearAll");

// ---------- Render ----------
function renderCategorySelect() {
  txCategory.innerHTML = "";
  state.categories.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    txCategory.appendChild(opt);
  });
}

function renderCategoryChips() {
  categoryList.innerHTML = "";
  state.categories.forEach((c) => {
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.innerHTML = `<span>${escapeHtml(c)}</span>`;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.title = "Kategorie löschen";
    btn.textContent = "×";
    btn.addEventListener("click", () => deleteCategory(c));

    chip.appendChild(btn);
    categoryList.appendChild(chip);
  });
}

function renderStatsAndLists() {
  const m = monthFilter.value || monthISO();

  const txMonth = state.transactions
    .filter(t => isSameMonth(t.date, m))
    .sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id));

  const income = txMonth.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = txMonth.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  sumIncome.textContent = toEuro(income);
  sumExpense.textContent = toEuro(expense);
  sumBalance.textContent = toEuro(balance);

  // Category stats (expenses only)
  const byCat = new Map();
  txMonth.filter(t => t.type === "expense").forEach(t => {
    byCat.set(t.category, (byCat.get(t.category) || 0) + t.amount);
  });

  const expenseTotal = expense || 0;
  const rows = Array.from(byCat.entries())
    .sort((a, b) => b[1] - a[1]);

  if (rows.length === 0) {
    categoryStats.textContent = "Noch keine Ausgaben in diesem Monat.";
  } else {
    categoryStats.innerHTML = "";
    rows.forEach(([cat, sum]) => {
      const pct = expenseTotal > 0 ? (sum / expenseTotal) * 100 : 0;

      const row = document.createElement("div");
      row.className = "cat-row";
      row.innerHTML = `
        <div>
          <div><strong>${escapeHtml(cat)}</strong> · ${toEuro(sum)} <span class="muted">(${pct.toFixed(1)}%)</span></div>
          <div class="bar"><div style="width:${Math.min(100, pct).toFixed(1)}%"></div></div>
        </div>
        <div class="muted small">Ausgaben</div>
      `;
      categoryStats.appendChild(row);
    });
  }

  // Transactions list
  if (txMonth.length === 0) {
    txList.textContent = "Noch keine Buchungen in diesem Monat.";
  } else {
    txList.innerHTML = "";
    txMonth.forEach(t => {
      const el = document.createElement("div");
      el.className = "tx";

      const amountClass = t.type === "expense" ? "expense" : "income";
      const sign = t.type === "expense" ? "-" : "+";

      el.innerHTML = `
        <div class="tx-top">
          <div>
            <div><strong>${escapeHtml(t.category)}</strong></div>
            <div class="tx-meta">
              <span class="badge">${escapeHtml(t.date)}</span>
              <span class="badge">${t.type === "expense" ? "Ausgabe" : "Einnahme"}</span>
              ${t.note ? `<span class="badge">${escapeHtml(t.note)}</span>` : ""}
            </div>
          </div>
          <div class="amount ${amountClass}">${sign} ${toEuro(t.amount)}</div>
        </div>
        <div class="tx-actions">
          <button type="button" data-action="edit">Bearbeiten</button>
          <button type="button" data-action="delete">Löschen</button>
        </div>
      `;

      el.querySelector('[data-action="delete"]').addEventListener("click", () => deleteTx(t.id));
      el.querySelector('[data-action="edit"]').addEventListener("click", () => editTx(t.id));

      txList.appendChild(el);
    });
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ---------- Actions ----------
function addTransaction(tx) {
  state.transactions.push(tx);
  saveState();
  renderAll();
}

function deleteTx(id) {
  state.transactions = state.transactions.filter(t => t.id !== id);
  saveState();
  renderAll();
}

function editTx(id) {
  const t = state.transactions.find(x => x.id === id);
  if (!t) return;

  // Simple edit flow: refill form, delete original, user saves again
  txType.value = t.type;
  txAmount.value = String(t.amount);
  txDate.value = t.date;
  txNote.value = t.note || "";

  // ensure category exists
  if (!state.categories.includes(t.category)) {
    state.categories.push(t.category);
  }
  renderCategorySelect();
  txCategory.value = t.category;

  // remove old entry
  deleteTx(id);

  // scroll to form
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function addCategory(name) {
  const n = name.trim();
  if (!n) return;

  const exists = state.categories.some(c => c.toLowerCase() === n.toLowerCase());
  if (exists) return;

  state.categories.push(n);
  saveState();
  renderAll();
}

function deleteCategory(name) {
  // allow delete only if no tx uses it
  const used = state.transactions.some(t => t.category === name);
  if (used) {
    alert("Kategorie kann nicht gelöscht werden: Es gibt Buchungen in dieser Kategorie.");
    return;
  }
  state.categories = state.categories.filter(c => c !== name);
  saveState();
  renderAll();
}

function clearAll() {
  const ok = confirm("Wirklich ALLES löschen? Kategorien + Buchungen werden zurückgesetzt.");
  if (!ok) return;

  localStorage.removeItem(STORE_KEY);
  state = loadState();
  saveState();
  renderAll();
}

// ---------- Events ----------
txForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const type = txType.value;
  const amount = Number(txAmount.value);
  const category = txCategory.value;
  const date = txDate.value;
  const note = txNote.value.trim();

  if (!Number.isFinite(amount) || amount <= 0) {
    alert("Bitte einen Betrag > 0 eingeben.");
    return;
  }
  if (!category) {
    alert("Bitte Kategorie auswählen.");
    return;
  }
  if (!date) {
    alert("Bitte Datum auswählen.");
    return;
  }

  addTransaction({
    id: uid(),
    type,
    amount: Math.round(amount * 100) / 100,
    category,
    date,
    note
  });

  txAmount.value = "";
  txNote.value = "";
  txType.value = "expense";
});

catForm.addEventListener("submit", (e) => {
  e.preventDefault();
  addCategory(catName.value);
  catName.value = "";
});

monthFilter.addEventListener("change", () => renderStatsAndLists());
clearAllBtn.addEventListener("click", clearAll);

// ---------- Init ----------
function renderAll() {
  // Ensure at least one category
  if (!state.categories || state.categories.length === 0) {
    state.categories = ["Sonstiges"];
  }

  renderCategorySelect();
  renderCategoryChips();
  renderStatsAndLists();
}

(function init() {
  txDate.value = todayISO();
  monthFilter.value = monthISO();
  saveState();
  renderAll();
})();
