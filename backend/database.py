import os
from motor.motor_asyncio import AsyncIOMotorClient
import certifi
from dotenv import load_dotenv

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL")
DB_NAME = os.getenv("DB_NAME")

class Database:
    client: AsyncIOMotorClient = None

    async def connect(self):
        if not MONGODB_URL:
            print("MONGODB_URL not found in environment variables")
            return
        
        self.client = AsyncIOMotorClient(MONGODB_URL, tlsCAFile=certifi.where())
        try:
            await self.client.admin.command('ping')
            print("Connected to MongoDB")
        except Exception as e:
            print(f"Failed to connect to MongoDB: {e}")
            self.client = None

    def close(self):
        if self.client:
            self.client.close()
            print("Disconnected from MongoDB")

    def get_db(self):
        if self.client:
            return self.client[DB_NAME]
        return None

db = Database()
