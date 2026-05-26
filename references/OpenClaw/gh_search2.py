import urllib.request, json, ssl, sys, io, time
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
H = {'User-Agent': 'Mozilla/5.0', 'Accept': 'application/vnd.github.v3+json'}

def search_github(query, per_page=5):
    import urllib.parse
    url = f'https://api.github.com/search/repositories?q={urllib.parse.quote(query)}&sort=stars&order=desc&per_page={per_page}'
    print(f'\n=== {query[:60]}... ===', flush=True)
    try:
        req = urllib.request.Request(url, headers=H)
        resp = urllib.request.urlopen(req, timeout=15)
        data = json.loads(resp.read())
        print(f'Total: {data["total_count"]} repos', flush=True)
        for item in data.get('items', [])[:per_page]:
            stars = item['stargazers_count']
            lang = item.get('language', 'N/A') or 'N/A'
            lic = (item.get('license') or {}).get('spdx_id', 'N/A')
            desc = (item.get('description') or '')[:100]
            name = item['full_name']
            pushed = item['pushed_at'][:10]
            print(f'  {stars}* [{lang}] {name} ({lic})', flush=True)
            print(f'    {desc} | {pushed}', flush=True)
    except Exception as e:
        print(f'  ERROR: {e}', flush=True)
    time.sleep(1.5)

searches = [
    'cognitive architecture multi agent brain LLM',
    'AI memory long term episodic RAG vector',
    'multi agent framework parallel LLM orchestration',
    'emotion sentiment safety guard AI agent',
    'context window attention management LLM agent',
    'reinforcement learning LLM agent strategy',
    'knowledge graph agent memory neo4j LLM',
    'theory mind user modeling AI agent personalization',
    'MCP tool orchestration agent function calling',
    'meta cognition self reflection LLM uncertainty',
    'skill learning procedural improvement DSPy prompt',
    'brain inspired neural architecture agent computing',
]

for s in searches:
    search_github(s, 5)
    time.sleep(1)

print('\n=== DONE ===', flush=True)
