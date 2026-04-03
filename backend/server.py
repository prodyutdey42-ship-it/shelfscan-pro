from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, UploadFile, File, Form, Depends
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime

class SessionRequest(BaseModel):
    session_id: str

class AuditResult(BaseModel):
    audit_id: str
    user_id: str
    section_name: str
    image_data: Optional[str] = None
    compliance_score: int
    out_of_stock: List[str]
    misplaced_items: List[str]
    recommendations: List[str]
    created_at: datetime

class AuditCreate(BaseModel):
    section_name: str
    image_base64: str

class DashboardStats(BaseModel):
    total_audits: int
    avg_score: int
    this_week: int

# ==================== AUTH HELPERS ====================

async def get_current_user(request: Request) -> dict:
    """Get current user from session token in cookie or Authorization header"""
    session_token = request.cookies.get("session_token")
    
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    user = await db.users.find_one(
        {"user_id": session["user_id"]},
        {"_id": 0}
    )
    
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/session")
async def exchange_session(request: SessionRequest, response: Response):
    """Exchange session_id from Emergent Auth for session data"""
    try:
        async with httpx.AsyncClient() as client_http:
            auth_response = await client_http.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": request.session_id}
            )
            
            if auth_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session_id")
            
            auth_data = auth_response.json()
        
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        email = auth_data.get("email")
        name = auth_data.get("name")
        picture = auth_data.get("picture")
        session_token = auth_data.get("session_token")
        
        existing_user = await db.users.find_one({"email": email}, {"_id": 0})
        
        if existing_user:
            user_id = existing_user["user_id"]
            await db.users.update_one(
                {"email": email},
                {"$set": {"name": name, "picture": picture}}
            )
        else:
            await db.users.insert_one({
                "user_id": user_id,
                "email": email,
                "name": name,
                "picture": picture,
                "created_at": datetime.now(timezone.utc)
            })
        
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        await db.user_sessions.insert_one({
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc)
        })
        
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            path="/",
            max_age=7 * 24 * 60 * 60
        )
        
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        return user
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Session exchange error: {e}")
        raise HTTPException(status_code=500, detail="Authentication failed")

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    """Get current authenticated user"""
    return user

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout user and clear session"""
    session_token = request.cookies.get("session_token")
    
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie(
        key="session_token",
        path="/",
        secure=True,
        samesite="none"
    )
    
    return {"message": "Logged out successfully"}

# ==================== AUDIT ROUTES ====================

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(user: dict = Depends(get_current_user)):
    """Get dashboard statistics for current user"""
    user_id = user["user_id"]
    
    total_audits = await db.audits.count_documents({"user_id": user_id})
    
    pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": None, "avg_score": {"$avg": "$compliance_score"}}}
    ]
    result = await db.audits.aggregate(pipeline).to_list(1)
    avg_score = int(result[0]["avg_score"]) if result and result[0].get("avg_score") else 0
    
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    this_week = await db.audits.count_documents({
        "user_id": user_id,
        "created_at": {"$gte": week_ago}
    })
    
    return {
        "total_audits": total_audits,
        "avg_score": avg_score,
        "this_week": this_week
    }

@api_router.get("/audits")
async def get_audits(user: dict = Depends(get_current_user)):
    """Get all audits for current user"""
    audits = await db.audits.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    for audit in audits:
        if isinstance(audit.get("created_at"), datetime):
            audit["created_at"] = audit["created_at"].isoformat()
    
    return audits

@api_router.get("/audits/{audit_id}")
async def get_audit(audit_id: str, user: dict = Depends(get_current_user)):
    """Get a specific audit"""
    audit = await db.audits.find_one(
        {"audit_id": audit_id, "user_id": user["user_id"]},
        {"_id": 0}
    )
    
    if not audit:
        raise HTTPException(status_code=404, detail="Audit not found")
    
    if isinstance(audit.get("created_at"), datetime):
        audit["created_at"] = audit["created_at"].isoformat()
    
    return audit

@api_router.post("/audits/analyze")
async def analyze_shelf(
    section_name: str = Form(...),
    image: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    """Analyze a shelf image using AI"""
    try:
        image_content = await image.read()
        image_base64 = base64.b64encode(image_content).decode('utf-8')
        
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="AI service not configured")
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"audit_{uuid.uuid4().hex[:8]}",
            system_message="""You are a retail shelf audit expert AI. Analyze shelf images and provide:
1. A compliance score (0-100) based on stock levels, organization, and product placement
2. List of out-of-stock issues (empty spaces, missing products)
3. List of misplaced items (products in wrong location, disorganized items)
4. Actionable recommendations for improvement

Respond in this exact JSON format:
{
    "compliance_score": <number 0-100>,
    "out_of_stock": ["issue 1", "issue 2"],
    "misplaced_items": ["issue 1", "issue 2"],
    "recommendations": ["recommendation 1", "recommendation 2"]
}

Be specific about shelf locations (top/middle/bottom, left/right) in your observations."""
        ).with_model("openai", "gpt-4o")
        
        image_content_obj = ImageContent(image_base64=image_base64)
        
        user_message = UserMessage(
            text=f"Analyze this retail shelf image from the '{section_name}' section. Identify stock issues, misplacements, and provide a compliance score with recommendations.",
            image_contents=[image_content_obj]
        )
        
        response = await chat.send_message(user_message)
        
        import json
        import re
        
        json_match = re.search(r'\{[\s\S]*\}', response)
        if json_match:
            analysis = json.loads(json_match.group())
        else:
            analysis = {
                "compliance_score": 50,
                "out_of_stock": ["Unable to analyze image properly"],
                "misplaced_items": [],
                "recommendations": ["Please try uploading a clearer image"]
            }
        
        audit_id = f"audit_{uuid.uuid4().hex[:12]}"
        audit_doc = {
            "audit_id": audit_id,
            "user_id": user["user_id"],
            "section_name": section_name,
            "image_data": image_base64[:100] + "...",
            "compliance_score": analysis.get("compliance_score", 0),
            "out_of_stock": analysis.get("out_of_stock", []),
            "misplaced_items": analysis.get("misplaced_items", []),
            "recommendations": analysis.get("recommendations", []),
            "created_at": datetime.now(timezone.utc)
        }
        
        await db.audits.insert_one(audit_doc)
        
        audit_doc.pop("_id", None)
        audit_doc["created_at"] = audit_doc["created_at"].isoformat()
        
        return audit_doc
        
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {e}")
        raise HTTPException(status_code=500, detail="Failed to parse AI response")
    except Exception as e:
        logger.error(f"Analysis error: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@api_router.delete("/audits/{audit_id}")
async def delete_audit(audit_id: str, user: dict = Depends(get_current_user)):
    """Delete an audit"""
    result = await db.audits.delete_one({
        "audit_id": audit_id,
        "user_id": user["user_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Audit not found")
    
    return {"message": "Audit deleted successfully"}

# ==================== HISTORY ROUTES ====================

@api_router.get("/history")
async def get_history(user: dict = Depends(get_current_user)):
    """Get complete history of uploads and tasks for current user"""
    audits = await db.audits.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    for audit in audits:
        if isinstance(audit.get("created_at"), datetime):
            audit["created_at"] = audit["created_at"].isoformat()
    
    total_count = len(audits)
    total_score = sum(a.get("compliance_score", 0) for a in audits)
    avg_score = int(total_score / total_count) if total_count > 0 else 0
    
    critical_count = sum(1 for a in audits if a.get("compliance_score", 0) < 40)
    warning_count = sum(1 for a in audits if 40 <= a.get("compliance_score", 0) < 70)
    good_count = sum(1 for a in audits if a.get("compliance_score", 0) >= 70)
    
    return {
        "audits": audits,
        "summary": {
            "total_audits": total_count,
            "average_score": avg_score,
            "critical_count": critical_count,
            "warning_count": warning_count,
            "good_count": good_count
        }
    }

# ==================== HEALTH CHECK ====================

@api_router.get("/")
async def root():
    return {"message": "ShelfScan AI API", "status": "healthy"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
