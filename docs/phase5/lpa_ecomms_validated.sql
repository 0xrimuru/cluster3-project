-- =====================================================================
-- LPA eComms - validated database design (MySQL / MariaDB)
-- Pedro Alvim - CTI20260187 - Phase 5 (ICTPRG546) - 04/10/2026
--
-- Based on the LPA specification dump (lpa_ecomms.sql). Changes made
-- during design validation (see Phase 5 Design Validation Report):
--   1. ENGINE MyISAM -> InnoDB so FOREIGN KEYs are actually enforced.
--   2. Foreign keys added: invoices->clients, invoice_items->invoices,
--      invoice_items->stock (+ the proposed ledger -> stock / users).
--   3. Quantities varchar(5)/(6) -> INT UNSIGNED (maths + never negative).
--   4. lpa_user_password varchar(50) -> varchar(255) to store a hash
--      (bcrypt / argon2), never plain text (ICTPRG537).
--   5. Duplicate column name lpa_inv_status in invoice_items / users
--      renamed to lpa_invitem_status / lpa_user_status.
--   6. NEW table lpa_stock_ledger for the stock audit history (client's
--      reference app). Proposed - to be confirmed with the client.
-- The tables are created in ICTDBS507 (database block).
-- =====================================================================

CREATE DATABASE IF NOT EXISTS lpa_ecomms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE lpa_ecomms;

DROP TABLE IF EXISTS lpa_stock_ledger, lpa_invoice_items, lpa_invoices, lpa_users, lpa_stock, lpa_clients;

CREATE TABLE lpa_clients (
  lpa_client_ID        VARCHAR(20)  NOT NULL,
  lpa_client_firstname VARCHAR(50)  NOT NULL,
  lpa_client_lastname  VARCHAR(50)  NOT NULL,
  lpa_client_address   VARCHAR(250) NOT NULL,
  lpa_client_phone     VARCHAR(30)  NOT NULL,
  lpa_client_status    CHAR(1)      NOT NULL DEFAULT 'a',   -- a = active, d = disabled
  PRIMARY KEY (lpa_client_ID)
) ENGINE=InnoDB;

CREATE TABLE lpa_stock (
  lpa_stock_ID     VARCHAR(20)   NOT NULL,
  lpa_stock_name   VARCHAR(250)  NOT NULL,
  lpa_stock_desc   TEXT          NOT NULL,
  lpa_stock_onhand INT UNSIGNED  NOT NULL DEFAULT 0,
  lpa_stock_price  DECIMAL(7,2)  NOT NULL,
  lpa_stock_status CHAR(1)       NOT NULL DEFAULT 'a',
  PRIMARY KEY (lpa_stock_ID),
  CHECK (lpa_stock_price >= 0)
) ENGINE=InnoDB;

CREATE TABLE lpa_users (
  lpa_user_ID        VARCHAR(20)  NOT NULL,
  lpa_user_username  VARCHAR(30)  NOT NULL,
  lpa_user_password  VARCHAR(255) NOT NULL,                 -- password HASH only
  lpa_user_firstname VARCHAR(50)  NOT NULL,
  lpa_user_lastname  VARCHAR(50)  NOT NULL,
  lpa_user_group     VARCHAR(50)  NOT NULL,                 -- e.g. administrator, user
  lpa_user_status    CHAR(1)      NOT NULL DEFAULT 'a',
  PRIMARY KEY (lpa_user_ID),
  UNIQUE KEY uq_username (lpa_user_username)
) ENGINE=InnoDB;

CREATE TABLE lpa_invoices (
  lpa_inv_no             VARCHAR(20)  NOT NULL,
  lpa_inv_date           DATETIME     NOT NULL,
  lpa_inv_client_ID      VARCHAR(20)  NOT NULL,
  lpa_inv_client_name    VARCHAR(50)  NOT NULL,
  lpa_inv_client_address VARCHAR(250) NOT NULL,
  lpa_inv_amount         DECIMAL(8,2) NOT NULL,
  lpa_inv_status         CHAR(1)      NOT NULL DEFAULT 'a',
  PRIMARY KEY (lpa_inv_no),
  KEY ix_inv_client (lpa_inv_client_ID),
  KEY ix_inv_date (lpa_inv_date),
  CONSTRAINT fk_inv_client FOREIGN KEY (lpa_inv_client_ID) REFERENCES lpa_clients (lpa_client_ID)
) ENGINE=InnoDB;

CREATE TABLE lpa_invoice_items (
  lpa_invitem_no           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  lpa_invitem_inv_no       VARCHAR(20)  NOT NULL,
  lpa_invitem_stock_ID     VARCHAR(20)  NOT NULL,
  lpa_invitem_stock_name   VARCHAR(250) NOT NULL,
  lpa_invitem_qty          INT UNSIGNED NOT NULL,
  lpa_invitem_stock_price  DECIMAL(7,2) NOT NULL,
  lpa_invitem_stock_amount DECIMAL(7,2) NOT NULL,
  lpa_invitem_status       CHAR(1)      NOT NULL DEFAULT 'a',
  PRIMARY KEY (lpa_invitem_no),
  CONSTRAINT fk_item_inv   FOREIGN KEY (lpa_invitem_inv_no)   REFERENCES lpa_invoices (lpa_inv_no) ON DELETE CASCADE,
  CONSTRAINT fk_item_stock FOREIGN KEY (lpa_invitem_stock_ID) REFERENCES lpa_stock (lpa_stock_ID)
) ENGINE=InnoDB;

-- Proposed (audit history of stock adjustments)
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
  CONSTRAINT fk_ledger_stock FOREIGN KEY (lpa_ledger_stock_ID) REFERENCES lpa_stock (lpa_stock_ID),
  CONSTRAINT fk_ledger_user  FOREIGN KEY (lpa_ledger_user_ID)  REFERENCES lpa_users (lpa_user_ID)
) ENGINE=InnoDB;
