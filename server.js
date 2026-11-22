"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");

const root = __dirname;
const PORT = process.env.PORT || 3000;

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 5000
    })
  : null;

function json(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });

  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let exceeded = false;

    req.on("data", chunk => {
      size += chunk.length;

      if (size > 10000) {
        exceeded = true;
      } else if (!exceeded) {
        chunks.push(chunk);
      }
    });

    req.on("end", () => {
      if (exceeded) {
        return reject(
          new Error("Solicitud demasiado grande")
        );
      }

      try {
        resolve(
          JSON.parse(
            Buffer.concat(chunks).toString("utf8")
          )
        );
      } catch {
        reject(new Error("JSON inválido"));
      }
    });

    req.on("error", reject);
  });
}

async function initDatabase() {
  if (!pool) {
    console.log("DATABASE_URL no configurada");
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS recursos (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      nombre VARCHAR(150) NOT NULL,
      categoria VARCHAR(100) NOT NULL,
      descripcion TEXT NOT NULL,
      url TEXT,
      fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log(
    "Base de datos inicializada correctamente"
  );
}

function validate(data) {
  if (
    !data ||
    typeof data.nombre !== "string" ||
    typeof data.categoria !== "string" ||
    typeof data.descripcion !== "string" ||
    (data.url != null &&
      typeof data.url !== "string")
  ) {
    return false;
  }

  const nombre = data.nombre.trim();
  const categoria = data.categoria.trim();
  const descripcion = data.descripcion.trim();
  const url = (data.url || "").trim();

  if (url) {
    try {
      const parsed = new URL(url);

      if (
        !["https:", "http:"].includes(
          parsed.protocol
        )
      ) {
        return false;
      }
    } catch {
      return false;
    }
  }

  return (
    nombre.length > 0 &&
    nombre.length <= 150 &&
    categoria.length > 0 &&
    categoria.length <= 100 &&
    descripcion.length > 0 &&
    descripcion.length <= 2000 &&
    url.length <= 2000
  );
}

async function handleAPI(req, res, pathname) {
  if (!pool) {
    return json(res, 503, {
      error: "Base de datos no configurada"
    });
  }

  const match = pathname.match(
    /^\/api\/recursos\/([0-9]+)$/
  );

  const isCollection =
    pathname === "/api/recursos";

  if (!match && !isCollection) {
    return json(res, 404, {
      error: "Ruta no encontrada"
    });
  }

  const id = match ? Number(match[1]) : null;

  if (
    match &&
    (!Number.isSafeInteger(id) || id < 1)
  ) {
    return json(res, 400, {
      error: "ID inválido"
    });
  }

  try {
    if (
      req.method === "GET" &&
      isCollection
    ) {
      const result = await pool.query(
        "SELECT * FROM recursos ORDER BY id ASC"
      );

      return json(res, 200, result.rows);
    }

    if (
      req.method === "GET" &&
      match
    ) {
      const result = await pool.query(
        "SELECT * FROM recursos WHERE id = $1",
        [id]
      );

      if (result.rowCount === 0) {
        return json(res, 404, {
          error: "Recurso no encontrado"
        });
      }

      return json(res, 200, result.rows[0]);
    }

    if (
      req.method === "POST" &&
      isCollection
    ) {
      const data = await readBody(req);

      if (!validate(data)) {
        return json(res, 400, {
          error: "Datos inválidos o incompletos"
        });
      }

      const result = await pool.query(
        `INSERT INTO recursos
         (nombre, categoria, descripcion, url)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [
          data.nombre.trim(),
          data.categoria.trim(),
          data.descripcion.trim(),
          (data.url || "").trim() || null
        ]
      );

      return json(res, 201, result.rows[0]);
    }

    if (
      req.method === "PUT" &&
      match
    ) {
      const data = await readBody(req);

      if (!validate(data)) {
        return json(res, 400, {
          error: "Datos inválidos o incompletos"
        });
      }

      const result = await pool.query(
        `UPDATE recursos
         SET nombre = $1,
             categoria = $2,
             descripcion = $3,
             url = $4
         WHERE id = $5
         RETURNING *`,
        [
          data.nombre.trim(),
          data.categoria.trim(),
          data.descripcion.trim(),
          (data.url || "").trim() || null,
          id
        ]
      );

      if (result.rowCount === 0) {
        return json(res, 404, {
          error: "Recurso no encontrado"
        });
      }

      return json(res, 200, result.rows[0]);
    }

    if (
      req.method === "DELETE" &&
      match
    ) {
      const result = await pool.query(
        "DELETE FROM recursos WHERE id = $1 RETURNING id",
        [id]
      );

      if (result.rowCount === 0) {
        return json(res, 404, {
          error: "Recurso no encontrado"
        });
      }

      return json(res, 200, {
        mensaje: "Recurso eliminado correctamente"
      });
    }

    return json(res, 405, {
      error: "Método no permitido"
    });
  } catch (error) {
    if (
      error.message === "JSON inválido" ||
      error.message ===
        "Solicitud demasiado grande"
    ) {
      return json(res, 400, {
        error: error.message
      });
    }

    console.error("Error en API:", error);

    return json(res, 500, {
      error: "Error interno del servidor"
    });
  }
}

const server = http.createServer(
  async (req, res) => {
    let pathname;

    try {
      pathname = decodeURIComponent(
        new URL(
          req.url,
          "http://localhost"
        ).pathname
      );
    } catch {
      return json(res, 400, {
        error: "Solicitud inválida"
      });
    }

    if (pathname.startsWith("/api/")) {
      return handleAPI(req, res, pathname);
    }

    if (
      req.method !== "GET" &&
      req.method !== "HEAD"
    ) {
      return json(res, 405, {
        error: "Método no permitido"
      });
    }

    const file = path.resolve(
      root,
      "." +
        (pathname === "/"
          ? "/index.html"
          : pathname)
    );

    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403);
      return res.end("Forbidden");
    }

    const relative = path.relative(
      root,
      file
    );

    const parts = relative.split(path.sep);

    if (
      parts.some(part =>
        part.startsWith(".")
      ) ||
      parts.includes("node_modules") ||
      parts.includes("server.js") ||
      parts.includes("package.json") ||
      parts.includes("package-lock.json")
    ) {
      res.writeHead(403);
      return res.end("Forbidden");
    }

    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404);
        return res.end("Not found");
      }

      res.writeHead(200, {
        "Content-Type":
          types[path.extname(file)] ||
          "application/octet-stream",
        "X-Content-Type-Options": "nosniff"
      });

      if (req.method === "HEAD") {
        return res.end();
      }

      res.end(data);
    });
  }
);

async function start() {
  try {
    await initDatabase();

    server.listen(
      PORT,
      "0.0.0.0",
      () => {
        console.log(
          `Servidor iniciado en puerto ${PORT}`
        );
      }
    );
  } catch (error) {
    console.error(
      "Error al iniciar PostgreSQL:",
      error
    );

    process.exit(1);
  }
}

start();
