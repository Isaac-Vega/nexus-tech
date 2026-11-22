"use strict";

const API = "/api/recursos";
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const form = $("#technology-form");
const records = $("#records");
const detail = $("#record-detail");
const message = $("#crud-message");
const saveButton = $("#save-record");
const cancelButton = $("#cancel-edit");
const idInput = $("#technology-id");
const nameInput = $("#technology-name");
const categoryInput = $("#technology-category");
const descriptionInput = $("#technology-description");
const urlInput = $("#technology-url");
const tokenInput = $("#admin-token");

let resources = [];
let busy = false;
let searchTerm = "";

$("#year").textContent = new Date().getFullYear();

function navigate(page) {
  if (!$("#" + page)?.classList.contains("page")) {
    page = "dashboard";
  }

  $$(".page").forEach(el => {
    el.classList.toggle("active", el.id === page);
  });

  $$(".nav-link").forEach(el => {
    el.classList.toggle("active", el.dataset.page === page);
  });

  $("#sidebar").classList.remove("open");
  $(".menu-toggle").setAttribute("aria-expanded", "false");

  if (location.hash !== "#" + page) {
    history.replaceState(null, "", "#" + page);
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

$$("[data-page]").forEach(el => {
  el.addEventListener("click", event => {
    event.preventDefault();
    navigate(el.dataset.page);
  });
});

$$("[data-go]").forEach(el => {
  el.addEventListener("click", () => navigate(el.dataset.go));
});

$(".menu-toggle").addEventListener("click", () => {
  const open = $("#sidebar").classList.toggle("open");
  $(".menu-toggle").setAttribute("aria-expanded", String(open));
});

window.addEventListener("hashchange", () => {
  navigate(location.hash.slice(1));
});

function showMessage(text, error = false) {
  message.textContent = text;
  message.classList.toggle("error", error);
}

async function request(url, options = {}) {
  const isWrite = ["POST", "PUT", "DELETE"].includes(options.method);
  const token = tokenInput.value.trim();

  if (isWrite && !token) {
    throw new Error(
      "Introduce el token de administrador antes de modificar recursos."
    );
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(isWrite ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  const type = response.headers.get("content-type") || "";

  if (!type.includes("application/json")) {
    throw new Error(
      "El servidor no devolvió JSON. Abre el sitio con Node.js, no con Live Server."
    );
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error || "Error al procesar la solicitud."
    );
  }

  return data;
}

function element(tag, className, text) {
  const el = document.createElement(tag);

  if (className) el.className = className;

  if (text !== undefined) {
    el.textContent = String(text);
  }

  return el;
}

function empty(container, text) {
  container.replaceChildren(element("p", "muted", text));
}

function resourceCard(item) {
  const card = element("article", "resource-card");
  const top = element("div", "resource-top");

  top.append(
    element("span", "resource-icon", "⌘"),
    element("span", "pill", item.categoria)
  );

  card.append(
    top,
    element("h3", "", item.nombre),
    element("p", "", item.descripcion)
  );

  if (item.url) {
    const link = element("a", "resource-link", "Abrir recurso ↗");
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    card.append(link);
  }

  return card;
}

function render() {
  const filtered = resources.filter(item =>
    [item.nombre, item.categoria, item.descripcion].some(value =>
      String(value).toLocaleLowerCase().includes(searchTerm)
    )
  );

  $("#stat-resources").textContent = resources.length;

  const categories = [
    ...new Set(
      resources.map(item => item.categoria.trim()).filter(Boolean)
    )
  ];

  $("#stat-categories").textContent = categories.length;
  $("#library-count").textContent = `${filtered.length} recursos`;

  const library = $("#library-resources");

  library.replaceChildren(...filtered.map(resourceCard));

  if (!filtered.length) {
    empty(
      library,
      searchTerm
        ? "No hay recursos que coincidan con tu búsqueda."
        : "Todavía no hay recursos. Agrega uno desde Administración."
    );
  }

  const recent = $("#recent-resources");

  recent.replaceChildren(
    ...[...resources].slice(-4).reverse().map(resourceCard)
  );

  if (!resources.length) {
    empty(recent, "No hay recursos registrados todavía.");
  }

  const categoryList = $("#category-list");
  categoryList.replaceChildren();

  for (const category of categories) {
    const card = element("article", "category-card");

    card.append(
      element("span", "resource-icon", "◫"),
      element("h2", "", category),
      element(
        "p",
        "",
        `${resources.filter(item =>
          item.categoria.trim() === category
        ).length} recursos disponibles`
      )
    );

    const button = element(
      "button",
      "button secondary",
      "Ver recursos →"
    );

    button.addEventListener("click", () => {
      $("#global-search").value = category;
      searchTerm = category.toLocaleLowerCase();
      render();
      navigate("biblioteca");
    });

    card.append(button);
    categoryList.append(card);
  }

  if (!categories.length) {
    empty(
      categoryList,
      "Las categorías aparecerán cuando agregues recursos."
    );
  }

  renderTable();
}

function tableState(text) {
  const tr = element("tr");
  const td = element("td", "", text);

  td.colSpan = 4;
  tr.append(td);
  records.replaceChildren(tr);
}

function actionButton(label, handler, danger = false) {
  const button = element(
    "button",
    `table-button${danger ? " danger" : ""}`,
    label
  );

  button.type = "button";
  button.addEventListener("click", handler);

  return button;
}

function renderTable() {
  records.replaceChildren();

  if (!resources.length) {
    tableState("No hay recursos registrados.");
    return;
  }

  for (const item of resources) {
    const row = element("tr");

    [item.id, item.nombre, item.categoria].forEach(value => {
      row.append(element("td", "", value));
    });

    const cell = element("td");
    const actions = element("div", "record-actions");

    actions.append(
      actionButton("Ver", () => viewResource(item.id)),
      actionButton("Editar", () => editResource(item.id)),
      actionButton(
        "Eliminar",
        () => deleteResource(item.id),
        true
      )
    );

    cell.append(actions);
    row.append(cell);
    records.append(row);
  }
}

async function loadResources() {
  try {
    const data = await request(API);

    if (!Array.isArray(data)) {
      throw new Error("Respuesta de recursos inválida.");
    }

    resources = data;
    render();

    return true;
  } catch (error) {
    resources = [];
    render();

    tableState("No se pudieron cargar los recursos.");

    empty(
      $("#library-resources"),
      "No se pudo conectar con la base de datos."
    );

    empty(
      $("#recent-resources"),
      "No se pudo conectar con la base de datos."
    );

    showMessage(error.message, true);
    return false;
  }
}

async function viewResource(id) {
  try {
    const item = await request(`${API}/${id}`);

    detail.replaceChildren(
      element("h3", "", item.nombre),
      element("p", "", `Categoría: ${item.categoria}`),
      element("p", "", item.descripcion),
      element("p", "", `ID: ${item.id}`)
    );

    if (item.url) {
      const link = element("a", "resource-link", "Abrir recurso ↗");
      link.href = item.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      detail.append(link);
    }

    detail.hidden = false;
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function editResource(id) {
  if (busy) return;

  try {
    const item = await request(`${API}/${id}`);

    idInput.value = item.id;
    nameInput.value = item.nombre;
    categoryInput.value = item.categoria;
    descriptionInput.value = item.descripcion;
    urlInput.value = item.url || "";

    $("#form-title").textContent = "Editar recurso";
    saveButton.textContent = "Guardar cambios";
    cancelButton.hidden = false;

    form.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    nameInput.focus({ preventScroll: true });
    showMessage(`Editando recurso #${id}`);
  } catch (error) {
    showMessage(error.message, true);
  }
}

function resetForm() {
  form.reset();
  idInput.value = "";

  $("#form-title").textContent = "Registrar recurso";
  saveButton.textContent = "Agregar recurso";
  cancelButton.hidden = true;
}

async function deleteResource(id) {
  if (
    busy ||
    !confirm(`¿Seguro que deseas eliminar el recurso #${id}?`)
  ) {
    return;
  }

  busy = true;

  try {
    await request(`${API}/${id}`, {
      method: "DELETE"
    });

    if (idInput.value === String(id)) {
      resetForm();
    }

    detail.hidden = true;

    const loaded = await loadResources();

    if (loaded) {
      showMessage("Recurso eliminado correctamente.");
    }
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    busy = false;
  }
}

form.addEventListener("submit", async event => {
  event.preventDefault();

  if (busy) return;

  const id = idInput.value;

  const data = {
    nombre: nameInput.value.trim(),
    categoria: categoryInput.value.trim(),
    descripcion: descriptionInput.value.trim(),
    url: urlInput.value.trim()
  };

  if (
    [data.nombre, data.categoria, data.descripcion]
      .some(value => !value)
  ) {
    showMessage("Completa todos los campos.", true);
    return;
  }

  busy = true;
  saveButton.disabled = true;

  try {
    await request(id ? `${API}/${id}` : API, {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(data)
    });

    resetForm();
    detail.hidden = true;

    const loaded = await loadResources();

    if (loaded) {
      showMessage(
        id
          ? "Recurso actualizado correctamente."
          : "Recurso agregado correctamente."
      );
    }
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    busy = false;
    saveButton.disabled = false;
  }
});

tokenInput.addEventListener("input", () => {
  $("#auth-state").textContent = tokenInput.value.trim()
    ? "Token introducido"
    : "Sin autenticar";
});

$("#clear-token").addEventListener("click", () => {
  tokenInput.value = "";
  $("#auth-state").textContent = "Sin autenticar";
  showMessage("Token borrado de esta página.");
});

cancelButton.addEventListener("click", () => {
  resetForm();
  showMessage("Edición cancelada.");
});

$("#refresh-records").addEventListener("click", loadResources);
$("#library-refresh").addEventListener("click", loadResources);

$("#global-search").addEventListener("input", event => {
  searchTerm = event.target.value.trim().toLocaleLowerCase();

  render();

  if (searchTerm) {
    navigate("biblioteca");
  }
});

navigate(location.hash.slice(1) || "dashboard");
loadResources();
