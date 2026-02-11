/**
 * OMDb API notes:
 * - Search: ?apikey=KEY&s=QUERY&type=movie&page=1..100  (returns Search[], totalResults)  :contentReference[oaicite:2]{index=2}
 * - Details: ?apikey=KEY&i=tt1234567&plot=full          :contentReference[oaicite:3]{index=3}
 */

const API_KEY = "193a5a2a";
const API_BASE = "https://www.omdbapi.com/";

const yearEl = document.getElementById("year");
const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");

const sortSelect = document.getElementById("sortSelect");
const grid = document.getElementById("movieGrid");
const statusText = document.getElementById("statusText");

const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const pageText = document.getElementById("pageText");

const modalOverlay = document.getElementById("modalOverlay");
const modalClose = document.getElementById("modalClose");
const modalContent = document.getElementById("modalContent");

yearEl.textContent = new Date().getFullYear();

let currentQuery = "";
let currentPage = 1;
let totalResults = 0;
let currentMovies = []; // current page results (for sorting)

function setStatus(msg) {
  statusText.textContent = msg;
}

function setPager() {
  pageText.textContent = `Page ${currentPage}`;
  prevBtn.disabled = currentPage <= 1;

  // OMDb returns 10 results per page (Search array length up to 10).
  const maxPage = Math.min(100, Math.ceil(totalResults / 10) || 1);
  nextBtn.disabled = currentPage >= maxPage;
}

function safePoster(url) {
  if (!url || url === "N/A") return "";
  return url;
}

function renderGrid(list) {
  grid.innerHTML = "";

  if (!list.length) {
    grid.innerHTML = "";
    return;
  }

  const frag = document.createDocumentFragment();

  list.forEach((m) => {
    const card = document.createElement("article");
    card.className = "card";
    card.tabIndex = 0;
    card.role = "button";
    card.setAttribute("aria-label", `Open details for ${m.Title}`);

    card.dataset.imdbid = m.imdbID;

    const posterUrl = safePoster(m.Poster);
    card.innerHTML = `
      ${
        posterUrl
          ? `<img class="poster" src="${posterUrl}" alt="${m.Title} poster" loading="lazy" />`
          : `<div class="poster" aria-label="No poster available"></div>`
      }
      <div class="card__body">
        <h3 class="card__title">${m.Title}</h3>
        <div class="card__meta">
          <span class="badge">${m.Type}</span>
          <span>${m.Year}</span>
        </div>
      </div>
    `;

    card.addEventListener("click", () => openDetails(m.imdbID));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") openDetails(m.imdbID);
    });

    frag.appendChild(card);
  });

  grid.appendChild(frag);
}

function sortMovies(value) {
  const copy = [...currentMovies];

  if (value === "az") {
    copy.sort((a, b) => a.Title.localeCompare(b.Title));
  } else if (value === "za") {
    copy.sort((a, b) => b.Title.localeCompare(a.Title));
  } else if (value === "newest") {
    copy.sort((a, b) => parseInt(b.Year, 10) - parseInt(a.Year, 10));
  } else if (value === "oldest") {
    copy.sort((a, b) => parseInt(a.Year, 10) - parseInt(b.Year, 10));
  }

  renderGrid(copy);
}

async function omdbRequest(params) {
  const url = new URL(API_BASE);
  url.searchParams.set("apikey", API_KEY);

  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      url.searchParams.set(k, v);
    }
  });

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function searchMovies(query, page = 1) {
  if (!API_KEY || API_KEY === "PASTE_YOUR_OMDB_KEY_HERE") {
    setStatus("Add your OMDb API key in app.js to start searching.");
    return;
  }

  setStatus("Searching...");
  grid.innerHTML = "";
  currentMovies = [];

  // OMDb search: s= (required), type=movie, page=  :contentReference[oaicite:4]{index=4}
  const data = await omdbRequest({
    s: query,
    type: "movie",
    page: String(page),
  });

  if (data.Response === "False") {
    totalResults = 0;
    currentMovies = [];
    setPager();
    setStatus(data.Error || "No results found.");
    return;
  }

  totalResults = Number(data.totalResults || 0);
  currentMovies = Array.isArray(data.Search) ? data.Search : [];

  setStatus(`Found ${totalResults.toLocaleString()} results for "${query}".`);
  setPager();
  sortMovies(sortSelect.value);
}

function openModal() {
  modalOverlay.classList.add("is-open");
  modalOverlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  modalOverlay.classList.remove("is-open");
  modalOverlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  modalContent.innerHTML = "";
}

modalClose.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modalOverlay.classList.contains("is-open")) closeModal();
});

async function openDetails(imdbID) {
  if (!imdbID) return;

  modalContent.innerHTML = `<p class="subtext">Loading details…</p>`;
  openModal();

  try {
    // Details: i= (IMDb ID), plot=full  :contentReference[oaicite:5]{index=5}
    const d = await omdbRequest({ i: imdbID, plot: "full" });

    if (d.Response === "False") {
      modalContent.innerHTML = `<p class="subtext">${d.Error || "Could not load details."}</p>`;
      return;
    }

    const posterUrl = safePoster(d.Poster);
    const rating = Array.isArray(d.Ratings) && d.Ratings.length ? d.Ratings[0].Value : "N/A";

    modalContent.innerHTML = `
      <div class="details">
        ${
          posterUrl
            ? `<img class="details__poster" src="${posterUrl}" alt="${d.Title} poster" />`
            : `<div class="details__poster" aria-label="No poster available"></div>`
        }

        <div>
          <h2 class="details__title">${d.Title}</h2>
          <p class="details__sub">${d.Year} • ${d.Rated || "NR"} • ${d.Runtime || "N/A"}</p>

          <div class="details__chips">
            <span class="badge">${d.Genre || "N/A"}</span>
            <span class="badge">IMDb: ${d.imdbRating || "N/A"}</span>
            <span class="badge">Top Rating: ${rating}</span>
          </div>

          <p class="details__plot">${d.Plot || "No plot available."}</p>

          <div class="kv">
            <div><strong>Director:</strong> ${d.Director || "N/A"}</div>
            <div><strong>Actors:</strong> ${d.Actors || "N/A"}</div>
            <div><strong>Released:</strong> ${d.Released || "N/A"}</div>
            <div><strong>Awards:</strong> ${d.Awards || "N/A"}</div>
            <div><strong>IMDb ID:</strong> ${d.imdbID || "N/A"}</div>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    modalContent.innerHTML = `<p class="subtext">Error loading details. (${err.message})</p>`;
  }
}

/* Events */
searchForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = searchInput.value.trim();
  if (!q) return;

  currentQuery = q;
  currentPage = 1;

  try {
    await searchMovies(currentQuery, currentPage);
  } catch (err) {
    setStatus(`Search failed: ${err.message}`);
  }
});

sortSelect.addEventListener("change", () => {
  sortMovies(sortSelect.value);
});

prevBtn.addEventListener("click", async () => {
  if (currentPage <= 1) return;
  currentPage -= 1;

  try {
    await searchMovies(currentQuery, currentPage);
  } catch (err) {
    setStatus(`Search failed: ${err.message}`);
  }
});

nextBtn.addEventListener("click", async () => {
  currentPage += 1;

  try {
    await searchMovies(currentQuery, currentPage);
  } catch (err) {
    setStatus(`Search failed: ${err.message}`);
  }
});

