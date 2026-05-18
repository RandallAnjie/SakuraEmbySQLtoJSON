PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE emby (
	tg BIGINT NOT NULL,
	embyid VARCHAR(255),
	name VARCHAR(255),
	pwd VARCHAR(255),
	pwd2 VARCHAR(255),
	lv VARCHAR(1),
	cr DATETIME,
	ex DATETIME,
	us INTEGER,
	iv INTEGER,
	ch DATETIME,
	PRIMARY KEY (tg)
);
-- lv=a 白名单（有 ex 也忽略）
INSERT INTO emby VALUES(12345,'abc-def','alice','p1','p2','a','2025-01-01 00:00:00','2026-12-31 00:00:00',0,0,NULL);
-- lv=b 普通用户，'' 转义
INSERT INTO emby VALUES(67890,'ghi-jkl','bob''s name','p1','p2','b','2025-02-01 12:30:00','2026-09-01 00:00:00',1,0,NULL);
-- lv=d 无账号 → 跳过
INSERT INTO emby VALUES(11111,NULL,'no_emby_yet',NULL,NULL,'d','2025-03-01 00:00:00',NULL,0,0,NULL);
COMMIT;
