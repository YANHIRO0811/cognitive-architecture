import urllib.request, json, ssl, sys, io, base64
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
headers = {'User-Agent': 'Mozilla/5.0', 'Accept': 'application/vnd.github.v3+json'}

repos = [
    ('openclaw', 'openclaw'),
    ('win4r', 'ClawTeam-OpenClaw'),
    ('Martian-Engineering', 'lossless-claw'),
    ('nanocoai', 'nanoclaw'),
    ('iOfficeAI', 'AionUi'),
]

for owner, name in repos:
    url = f'https://api.github.com/repos/{owner}/{name}'
    try:
        req = urllib.request.Request(url, headers=headers)
        resp = urllib.request.urlopen(req, timeout=10, context=ctx)
        r = json.loads(resp.read())
        print(f'\n=== {r["full_name"]} ===')
        print(f'Stars: {r["stargazers_count"]} | Forks: {r["forks_count"]}')
        print(f'Lang: {r["language"]} | License: {(r.get("license") or {}).get("spdx_id", "N/A")}')
        print(f'Desc: {r.get("description", "N/A")}')
        print(f'Topics: {r.get("topics", [])}')
        print(f'Archived: {r.get("archived", False)}')
        print(f'URL: {r["html_url"]}')
        
        # Get readme
        try:
            rm_url = f'https://api.github.com/repos/{owner}/{name}/readme'
            req2 = urllib.request.Request(rm_url, headers=headers)
            resp2 = urllib.request.urlopen(req2, timeout=10, context=ctx)
            rm = json.loads(resp2.read())
            content = base64.b64decode(rm['content']).decode('utf-8', errors='ignore')
            print(f'README: {len(content)} chars')
            # Save readme
            out = f'C:\\Users\\YANHI\\.openclaw-autoclaw\\agents\\temp\\GH_{owner}_{name}_README.md'
            with open(out, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f'  Saved to temp/GH_{owner}_{name}_README.md')
        except Exception as e:
            print(f'  README: {e}')
    except Exception as e:
        print(f'\n[{owner}/{name}] ERROR: {e}')
