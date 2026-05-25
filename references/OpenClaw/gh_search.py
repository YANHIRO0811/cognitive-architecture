import urllib.request, urllib.parse, json, ssl, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def search_gh(query, label, n=5):
    url = f'https://api.github.com/search/repositories?q={urllib.parse.quote(query)}&sort=stars&order=desc&per_page={n}'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Accept': 'application/vnd.github.v3+json'})
    resp = urllib.request.urlopen(req, timeout=15, context=ctx)
    data = json.loads(resp.read())
    print(f'\n=== {label} ({data["total_count"]} repos) ===')
    for r in data.get('items', [])[:n]:
        desc = (r['description'] or '(no desc)')[:180]
        lang = r.get('language', '?')
        stars = r['stargazers_count']
        print(f'{r["full_name"]}  Stars:{stars}  Lang:{lang}')
        print(f'  {desc}')
        print(f'  {r["html_url"]}')
        print()

# 1. OpenClaw 社区
search_gh('openclaw agent assistant', 'OpenClaw')

# 2. 脑启发架构
search_gh('cognitive architecture multi agent brain', '脑启发多Agent')

# 3. 桌面级 agent 框架
search_gh('desktop ai agent framework autonomous', '桌面AI Agent')
