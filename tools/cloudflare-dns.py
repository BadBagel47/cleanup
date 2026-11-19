#!/usr/bin/env python3
"""Creates the DNS records listed in dns/records.json at Cloudflare.

Only ever creates records. A record that already exists exactly as listed is
left alone; anything else under the same name stops the run with an error,
so an existing record is never changed or removed by this script.

Needs the environment variable CLOUDFLARE_API_TOKEN (a token with Zone Read
and DNS Edit). Run from the repo root:  python3 tools/cloudflare-dns.py
With --dry-run it only reports what it would do.
"""
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

API = "https://api.cloudflare.com/client/v4"


def call(method, path, token, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method, headers={
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            out = json.load(res)
    except urllib.error.HTTPError as err:
        try:
            out = json.load(err)
        except ValueError:
            out = {"success": False, "errors": [{"message": "HTTP %d" % err.code}]}
    if not out.get("success"):
        msgs = "; ".join(e.get("message", "?") for e in out.get("errors", []))
        sys.exit("Cloudflare refused %s %s: %s" % (method, path.split("?")[0], msgs))
    return out["result"]


def summary(line):
    print(line)
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path:
        with open(path, "a", encoding="utf-8") as f:
            f.write(line + "\n")


def main():
    dry = "--dry-run" in sys.argv
    token = os.environ.get("CLOUDFLARE_API_TOKEN")
    if not token:
        sys.exit("CLOUDFLARE_API_TOKEN is not set (add it as a GitHub secret).")
    with open("dns/records.json", encoding="utf-8") as f:
        wanted = json.load(f)
    zone_name = wanted["zone"]
    zones = call("GET", "/zones?" + urllib.parse.urlencode({"name": zone_name}), token)
    if len(zones) != 1:
        sys.exit("Zone %s not found for this token." % zone_name)
    zone = zones[0]["id"]

    failed = False
    for rec in wanted["records"]:
        fqdn = zone_name if rec["name"] in ("@", zone_name) else rec["name"] + "." + zone_name
        existing = call("GET", "/zones/%s/dns_records?%s" % (zone, urllib.parse.urlencode({"name": fqdn, "per_page": 100})), token)
        same = [r for r in existing if r["type"] == rec["type"]
                and r["content"].rstrip(".").lower() == rec["content"].rstrip(".").lower()
                and bool(r.get("proxied")) == bool(rec.get("proxied"))]
        if same and len(existing) == 1:
            summary("- `%s` %s → %s: already in place, nothing to do." % (fqdn, rec["type"], rec["content"]))
            continue
        if existing:
            failed = True
            found = ", ".join("%s → %s (%s)" % (r["type"], r["content"], "proxied" if r.get("proxied") else "DNS only") for r in existing)
            summary("- `%s`: STOPPED, other records already exist under this name: %s. Nothing was changed." % (fqdn, found))
            continue
        if dry:
            summary("- `%s` %s → %s: would be created (dry run)." % (fqdn, rec["type"], rec["content"]))
            continue
        call("POST", "/zones/%s/dns_records" % zone, token, {
            "type": rec["type"], "name": fqdn, "content": rec["content"],
            "proxied": bool(rec.get("proxied")), "ttl": 1, "comment": rec.get("comment", ""),
        })
        summary("- `%s` %s → %s (%s): created." % (fqdn, rec["type"], rec["content"], "proxied" if rec.get("proxied") else "DNS only"))
    if failed:
        sys.exit(1)


main()
