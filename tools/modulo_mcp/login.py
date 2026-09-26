"""Sign the Modulo MCP in with its own OIDC session (authorization code + PKCE, offline_access).

The resulting access and refresh tokens are written to mode-0600 files for
MODULO_API_TOKEN_FILE / MODULO_OIDC_REFRESH_TOKEN_FILE. The refresh token is an
offline token: it survives the browser SSO session and stays valid while it is
used at least once per offline-session idle period (Keycloak default: 30 days).

The realm only allows redirects back to the Modulo origin, so the code is
collected from the address the browser lands on:

    python3 login.py start            # prints a sign-in URL; open it in any browser
    python3 login.py finish '<URL>'   # paste the address the browser landed on

or, when the Modulo desktop app runs with --remote-debugging-port, in one step:

    python3 login.py cdp [--port 9222]
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import secrets
import sys
import time
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlsplit
from urllib.request import Request, urlopen

try:
    from .client import ModuloClient, ModuloError
except ImportError:
    from client import ModuloClient, ModuloError

CLIENT_ID = "modulo-frontend"
CALLBACK_PATH = "/mcp-callback"
CONFIG_DIR = Path(os.environ.get("MODULO_MCP_CONFIG_DIR", Path.home() / ".config" / "modulo"))


def _base_url() -> str:
    return ModuloClient().base_url  # validates the origin (HTTPS unless localhost)


def _realm(base: str) -> str:
    return base + "/auth/realms/modulo/protocol/openid-connect"


def _pending_path() -> Path:
    return CONFIG_DIR / ".mcp-login-pending.json"


def _write_private(path: Path, text: str) -> None:
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    ModuloClient._replace_secret(path, text)


def authorization_url() -> str:
    base = _base_url()
    verifier = secrets.token_urlsafe(64)
    state = secrets.token_urlsafe(24)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    redirect = base + CALLBACK_PATH
    _write_private(_pending_path(), json.dumps({"verifier": verifier, "state": state, "redirect": redirect,
                                               "created": int(time.time())}))
    return _realm(base) + "/auth?" + urlencode({
        "client_id": CLIENT_ID, "response_type": "code", "redirect_uri": redirect,
        "scope": "openid offline_access", "state": state,
        "code_challenge": challenge, "code_challenge_method": "S256",
    })


def finish(landed_url: str) -> dict:
    pending_path = _pending_path()
    if not pending_path.is_file():
        raise ModuloError("No pending sign-in; run `login.py start` first")
    pending = json.loads(pending_path.read_text(encoding="utf-8"))
    if time.time() - pending["created"] > 600:
        raise ModuloError("The sign-in attempt expired; run `login.py start` again")
    parsed = urlsplit(landed_url.strip())
    query = parse_qs(parsed.query)
    if f"{parsed.scheme}://{parsed.netloc}{parsed.path}" != pending["redirect"]:
        raise ModuloError("That is not the Modulo MCP callback address")
    if query.get("state") != [pending["state"]]:
        raise ModuloError("Sign-in state mismatch; run `login.py start` again")
    if "code" not in query:
        raise ModuloError(f"Sign-in failed: {query.get('error', ['no code returned'])[0]}")
    body = urlencode({"grant_type": "authorization_code", "client_id": CLIENT_ID, "code": query["code"][0],
                      "redirect_uri": pending["redirect"], "code_verifier": pending["verifier"]}).encode()
    request = Request(_realm(_base_url()) + "/token", data=body, method="POST",
                      headers={"Content-Type": "application/x-www-form-urlencoded"})
    try:
        with urlopen(request, timeout=15) as response:
            tokens = json.load(response)
    except OSError:
        raise ModuloError("Token exchange failed; run `login.py start` again") from None
    finally:
        pending_path.unlink(missing_ok=True)
    access, refresh = tokens.get("access_token"), tokens.get("refresh_token")
    if not isinstance(access, str) or not isinstance(refresh, str):
        raise ModuloError("The identity provider returned no tokens")
    access_file = Path(os.environ.get("MODULO_API_TOKEN_FILE", CONFIG_DIR / "mcp-access-token"))
    refresh_file = Path(os.environ.get("MODULO_OIDC_REFRESH_TOKEN_FILE", CONFIG_DIR / "mcp-refresh-token"))
    _write_private(refresh_file, refresh)
    _write_private(access_file, access)
    claims = json.loads(base64.urlsafe_b64decode(access.split(".")[1] + "=="))
    return {"access_file": str(access_file), "refresh_file": str(refresh_file), "subject": claims.get("sub"),
            "offline": "offline_access" in tokens.get("scope", "").split()}


def via_cdp(port: int) -> dict:
    """Run the sign-in inside the desktop app's session (hidden same-origin iframe) and read the
    callback address from its network events. The code is useless without this process's PKCE
    verifier, so the page that briefly loads in the iframe cannot redeem it."""
    import websocket  # websocket-client

    url = authorization_url()
    callback = json.loads(_pending_path().read_text(encoding="utf-8"))["redirect"]
    pages = [t for t in json.load(urlopen(f"http://127.0.0.1:{port}/json/list", timeout=5)) if t["type"] == "page"]
    page = next((t for t in pages if t["url"].startswith(_base_url())), None)
    if page is None:
        raise ModuloError("No Modulo window found on the debug port")
    ws = websocket.create_connection(page["webSocketDebuggerUrl"], suppress_origin=True, timeout=30)
    ids = iter(range(1, 1_000_000))
    backlog: list[dict] = []

    def call(method: str, params: dict | None = None) -> dict:
        message = {"id": next(ids), "method": method, "params": params or {}}
        ws.send(json.dumps(message))
        while True:
            reply = json.loads(ws.recv())
            if reply.get("id") == message["id"]:
                if "error" in reply:
                    raise ModuloError(f"CDP {method} failed: {reply['error'].get('message')}")
                return reply.get("result", {})
            backlog.append(reply)

    frame_id = "modulo-mcp-login-" + secrets.token_hex(4)
    try:
        call("Network.enable")
        call("Runtime.evaluate", {"expression": (
            f"(()=>{{const f=document.createElement('iframe');f.id={json.dumps(frame_id)};"
            f"f.style.display='none';f.src={json.dumps(url)};document.body.appendChild(f);}})()")})
        deadline = time.time() + 45
        while time.time() < deadline:
            try:
                event = backlog.pop(0) if backlog else json.loads(ws.recv())
            except websocket.WebSocketTimeoutException:
                break
            landed = (event.get("params", {}).get("request") or {}).get("url", "")
            if event.get("method") == "Network.requestWillBeSent" and landed.startswith(callback + "?"):
                call("Runtime.evaluate", {"expression": f"document.getElementById({json.dumps(frame_id)})?.remove()"})
                return finish(landed)
        raise ModuloError("The desktop app has no reusable sign-in session; use `login.py start` / `finish`")
    finally:
        try:
            call("Runtime.evaluate", {"expression": f"document.getElementById({json.dumps(frame_id)})?.remove()"})
            call("Network.disable")
        finally:
            ws.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("start")
    finish_parser = sub.add_parser("finish")
    finish_parser.add_argument("landed_url")
    cdp_parser = sub.add_parser("cdp")
    cdp_parser.add_argument("--port", type=int, default=9222)
    args = parser.parse_args()
    try:
        if args.command == "start":
            print(authorization_url())
            print("\nOpen that URL, sign in, then run:\n  python3 login.py finish '<the address you landed on>'", file=sys.stderr)
            return 0
        result = finish(args.landed_url) if args.command == "finish" else via_cdp(args.port)
    except ModuloError as error:
        print(error, file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
