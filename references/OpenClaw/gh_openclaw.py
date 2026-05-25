import urllib.request, json, ssl, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
headers = {'User-Agent': 'Mozilla/5.0', 'Accept': 'application/vnd.github.v3+json'}

# Search all repos mentioning openclaw
for q in ['openclaw', 'openclaw agent', 'openclaw fork', 'openclaw plugin', 'openclaw app']:
    url = f'https://api.github.com/search/repositories?q={urllib.parse.quote(q)}&sort=stars&order=desc&per_page=5'
    req = urllib.request.Request(url, headers=headers)
    resp = urllib.request.urlopen(req, timeout=10, context=ctx)
    data = json.loads(resp.read())
    print(f'\n=== "{q}" ({data["total_count"]} repos) ===')
    for r in data.get('items', [])[:5]:
        desc = (r.get('description') or '(no desc)')[:150]
        print(f'{r["full_name"]}  Stars:{r["stargazers_count"]}  Lang:{r.get("language","?")}')
        print(f'  {desc}')
        print(f'  {r["html_url"]}')
        print()
