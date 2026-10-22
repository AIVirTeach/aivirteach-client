// D1 is optional: production reads from the remote API, while local hosting may bind DB.
declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
  }
}
