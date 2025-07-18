# # -*- coding: utf-8 -*-
# from models import Base, engine
# import sqlite3

# # 删除所有表
# Base.metadata.drop_all(bind=engine)

# # 重新创建所有表
# Base.metadata.create_all(bind=engine)

# print("Database tables recreated successfully!") 

# conn = sqlite3.connect('backend/exam_system.db')
# c = conn.cursor()

# # 检查是否已存在comment字段
# c.execute("PRAGMA table_info(student_answers)")
# columns = [row[1] for row in c.fetchall()]
# if 'comment' not in columns:
#     c.execute("ALTER TABLE student_answers ADD COLUMN comment TEXT DEFAULT ''")
#     print('已添加comment字段')
# else:
#     print('comment字段已存在')

# conn.commit()
# conn.close() 

# import sqlite3
# conn = sqlite3.connect('exam_system.db')
# conn.execute("ALTER TABLE exam_history ADD COLUMN weak_keywords TEXT DEFAULT ''")
# conn.commit()
# conn.close()

# import sqlite3
# conn = sqlite3.connect('backend/exam_system.db')
# conn.execute('ALTER TABLE teaching_plan_history ADD COLUMN lesson_schedule TEXT;')
# conn.commit()
# conn.close()

from models import Base, engine

if __name__ == "__main__":
    print("正在初始化数据库表...")
    Base.metadata.create_all(engine)
    print("数据库表创建完成！")