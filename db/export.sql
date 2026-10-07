-- LPA eComms database export
-- Exported 2026-10-07T04:19:43.612Z from server 10.11.14-MariaDB-0ubuntu0.24.04.1 by db/export.js

CREATE DATABASE IF NOT EXISTS lpa_ecomms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE lpa_ecomms;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `lpa_clients`;
CREATE TABLE `lpa_clients` (
  `lpa_client_ID` varchar(20) NOT NULL,
  `lpa_client_firstname` varchar(50) NOT NULL,
  `lpa_client_lastname` varchar(50) NOT NULL,
  `lpa_client_address` varchar(250) NOT NULL,
  `lpa_client_phone` varchar(160) NOT NULL,
  `lpa_client_phone_idx` char(64) DEFAULT NULL,
  `lpa_client_status` char(1) NOT NULL DEFAULT 'a',
  PRIMARY KEY (`lpa_client_ID`),
  KEY `ix_client_phone_idx` (`lpa_client_phone_idx`),
  CONSTRAINT `ck_client_status` CHECK (`lpa_client_status` in ('a','d'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `lpa_clients` (`lpa_client_ID`, `lpa_client_firstname`, `lpa_client_lastname`, `lpa_client_address`, `lpa_client_phone`, `lpa_client_phone_idx`, `lpa_client_status`) VALUES
  ('CL-001', 'Riverside College', 'Library', '12 River Rd, Indooroopilly QLD 4068', 'v1.VMeRTTcZliTkaVaZ.SWd-E5woauqO9UpIjcW56A.z44RGdKVGEivFepFjfE', '7061954e6ee95907680b86c471a99ef8bb5bc62394223aaf38b8985e3e02100a', 'a'),
  ('CL-002', 'DevWorks', 'Pty Ltd', '88 Ann St, Brisbane City QLD 4000', 'v1.9X53poWQod92EtGa.4AJ3FGswfQUeVQdHtkcfdw.oGB4LQcFJyiEixdJEyg', '04b39dca7f6c368df8737dc1fad16d8de9ea51d6dd7d3682582471bdc476779c', 'a'),
  ('CL-003', 'Logic Peripherals', 'Australia', '123 Queen St, Brisbane City QLD 4000', 'v1.oBN9hPpZx0cgUN-X.z58L4NEjwG0H7kna-VUKHA.soIkeo9KOmu48273LX0', '98ac99e327197c8837bf12f108056d564698dc28de1ad35c4da94fccc60b69d6', 'a'),
  ('CL-004', 'Northgate', 'High School', '5 Ridge St, Northgate QLD 4013', 'v1.8ZagR82kFMWKW598.nNaV-dJnlRjNLr7POvncXA.cjdad4_ZHcMlGe9-JoU', '922a8ed7e7d05da7a2f7ae02ccef50ff99ab8c00b28f0b717e815a9ce1467179', 'a'),
  ('CL-005', 'Brisbane Coders', 'Guild', '40 Grey St, South Brisbane QLD 4101', 'v1.D3uQnCXEpMLJh22A.8ce2f2EAVe5C0EScEBa2IQ.TEIZPoCp1CdCxASyflQ', '2057b9b88af3f464e819826134c79b180d96ce1bcbb23633bcdc585c5962c1f2', 'd'),
  ('CL-006', 'Alex', 'Turner', '7 Park Rd, Milton QLD 4064', 'v1.6AtFa3Zv1MgM7b16.dzMN0dKsqDp6EPU5NZ16_w.KpNdsa3UfNpaTXBX', '445c995c252abed06bc90980d672bccada53415e3b9595390dedb42b16d80043', 'a');

DROP TABLE IF EXISTS `lpa_stock`;
CREATE TABLE `lpa_stock` (
  `lpa_stock_ID` varchar(20) NOT NULL,
  `lpa_stock_name` varchar(250) NOT NULL,
  `lpa_stock_brand` varchar(100) NOT NULL DEFAULT '',
  `lpa_stock_category` varchar(50) NOT NULL DEFAULT 'General',
  `lpa_stock_desc` text NOT NULL,
  `lpa_stock_image` varchar(250) NOT NULL DEFAULT '/images/products/placeholder.png',
  `lpa_stock_onhand` int(10) unsigned NOT NULL DEFAULT 0,
  `lpa_stock_price` decimal(7,2) NOT NULL,
  `lpa_stock_status` char(1) NOT NULL DEFAULT 'a',
  PRIMARY KEY (`lpa_stock_ID`),
  KEY `ix_stock_name` (`lpa_stock_name`),
  KEY `ix_stock_category` (`lpa_stock_category`),
  CONSTRAINT `ck_stock_price` CHECK (`lpa_stock_price` >= 0),
  CONSTRAINT `ck_stock_status` CHECK (`lpa_stock_status` in ('a','d','x'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `lpa_stock` (`lpa_stock_ID`, `lpa_stock_name`, `lpa_stock_brand`, `lpa_stock_category`, `lpa_stock_desc`, `lpa_stock_image`, `lpa_stock_onhand`, `lpa_stock_price`, `lpa_stock_status`) VALUES
  ('LPA-001', 'Mechanical Keyboard MK-87', 'Vertex', 'Keyboards', 'Compact 87-key hot-swappable mechanical keyboard with RGB backlight.', '/images/products/keyboard.png', 12, 89, 'a'),
  ('LPA-002', 'Wireless Optical Mouse WM-200', 'Orbit', 'Mice', 'Ergonomic 2.4GHz wireless mouse, 1600 DPI, silent-click.', '/images/products/mouse.png', 7, 39.5, 'a'),
  ('LPA-003', '27\" 4K UHD Monitor UM-27', 'Lumina', 'Monitors', '27-inch 4K IPS display, 60Hz, HDMI + DisplayPort.', '/images/products/monitor.png', 0, 429, 'a'),
  ('LPA-004', 'USB-C Docking Station DS-11', 'NovaLink', 'Docks & Hubs', '11-in-1 USB-C dock: dual HDMI, USB-A, SD, Ethernet, 100W PD.', '/images/products/dock.png', 0, 149, 'a'),
  ('LPA-005', '1080p HD Webcam CV-10', 'ClearView', 'Webcams', 'Full-HD 1080p webcam with auto-focus and dual mics.', '/images/products/webcam.png', 20, 69, 'a'),
  ('LPA-006', 'Noise-Cancelling Headset HS-90', 'AudioCore', 'Audio', 'Over-ear ANC headset, USB + 3.5mm, boom microphone.', '/images/products/headset.png', 3, 119, 'd'),
  ('LPA-007', 'Mechanical Numpad NP-22', 'Vertex', 'Keyboards', 'Standalone 22-key mechanical number pad, USB-C.', '/images/products/numpad.png', 13, 34, 'a'),
  ('LPA-008', 'USB-C to HDMI Cable 2m', 'NovaLink', 'Cables & Adapters', '2-metre USB-C to HDMI 4K@60Hz cable, braided.', '/images/products/cable.png', 2, 19, 'a'),
  ('LPA-020', 'Laptop Stand LS-3', 'Orbit', 'Accessories', 'Aluminium laptop stand.', '/images/products/placeholder.png', 12, 39.95, 'x');

DROP TABLE IF EXISTS `lpa_users`;
CREATE TABLE `lpa_users` (
  `lpa_user_ID` varchar(20) NOT NULL,
  `lpa_user_username` varchar(30) NOT NULL,
  `lpa_user_password` varchar(255) NOT NULL,
  `lpa_user_firstname` varchar(50) NOT NULL,
  `lpa_user_lastname` varchar(50) NOT NULL,
  `lpa_user_group` varchar(50) NOT NULL,
  `lpa_user_client_ID` varchar(20) DEFAULT NULL,
  `lpa_user_status` char(1) NOT NULL DEFAULT 'a',
  PRIMARY KEY (`lpa_user_ID`),
  UNIQUE KEY `uq_username` (`lpa_user_username`),
  KEY `fk_user_client` (`lpa_user_client_ID`),
  CONSTRAINT `fk_user_client` FOREIGN KEY (`lpa_user_client_ID`) REFERENCES `lpa_clients` (`lpa_client_ID`),
  CONSTRAINT `ck_user_group` CHECK (`lpa_user_group` in ('administrator','user','customer')),
  CONSTRAINT `ck_user_status` CHECK (`lpa_user_status` in ('a','d','x'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `lpa_users` (`lpa_user_ID`, `lpa_user_username`, `lpa_user_password`, `lpa_user_firstname`, `lpa_user_lastname`, `lpa_user_group`, `lpa_user_client_ID`, `lpa_user_status`) VALUES
  ('U-001', 'palvim', 'scrypt$70806fcddee2ee3e1cd7156ec9930438$929687f4f32802ab14ae9b57a85491c2989e9203f058bcbaf9b7fd9329b852786ee061ec1e93a5b13d2cb8737869c01c6915cfbc641c2895e0af4c53854cdcbf', 'Pedro', 'Alvim', 'administrator', NULL, 'a'),
  ('U-002', 'mchang', 'scrypt$27b61f103931fb82a93a438c7455f3cd$fe06755ac9d5e1f82e75b91b1bf1b2381dd68cd4a053a11179ed15b7fdc5eb7ea4106761557bd5fd2bf3105e807fe86cf5eb18cbf5db4bd3a12490819a950de5', 'Michael', 'Chang', 'user', NULL, 'a'),
  ('U-003', 'aturner', 'scrypt$22cc188283e40b4eecc85b502e8f7c38$19af93e15eea4bd05a2cd6310016bd0918bda868adf87ac1727114f84a07e9a99cc19483791bed5c484e05a399ab5cf28bd282a3fc4198787946dbbbe056660f', 'Alex', 'Turner', 'customer', 'CL-006', 'a');

DROP TABLE IF EXISTS `lpa_invoices`;
CREATE TABLE `lpa_invoices` (
  `lpa_inv_no` varchar(20) NOT NULL,
  `lpa_inv_date` datetime NOT NULL,
  `lpa_inv_client_ID` varchar(20) NOT NULL,
  `lpa_inv_client_name` varchar(101) NOT NULL,
  `lpa_inv_client_address` varchar(250) NOT NULL,
  `lpa_inv_amount` decimal(8,2) NOT NULL,
  `lpa_inv_payment` varchar(30) NOT NULL DEFAULT 'Account',
  `lpa_inv_status` char(1) NOT NULL DEFAULT 'a',
  PRIMARY KEY (`lpa_inv_no`),
  KEY `ix_inv_client` (`lpa_inv_client_ID`),
  KEY `ix_inv_date` (`lpa_inv_date`),
  CONSTRAINT `fk_inv_client` FOREIGN KEY (`lpa_inv_client_ID`) REFERENCES `lpa_clients` (`lpa_client_ID`),
  CONSTRAINT `ck_inv_status` CHECK (`lpa_inv_status` in ('a','x'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `lpa_invoices` (`lpa_inv_no`, `lpa_inv_date`, `lpa_inv_client_ID`, `lpa_inv_client_name`, `lpa_inv_client_address`, `lpa_inv_amount`, `lpa_inv_payment`, `lpa_inv_status`) VALUES
  ('INV-1001', '2026-07-28 09:12:00', 'CL-001', 'Riverside College Library', '12 River Rd, Indooroopilly QLD 4068', 184, 'Account', 'a'),
  ('INV-1002', '2026-07-29 10:05:00', 'CL-002', 'DevWorks Pty Ltd', '88 Ann St, Brisbane City QLD 4000', 97, 'Account', 'a'),
  ('INV-1003', '2026-07-30 11:30:00', 'CL-003', 'Logic Peripherals Australia', '123 Queen St, Brisbane City QLD 4000', 265.5, 'Account', 'a'),
  ('INV-1004', '2026-08-01 14:20:00', 'CL-004', 'Northgate High School', '5 Ridge St, Northgate QLD 4013', 45, 'Account', 'a'),
  ('INV-1005', '2026-08-03 15:45:00', 'CL-002', 'DevWorks Pty Ltd', '88 Ann St, Brisbane City QLD 4000', 123, 'Account', 'a'),
  ('INV-1006', '2026-08-04 16:10:00', 'CL-005', 'Brisbane Coders Guild', '40 Grey St, South Brisbane QLD 4101', 89, 'Account', 'a'),
  ('INV-1007', '2026-10-07 14:19:40', 'CL-003', 'Logic Peripherals Australia', '123 Queen St, Brisbane City QLD 4000', 596, 'Account', 'a'),
  ('INV-1008', '2026-10-07 14:19:40', 'CL-006', 'Alex Turner', '7 Park Rd, Milton QLD 4064', 68, 'PayPal', 'a');

DROP TABLE IF EXISTS `lpa_invoice_items`;
CREATE TABLE `lpa_invoice_items` (
  `lpa_invitem_no` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `lpa_invitem_inv_no` varchar(20) NOT NULL,
  `lpa_invitem_stock_ID` varchar(20) NOT NULL,
  `lpa_invitem_stock_name` varchar(250) NOT NULL,
  `lpa_invitem_qty` int(10) unsigned NOT NULL,
  `lpa_invitem_stock_price` decimal(7,2) NOT NULL,
  `lpa_invitem_stock_amount` decimal(9,2) NOT NULL,
  `lpa_invitem_status` char(1) NOT NULL DEFAULT 'a',
  PRIMARY KEY (`lpa_invitem_no`),
  KEY `ix_item_inv` (`lpa_invitem_inv_no`),
  KEY `fk_item_stock` (`lpa_invitem_stock_ID`),
  CONSTRAINT `fk_item_inv` FOREIGN KEY (`lpa_invitem_inv_no`) REFERENCES `lpa_invoices` (`lpa_inv_no`) ON DELETE CASCADE,
  CONSTRAINT `fk_item_stock` FOREIGN KEY (`lpa_invitem_stock_ID`) REFERENCES `lpa_stock` (`lpa_stock_ID`),
  CONSTRAINT `ck_item_qty` CHECK (`lpa_invitem_qty` > 0)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `lpa_invoice_items` (`lpa_invitem_no`, `lpa_invitem_inv_no`, `lpa_invitem_stock_ID`, `lpa_invitem_stock_name`, `lpa_invitem_qty`, `lpa_invitem_stock_price`, `lpa_invitem_stock_amount`, `lpa_invitem_status`) VALUES
  (1, 'INV-1001', 'LPA-001', 'Mechanical Keyboard MK-87', 1, 89, 89, 'a'),
  (2, 'INV-1001', 'LPA-008', 'USB-C to HDMI Cable 2m', 5, 19, 95, 'a'),
  (3, 'INV-1002', 'LPA-002', 'Wireless Optical Mouse WM-200', 2, 39.5, 79, 'a'),
  (4, 'INV-1002', 'LPA-008', 'USB-C to HDMI Cable 2m', 1, 18, 18, 'a'),
  (5, 'INV-1003', 'LPA-006', 'Noise-Cancelling Headset HS-90', 1, 119, 119, 'a'),
  (6, 'INV-1003', 'LPA-005', '1080p HD Webcam CV-10', 1, 69, 69, 'a'),
  (7, 'INV-1003', 'LPA-002', 'Wireless Optical Mouse WM-200', 1, 39.5, 39.5, 'a'),
  (8, 'INV-1003', 'LPA-008', 'USB-C to HDMI Cable 2m', 2, 19, 38, 'a'),
  (9, 'INV-1004', 'LPA-007', 'Mechanical Numpad NP-22', 1, 26, 26, 'a'),
  (10, 'INV-1004', 'LPA-008', 'USB-C to HDMI Cable 2m', 1, 19, 19, 'a'),
  (11, 'INV-1005', 'LPA-001', 'Mechanical Keyboard MK-87', 1, 89, 89, 'a'),
  (12, 'INV-1005', 'LPA-007', 'Mechanical Numpad NP-22', 1, 34, 34, 'a'),
  (13, 'INV-1006', 'LPA-001', 'Mechanical Keyboard MK-87', 1, 89, 89, 'a'),
  (14, 'INV-1007', 'LPA-004', 'USB-C Docking Station DS-11', 4, 149, 596, 'a'),
  (15, 'INV-1008', 'LPA-007', 'Mechanical Numpad NP-22', 2, 34, 68, 'a');

DROP TABLE IF EXISTS `lpa_stock_ledger`;
CREATE TABLE `lpa_stock_ledger` (
  `lpa_ledger_ID` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `lpa_ledger_stock_ID` varchar(20) NOT NULL,
  `lpa_ledger_user_ID` varchar(20) NOT NULL,
  `lpa_ledger_operation` enum('add','remove','reconcile') NOT NULL,
  `lpa_ledger_reason` varchar(100) NOT NULL,
  `lpa_ledger_before` int(10) unsigned NOT NULL,
  `lpa_ledger_after` int(10) unsigned NOT NULL,
  `lpa_ledger_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`lpa_ledger_ID`),
  KEY `ix_ledger_stock` (`lpa_ledger_stock_ID`,`lpa_ledger_at`),
  KEY `fk_ledger_user` (`lpa_ledger_user_ID`),
  CONSTRAINT `fk_ledger_stock` FOREIGN KEY (`lpa_ledger_stock_ID`) REFERENCES `lpa_stock` (`lpa_stock_ID`),
  CONSTRAINT `fk_ledger_user` FOREIGN KEY (`lpa_ledger_user_ID`) REFERENCES `lpa_users` (`lpa_user_ID`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `lpa_stock_ledger` (`lpa_ledger_ID`, `lpa_ledger_stock_ID`, `lpa_ledger_user_ID`, `lpa_ledger_operation`, `lpa_ledger_reason`, `lpa_ledger_before`, `lpa_ledger_after`, `lpa_ledger_at`) VALUES
  (1, 'LPA-007', 'U-002', 'add', 'Restocked from primary shipment', 5, 15, '2026-08-05 10:25:00'),
  (2, 'LPA-005', 'U-001', 'add', 'Restocked from primary shipment', 12, 20, '2026-08-05 10:40:00'),
  (3, 'LPA-003', 'U-001', 'remove', 'Damaged / write-off', 2, 0, '2026-08-05 11:15:00'),
  (4, 'LPA-004', 'U-002', 'reconcile', 'Physical inventory count', 5, 4, '2026-08-05 11:54:00'),
  (5, 'LPA-004', 'U-001', 'remove', 'Sold - INV-1007', 4, 0, '2026-10-07 14:19:40'),
  (6, 'LPA-007', 'U-003', 'remove', 'Sold - INV-1008', 15, 13, '2026-10-07 14:19:40');

SET FOREIGN_KEY_CHECKS = 1;
