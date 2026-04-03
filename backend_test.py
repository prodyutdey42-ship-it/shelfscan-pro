#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
import subprocess
import time

class ShelfScanAPITester:
    def __init__(self, base_url="https://sleepy-hypatia-2.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.session_token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}" if endpoint else self.api_url
        test_headers = {'Content-Type': 'application/json'}
        
        if headers:
            test_headers.update(headers)
            
        if self.session_token and 'Authorization' not in test_headers:
            test_headers['Authorization'] = f'Bearer {self.session_token}'

        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            
            if success:
                self.log_test(name, True)
                try:
                    return True, response.json()
                except:
                    return True, response.text
            else:
                details = f"Expected {expected_status}, got {response.status_code}"
                if response.text:
                    details += f" - {response.text[:200]}"
                self.log_test(name, False, details)
                return False, {}

        except Exception as e:
            self.log_test(name, False, f"Error: {str(e)}")
            return False, {}

    def use_provided_test_credentials(self):
        """Use the provided test credentials"""
        print("\n🔧 Using provided test credentials...")
        self.session_token = "test_session_1775201451902"
        self.user_id = "test-user-1775201451902"
        print(f"✅ Using session token: {self.session_token}")
        print(f"✅ Using user ID: {self.user_id}")
        return True

    def create_test_user_session(self):
        """Create test user and session in MongoDB"""
        print("\n🔧 Creating test user and session in MongoDB...")
        
        try:
            # Generate unique identifiers
            timestamp = int(time.time())
            user_id = f"test-user-{timestamp}"
            session_token = f"test_session_{timestamp}"
            email = f"test.user.{timestamp}@example.com"
            
            # MongoDB commands to create test user and session properly
            mongo_commands = f"""
var userId = "{user_id}";
var sessionToken = "{session_token}";
var email = "{email}";

// Insert user
var userResult = db.users.insertOne({{
  user_id: userId,
  email: email,
  name: "Test User",
  picture: "https://via.placeholder.com/150",
  created_at: new Date()
}});

// Insert session
var sessionResult = db.user_sessions.insertOne({{
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
}});

print("User inserted: " + userResult.acknowledged);
print("Session inserted: " + sessionResult.acknowledged);
"""
            
            # Execute MongoDB commands
            result = subprocess.run(
                ['mongosh', 'test_database', '--eval', mongo_commands],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0 and "User inserted: true" in result.stdout:
                self.session_token = session_token
                self.user_id = user_id
                print(f"✅ Test user created: {user_id}")
                print(f"✅ Session token: {session_token}")
                return True
            else:
                print(f"❌ MongoDB error: {result.stderr}")
                print(f"❌ MongoDB output: {result.stdout}")
                return False
                
        except Exception as e:
            print(f"❌ Error creating test user: {str(e)}")
            return False

    def test_health_endpoints(self):
        """Test basic health endpoints"""
        print("\n=== TESTING HEALTH ENDPOINTS ===")
        
        # Test root endpoint
        self.run_test("API Root Health Check", "GET", "", 200)
        
        # Test health endpoint
        self.run_test("API Health Endpoint", "GET", "health", 200)

    def test_unauthenticated_endpoints(self):
        """Test endpoints that should work without authentication"""
        print("\n=== TESTING UNAUTHENTICATED ACCESS ===")
        
        # Test /auth/me without token (should return 401)
        self.run_test("Auth Me (No Token)", "GET", "auth/me", 401)

    def test_authenticated_endpoints(self):
        """Test endpoints that require authentication"""
        if not self.session_token:
            print("❌ No session token available, skipping authenticated tests")
            return
            
        print("\n=== TESTING AUTHENTICATED ENDPOINTS ===")
        
        # Test /auth/me with token
        success, user_data = self.run_test("Auth Me (With Token)", "GET", "auth/me", 200)
        if success:
            print(f"   User: {user_data.get('name', 'Unknown')}")
        
        # Test dashboard stats
        success, stats = self.run_test("Dashboard Stats", "GET", "dashboard/stats", 200)
        if success:
            print(f"   Stats: {stats}")
        
        # Test audits list
        success, audits = self.run_test("Get Audits", "GET", "audits", 200)
        if success:
            print(f"   Audits count: {len(audits) if isinstance(audits, list) else 'N/A'}")
        
        # Test history
        success, history = self.run_test("Get History", "GET", "history", 200)
        if success:
            if isinstance(history, dict) and 'summary' in history:
                print(f"   History summary: {history['summary']}")

    def test_session_exchange(self):
        """Test session exchange endpoint (without actual OAuth)"""
        print("\n=== TESTING SESSION EXCHANGE ===")
        
        # This will fail without valid session_id from OAuth, but we test the endpoint exists
        self.run_test("Session Exchange (Invalid)", "POST", "auth/session", 401, 
                     data={"session_id": "invalid_session_id"})

    def test_logout(self):
        """Test logout endpoint"""
        if not self.session_token:
            return
            
        print("\n=== TESTING LOGOUT ===")
        self.run_test("Logout", "POST", "auth/logout", 200)

    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting ShelfScan AI Backend Tests")
        print(f"🌐 Testing API: {self.api_url}")
        
        # Test basic health first
        self.test_health_endpoints()
        
        # Test unauthenticated access
        self.test_unauthenticated_endpoints()
        
        # Try provided test credentials first
        if self.use_provided_test_credentials():
            self.test_authenticated_endpoints()
            self.test_logout()
        # Fallback to creating new test user for authenticated tests
        elif self.create_test_user_session():
            self.test_authenticated_endpoints()
            self.test_logout()
        else:
            print("⚠️  Skipping authenticated tests due to credential setup issues")
        
        # Test session exchange
        self.test_session_exchange()
        
        # Print final results
        print(f"\n📊 Backend Tests Summary:")
        print(f"   Tests run: {self.tests_run}")
        print(f"   Tests passed: {self.tests_passed}")
        print(f"   Success rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        return self.tests_passed, self.tests_run, self.test_results

def main():
    tester = ShelfScanAPITester()
    passed, total, results = tester.run_all_tests()
    
    # Return appropriate exit code
    return 0 if passed == total else 1

if __name__ == "__main__":
    sys.exit(main())