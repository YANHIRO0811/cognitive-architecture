import urllib.request, json, ssl, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def get_repo(owner, name):
    url = f'https://api.github.com/repos/{owner}/{name}'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Accept': 'application/vnd.github.v3+json'})
    resp = urllib.request.urlopen(req, timeout=15, context=ctx)
    r = json.loads(resp.read())
    print(f'\n=== {r["full_name"]} ===')
    print(f'Stars: {r["stargazers_count"]} | Forks: {r["forks_count"]} | Lang: {r["language"]}')
    print(f'Desc: {r["description"]}')
    print(f'Topics: {r.get("topics", [])}')
    print(f'License: {r.get("license", {}).get("spdx_id", "N/A")}')
    print(f'URL: {r["html_url"]}')
    print(f'Homepage: {r.get("homepage", "N/A")}')

    # Get readme
    try:
        readme_url = f'https://api.github.com/repos/{owner}/{name}/readme'
        req2 = urllib.request.Request(readme_url, headers={'User-Agent': 'Mozilla/5.0', 'Accept': 'application/vnd.github.v3+json'})
        resp2 = urllib.request.urlopen(req2, timeout=15, context=ctx)
        rm = json.loads(resp2.read())
        import base64
        content = base64.b64decode(rm['content']).decode('utf-8', errors='ignore')
        print(f'\n--- README (first 2000 chars) ---')
        print(content[:2000])
    except:
        pass

get_repo('farion1231', 'cc-switch')
get_repo('EdJb1971', 'Emergent_Cognitive_Architecture_bob')
get_repo('AstrBotDevs', 'AstrBot')
