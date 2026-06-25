import sys
import json
import requests
import time
import csv

# Read stdin JSON configuration
try:
    config_input = sys.stdin.read()
    if not config_input.strip():
        print("Error: Empty configuration from stdin.")
        sys.exit(1)
    config = json.loads(config_input)
except Exception as e:
    print(f"Error parsing config JSON from stdin: {e}")
    sys.exit(1)

token = config.get("token", "")
apis = config.get("apis", [])

print("Starting API Automation Runner...")
print(f"Total APIs found: {len(apis)}")
print(f"Token: {'Provided' if token else 'NoneSpecified'}")
print("-" * 60)

results = []

for index, api in enumerate(apis):
    name = api.get("name", f"API {index+1}")
    method = api.get("method", "GET").upper()
    url = api.get("url", "")
    headers = api.get("headers", {})
    body = api.get("body", "")
    body_type = api.get("bodyType", "none")
    
    # Auto-inject Bearer token if present and not overridden
    if token and "Authorization" not in headers and "authorization" not in headers:
        headers["Authorization"] = f"Bearer {token}"
        
    print(f"[{index+1}/{len(apis)}] Executing {method} {url} ({name})...")
    
    start_time = time.time()
    try:
        req_kwargs = {
            "headers": headers,
            "timeout": 15
        }
        
        # Determine body payloads
        if method in ["POST", "PUT", "PATCH", "DELETE"]:
            if body:
                if body_type == "json" or body.strip().startswith("{") or body.strip().startswith("["):
                    try:
                        req_kwargs["json"] = json.loads(body)
                    except ValueError:
                        req_kwargs["data"] = body
                else:
                    req_kwargs["data"] = body

        response = requests.request(method, url, **req_kwargs)
        latency = (time.time() - start_time) * 1000
        
        try:
            response_data = response.json()
        except:
            response_data = response.text
            
        result = {
            "id": api.get("id", index+1),
            "name": name,
            "method": method,
            "url": url,
            "status": response.status_code,
            "latency_ms": round(latency, 2),
            "response": response_data
        }
        print(f"  └─ Success: Status {response.status_code} ({round(latency, 1)}ms)")
    except Exception as e:
        latency = (time.time() - start_time) * 1000
        result = {
            "id": api.get("id", index+1),
            "name": name,
            "method": method,
            "url": url,
            "status": "ERROR",
            "latency_ms": round(latency, 2),
            "response": str(e)
        }
        print(f"  └─ Failed: {str(e)}")
        
    results.append(result)
    print("-" * 60)
    time.sleep(0.2) # Short delay between requests

# Write reports
try:
    with open("output.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print("Saved output.json")
except Exception as e:
    print(f"Failed to save output.json: {e}")

try:
    with open("output.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["id", "name", "method", "url", "status", "latency_ms", "response"])
        for r in results:
            writer.writerow([
                r["id"],
                r["name"],
                r["method"],
                r["url"],
                r["status"],
                r["latency_ms"],
                json.dumps(r["response"]) if isinstance(r["response"], (dict, list)) else r["response"]
            ])
    print("Saved output.csv")
except Exception as e:
    print(f"Failed to save output.csv: {e}")

print("Automation execution finished.")