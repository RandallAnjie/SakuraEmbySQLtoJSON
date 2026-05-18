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

INSERT INTO `emby` VALUES
  (12345,'abc-def','alice','p1','p2','a','2025-01-01 00:00:00','2026-12-31 00:00:00',0,0,NULL),
  (67890,'ghi-jkl','bob \'the\' bold','p1\\p2','p2','a','2025-02-01 12:30:00',NULL,1,0,NULL),
  (11111,NULL,'no_emby_yet',NULL,NULL,'d','2025-03-01 00:00:00',NULL,0,0,NULL),
  (22222,'mn,op','comma,user',NULL,NULL,'a','2025-04-01 00:00:00','2026-06-15 08:00:00',0,0,NULL);
