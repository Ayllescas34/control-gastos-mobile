-- Default categories for a new install, inserted once by the migration runner.
-- Fixed ids keep them identical on every device (and future sync). Archiving one is
-- permanent: this migration never runs again. Icons are icon-system names.
INSERT INTO `categories` (`id`, `name`, `kind`, `icon`, `created_at`, `updated_at`, `deleted_at`) VALUES
  ('4251bd0b-eef9-4932-ab4d-76b8dea766e1', 'Alimentación', 'expense', 'restaurant', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), NULL),
  ('1671b902-ffe0-48d2-acaa-e5a2e83cb75d', 'Supermercado', 'expense', 'shoppingCart', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), NULL),
  ('a217ec90-08ac-4025-b8df-6d0b8c8ad847', 'Transporte', 'expense', 'car', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), NULL),
  ('9456d6a0-82b4-4dc9-99e5-4ecb7017b619', 'Vivienda', 'expense', 'home', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), NULL),
  ('30da3513-bb03-431f-a473-88515824a188', 'Salud', 'expense', 'health', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), NULL),
  ('c9449b83-3c7a-4414-b2ba-e53f6ab5e404', 'Educación', 'expense', 'education', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), NULL),
  ('daa34707-f598-400a-8373-736bbb6c2d6f', 'Entretenimiento', 'expense', 'entertainment', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), NULL),
  ('4c954961-e4b3-4135-81d9-7acb77626c16', 'Compras', 'expense', 'shoppingBag', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), NULL),
  ('2684c8f4-1e45-4ca3-9605-d76d094ca090', 'Servicios', 'expense', 'utilities', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), NULL),
  ('f331f4a5-bfaf-4c4e-b7ab-68ad763c7c80', 'Suscripciones', 'expense', 'subscription', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), NULL),
  ('32f5a376-c2c2-4bbd-95ba-ba98f4ef102e', 'Viajes', 'expense', 'travel', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), NULL),
  ('448f2476-ba4e-48a9-bfc5-0653e95d4773', 'Otros', 'expense', 'other', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), NULL),
  ('fff64af9-d9eb-440a-bc03-5c0ea14ab884', 'Salario', 'income', 'salary', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), NULL),
  ('aca7d443-cb11-47d2-8fa9-b58f7e0b2cca', 'Otros ingresos', 'income', 'other', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), NULL);
