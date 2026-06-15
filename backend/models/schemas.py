from pydantic import BaseModel
from typing import Optional
from uuid import UUID


class UserCreate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None


class UserResponse(BaseModel):
    id: UUID
    name: Optional[str]
    email: Optional[str]


class QueryRequest(BaseModel):
    user_id: str
    query: str
    language: Optional[str] = "en"


class QueryResponse(BaseModel):
    answer: str
    user_id: str


class IngestResponse(BaseModel):
    message: str
    chunks_stored: int
