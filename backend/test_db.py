import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

import certifi

async def test_connection():
    mongo_url = os.getenv("MONGODB_URL")
    if not mongo_url:
        print("Error: MONGODB_URL not found in .env")
        return

    print(f"Testing connection to: {mongo_url.split('@')[1]}") # Print only the host part for security/clarity

    try:
        client = AsyncIOMotorClient(mongo_url, tlsCAFile=certifi.where())
        # The is_master command is cheap and effectively tests connection availability
        await client.admin.command('ismaster')
        msg = "✅ Successfully connected to MongoDB!"
        print(msg)
        
        # List databases to be sure
        dbs = await client.list_database_names()
        print(f"Available databases: {dbs}")
        
        with open("backend/db_test_result.txt", "w") as f:
            f.write(msg + "\n" + f"Available databases: {dbs}")
        
    except Exception as e:
        msg = f"❌ Failed to connect to MongoDB: {e}"
        print(msg)
        with open("backend/db_test_result.txt", "w") as f:
            f.write(msg)

if __name__ == "__main__":
    asyncio.run(test_connection())
