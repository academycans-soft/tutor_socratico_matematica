import sqlite3
import json
import traceback
from datetime import datetime
from data.database import SessionLocal, engine
from sqlalchemy import text

def parse_val(col, val, pg_type):
    if val is None:
        return None
    t = pg_type.lower()
    if "json" in t:
        if isinstance(val, str):
            try:
                return json.loads(val)
            except Exception:
                return {}
        return val
    if "boolean" in t:
        return bool(val)
    if "timestamp" in t or "date" in t:
        if isinstance(val, str):
            # Parse sqlite datetime string 'YYYY-MM-DD HH:MM:SS.ffffff' or iso
            val_clean = val.replace('T', ' ')
            try:
                return datetime.fromisoformat(val)
            except Exception:
                return val
    return val

def migrate():
    sqlite_conn = sqlite3.connect('/app/var/tutorai.db')
    sqlite_cur = sqlite_conn.cursor()

    tables = [
        "users",
        "groups",
        "app_configs",
        "model_configs",
        "classrooms",
        "classroom_members",
        "knowledge_bases",
        "files",
        "knowledge_files",
        "courses",
        "assignments",
        "submissions",
        "chats",
        "supports",
        "support_files",
        "parent_students",
        "feedbacks"
    ]

    for table in tables:
        try:
            sqlite_cur.execute(f"PRAGMA table_info({table})")
            cols_info = sqlite_cur.fetchall()
            if not cols_info:
                continue
            col_names = [c[1] for c in cols_info]

            rows = sqlite_cur.execute(f"SELECT * FROM {table}").fetchall()
            if not rows:
                continue

            with engine.connect() as conn:
                res = conn.execute(text(f"""
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE table_name = '{table}'
                """)).fetchall()
                pg_cols = {r[0]: r[1] for r in res}

            valid_cols = [c for c in col_names if c in pg_cols]
            col_indices = [col_names.index(c) for c in valid_cols]

            success = 0
            with engine.begin() as conn:
                for row in rows:
                    row_data = {}
                    for col, idx in zip(valid_cols, col_indices):
                        row_data[col] = parse_val(col, row[idx], pg_cols[col])

                    cols_str = ", ".join([f'"{c}"' for c in valid_cols])
                    params_str = ", ".join([f":{c}" for c in valid_cols])
                    stmt = text(f'INSERT INTO "{table}" ({cols_str}) VALUES ({params_str}) ON CONFLICT DO NOTHING')
                    conn.execute(stmt, row_data)
                    success += 1

            print(f"[OK] {table}: {success}/{len(rows)} migrated.")
        except Exception as e:
            print(f"[FAIL] {table}: {e}")
            traceback.print_exc()

    sqlite_conn.close()
    print("Migration finished!")

if __name__ == "__main__":
    migrate()
