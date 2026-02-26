-- Subscriptions Plugin - Initial Schema Migration
-- Creates all tables required for WooCommerce Subscriptions API compatibility
-- Version: 1.0.0

-- Main subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  parent_id INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  version VARCHAR(20),
  created_via VARCHAR(50),
  order_key VARCHAR(100),
  number VARCHAR(50),
  customer_id INTEGER NOT NULL DEFAULT 0,
  customer_note TEXT,
  customer_ip_address VARCHAR(45),
  customer_user_agent VARCHAR(255),
  billing_period VARCHAR(10) NOT NULL DEFAULT 'month',
  billing_interval INTEGER NOT NULL DEFAULT 1,
  date_created TIMESTAMP NOT NULL DEFAULT NOW(),
  date_created_gmt TIMESTAMP NOT NULL DEFAULT NOW(),
  date_modified TIMESTAMP NOT NULL DEFAULT NOW(),
  date_modified_gmt TIMESTAMP NOT NULL DEFAULT NOW(),
  date_completed TIMESTAMP,
  date_completed_gmt TIMESTAMP,
  date_paid TIMESTAMP,
  date_paid_gmt TIMESTAMP,
  start_date_gmt TIMESTAMP NOT NULL,
  trial_end_date_gmt TIMESTAMP,
  next_payment_date_gmt TIMESTAMP,
  last_payment_date_gmt TIMESTAMP,
  cancelled_date_gmt TIMESTAMP,
  end_date_gmt TIMESTAMP,
  payment_retry_date_gmt TIMESTAMP,
  discount_total VARCHAR(20) NOT NULL DEFAULT '0.00',
  discount_tax VARCHAR(20) NOT NULL DEFAULT '0.00',
  shipping_total VARCHAR(20) NOT NULL DEFAULT '0.00',
  shipping_tax VARCHAR(20) NOT NULL DEFAULT '0.00',
  cart_tax VARCHAR(20) NOT NULL DEFAULT '0.00',
  total VARCHAR(20) NOT NULL DEFAULT '0.00',
  total_tax VARCHAR(20) NOT NULL DEFAULT '0.00',
  prices_include_tax BOOLEAN NOT NULL DEFAULT FALSE,
  payment_method VARCHAR(50),
  payment_method_title VARCHAR(100),
  transaction_id VARCHAR(100),
  billing JSONB NOT NULL DEFAULT '{}',
  shipping JSONB NOT NULL DEFAULT '{}',
  resubscribed_from INTEGER,
  resubscribed_subscription INTEGER,
  meta_data JSONB NOT NULL DEFAULT '[]',
  payment_details JSONB,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

-- Indexes for subscriptions table
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions(status);
CREATE INDEX IF NOT EXISTS subscriptions_customer_id_idx ON subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS subscriptions_parent_id_idx ON subscriptions(parent_id);
CREATE INDEX IF NOT EXISTS subscriptions_next_payment_idx ON subscriptions(next_payment_date_gmt);

-- Subscription line items
CREATE TABLE IF NOT EXISTS subscription_items (
  id SERIAL PRIMARY KEY,
  subscription_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  product_id INTEGER NOT NULL,
  variation_id INTEGER NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  tax_class VARCHAR(50) DEFAULT '',
  subtotal VARCHAR(20) NOT NULL DEFAULT '0.00',
  subtotal_tax VARCHAR(20) NOT NULL DEFAULT '0.00',
  total VARCHAR(20) NOT NULL DEFAULT '0.00',
  total_tax VARCHAR(20) NOT NULL DEFAULT '0.00',
  sku VARCHAR(100),
  price VARCHAR(20),
  taxes JSONB NOT NULL DEFAULT '[]',
  meta_data JSONB NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS subscription_items_subscription_id_idx ON subscription_items(subscription_id);

-- Subscription shipping lines
CREATE TABLE IF NOT EXISTS subscription_shipping_lines (
  id SERIAL PRIMARY KEY,
  subscription_id INTEGER NOT NULL,
  method_title VARCHAR(100) NOT NULL,
  method_id VARCHAR(50) NOT NULL,
  instance_id VARCHAR(50),
  total VARCHAR(20) NOT NULL DEFAULT '0.00',
  total_tax VARCHAR(20) NOT NULL DEFAULT '0.00',
  taxes JSONB NOT NULL DEFAULT '[]',
  meta_data JSONB NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS subscription_shipping_subscription_id_idx ON subscription_shipping_lines(subscription_id);

-- Subscription tax lines
CREATE TABLE IF NOT EXISTS subscription_tax_lines (
  id SERIAL PRIMARY KEY,
  subscription_id INTEGER NOT NULL,
  rate_code VARCHAR(100) NOT NULL,
  rate_id INTEGER NOT NULL,
  label VARCHAR(100) NOT NULL,
  compound BOOLEAN NOT NULL DEFAULT FALSE,
  tax_total VARCHAR(20) NOT NULL DEFAULT '0.00',
  shipping_tax_total VARCHAR(20) NOT NULL DEFAULT '0.00',
  rate_percent INTEGER,
  meta_data JSONB NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS subscription_tax_subscription_id_idx ON subscription_tax_lines(subscription_id);

-- Subscription fee lines
CREATE TABLE IF NOT EXISTS subscription_fee_lines (
  id SERIAL PRIMARY KEY,
  subscription_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  tax_class VARCHAR(50) DEFAULT '',
  tax_status VARCHAR(20) NOT NULL DEFAULT 'taxable',
  total VARCHAR(20) NOT NULL DEFAULT '0.00',
  total_tax VARCHAR(20) NOT NULL DEFAULT '0.00',
  taxes JSONB NOT NULL DEFAULT '[]',
  meta_data JSONB NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS subscription_fee_subscription_id_idx ON subscription_fee_lines(subscription_id);

-- Subscription coupon lines
CREATE TABLE IF NOT EXISTS subscription_coupon_lines (
  id SERIAL PRIMARY KEY,
  subscription_id INTEGER NOT NULL,
  code VARCHAR(100) NOT NULL,
  discount VARCHAR(20) NOT NULL DEFAULT '0.00',
  discount_tax VARCHAR(20) NOT NULL DEFAULT '0.00',
  meta_data JSONB NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS subscription_coupon_subscription_id_idx ON subscription_coupon_lines(subscription_id);

-- Subscription notes
CREATE TABLE IF NOT EXISTS subscription_notes (
  id SERIAL PRIMARY KEY,
  subscription_id INTEGER NOT NULL,
  note TEXT NOT NULL,
  author VARCHAR(100),
  date_created TIMESTAMP NOT NULL DEFAULT NOW(),
  date_created_gmt TIMESTAMP NOT NULL DEFAULT NOW(),
  is_customer_note BOOLEAN NOT NULL DEFAULT FALSE,
  added_by_user BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS subscription_notes_subscription_id_idx ON subscription_notes(subscription_id);
