-- =====================================================================
-- LPA eComms - starting data (seed). Run after schema.sql.
-- Pedro Alvim - CTI20260187 - Phase 7 (ICTDBS507) - 05/10/2026
-- Demo accounts - password for all three: Lpa#2026 (stored only as scrypt hashes)
--   palvim  = administrator, mchang = staff (user), aturner = customer (client CL-006)
-- =====================================================================
USE lpa_ecomms;

INSERT INTO lpa_clients (lpa_client_ID, lpa_client_firstname, lpa_client_lastname, lpa_client_address, lpa_client_phone, lpa_client_status) VALUES
  ('CL-001', 'Riverside College', 'Library', '12 River Rd, Indooroopilly QLD 4068', '(07) 3100 2200', 'a'),
  ('CL-002', 'DevWorks', 'Pty Ltd', '88 Ann St, Brisbane City QLD 4000', '(07) 3211 4545', 'a'),
  ('CL-003', 'Logic Peripherals', 'Australia', '123 Queen St, Brisbane City QLD 4000', '(07) 3000 1234', 'a'),
  ('CL-004', 'Northgate', 'High School', '5 Ridge St, Northgate QLD 4013', '(07) 3266 7788', 'a'),
  ('CL-005', 'Brisbane Coders', 'Guild', '40 Grey St, South Brisbane QLD 4101', '(07) 3400 9911', 'd'),
  ('CL-006', 'Alex', 'Turner', '7 Park Rd, Milton QLD 4064', '0412 345 678', 'a');

INSERT INTO lpa_stock (lpa_stock_ID, lpa_stock_name, lpa_stock_brand, lpa_stock_category, lpa_stock_desc, lpa_stock_image, lpa_stock_onhand, lpa_stock_price, lpa_stock_status) VALUES
  ('LPA-001', 'Mechanical Keyboard MK-87', 'Vertex', 'Keyboards', 'Compact 87-key hot-swappable mechanical keyboard with RGB backlight.', '/images/products/keyboard.png', 12, 89.00, 'a'),
  ('LPA-002', 'Wireless Optical Mouse WM-200', 'Orbit', 'Mice', 'Ergonomic 2.4GHz wireless mouse, 1600 DPI, silent-click.', '/images/products/mouse.png', 7, 39.50, 'a'),
  ('LPA-003', '27" 4K UHD Monitor UM-27', 'Lumina', 'Monitors', '27-inch 4K IPS display, 60Hz, HDMI + DisplayPort.', '/images/products/monitor.png', 0, 429.00, 'a'),
  ('LPA-004', 'USB-C Docking Station DS-11', 'NovaLink', 'Docks & Hubs', '11-in-1 USB-C dock: dual HDMI, USB-A, SD, Ethernet, 100W PD.', '/images/products/dock.png', 4, 149.00, 'a'),
  ('LPA-005', '1080p HD Webcam CV-10', 'ClearView', 'Webcams', 'Full-HD 1080p webcam with auto-focus and dual mics.', '/images/products/webcam.png', 20, 69.00, 'a'),
  ('LPA-006', 'Noise-Cancelling Headset HS-90', 'AudioCore', 'Audio', 'Over-ear ANC headset, USB + 3.5mm, boom microphone.', '/images/products/headset.png', 3, 119.00, 'd'),
  ('LPA-007', 'Mechanical Numpad NP-22', 'Vertex', 'Keyboards', 'Standalone 22-key mechanical number pad, USB-C.', '/images/products/numpad.png', 15, 34.00, 'a'),
  ('LPA-008', 'USB-C to HDMI Cable 2m', 'NovaLink', 'Cables & Adapters', '2-metre USB-C to HDMI 4K@60Hz cable, braided.', '/images/products/cable.png', 2, 19.00, 'a');

INSERT INTO lpa_users (lpa_user_ID, lpa_user_username, lpa_user_password, lpa_user_firstname, lpa_user_lastname, lpa_user_group, lpa_user_client_ID, lpa_user_status) VALUES
  ('U-001', 'palvim',  'scrypt$70806fcddee2ee3e1cd7156ec9930438$929687f4f32802ab14ae9b57a85491c2989e9203f058bcbaf9b7fd9329b852786ee061ec1e93a5b13d2cb8737869c01c6915cfbc641c2895e0af4c53854cdcbf', 'Pedro',   'Alvim',  'administrator', NULL,     'a'),
  ('U-002', 'mchang',  'scrypt$27b61f103931fb82a93a438c7455f3cd$fe06755ac9d5e1f82e75b91b1bf1b2381dd68cd4a053a11179ed15b7fdc5eb7ea4106761557bd5fd2bf3105e807fe86cf5eb18cbf5db4bd3a12490819a950de5', 'Michael', 'Chang',  'user',          NULL,     'a'),
  ('U-003', 'aturner', 'scrypt$22cc188283e40b4eecc85b502e8f7c38$19af93e15eea4bd05a2cd6310016bd0918bda868adf87ac1727114f84a07e9a99cc19483791bed5c484e05a399ab5cf28bd282a3fc4198787946dbbbe056660f', 'Alex',    'Turner', 'customer',      'CL-006', 'a');

INSERT INTO lpa_invoices (lpa_inv_no, lpa_inv_date, lpa_inv_client_ID, lpa_inv_client_name, lpa_inv_client_address, lpa_inv_amount, lpa_inv_payment, lpa_inv_status) VALUES
  ('INV-1001', '2026-07-28 09:12:00', 'CL-001', 'Riverside College Library', '12 River Rd, Indooroopilly QLD 4068', 184.00, 'Account', 'a'),
  ('INV-1002', '2026-07-29 10:05:00', 'CL-002', 'DevWorks Pty Ltd', '88 Ann St, Brisbane City QLD 4000', 97.00, 'Account', 'a'),
  ('INV-1003', '2026-07-30 11:30:00', 'CL-003', 'Logic Peripherals Australia', '123 Queen St, Brisbane City QLD 4000', 265.50, 'Account', 'a'),
  ('INV-1004', '2026-08-01 14:20:00', 'CL-004', 'Northgate High School', '5 Ridge St, Northgate QLD 4013', 45.00, 'Account', 'a'),
  ('INV-1005', '2026-08-03 15:45:00', 'CL-002', 'DevWorks Pty Ltd', '88 Ann St, Brisbane City QLD 4000', 123.00, 'Account', 'a'),
  ('INV-1006', '2026-08-04 16:10:00', 'CL-005', 'Brisbane Coders Guild', '40 Grey St, South Brisbane QLD 4101', 89.00, 'Account', 'a');

INSERT INTO lpa_invoice_items (lpa_invitem_inv_no, lpa_invitem_stock_ID, lpa_invitem_stock_name, lpa_invitem_qty, lpa_invitem_stock_price, lpa_invitem_stock_amount) VALUES
  ('INV-1001', 'LPA-001', 'Mechanical Keyboard MK-87', 1, 89.00, 89.00),
  ('INV-1001', 'LPA-008', 'USB-C to HDMI Cable 2m', 5, 19.00, 95.00),
  ('INV-1002', 'LPA-002', 'Wireless Optical Mouse WM-200', 2, 39.50, 79.00),
  ('INV-1002', 'LPA-008', 'USB-C to HDMI Cable 2m', 1, 18.00, 18.00),
  ('INV-1003', 'LPA-006', 'Noise-Cancelling Headset HS-90', 1, 119.00, 119.00),
  ('INV-1003', 'LPA-005', '1080p HD Webcam CV-10', 1, 69.00, 69.00),
  ('INV-1003', 'LPA-002', 'Wireless Optical Mouse WM-200', 1, 39.50, 39.50),
  ('INV-1003', 'LPA-008', 'USB-C to HDMI Cable 2m', 2, 19.00, 38.00),
  ('INV-1004', 'LPA-007', 'Mechanical Numpad NP-22', 1, 26.00, 26.00),
  ('INV-1004', 'LPA-008', 'USB-C to HDMI Cable 2m', 1, 19.00, 19.00),
  ('INV-1005', 'LPA-001', 'Mechanical Keyboard MK-87', 1, 89.00, 89.00),
  ('INV-1005', 'LPA-007', 'Mechanical Numpad NP-22', 1, 34.00, 34.00),
  ('INV-1006', 'LPA-001', 'Mechanical Keyboard MK-87', 1, 89.00, 89.00);

INSERT INTO lpa_stock_ledger (lpa_ledger_stock_ID, lpa_ledger_user_ID, lpa_ledger_operation, lpa_ledger_reason, lpa_ledger_before, lpa_ledger_after, lpa_ledger_at) VALUES
  ('LPA-007', 'U-002', 'add',       'Restocked from primary shipment', 5,  15, '2026-08-05 10:25:00'),
  ('LPA-005', 'U-001', 'add',       'Restocked from primary shipment', 12, 20, '2026-08-05 10:40:00'),
  ('LPA-003', 'U-001', 'remove',    'Damaged / write-off',             2,  0,  '2026-08-05 11:15:00'),
  ('LPA-004', 'U-002', 'reconcile', 'Physical inventory count',        5,  4,  '2026-08-05 11:54:00');
