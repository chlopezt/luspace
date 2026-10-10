const enc = new TextEncoder();
export const uid = () => crypto.randomUUID();
export function token() {
  return [...crypto.getRandomValues(new Uint8Array(32))]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
export async function hash(value) {
  return [
    ...new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(value))),
  ]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
export async function password(value, salt = token().slice(0, 32)) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(value),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: enc.encode(salt),
      iterations: 100000,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return (
    salt +
    ":" +
    [...new Uint8Array(bits)]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
  );
}
export async function verify(value, stored) {
  const candidate = await password(value, stored.split(":")[0]);
  let d = candidate.length ^ stored.length;
  for (let i = 0; i < candidate.length; i++)
    d |= candidate.charCodeAt(i) ^ stored.charCodeAt(i);
  return d === 0;
}
export function cookie(req, value, age = 28800) {
  return `luspace_session=${value}; Path=/; HttpOnly; SameSite=Strict${age===null?'':`; Max-Age=${age}`}${new URL(req.url).protocol === "https:" ? "; Secure" : ""}`;
}
