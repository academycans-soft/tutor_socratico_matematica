import sqlite3
import json
from datetime import datetime
from data.database import SessionLocal, init_database
from data import models

def parse_dt(v):
    if not v:
        return None
    if isinstance(v, str):
        v = v.replace('T', ' ')
        try:
            return datetime.fromisoformat(v)
        except Exception:
            return None
    return v

def parse_json(v):
    if not v:
        return None
    if isinstance(v, str):
        try:
            return json.loads(v)
        except Exception:
            return None
    return v

def migrate_all():
    init_database()
    sqlite_conn = sqlite3.connect('/app/var/tutorai.db')
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cur = sqlite_conn.cursor()
    
    db = SessionLocal()
    
    # 1. Users
    print("Migrating Users...")
    for r in sqlite_cur.execute("SELECT * FROM users").fetchall():
        d = dict(r)
        u = models.User(
            id=d["id"],
            email=d["email"],
            name=d["name"],
            password_hash=d["password_hash"],
            is_active=bool(d["is_active"]) if d.get("is_active") is not None else True,
            is_admin=bool(d["is_admin"]) if d.get("is_admin") is not None else False,
            profile_image_url=d.get("profile_image_url"),
            settings=parse_json(d.get("settings")),
            info=parse_json(d.get("info")),
            role=d.get("role", "user"),
            created_at=parse_dt(d.get("created_at")),
            updated_at=parse_dt(d.get("updated_at"))
        )
        db.merge(u)
    db.commit()
    print("Users migrated.")

    # 2. Groups
    print("Migrating Groups...")
    try:
        for r in sqlite_cur.execute("SELECT * FROM groups").fetchall():
            d = dict(r)
            g = models.Group(
                id=d["id"],
                user_id=d["user_id"],
                name=d["name"],
                description=d.get("description"),
                data=parse_json(d.get("data")),
                meta=parse_json(d.get("meta")),
                permissions=parse_json(d.get("permissions")),
                user_ids=parse_json(d.get("user_ids")),
                created_at=parse_dt(d.get("created_at")),
                updated_at=parse_dt(d.get("updated_at"))
            )
            db.merge(g)
        db.commit()
    except Exception as e:
        print("Groups error:", e)

    # 3. AppConfigs
    print("Migrating AppConfigs...")
    for r in sqlite_cur.execute("SELECT * FROM app_configs").fetchall():
        d = dict(r)
        cfg = models.AppConfig(
            key=d["key"],
            value=parse_json(d.get("value")),
            updated_at=parse_dt(d.get("updated_at"))
        )
        db.merge(cfg)
    db.commit()

    # 4. Classrooms
    print("Migrating Classrooms...")
    for r in sqlite_cur.execute("SELECT * FROM classrooms").fetchall():
        d = dict(r)
        c = models.Classroom(
            id=d["id"],
            name=d["name"],
            description=d.get("description"),
            code=d.get("code"),
            teacher_id=d["teacher_id"],
            created_at=parse_dt(d.get("created_at")),
            updated_at=parse_dt(d.get("updated_at"))
        )
        db.merge(c)
    db.commit()

    # 5. ClassroomMembers
    print("Migrating ClassroomMembers...")
    for r in sqlite_cur.execute("SELECT * FROM classroom_members").fetchall():
        d = dict(r)
        m = models.ClassroomMember(
            id=d["id"],
            classroom_id=d["classroom_id"],
            user_id=d["user_id"],
            role=d.get("role", "student"),
            joined_at=parse_dt(d.get("joined_at"))
        )
        db.merge(m)
    db.commit()

    # 6. KnowledgeBases
    print("Migrating KnowledgeBases...")
    for r in sqlite_cur.execute("SELECT * FROM knowledge_bases").fetchall():
        d = dict(r)
        meta = parse_json(d.get("meta")) or {}
        if d.get("access_control") and not meta:
            meta = parse_json(d.get("access_control"))
        kb = models.KnowledgeBase(
            id=d["id"],
            user_id=d["user_id"],
            name=d["name"],
            description=d.get("description"),
            data=parse_json(d.get("data")),
            meta=meta,
            created_at=parse_dt(d.get("created_at")),
            updated_at=parse_dt(d.get("updated_at"))
        )
        db.merge(kb)
    db.commit()

    # 7. Files
    print("Migrating Files...")
    for r in sqlite_cur.execute("SELECT * FROM files").fetchall():
        d = dict(r)
        f = models.FileRecord(
            id=d["id"],
            user_id=d["user_id"],
            filename=d["filename"],
            path=d.get("path"),
            content_type=d.get("content_type"),
            size=d.get("size"),
            data=parse_json(d.get("data")),
            meta=parse_json(d.get("meta")),
            created_at=parse_dt(d.get("created_at"))
        )
        db.merge(f)
    db.commit()

    # 8. KnowledgeFiles
    print("Migrating KnowledgeFiles...")
    for r in sqlite_cur.execute("SELECT * FROM knowledge_files").fetchall():
        d = dict(r)
        kf = models.KnowledgeFile(
            id=d["id"],
            knowledge_id=d["knowledge_id"],
            file_id=d["file_id"],
            created_at=parse_dt(d.get("created_at"))
        )
        db.merge(kf)
    db.commit()

    # 9. DocumentChunks
    print("Migrating DocumentChunks...")
    for r in sqlite_cur.execute("SELECT * FROM document_chunks").fetchall():
        d = dict(r)
        chunk = models.DocumentChunk(
            id=d["id"],
            file_id=d.get("file_id"),
            collection_name=d.get("collection_name"),
            chunk_index=d.get("chunk_index", 0),
            content=d.get("content", ""),
            embedding=parse_json(d.get("embedding")),
            meta=parse_json(d.get("meta")),
            created_at=parse_dt(d.get("created_at"))
        )
        db.merge(chunk)
    db.commit()

    # 10. Courses
    print("Migrating Courses...")
    for r in sqlite_cur.execute("SELECT * FROM courses").fetchall():
        d = dict(r)
        course = models.Course(
            id=d["id"],
            title=d["title"],
            description=d.get("description"),
            subject=d.get("subject"),
            classroom_id=d["classroom_id"],
            teacher_id=d["teacher_id"],
            level=d.get("level", "Beginner"),
            image_url=d.get("image_url"),
            knowledge_id=d.get("knowledge_id"),
            created_at=parse_dt(d.get("created_at")),
            updated_at=parse_dt(d.get("updated_at"))
        )
        db.merge(course)
    db.commit()

    # 11. Assignments
    print("Migrating Assignments...")
    for r in sqlite_cur.execute("SELECT * FROM assignments").fetchall():
        d = dict(r)
        a = models.Assignment(
            id=d["id"],
            course_id=d["course_id"],
            classroom_id=d.get("classroom_id"),
            teacher_id=d.get("teacher_id"),
            title=d["title"],
            description=d.get("description"),
            due_date=d.get("due_date"),
            points=d.get("points", 100),
            enable_ai_grading=bool(d["enable_ai_grading"]) if d.get("enable_ai_grading") is not None else False,
            status=d.get("status", "published"),
            created_at=parse_dt(d.get("created_at")),
            updated_at=parse_dt(d.get("updated_at"))
        )
        db.merge(a)
    db.commit()

    # 12. Chats
    print("Migrating Chats...")
    for r in sqlite_cur.execute("SELECT * FROM chats").fetchall():
        d = dict(r)
        chat = models.Chat(
            id=d["id"],
            user_id=d["user_id"],
            title=d["title"],
            chat=parse_json(d.get("chat")),
            meta=parse_json(d.get("meta")),
            share_id=d.get("share_id"),
            archived=bool(d["archived"]) if d.get("archived") is not None else False,
            pinned=bool(d["pinned"]) if d.get("pinned") is not None else False,
            folder_id=d.get("folder_id"),
            created_at=parse_dt(d.get("created_at")),
            updated_at=parse_dt(d.get("updated_at"))
        )
        db.merge(chat)
    db.commit()

    # 13. Supports
    print("Migrating Supports...")
    for r in sqlite_cur.execute("SELECT * FROM supports").fetchall():
        d = dict(r)
        s = models.Support(
            id=d["id"],
            user_id=d["user_id"],
            title=d["title"],
            short_description=d.get("short_description"),
            subject=d.get("subject"),
            custom_subject=d.get("custom_subject"),
            course_id=d.get("course_id"),
            learning_objective=d.get("learning_objective"),
            learning_type=d.get("learning_type"),
            level=d.get("level"),
            content_language=d.get("content_language"),
            estimated_duration=d.get("estimated_duration"),
            access_type=d.get("access_type"),
            keywords=d.get("keywords"),
            start_date=d.get("start_date"),
            end_date=d.get("end_date"),
            avatar_id=d.get("avatar_id"),
            chat_id=d.get("chat_id"),
            status=d.get("status", "pending"),
            created_at=parse_dt(d.get("created_at")),
            updated_at=parse_dt(d.get("updated_at"))
        )
        db.merge(s)
    db.commit()

    print("ALL DATA MIGRATED CLEANLY INTO POSTGRESQL!")
    db.close()
    sqlite_conn.close()

if __name__ == "__main__":
    migrate_all()
