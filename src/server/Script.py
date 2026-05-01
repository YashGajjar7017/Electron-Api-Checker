import requests
import json
import csv
import time

BASE_URL = "http://192.168.4.1/api/history?day=2026-04-29&vd=5&offset={id}&limit=96"

START_ID = 0
END_ID = 200
STEP = 5
DELAY_SECONDS = 0.5   # safer delay

TOKEN = input()

HEADERS = {
    "Authorization": f"Bearer {TOKEN}"
}

results = []

for request_id in range(START_ID, END_ID + 1, STEP):
    url = BASE_URL.format(id=request_id)

    try:
        start = time.time()
        response = requests.get(
            url,
            headers=HEADERS,
            timeout=10
        )
        latency = (time.time() - start) * 1000

        try:
            parsed = response.json()
        except:
            parsed = response.text

        result = {
            "id": request_id,
            "status": response.status_code,
            "latency_ms": round(latency, 3),
            "response": parsed
        }

        print(f"SUCCESS {request_id} -> {response.status_code}")

    except Exception as e:
        result = {
            "id": request_id,
            "status": "ERROR",
            "latency_ms": None,
            "response": str(e)
        }

        print(f"FAILED {request_id}")

    results.append(result)

    time.sleep(DELAY_SECONDS)


# Save JSON
with open("output.json", "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2)

# Save CSV
with open("output.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(["id", "status", "latency_ms", "response"])

    for row in results:
        writer.writerow([
            row["id"],
            row["status"],
            row["latency_ms"],
            json.dumps(row["response"])
        ])

print("Done.")