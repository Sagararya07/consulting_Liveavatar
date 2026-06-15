import os
from pathlib import Path
import httpx
from dotenv import load_dotenv

# Load the unified .env from the project root (one level up from /backend)
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

API_KEY = os.getenv("HEYGEN_API_KEY")

async def test_get_avatars():
    if not API_KEY:
        print("HEYGEN_API_KEY is not set!")
        return

    # Try looks endpoint
    url = "https://api.heygen.com/v3/avatars/looks"
    headers = {
        "x-api-key": API_KEY,
        "accept": "application/json"
    }
    
    print(f"Querying looks endpoint with API key: {API_KEY[:8]}...")
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers=headers)
        print("Status code:", resp.status_code)
        if resp.status_code == 200:
            data = resp.json()
            print("Response contains", len(data.get("data", {}).get("looks", [])), "looks")
            for look in data.get("data", {}).get("looks", [])[:5]:
                print(f"- Look ID: {look.get('id')}, Avatar ID: {look.get('avatar_id')}, Preview: {look.get('preview_image_url')}")
        else:
            print("Response content:", resp.text)

        # Try groups endpoint
        url_groups = "https://api.heygen.com/v3/avatars"
        resp_groups = await client.get(url_groups, headers=headers)
        print("Groups Status code:", resp_groups.status_code)
        if resp_groups.status_code == 200:
            data_groups = resp_groups.json()
            print("Response contains", len(data_groups.get("data", {}).get("avatars", [])), "avatars")
            for av in data_groups.get("data", {}).get("avatars", [])[:5]:
                print(f"- Group ID: {av.get('id')}, Preview: {av.get('preview_image_url')}")
        else:
            print("Response content:", resp_groups.text)

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_get_avatars())
