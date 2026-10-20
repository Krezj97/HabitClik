#!/usr/bin/env node
"use strict";

// Digital Asset Links must be hosted at the web ORIGIN root, never under
// the GitHub Pages project subpath. No secrets or signing keys are stored here.
const packageName = process.argv[2];
const fingerprint = process.argv[3];
const originInput = process.argv[4];
const help = "Uso: node android/generate-assetlinks.cjs <paquete.android> <SHA256_APP_SIGNING_95_CARACTERES> <https://dominio-propio/>";

function assertValid(condition, problem) {
  if (!condition) {
    console.error("Error: " + problem + "\n" + help);
    process.exitCode = 1;
    return false;
  }
  return true;
}

function main() {
  if (!assertValid(typeof packageName === "string" &&
    /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*){1,}$/.test(packageName),
    "Identificador de paquete inválido.")) return;
  if (!assertValid(typeof fingerprint === "string" &&
    /^(?:[0-9a-fA-F]{2}:){31}[0-9a-fA-F]{2}$/.test(fingerprint),
    "Indica la huella SHA-256 del certificado APP SIGNING en formato AA:BB:..., no la clave privada.")) return;
  let url;
  try { url = new URL(originInput); } catch (error) { url = null; }
  if (!assertValid(url && url.protocol === "https:" && url.pathname === "/" &&
    !url.search && !url.hash && !url.username && !url.password,
    "Se requiere una URL HTTPS del origen raíz (no una ruta /HabitClik/).")) return;
  if (!assertValid(!url.hostname.endsWith(".github.io") && url.hostname !== "github.io",
    "No se puede verificar el dominio raíz github.io desde un repositorio de proyecto; configura un dominio propio.")) return;
  const links = [{
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: packageName,
      sha256_cert_fingerprints: [fingerprint.toUpperCase()]
    }
  }];
  process.stdout.write(JSON.stringify(links, null, 2) + "\n");
}

main();
