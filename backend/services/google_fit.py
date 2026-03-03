import httpx
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

GOOGLE_FIT_URL = "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate"

async def fetch_google_fit_data(access_token: str):
    """
    Fetches steps, heart rate, and sleep data from Google Fit for the current day.
    """
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }

    # Time range: Start of today to now
    now = datetime.utcnow()
    start_of_day = datetime(now.year, now.month, now.day)
    start_time_millis = int(start_of_day.timestamp() * 1000)
    end_time_millis = int(now.timestamp() * 1000)

    # Request body for aggregation
    body = {
        "aggregateBy": [
            {"dataTypeName": "com.google.step_count.delta"},
            {"dataTypeName": "com.google.heart_rate.bpm"},
            {"dataTypeName": "com.google.sleep.segment"} # Sleep might need a different query if it spans days
        ],
        "bucketByTime": {"durationMillis": 86400000}, # 1 day bucket
        "startTimeMillis": start_time_millis,
        "endTimeMillis": end_time_millis
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(GOOGLE_FIT_URL, headers=headers, json=body)
            response.raise_for_status()
            data = response.json()
            
            steps = 0
            heart_rate_avg = 0
            sleep_hours = 0

            for bucket in data.get("bucket", []):
                for dataset in bucket.get("dataset", []):
                    data_source_id = dataset.get("dataSourceId", "")
                    
                    for point in dataset.get("point", []):
                        # Steps
                        if "step_count" in data_source_id or "step_count" in dataset.get("dataSourceId", ""): # Check type
                             for val in point.get("value", []):
                                steps += val.get("intVal", 0)
                        
                        # Heart Rate
                        if "heart_rate" in data_source_id:
                             count = 0
                             total = 0
                             for val in point.get("value", []):
                                 if "fpVal" in val:
                                     total += val["fpVal"]
                                     count += 1
                             if count > 0:
                                 heart_rate_avg = total / count
                        
                        # Sleep
                        if "sleep" in data_source_id:
                             for point in dataset.get("point", []):
                                 start = int(point.get("startTimeNanos", 0))
                                 end = int(point.get("endTimeNanos", 0))
                                 if start and end:
                                     duration_hours = (end - start) / (1e9 * 3600)
                                     sleep_hours += duration_hours

            return {
                "steps": steps,
                "heart_rate_avg": round(heart_rate_avg) if heart_rate_avg else None,
                "sleep_hours": round(sleep_hours, 1) if sleep_hours > 0 else None
            }

        except Exception as e:
            logger.error(f"Error fetching Google Fit data: {e}")
            return None
