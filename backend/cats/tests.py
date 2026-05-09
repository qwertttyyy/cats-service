from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from cats.models import CoatType

User = get_user_model()


class AuthApiTests(TestCase):
    def test_user_can_register(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "username": "ivan",
                "password": "StrongPassword123!",
                "first_name": "Ivan",
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("public_id", response.json())
        self.assertNotIn("password", response.json())
        self.assertTrue(User.objects.filter(username="ivan").exists())

    def test_user_can_obtain_jwt(self):
        User.objects.create_user(
            username="ivan", password="StrongPassword123!"
        )

        response = self.client.post(
            "/api/auth/token/",
            {"username": "ivan", "password": "StrongPassword123!"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.json())
        self.assertIn("refresh", response.json())


class CatApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="owner", password="StrongPassword123!"
        )
        self.other_user = User.objects.create_user(
            username="other", password="StrongPassword123!"
        )
        self.coat_type, _ = CoatType.objects.get_or_create(
            slug="short",
            defaults={"name": "короткошёрстная", "sort_order": 20},
        )
        self.client.force_authenticate(self.user)

    def test_user_can_create_cat(self):
        response = self.client.post(
            "/api/cats/",
            {
                "name": "Murka",
                "age_months": 14,
                "breed": "Siberian",
                "coat_type": "short",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        payload = response.json()
        self.assertEqual(payload["age_display"], "1 год 2 месяца")
        self.assertEqual(payload["coat_type"], "short")

    def test_user_does_not_see_other_users_cat(self):
        other_client = APIClient()
        other_client.force_authenticate(self.other_user)
        create_response = other_client.post(
            "/api/cats/",
            {"name": "Barsik", "age_months": 24, "breed": "Maine Coon"},
            format="json",
        )
        cat_public_id = create_response.json()["public_id"]

        list_response = self.client.get("/api/cats/")
        detail_response = self.client.get(f"/api/cats/{cat_public_id}/")

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.json()["count"], 0)
        self.assertEqual(
            detail_response.status_code, status.HTTP_404_NOT_FOUND
        )

    def test_age_months_validation(self):
        response = self.client.post(
            "/api/cats/",
            {"name": "Murka", "age_months": 481, "breed": "Siberian"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("age_months", response.json())

    def test_coat_types_are_available(self):
        response = self.client.get("/api/coat-types/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        slugs = {item["slug"] for item in response.json()["results"]}
        self.assertIn("short", slugs)

    def test_breeders_list_does_not_include_current_user(self):
        response = self.client.get("/api/breeders/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        usernames = {item["username"] for item in response.json()["results"]}
        self.assertIn("other", usernames)
        self.assertNotIn("owner", usernames)
