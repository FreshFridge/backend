import os
import random

from locust import HttpUser, between, task


AUTH_TOKEN = os.getenv("AUTH_TOKEN")
LOGIN_EMAIL = os.getenv("LOGIN_EMAIL")
LOGIN_PASSWORD = os.getenv("LOGIN_PASSWORD")
IOT_API_KEY = os.getenv("IOT_API_KEY")
FRIDGE_ID = os.getenv("FRIDGE_ID") or os.getenv("IOT_FRIDGE_ID") or "22222222-2222-4222-8222-222222222222"


class FreshFridgeUser(HttpUser):
    wait_time = between(1, 3)

    def on_start(self):
        self.auth_token = AUTH_TOKEN

        if self.auth_token or not (LOGIN_EMAIL and LOGIN_PASSWORD):
            return

        response = self.client.post(
            "/api/auth/login",
            json={"email": LOGIN_EMAIL, "password": LOGIN_PASSWORD},
            name="/api/auth/login",
        )

        if response.ok:
            self.auth_token = response.json().get("accessToken")

    def auth_headers(self):
        if not self.auth_token:
            return {}

        return {"Authorization": f"Bearer {self.auth_token}"}

    @task(4)
    def health(self):
        self.client.get("/health", name="/health")

    @task(2)
    def current_user(self):
        if self.auth_token:
            self.client.get("/api/auth/me", headers=self.auth_headers(), name="/api/auth/me")

    @task(3)
    def products(self):
        if self.auth_token:
            self.client.get("/api/products", headers=self.auth_headers(), name="/api/products")

    @task(2)
    def telemetry(self):
        headers = {"Content-Type": "application/json"}

        if IOT_API_KEY:
            headers["x-api-key"] = IOT_API_KEY
        elif self.auth_token:
            headers.update(self.auth_headers())
        else:
            return

        payload = {
            "fridgeId": FRIDGE_ID,
            "temperature": round(random.uniform(2.0, 8.0), 2),
            "humidity": round(random.uniform(35.0, 75.0), 2),
            "doorOpen": random.random() < 0.15,
        }

        self.client.post(
            "/api/iot/telemetry",
            json=payload,
            headers=headers,
            name="/api/iot/telemetry",
        )
