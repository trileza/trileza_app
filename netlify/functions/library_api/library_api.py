import json
from uuid import uuid4
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from sqlmodel import Session, select

from models import Book, UserLibraryAccess, Reservation, Fine, UserReview, Highlight, ReadingComment
from database import get_session, init_db

from fastapi.middleware.gzip import GZipMiddleware

app = FastAPI(
    title="Library Management API",
    openapi_url="/api/library/openapi.json",
    docs_url="/api/library/docs"
)

app.add_middleware(GZipMiddleware, minimum_size=1000)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Middleware to rewrite and normalize paths for Netlify Function routing compatibility.
# Maps incoming paths (e.g. /.netlify/functions/library_api/books or /books)
# to match the mapped "/api/library/books" FastAPI routing signatures.
@app.middleware("http")
async def normalize_path_middleware(request, call_next):
    path = request.scope.get("path", "")
    
    # Strip Netlify function prefix if present
    if path.startswith("/.netlify/functions/library_api"):
        path = path[len("/.netlify/functions/library_api"):]
        
    # If the path doesn't start with /api/library, prepend it
    if not path.startswith("/api/library"):
        path = "/api/library" + ("/" if not path.startswith("/") else "") + path.lstrip("/")
        
    # Modify request scope path and raw_path so FastAPI routes match
    request.scope["path"] = path
    if "raw_path" in request.scope:
        request.scope["raw_path"] = path.encode("utf-8")
        
    response = await call_next(request)
    return response

@app.on_event("startup")
def on_startup():
    init_db()

# --- BOOK ENDPOINTS (CRUD) ---

@app.get("/api/library/books")
def list_books(
    search: Optional[str] = None,
    category: Optional[str] = None,
    section: Optional[str] = None,
    material_type: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    session: Session = Depends(get_session)
):
    query = select(Book)
    if search:
        query = query.where(
            (Book.title.ilike(f"%{search}%")) | 
            (Book.author_name.ilike(f"%{search}%"))
        )
    if category and category != "All":
        query = query.where(Book.category == category)
    if section and section != "All":
        query = query.where(Book.section == section)
    if material_type and material_type != "All":
        query = query.where(Book.material_type == material_type)
        
    # Pagination offset & limit
    offset = (page - 1) * limit
    query = query.offset(offset).limit(limit)
        
    books = session.exec(query).all()
    return books

@app.get("/api/library/books/{book_id}")
def get_book(book_id: str, session: Session = Depends(get_session)):
    book = session.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return book

@app.post("/api/library/books")
def create_book(book_data: dict, session: Session = Depends(get_session)):
    # Generates custom ID if not provided
    book_id = book_data.get("id", f"b-{int(datetime.utcnow().timestamp())}")
    
    # Parse tags and sample_pages if passed as lists
    tags = book_data.get("tags", [])
    if isinstance(tags, list):
        tags = json.dumps(tags)
    
    sample_pages = book_data.get("sample_pages", [])
    if isinstance(sample_pages, list):
        sample_pages = json.dumps(sample_pages)

    db_book = Book(
        id=book_id,
        title=book_data.get("title"),
        author_id=book_data.get("author_id"),
        author_name=book_data.get("author_name"),
        cover_url=book_data.get("cover_url", ""),
        retail_price=float(book_data.get("retail_price", 0.0)),
        rental_price=float(book_data.get("rental_price", 0.0)),
        category=book_data.get("category", ""),
        description=book_data.get("description", ""),
        rating=float(book_data.get("rating", 0.0)),
        section=book_data.get("section"),
        language=book_data.get("language", "English"),
        publication_date=book_data.get("publication_date"),
        pages=book_data.get("pages"),
        age_rating=book_data.get("age_rating", "Everyone"),
        isbn=book_data.get("isbn"),
        tags=tags,
        sample_pages=sample_pages,
        file_url=book_data.get("file_url"),
        book_file_name=book_data.get("book_file_name"),
        material_type=book_data.get("material_type", "book"),
        volume=book_data.get("volume"),
        issue=book_data.get("issue"),
        journal_name=book_data.get("journal_name")
    )
    session.add(db_book)
    session.commit()
    session.refresh(db_book)
    return db_book

@app.put("/api/library/books/{book_id}")
def update_book(book_id: str, book_data: dict, session: Session = Depends(get_session)):
    db_book = session.get(Book, book_id)
    if not db_book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    for key, val in book_data.items():
        if key == "tags" and isinstance(val, list):
            val = json.dumps(val)
        elif key == "sample_pages" and isinstance(val, list):
            val = json.dumps(val)
        
        if hasattr(db_book, key):
            setattr(db_book, key, val)
            
    session.add(db_book)
    session.commit()
    session.refresh(db_book)
    return db_book

@app.delete("/api/library/books/{book_id}")
def delete_book(book_id: str, session: Session = Depends(get_session)):
    db_book = session.get(Book, book_id)
    if not db_book:
        raise HTTPException(status_code=404, detail="Book not found")
    session.delete(db_book)
    session.commit()
    return {"detail": "Book deleted successfully"}

# --- ACCESS ENDPOINTS (BORROW/BUY/RETURN) ---

@app.get("/api/library/access")
def get_user_access(user_id: str, session: Session = Depends(get_session)):
    access = session.exec(
        select(UserLibraryAccess).where(UserLibraryAccess.user_id == user_id)
    ).all()
    return access

@app.post("/api/library/borrow")
def borrow_book(data: dict, session: Session = Depends(get_session)):
    user_id = data.get("user_id")
    book_id = data.get("book_id")
    price = float(data.get("price", 0.0))

    if not user_id or not book_id:
        raise HTTPException(status_code=400, detail="Missing user_id or book_id")
    
    # Check if book exists
    book = session.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    # Retrieve existing access details to accumulate rent total
    existing = session.exec(
        select(UserLibraryAccess)
        .where(UserLibraryAccess.user_id == user_id)
        .where(UserLibraryAccess.book_id == book_id)
    ).first()

    accumulated_rent = price
    is_own = False

    if existing:
        accumulated_rent += existing.lifetime_rent_total
        if existing.access_type == 'own':
            is_own = True

    # Check if cumulative rent meets/exceeds retail price (Ownership threshold trigger)
    if accumulated_rent >= book.retail_price:
        is_own = True

    expires_at = None if is_own else (datetime.utcnow() + timedelta(days=14))

    if existing:
        existing.access_type = "own" if is_own else "rent"
        existing.lifetime_rent_total = accumulated_rent
        existing.expires_at = expires_at
        existing.returned_at = None
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing
    else:
        new_access = UserLibraryAccess(
            id=str(uuid4()),
            user_id=user_id,
            book_id=book_id,
            access_type="own" if is_own else "rent",
            lifetime_rent_total=accumulated_rent,
            expires_at=expires_at
        )
        session.add(new_access)
        session.commit()
        session.refresh(new_access)
        return new_access

@app.post("/api/library/buy")
def buy_book(data: dict, session: Session = Depends(get_session)):
    user_id = data.get("user_id")
    book_id = data.get("book_id")

    if not user_id or not book_id:
        raise HTTPException(status_code=400, detail="Missing user_id or book_id")

    existing = session.exec(
        select(UserLibraryAccess)
        .where(UserLibraryAccess.user_id == user_id)
        .where(UserLibraryAccess.book_id == book_id)
    ).first()

    if existing:
        existing.access_type = "own"
        existing.expires_at = None
        existing.returned_at = None
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing
    else:
        new_access = UserLibraryAccess(
            id=str(uuid4()),
            user_id=user_id,
            book_id=book_id,
            access_type="own",
            lifetime_rent_total=0.0
        )
        session.add(new_access)
        session.commit()
        session.refresh(new_access)
        return new_access

@app.post("/api/library/return")
def return_book(data: dict, session: Session = Depends(get_session)):
    user_id = data.get("user_id")
    book_id = data.get("book_id")

    access = session.exec(
        select(UserLibraryAccess)
        .where(UserLibraryAccess.user_id == user_id)
        .where(UserLibraryAccess.book_id == book_id)
        .where(UserLibraryAccess.access_type == "rent")
    ).first()

    if not access:
        raise HTTPException(status_code=404, detail="Active rental access not found")

    access.returned_at = datetime.utcnow()
    
    # Calculate overdue fines (e.g. ₦100 per day overdue)
    fine_amount = 0.0
    if access.expires_at and datetime.utcnow() > access.expires_at:
        overdue_duration = datetime.utcnow() - access.expires_at
        overdue_days = max(1, overdue_duration.days)
        fine_amount = overdue_days * 100.0  # ₦100 per day fine
        
        # Save a Fine record
        new_fine = Fine(
            id=str(uuid4()),
            user_id=user_id,
            book_id=book_id,
            amount=fine_amount,
            status="unpaid"
        )
        session.add(new_fine)
    
    session.add(access)
    session.commit()
    session.refresh(access)
    return {"access": access, "fine_generated": fine_amount}

# --- RESERVATIONS ENDPOINTS ---

@app.post("/api/library/reserve")
def reserve_book(data: dict, session: Session = Depends(get_session)):
    user_id = data.get("user_id")
    book_id = data.get("book_id")
    
    if not user_id or not book_id:
        raise HTTPException(status_code=400, detail="Missing user_id or book_id")
        
    res = Reservation(
        id=str(uuid4()),
        user_id=user_id,
        book_id=book_id,
        status="pending"
    )
    session.add(res)
    session.commit()
    session.refresh(res)
    return res

@app.get("/api/library/reservations")
def list_reservations(
    user_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    session: Session = Depends(get_session)
):
    offset = (page - 1) * limit
    res = session.exec(
        select(Reservation)
        .where(Reservation.user_id == user_id)
        .offset(offset)
        .limit(limit)
    ).all()
    return res

# --- OVERDUE FINES ---

@app.get("/api/library/fines")
def list_fines(
    user_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    session: Session = Depends(get_session)
):
    offset = (page - 1) * limit
    fines = session.exec(
        select(Fine)
        .where(Fine.user_id == user_id)
        .offset(offset)
        .limit(limit)
    ).all()
    return fines

@app.post("/api/library/fines/pay")
def pay_fine(data: dict, session: Session = Depends(get_session)):
    fine_id = data.get("fine_id")
    fine = session.get(Fine, fine_id)
    if not fine:
        raise HTTPException(status_code=404, detail="Fine record not found")
    
    fine.status = "paid"
    fine.paid_at = datetime.utcnow()
    session.add(fine)
    session.commit()
    session.refresh(fine)
    return fine

# --- ML RECOMMENDATIONS (CONTENT-BASED) ---

@app.get("/api/library/recommendations")
def get_recommendations(
    user_id: Optional[str] = None,
    book_id: Optional[str] = None,
    session: Session = Depends(get_session)
):
    all_books = session.exec(select(Book)).all()
    if not all_books:
        return []
        
    target_categories = set()
    target_tags = set()
    exclude_ids = set()

    if user_id:
        # Get user access history
        user_accesses = session.exec(
            select(UserLibraryAccess).where(UserLibraryAccess.user_id == user_id)
        ).all()
        accessed_book_ids = {a.book_id for a in user_accesses}
        exclude_ids.update(accessed_book_ids)
        
        for b_id in accessed_book_ids:
            b = session.get(Book, b_id)
            if b:
                target_categories.add(b.category)
                if b.tags:
                    try:
                        t_list = json.loads(b.tags)
                        if isinstance(t_list, list):
                            target_tags.update(t_list)
                    except:
                        pass
                        
    elif book_id:
        ref_book = session.get(Book, book_id)
        if ref_book:
            exclude_ids.add(ref_book.id)
            target_categories.add(ref_book.category)
            if ref_book.tags:
                try:
                    t_list = json.loads(ref_book.tags)
                    if isinstance(t_list, list):
                        target_tags.update(t_list)
                except:
                    pass

    # Score each other book based on shared category and tags
    scored_books = []
    for b in all_books:
        if b.id in exclude_ids:
            continue
            
        score = 0
        if b.category in target_categories:
            score += 5  # Weight for same category
            
        b_tags = []
        if b.tags:
            try:
                b_tags = json.loads(b.tags)
            except:
                pass
                
        for t in b_tags:
            if t in target_tags:
                score += 2  # Weight for matching tag
                
        # Also factor in average rating
        score += b.rating
        
        scored_books.append((b, score))
        
    # Sort by score descending and return top 5
    scored_books.sort(key=lambda x: x[1], reverse=True)
    return [sb[0] for sb in scored_books[:5]]

# --- REVIEWS ENDPOINTS ---

@app.get("/api/library/reviews/{book_id}")
def list_reviews(
    book_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    session: Session = Depends(get_session)
):
    offset = (page - 1) * limit
    reviews = session.exec(
        select(UserReview)
        .where(UserReview.book_id == book_id)
        .offset(offset)
        .limit(limit)
    ).all()
    return reviews

@app.post("/api/library/reviews")
def submit_review(review_data: dict, session: Session = Depends(get_session)):
    book_id = review_data.get("book_id")
    book = session.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
        
    rev = UserReview(
        id=str(uuid4()),
        user_id=review_data.get("user_id"),
        user_name=review_data.get("user_name"),
        book_id=book_id,
        rating=int(review_data.get("rating", 5)),
        comment=review_data.get("comment", "")
    )
    session.add(rev)
    
    # Recalculate book average rating
    all_revs = session.exec(
        select(UserReview).where(UserReview.book_id == book_id)
    ).all()
    total_ratings = sum([r.rating for r in all_revs]) + rev.rating
    avg_rating = round(total_ratings / (len(all_revs) + 1), 1)
    book.rating = avg_rating
    session.add(book)
    
    session.commit()
    session.refresh(rev)
    return rev

# --- HIGHLIGHTS & ANNOTATIONS ---

@app.get("/api/library/highlights")
def list_highlights(
    user_id: str,
    book_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session)
):
    offset = (page - 1) * limit
    hls = session.exec(
        select(Highlight)
        .where(Highlight.user_id == user_id)
        .where(Highlight.book_id == book_id)
        .offset(offset)
        .limit(limit)
    ).all()
    return hls

@app.post("/api/library/highlights")
def save_highlight(hl_data: dict, session: Session = Depends(get_session)):
    hl = Highlight(
        id=hl_data.get("id", str(uuid4())),
        user_id=hl_data.get("user_id"),
        book_id=hl_data.get("book_id"),
        passage_text=hl_data.get("passage_text"),
        comment=hl_data.get("comment"),
        color=hl_data.get("color", "yellow")
    )
    session.add(hl)
    session.commit()
    session.refresh(hl)
    return hl

@app.delete("/api/library/highlights/{hl_id}")
def delete_highlight(hl_id: str, session: Session = Depends(get_session)):
    hl = session.get(Highlight, hl_id)
    if not hl:
        raise HTTPException(status_code=404, detail="Highlight not found")
    session.delete(hl)
    session.commit()
    return {"detail": "Highlight deleted successfully"}

# --- READING COMMENTS ---

@app.get("/api/library/comments")
def list_comments(
    user_id: str,
    book_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session)
):
    offset = (page - 1) * limit
    comments = session.exec(
        select(ReadingComment)
        .where(ReadingComment.user_id == user_id)
        .where(ReadingComment.book_id == book_id)
        .offset(offset)
        .limit(limit)
    ).all()
    return comments

@app.post("/api/library/comments")
def save_comment(comment_data: dict, session: Session = Depends(get_session)):
    comment = ReadingComment(
        id=str(uuid4()),
        user_id=comment_data.get("user_id"),
        user_name=comment_data.get("user_name"),
        book_id=comment_data.get("book_id"),
        page_index=int(comment_data.get("page_index", 1)),
        text=comment_data.get("text")
    )
    session.add(comment)
    session.commit()
    session.refresh(comment)
    return comment

handler = Mangum(app)
