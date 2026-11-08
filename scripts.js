"use strict";

const menuButton = document.querySelector(".menu-toggle");
const nav = document.querySelector(".nav");

menuButton?.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.setAttribute(
    "aria-label",
    open ? "Cerrar menú" : "Abrir menú"
  );
});

nav?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    nav.classList.remove("open");
    menuButton?.setAttribute("aria-expanded", "false");
    menuButton?.setAttribute("aria-label", "Abrir menú");
  });
});

const year = document.querySelector("#year");
if (year) year.textContent = new Date().getFullYear();

const API = "/api/tecnologias";

const form = document.querySelector("#technology-form");
const records = document.querySelector("#records");
const message = document.querySelector("#crud-message");
const detail = document.querySelector("#record-detail");
const saveButton = document.querySelector("#save-record");
const cancelButton = document.querySelector("#cancel-edit");
const refreshButton = document.querySelector("#refresh-records");
const formTitle = document.querySelector("#form-title");

const idInput = document.querySelector("#technology-id");
const nameInput = document.querySelector("#technology-name");
const categoryInput = document.querySelector("#technology-category");
const descriptionInput = document.querySelector("#technology-description");

let busy = false;

function mostrarMensaje(texto, error = false) {
  message.textContent = texto;
  message.classList.toggle("error", error);
}

async function solicitar(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Error en la solicitud");
  }

  return data;
}

function limpiarFormulario() {
  form.reset();
  idInput.value = "";
  formTitle.textContent = "Registrar tecnología";
  saveButton.textContent = "Agregar tecnología";
  cancelButton.hidden = true;
}

function crearCelda(fila, texto) {
  const celda = document.createElement("td");
  celda.textContent = String(texto);
  fila.appendChild(celda);
  return celda;
}

function crearBoton(texto, accion, clase = "") {
  const boton = document.createElement("button");
  boton.type = "button";
  boton.className = `table-button ${clase}`.trim();
  boton.textContent = texto;
  boton.addEventListener("click", accion);
  return boton;
}

function mostrarEstadoTabla(texto) {
  records.replaceChildren();
  const fila = document.createElement("tr");
  const celda = crearCelda(fila, texto);
  celda.colSpan = 4;
  records.appendChild(fila);
}

async function cargarTecnologias() {
  mostrarEstadoTabla("Cargando registros...");

  try {
    const tecnologias = await solicitar(API);

    if (!tecnologias.length) {
      mostrarEstadoTabla("No hay tecnologías registradas.");
      return;
    }

    records.replaceChildren();

    for (const tecnologia of tecnologias) {
      const fila = document.createElement("tr");

      crearCelda(fila, tecnologia.id);
      crearCelda(fila, tecnologia.nombre);
      crearCelda(fila, tecnologia.categoria);

      const acciones = document.createElement("td");
      const grupo = document.createElement("div");
      grupo.className = "record-actions";

      grupo.append(
        crearBoton("Ver", () => verTecnologia(tecnologia.id)),
        crearBoton("Editar", () => editarTecnologia(tecnologia.id)),
        crearBoton(
          "Eliminar",
          () => eliminarTecnologia(tecnologia.id),
          "danger"
        )
      );

      acciones.appendChild(grupo);
      fila.appendChild(acciones);
      records.appendChild(fila);
    }
  } catch (error) {
    mostrarEstadoTabla("No se pudieron cargar los registros.");
    mostrarMensaje(error.message, true);
  }
}

async function verTecnologia(id) {
  try {
    const tecnologia = await solicitar(`${API}/${id}`);

    detail.replaceChildren();

    const titulo = document.createElement("h3");
    titulo.textContent = tecnologia.nombre;

    const categoria = document.createElement("p");
    categoria.textContent = `Categoría: ${tecnologia.categoria}`;

    const descripcion = document.createElement("p");
    descripcion.textContent = tecnologia.descripcion;

    const identificador = document.createElement("p");
    identificador.textContent = `ID: ${tecnologia.id}`;

    detail.append(titulo, categoria, descripcion, identificador);
    detail.hidden = false;
  } catch (error) {
    mostrarMensaje(error.message, true);
  }
}

async function editarTecnologia(id) {
  try {
    const tecnologia = await solicitar(`${API}/${id}`);

    idInput.value = tecnologia.id;
    nameInput.value = tecnologia.nombre;
    categoryInput.value = tecnologia.categoria;
    descriptionInput.value = tecnologia.descripcion;

    formTitle.textContent = "Editar tecnología";
    saveButton.textContent = "Guardar cambios";
    cancelButton.hidden = false;

    form.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    nameInput.focus({ preventScroll: true });
    mostrarMensaje(`Editando registro #${id}`);
  } catch (error) {
    mostrarMensaje(error.message, true);
  }
}

async function eliminarTecnologia(id) {
  if (busy) return;

  const confirmado = confirm(
    `¿Seguro que deseas eliminar el registro #${id}?`
  );

  if (!confirmado) return;

  busy = true;

  try {
    await solicitar(`${API}/${id}`, { method: "DELETE" });

    if (idInput.value === String(id)) {
      limpiarFormulario();
    }

    detail.hidden = true;
    mostrarMensaje("Tecnología eliminada correctamente.");
    await cargarTecnologias();
  } catch (error) {
    mostrarMensaje(error.message, true);
  } finally {
    busy = false;
  }
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;

  const id = idInput.value;

  const datos = {
    nombre: nameInput.value.trim(),
    categoria: categoryInput.value.trim(),
    descripcion: descriptionInput.value.trim()
  };

  if (!datos.nombre || !datos.categoria || !datos.descripcion) {
    mostrarMensaje("Completa todos los campos.", true);
    return;
  }

  busy = true;
  saveButton.disabled = true;

  try {
    await solicitar(id ? `${API}/${id}` : API, {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(datos)
    });

    limpiarFormulario();
    detail.hidden = true;

    mostrarMensaje(
      id
        ? "Tecnología actualizada correctamente."
        : "Tecnología agregada correctamente."
    );

    await cargarTecnologias();
  } catch (error) {
    mostrarMensaje(error.message, true);
  } finally {
    busy = false;
    saveButton.disabled = false;
  }
});

cancelButton?.addEventListener("click", () => {
  limpiarFormulario();
  mostrarMensaje("Edición cancelada.");
});

refreshButton?.addEventListener("click", cargarTecnologias);

if (form && records) {
  cargarTecnologias();
}
