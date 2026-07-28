#!/usr/bin/env python3
# Glidr load test — simulates N concurrent logged-in users with human-ish
# pacing against the heaviest read endpoints. Pure stdlib (no Node needed).
#
#   python3 scripts/load-test.py https://glidr.no "<cookie1>[,<cookie2>,...]" [users=300] [seconds=60]
#
# Cookies: log in in the browser -> DevTools -> Application -> Cookies ->
# copy connect.sid as "connect.sid=s%3A...". Pass SEVERAL cookies (comma-
# separated) from accounts on DIFFERENT teams to spread load across team
# data — virtual users are distributed round-robin over the cookies.
#
# Each virtual user keeps ONE persistent TLS connection (like a browser tab),
# ramps up over ~20 s, and paces requests 0.2-1.0 s apart. 300 users at this
# pacing is roughly 400 req/s — far above what 300 REAL users generate, so a
# pass here is a comfortable margin.
import http.client
import json
import random
import ssl
import sys
import threading
import time
from urllib.parse import urlparse

if len(sys.argv) < 3:
    print('Usage: python3 scripts/load-test.py <baseUrl> "<cookie>[,<cookie>...]" [users=300] [seconds=60]')
    sys.exit(1)

BASE = urlparse(sys.argv[1])
COOKIES = [c.strip() for c in sys.argv[2].split(",") if c.strip()]
USERS = int(sys.argv[3]) if len(sys.argv) > 3 else 300
SECONDS = int(sys.argv[4]) if len(sys.argv) > 4 else 60
RAMP_S = min(20, SECONDS / 3)

GETS = [
    "/api/tests", "/api/products", "/api/weather", "/api/series",
    "/api/auth/me", "/api/watch/queue", "/api/kick-tests", "/api/user/teams",
    "/api/athletes", "/api/tests/recent-results", "/api/grind-profiles",
    "/api/athlete-transfers", "/api/athlete-loans",
]

CTX = ssl.create_default_context()
lock = threading.Lock()
stats = {"ok": 0, "fail": 0, "times": [], "codes": {}}
test_ids: dict[str, list[int]] = {}


def connect() -> http.client.HTTPSConnection | http.client.HTTPConnection:
    if BASE.scheme == "https":
        return http.client.HTTPSConnection(BASE.netloc, context=CTX, timeout=30)
    return http.client.HTTPConnection(BASE.netloc, timeout=30)


def request(conn, method: str, path: str, cookie: str, body: str | None = None):
    headers = {"Cookie": cookie, "Accept": "application/json"}
    if body is not None:
        headers["Content-Type"] = "application/json"
    conn.request(method, path, body=body, headers=headers)
    res = conn.getresponse()
    data = res.read()
    return res.status, data


def prime(cookie: str):
    """Fetch test ids once per cookie so VUs can exercise the bulk endpoint."""
    try:
        conn = connect()
        status, data = request(conn, "GET", "/api/tests", cookie)
        conn.close()
        if status == 200:
            ids = [t["id"] for t in json.loads(data) if isinstance(t, dict) and "id" in t]
            test_ids[cookie] = ids[:200]
    except Exception:
        test_ids[cookie] = []


def vu(index: int, end_at: float):
    cookie = COOKIES[index % len(COOKIES)]
    time.sleep(RAMP_S * index / max(1, USERS))  # ramp-up
    conn = connect()
    while time.time() < end_at:
        ids = test_ids.get(cookie) or []
        use_bulk = ids and random.random() < 0.15
        if use_bulk:
            method, path = "POST", "/api/test-entries/bulk"
            body = json.dumps({"ids": random.sample(ids, min(25, len(ids)))})
        else:
            method, path, body = "GET", random.choice(GETS), None
        t0 = time.time()
        try:
            status, _ = request(conn, method, path, cookie, body)
            ms = (time.time() - t0) * 1000
            with lock:
                stats["times"].append(ms)
                stats["codes"][status] = stats["codes"].get(status, 0) + 1
                if 200 <= status < 400:
                    stats["ok"] += 1
                else:
                    stats["fail"] += 1
        except Exception:
            try:
                conn.close()
            except Exception:
                pass
            conn = connect()  # stale keep-alive — reconnect like a browser would
            with lock:
                stats["fail"] += 1
                stats["codes"]["ERR"] = stats["codes"].get("ERR", 0) + 1
        time.sleep(0.2 + random.random() * 0.8)  # human-ish pacing
    try:
        conn.close()
    except Exception:
        pass


def main():
    print(f"Load test: {USERS} users x {SECONDS}s against {BASE.geturl()}  ({len(COOKIES)} session(s)/team(s))")
    for c in COOKIES:
        prime(c)
    print(f"Primed bulk ids per session: {[len(v) for v in test_ids.values()]}")
    end_at = time.time() + SECONDS
    threads = [threading.Thread(target=vu, args=(i, end_at), daemon=True) for i in range(USERS)]
    t0 = time.time()
    for t in threads:
        t.start()
    # progress line every 10 s
    while any(t.is_alive() for t in threads):
        time.sleep(10)
        with lock:
            n = stats["ok"] + stats["fail"]
            times = sorted(stats["times"])
        if times:
            p50 = times[int(len(times) * 0.5)]
            print(f"  … {n} requests, p50 {p50:.0f} ms, failures {stats['fail']}")
    times = sorted(stats["times"])
    total = stats["ok"] + stats["fail"]

    def pct(q):
        return times[min(len(times) - 1, int(len(times) * q))] if times else 0

    print(f"\nDone in {time.time() - t0:.1f}s")
    print(f"Requests: {total}  OK: {stats['ok']}  Failed: {stats['fail']} ({stats['fail'] / max(1, total) * 100:.1f}%)")
    print(f"Latency  p50: {pct(0.5):.0f}ms  p90: {pct(0.9):.0f}ms  p99: {pct(0.99):.0f}ms  max: {times[-1] if times else 0:.0f}ms")
    print(f"Status codes: {stats['codes']}")
    print("\nPASS — holds this load." if stats["fail"] == 0 else "\nFAILURES — check Render logs/metrics before winter.")


if __name__ == "__main__":
    main()
