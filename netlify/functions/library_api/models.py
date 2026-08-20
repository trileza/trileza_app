from typing import List, Optional
from datetime import datetime
from sqlmodel import SQLModel, Field

class Book(SQLModel, table=True):
    __tablename__ = "api_books"
    id: str = Field(primary_key=True)
    title: str
    author_id: str
    author_name: str
    cover_url: str
    retail_price: float
    rental_price: float
    category: str
    description: str
    rating: float = Field(default=0.0)
    section: Optional[str] = None
    language: str = Field(default="English")
    publication_date: Optional[str] = None
    pages: Optional[int] = None
    age_rating: str = Field(default="Everyone")
    isbn: Optional[str] = None
    tags: Optional[str] = Field(default="[]")  # JSON String representing List[str]
    sample_pages: Optional[str] = Field(default="[]")  # JSON String representing List[str]
    file_url: Optional[str] = None
    book_file_name: Optional[str] = None
    material_type: str = Field(default="book")  # 'book', 'journal', 'article'
    volume: Optional[str] = None
    issue: Optional[str] = None
    journal_name: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserLibraryAccess(SQLModel, table=True):
    __tablename__ = "api_user_library_access"
    id: str = Field(primary_key=True)
    user_id: str
    book_id: str
    access_type: str  # 'own', 'borrow', 'gift'
    lifetime_rent_total: float = Field(default=0.0)
    is_author_gift: bool = Field(default=False)
    sponsored_by: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None
    returned_at: Optional[datetime] = None

class Reservation(SQLModel, table=True):
    __tablename__ = "api_reservations"
    id: str = Field(primary_key=True)
    user_id: str
    book_id: str
    status: str = Field(default="pending")  # 'pending', 'active', 'completed', 'cancelled'
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Fine(SQLModel, table=True):
    __tablename__ = "api_fines"
    id: str = Field(primary_key=True)
    user_id: str
    book_id: str
    amount: float
    status: str = Field(default="unpaid")  # 'unpaid', 'paid'
    created_at: datetime = Field(default_factory=datetime.utcnow)
    paid_at: Optional[datetime] = None

class UserReview(SQLModel, table=True):
    __tablename__ = "api_user_reviews"
    id: str = Field(primary_key=True)
    user_id: str
    user_name: str
    book_id: str
    rating: int  # 1 to 5
    comment: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Highlight(SQLModel, table=True):
    __tablename__ = "api_highlights"
    id: str = Field(primary_key=True)
    user_id: str
    book_id: str
    passage_text: str
    comment: Optional[str] = None
    color: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ReadingComment(SQLModel, table=True):
    __tablename__ = "api_comments"
    id: str = Field(primary_key=True)
    user_id: str
    user_name: str
    book_id: str
    page_index: int
    text: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
