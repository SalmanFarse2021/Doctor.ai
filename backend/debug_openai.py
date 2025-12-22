import os
import asyncio
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv

load_dotenv()

async def test():
    try:
        llm = ChatOpenAI(
            model="gpt-5.1",
            api_key=os.getenv("OPENAI_API_KEY"),
            request_timeout=10
        )
        print("Attempting to invoke gpt-5.1...")
        res = await llm.ainvoke("Hello")
        print(res)
    except Exception as e:
        print(f"Caught Error: {e}")

asyncio.run(test())
