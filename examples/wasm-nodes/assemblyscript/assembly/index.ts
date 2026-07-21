// Example Modulo blueprint node (action.wasm.execute, ABI v1 — ADR 0003).
//
// Title-cases the note title: "hello world" → "Hello World".
//
// ABI: export memory + alloc + execute; no imports (built with --use abort=
// and --runtime stub so AssemblyScript emits a self-contained module).
// Input:  UTF-8 JSON {"v":1,"note":{"title":"...","content":"..."}}
// Output: raw UTF-8 text, returned as (ptr << 32) | len packed into an i64.

/** Host asks for a buffer to place the input envelope in. */
export function alloc(size: i32): i32 {
  // The stub runtime is a bump allocator that never frees — fine, because the
  // host discards the whole instance after one execute() call.
  return i32(__new(<usize>size, idof<ArrayBuffer>()));
}

/** Run the node: read the envelope, produce the output text. */
export function execute(inPtr: i32, inLen: i32): i64 {
  const input = String.UTF8.decodeUnsafe(<usize>inPtr, <usize>inLen);
  const title = extractStringField(input, "title");
  const result = titleCase(title);

  const outBuf = String.UTF8.encode(result);
  const outPtr = changetype<usize>(outBuf);
  return (i64(outPtr) << 32) | i64(outBuf.byteLength);
}

function titleCase(s: string): string {
  const words = s.split(" ");
  const out = new Array<string>(words.length);
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    out[i] = w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w;
  }
  return out.join(" ");
}

/**
 * Minimal JSON string-field extractor for the v1 envelope (flat, known shape).
 * Handles the JSON escape sequences; enough for the envelope, not a general
 * JSON parser — real modules are welcome to ship one.
 */
function extractStringField(json: string, field: string): string {
  const needle = '"' + field + '"';
  let i = json.indexOf(needle);
  if (i < 0) return "";
  i = json.indexOf('"', json.indexOf(":", i + needle.length) + 1);
  if (i < 0) return "";
  i++; // past the opening quote
  let out = "";
  while (i < json.length) {
    const c = json.charCodeAt(i);
    if (c === 0x22 /* " */) break;
    if (c === 0x5c /* \ */ && i + 1 < json.length) {
      const e = json.charCodeAt(i + 1);
      if (e === 0x6e) { out += "\n"; }
      else if (e === 0x74) { out += "\t"; }
      else if (e === 0x72) { out += "\r"; }
      else if (e === 0x62) { out += "\b"; }
      else if (e === 0x66) { out += "\f"; }
      else if (e === 0x75 /* u */ && i + 5 < json.length) {
        const code = i32(parseInt(json.substring(i + 2, i + 6), 16));
        out += String.fromCharCode(code);
        i += 6;
        continue;
      } else { out += json.charAt(i + 1); }
      i += 2;
      continue;
    }
    out += json.charAt(i);
    i++;
  }
  return out;
}
