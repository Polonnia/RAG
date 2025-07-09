# -*- coding: utf-8 -*-
from models import Base, engine
import sqlite3

# 删除所有表
Base.metadata.drop_all(bind=engine)

# 重新创建所有表
Base.metadata.create_all(bind=engine)

print("Database tables recreated successfully!") 

conn = sqlite3.connect('backend/exam_system.db')
c = conn.cursor()

# 检查是否已存在comment字段
c.execute("PRAGMA table_info(student_answers)")
columns = [row[1] for row in c.fetchall()]
if 'comment' not in columns:
    c.execute("ALTER TABLE student_answers ADD COLUMN comment TEXT DEFAULT ''")
    print('已添加comment字段')
else:
    print('comment字段已存在')

conn.commit()
conn.close() 