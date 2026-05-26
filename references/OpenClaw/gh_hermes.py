import urllib.request, json, ssl, sys, io, base64
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
headers = {'User-Agent': 'Mozilla/5.0', 'Accept': 'application/vnd.github.v3+json'}

# Hermes Agent
url = 'https://api.github.com/repos/NousResearch/hermes-agent'
req = urllib.request.Request(url, headers=headers)
resp = urllib.request.urlopen(req, timeout=10, context=ctx)
r = json.loads(resp.read())
print(f'=== {r["full_name"]} ===')
print(f'Stars: {r["stargazers_count"]} | Lang: {r["language"]} | License: {(r.get("license") or {}).get("spdx_id", "N/A")}')
print(f'Desc: {r.get("description", "N/A")}')
print(f'Topics: {r.get("topics", [])}')
print(f'Homepage: {r.get("homepage", "")}')

# README
rm_url = f'https://api.github.com/repos/NousResearch/hermes-agent/readme'
req2 = urllib.request.Request(rm_url, headers=headers)
resp2 = urllib.request.urlopen(req2, timeout=10, context=ctx)
rm = json.loads(resp2.read())
content = base64.b64decode(rm['content']).decode('utf-8', errors='ignore')
out = r'C:\Users\YANHI\.openclaw-autoclaw\agents\temp\GH_NousResearch_hermes-agent_README.md'
with open(out, 'w', encoding='utf-8') as f:
    f.write(content)
print(f'README: {len(content)} chars saved')

# File tree
tree_url = 'https://api.github.com/repos/NousResearch/hermes-agent/git/trees/main?recursive=1'
try:
    req3 = urllib.request.Request(tree_url, headers=headers)
    resp3 = urllib.request.urlopen(req3, timeout=10, context=ctx)
    tree = json.loads(resp3.read())
    print('\n=== Hermes Agent Structure ===')
    dirs = set()
    for item in tree.get('tree', []):
        path = item['path']
        parts = path.split('/')
        if len(parts) == 1:
            print(f"  {path} ({item.get('size',0)})")
        else:
            dirs.add(parts[0])
    print(f'\nTop dirs: {sorted(dirs)}')
except Exception as e:
    print(f'Tree: {e}')
