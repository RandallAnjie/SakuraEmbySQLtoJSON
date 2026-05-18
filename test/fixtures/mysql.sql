-- mysqldump fragment for table `emby`
CREATE TABLE `emby` (
  `tg` bigint NOT NULL,
  `embyid` varchar(255) DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  `pwd` varchar(255) DEFAULT NULL,
  `pwd2` varchar(255) DEFAULT NULL,
  `lv` varchar(1) DEFAULT 'd',
  `cr` datetime DEFAULT NULL,
  `ex` datetime DEFAULT NULL,
  `us` int DEFAULT '0',
  `iv` int DEFAULT '0',
  `ch` datetime DEFAULT NULL,
  PRIMARY KEY (`tg`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 五条记录覆盖四种 lv：
--   12345 lv=a 白名单 —— 即使 ex 有值，导出 expiresAt 也要留空
--   67890 lv=b 普通用户 —— 导出，按 ex 写到期
--   11111 lv=d 无账号 —— 跳过
--   22222 lv=b 但 ex=NULL —— 导出，expiresAt 留空（字段含逗号 + 单引号转义测试）
--   33333 lv=c 封禁 —— 跳过
INSERT INTO `emby` VALUES
  (12345,'abc-def','alice','p1','p2','a','2025-01-01 00:00:00','2026-12-31 00:00:00',0,0,NULL),
  (67890,'ghi-jkl','bob \'the\' bold','p1\\p2','p2','b','2025-02-01 12:30:00','2026-10-01 12:00:00',1,0,NULL),
  (11111,NULL,'no_emby_yet',NULL,NULL,'d','2025-03-01 00:00:00',NULL,0,0,NULL),
  (22222,'mn,op','comma,user',NULL,NULL,'b','2025-04-01 00:00:00',NULL,0,0,NULL),
  (33333,'banned-id','evil',NULL,NULL,'c','2025-05-01 00:00:00','2025-06-01 00:00:00',0,0,NULL);
