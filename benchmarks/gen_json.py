import json
import os
import random
import time

def generate_realistic_data(num_entries):
    first_names = ["James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda", "William", "Elizabeth"]
    last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez"]
    companies = ["TechCorp", "InnovateSoft", "GlobalLogistics", "BioGen", "EcoEnergy", "FinStream", "MediaHub", "AlphaDesign"]
    cities = ["New York", "San Francisco", "London", "Tokyo", "Berlin", "Paris", "Sydney", "Toronto"]
    tags_pool = ["productivity", "efficiency", "innovation", "management", "software", "hardware", "cloud", "ai", "data"]
    
    data = []
    base_time = 1700000000 # ~Nov 2023
    
    for i in range(num_entries):
        first = random.choice(first_names)
        last = random.choice(last_names)
        company = random.choice(companies)
        
        # Varied text length for "about"
        sentences = [
            "Providing high-quality solutions for modern businesses.",
            "Leading the industry in innovation and customer satisfaction.",
            "Specializing in cloud-native applications and scalable architectures.",
            "Dedicated to sustainable growth and ethical technology development.",
            "Transforming the digital landscape with cutting-edge tools.",
            "A pioneer in data-driven decision making and automation.",
            "Building the future of interconnected systems and smart devices."
        ]
        about_text = " ".join(random.sample(sentences, random.randint(2, 5)))
        
        entry = {
            "metadata": {
                "id": i,
                "uuid": f"{random.getrandbits(128):032x}",
                "timestamp": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(base_time + i * 3600)),
                "version": f"{random.randint(1, 5)}.{random.randint(0, 9)}.{random.randint(0, 99)}"
            },
            "profile": {
                "name": f"{first} {last}",
                "email": f"{first.lower()}.{last.lower()}@{company.lower()}.com",
                "phone": f"+1-{random.randint(200, 999)}-{random.randint(200, 999)}-{random.randint(1000, 9999)}",
                "address": {
                    "street": f"{random.randint(100, 9999)} {random.choice(['Main St', 'Oak Ave', 'Park Blvd', 'Cedar Ln'])}",
                    "city": random.choice(cities),
                    "postal_code": f"{random.randint(10000, 99999)}",
                    "coordinates": {
                        "lat": round(random.uniform(-90, 90), 6),
                        "lng": round(random.uniform(-180, 180), 6)
                    }
                },
                "isActive": random.random() > 0.2,
                "balance": round(random.uniform(1000, 50000), 2)
            },
            "work": {
                "company": company,
                "department": random.choice(["Engineering", "Marketing", "Sales", "HR", "Legal", "Operations"]),
                "role": random.choice(["Manager", "Senior Developer", "Analyst", "Specialist", "Director"]),
                "salary": random.randint(60000, 180000),
                "tags": random.sample(tags_pool, random.randint(3, 6))
            },
            "about": about_text,
            "preferences": {
                "notifications": {
                    "email": True,
                    "sms": random.random() > 0.5,
                    "push": random.random() > 0.3
                },
                "theme": random.choice(["light", "dark", "system"]),
                "language": random.choice(["en-US", "en-GB", "de-DE", "fr-FR", "ja-JP"])
            }
        }
        data.append(entry)
    
    return data

output_path = "test-data/silesia/large.json"
# Aiming for ~1MB with more varied data
# Each entry is roughly 800-1000 bytes now with nesting
num_entries = 1100

data = generate_realistic_data(num_entries)

os.makedirs(os.path.dirname(output_path), exist_ok=True)
with open(output_path, "w") as f:
    json.dump(data, f, indent=2)

print(f"File created: {output_path}, size: {os.path.getsize(output_path) / 1024:.2f} KB")

