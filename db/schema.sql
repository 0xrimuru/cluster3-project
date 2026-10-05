-- =====================================================================
-- LPA eComms - database schema (MySQL 8 / MariaDB 10.4+)
-- Pedro Alvim - CTI20260187 - Phase 7 (ICTDBS507) - 05/10/2026
--
-- Starts from the design validated in Phase 5 (lpa_ecomms_validated.sql):
-- InnoDB, foreign keys, INT UNSIGNED quantities, password hashes, the
-- renamed status columns and the stock ledger. Changes made when the
-- web app was connected (ICTDBS507):
--   7.1 lpa_stock: + brand, category and image columns (shown in the
--       Stock and Shop pages).
--   7.2 lpa_users: + lpa_user_client_ID (NULL for staff) -> lpa_clients,
--       so a web-store customer is linked to their client record.
--   7.3 lpa_invoices: + lpa_inv_payment (Account, Visa, PayPal...);
--       lpa_inv_client_name widened 50 -> 101 (first + space + last name).
--   7.4 Status codes documented: a = active, d = disabled / inactive,
--       x = deleted (soft delete - kept for invoices and the audit trail).
--   7.5 Indexes for the searches the pages run (name, category, username).
-- =====================================================================

CREATE DATABASE IF NOT EXISTS lpa_ecomms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE lpa_ecomms;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS lpa_stock_ledger, lpa_invoice_items, lpa_invoices, lpa_users, lpa_stock, lpa_clients;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE lpa_clients (
  lpa_client_ID        VARCHAR(20)  NOT NULL,
  lpa_client_firstname VARCHAR(50)  NOT NULL,
  lpa_client_lastname  VARCHAR(50)  NOT NULL,
  lpa_client_address   VARCHAR(250) NOT NULL,
  lpa_client_phone     VARCHAR(30)  NOT NULL,
  lpa_client_status    CHAR(1)      NOT NULL DEFAULT 'a',   -- a = active, d = disabled
  PRIMARY KEY (lpa_client_ID),
  CONSTRAINT ck_client_status CHECK (lpa_client_status IN ('a','d'))
) ENGINE=InnoDB;

CREATE TABLE lpa_stock (
  lpa_stock_ID       VARCHAR(20)   NOT NULL,                -- e.g. LPA-001 (the SKU)
  lpa_stock_name     VARCHAR(250)  NOT NULL,
  lpa_stock_brand    VARCHAR(100)  NOT NULL DEFAULT '',     -- 7.1
  lpa_stock_category VARCHAR(50)   NOT NULL DEFAULT 'General', -- 7.1
  lpa_stock_desc     TEXT          NOT NULL,
  lpa_stock_image    VARCHAR(250)  NOT NULL DEFAULT '/images/products/placeholder.png', -- 7.1
  lpa_stock_onhand   INT UNSIGNED  NOT NULL DEFAULT 0,
  lpa_stock_price    DECIMAL(7,2)  NOT NULL,
  lpa_stock_status   CHAR(1)       NOT NULL DEFAULT 'a',    -- a = active, d = disabled, x = deleted
  PRIMARY KEY (lpa_stock_ID),
  KEY ix_stock_name (lpa_stock_name),
  KEY ix_stock_category (lpa_stock_category),
  CONSTRAINT ck_stock_price  CHECK (lpa_stock_price >= 0),
  CONSTRAINT ck_stock_status CHECK (lpa_stock_status IN ('a','d','x'))
) ENGINE=InnoDB;

CREATE TABLE lpa_users (
  lpa_user_ID        VARCHAR(20)  NOT NULL,
  lpa_user_username  VARCHAR(30)  NOT NULL,
  lpa_user_password  VARCHAR(255) NOT NULL,                 -- password HASH only (scrypt$salt$hash)
  lpa_user_firstname VARCHAR(50)  NOT NULL,
  lpa_user_lastname  VARCHAR(50)  NOT NULL,
  lpa_user_group     VARCHAR(50)  NOT NULL,                 -- administrator, user (staff), customer
  lpa_user_client_ID VARCHAR(20)  NULL,                     -- 7.2 customers only
  lpa_user_status    CHAR(1)      NOT NULL DEFAULT 'a',     -- a = active, d = inactive, x = deleted
  PRIMARY KEY (lpa_user_ID),
  UNIQUE KEY uq_username (lpa_user_username),
  CONSTRAINT fk_user_client  FOREIGN KEY (lpa_user_client_ID) REFERENCES lpa_clients (lpa_client_ID),
  CONSTRAINT ck_user_group   CHECK (lpa_user_group IN ('administrator','user','customer')),
  CONSTRAINT ck_user_status  CHECK (lpa_user_status IN ('a','d','x'))
) ENGINE=InnoDB;

CREATE TABLE lpa_invoices (
  lpa_inv_no             VARCHAR(20)  NOT NULL,
  lpa_inv_date           DATETIME     NOT NULL,
  lpa_inv_client_ID      VARCHAR(20)  NOT NULL,
  lpa_inv_client_name    VARCHAR(101) NOT NULL,              -- 7.3 copied from the client on the day
  lpa_inv_client_address VARCHAR(250) NOT NULL,
  lpa_inv_amount         DECIMAL(8,2) NOT NULL,
  lpa_inv_payment        VARCHAR(30)  NOT NULL DEFAULT 'Account', -- 7.3
  lpa_inv_status         CHAR(1)      NOT NULL DEFAULT 'a',  -- a = active, x = deleted
  PRIMARY KEY (lpa_inv_no),
  KEY ix_inv_client (lpa_inv_client_ID),
  KEY ix_inv_date (lpa_inv_date),
  CONSTRAINT fk_inv_client FOREIGN KEY (lpa_inv_client_ID) REFERENCES lpa_clients (lpa_client_ID),
  CONSTRAINT ck_inv_status CHECK (lpa_inv_status IN ('a','x'))
) ENGINE=InnoDB;

CREATE TABLE lpa_invoice_items (
  lpa_invitem_no           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  lpa_invitem_inv_no       VARCHAR(20)  NOT NULL,
  lpa_invitem_stock_ID     VARCHAR(20)  NOT NULL,
  lpa_invitem_stock_name   VARCHAR(250) NOT NULL,
  lpa_invitem_qty          INT UNSIGNED NOT NULL,
  lpa_invitem_stock_price  DECIMAL(7,2) NOT NULL,             -- price charged on the day
  lpa_invitem_stock_amount DECIMAL(9,2) NOT NULL,
  lpa_invitem_status       CHAR(1)      NOT NULL DEFAULT 'a',
  PRIMARY KEY (lpa_invitem_no),
  KEY ix_item_inv (lpa_invitem_inv_no),
  CONSTRAINT fk_item_inv   FOREIGN KEY (lpa_invitem_inv_no)   REFERENCES lpa_invoices (lpa_inv_no) ON DELETE CASCADE,
  CONSTRAINT fk_item_stock FOREIGN KEY (lpa_invitem_stock_ID) REFERENCES lpa_stock (lpa_stock_ID),
  CONSTRAINT ck_item_qty   CHECK (lpa_invitem_qty > 0)
) ENGINE=InnoDB;

-- Audit history of every stock change (adjustments, sales, returns)
CREATE TABLE lpa_stock_ledger (
  lpa_ledger_ID        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  lpa_ledger_stock_ID  VARCHAR(20)  NOT NULL,
  lpa_ledger_user_ID   VARCHAR(20)  NOT NULL,
  lpa_ledger_operation ENUM('add','remove','reconcile') NOT NULL,
  lpa_ledger_reason    VARCHAR(100) NOT NULL,
  lpa_ledger_before    INT UNSIGNED NOT NULL,
  lpa_ledger_after     INT UNSIGNED NOT NULL,
  lpa_ledger_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (lpa_ledger_ID),
  KEY ix_ledger_stock (lpa_ledger_stock_ID, lpa_ledger_at),
  CONSTRAINT fk_ledger_stock FOREIGN KEY (lpa_ledger_stock_ID) REFERENCES lpa_stock (lpa_stock_ID),
  CONSTRAINT fk_ledger_user  FOREIGN KEY (lpa_ledger_user_ID)  REFERENCES lpa_users (lpa_user_ID)
) ENGINE=InnoDB;
