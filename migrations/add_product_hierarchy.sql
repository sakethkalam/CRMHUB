-- Migration: add_product_hierarchy
-- Description: Adds 3-level medical-device product hierarchy
--              (ProductCategory → ProductFamily → Product)
--              plus M2M join tables to Opportunity and Lead.
-- Safe to re-run: all statements use IF NOT EXISTS.
-- Run order matters — parent tables must exist before children.

-- 1. Top-level category
CREATE TABLE IF NOT EXISTS product_categories (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Mid-level family
CREATE TABLE IF NOT EXISTS product_families (
    id               SERIAL PRIMARY KEY,
    name             VARCHAR(255) NOT NULL,
    category_id      INTEGER NOT NULL
                         REFERENCES product_categories(id) ON DELETE CASCADE,
    description      TEXT,
    therapeutic_area VARCHAR(255),
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Individual SKU / product
CREATE TABLE IF NOT EXISTS products (
    id                SERIAL PRIMARY KEY,
    sku               VARCHAR(100) NOT NULL UNIQUE,
    name              VARCHAR(255) NOT NULL,
    family_id         INTEGER NOT NULL
                          REFERENCES product_families(id) ON DELETE CASCADE,
    description       TEXT,
    unit_price        FLOAT NOT NULL DEFAULT 0.0,
    currency          VARCHAR(10) NOT NULL DEFAULT 'USD',
    unit_of_measure   VARCHAR(50),
    -- RegulatoryStatus: Approved | Pending | Discontinued | Investigational
    regulatory_status VARCHAR(50) NOT NULL DEFAULT 'Pending',
    -- DeviceClass: Class I | Class II | Class III
    device_class      VARCHAR(50),
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    launch_date       TIMESTAMPTZ,
    discontinue_date  TIMESTAMPTZ,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Opportunity ↔ Product (M2M)
CREATE TABLE IF NOT EXISTS opportunity_products (
    opportunity_id INTEGER NOT NULL
                       REFERENCES opportunities(id) ON DELETE CASCADE,
    product_id     INTEGER NOT NULL
                       REFERENCES products(id)      ON DELETE CASCADE,
    PRIMARY KEY (opportunity_id, product_id)
);

-- 5. Lead ↔ Product (M2M)
CREATE TABLE IF NOT EXISTS lead_products (
    lead_id    INTEGER NOT NULL REFERENCES leads(id)    ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    PRIMARY KEY (lead_id, product_id)
);

-- Optional performance indexes
CREATE INDEX IF NOT EXISTS ix_product_families_category_id ON product_families(category_id);
CREATE INDEX IF NOT EXISTS ix_products_family_id           ON products(family_id);
CREATE INDEX IF NOT EXISTS ix_products_sku                 ON products(sku);
CREATE INDEX IF NOT EXISTS ix_products_name                ON products(name);
