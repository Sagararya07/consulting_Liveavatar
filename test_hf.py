import asyncio
import httpx

async def test():
    async with httpx.AsyncClient() as client:
        headers = {'Authorization': 'Bearer YOUR_HF_TOKEN'}
        res = await client.post('https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2', headers=headers, json={'inputs': 'hello'})
        print(res.status_code)
        print(res.text)

asyncio.run(test())
