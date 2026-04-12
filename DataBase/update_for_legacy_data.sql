USE air_charter_extended;

UPDATE airlines
SET
    airline_name = 'PrivatAir',
    creation_date = '1998-09-23',
    organization_full_name = 'Общество с ограниченной ответственностью «PrivatAir»',
    organization_short_name = 'ООО «PrivatAir»',
    legal_address = '119019, г. Москва, ул. Новый Арбат, д. 21, офис 604',
    postal_address = '119019, г. Москва, ул. Новый Арбат, д. 21, офис 604',
    phone_number = '+7 495 221-48-60',
    email = 'info@privatair-aero.ru',
    bank_name = 'АО «Альфа-Банк»',
    taxpayer_id = '7702457812',
    tax_registration_reason_code = '770201001',
    primary_state_registration_number = '1027700457812',
    current_account_number = '40702810401470002136',
    correspondent_account_number = '30101810200000000593',
    bank_identifier_code = '044525593'
WHERE id = 2;

UPDATE airlines
SET
    airline_name = 'CityJet',
    creation_date = '2003-10-01',
    organization_full_name = 'Общество с ограниченной ответственностью «CityJet»',
    organization_short_name = 'ООО «CityJet»',
    legal_address = '196210, г. Санкт-Петербург, ул. Стартовая, д. 8, лит. А, офис 312',
    postal_address = '196210, г. Санкт-Петербург, ул. Стартовая, д. 8, лит. А, офис 312',
    phone_number = '+7 812 605-74-11',
    email = 'charter@cityjet-air.ru',
    bank_name = 'ПАО «Банк ВТБ»',
    taxpayer_id = '7810784635',
    tax_registration_reason_code = '781001001',
    primary_state_registration_number = '1037800784635',
    current_account_number = '40702810703010001842',
    correspondent_account_number = '30101810200000000704',
    bank_identifier_code = '044030704'
WHERE id = 5;

UPDATE airlines
SET
    airline_name = 'No Name Jet',
    creation_date = '2025-06-24',
    organization_full_name = 'Общество с ограниченной ответственностью «No Name Jet»',
    organization_short_name = 'ООО «No Name Jet»',
    legal_address = '450077, Республика Башкортостан, г. Уфа, ул. Ленина, д. 70, офис 15',
    postal_address = '450077, Республика Башкортостан, г. Уфа, ул. Ленина, д. 70, офис 15',
    phone_number = '+7 347 246-92-18',
    email = 'office@nonamejet.ru',
    bank_name = 'ПАО «Сбербанк»',
    taxpayer_id = '0276983412',
    tax_registration_reason_code = '027601001',
    primary_state_registration_number = '1250200034127',
    current_account_number = '40702810062000014528',
    correspondent_account_number = '30101810300000000601',
    bank_identifier_code = '048073601'
WHERE id = 17;

UPDATE persons SET email = 'aleksey.ivanov@example.com', birth_date = '1990-04-12' WHERE id = 1;
UPDATE persons SET email = 'maria.smirnova@example.com', birth_date = '1993-09-25' WHERE id = 2;
UPDATE persons SET email = 'oleg.kozlov@example.com', birth_date = '1988-02-14' WHERE id = 3;
UPDATE persons SET email = 'elena.frolova@example.com', birth_date = '1992-07-08' WHERE id = 4;

UPDATE persons SET email = 'dmitriy.salnikov@example.com', birth_date = '2004-03-17' WHERE id = 13;
UPDATE persons SET email = 'erik.fayzullin@example.com', birth_date = '2003-11-21' WHERE id = 14;
UPDATE persons SET email = 'regina.safina@example.com', birth_date = '2004-06-05' WHERE id = 15;
UPDATE persons SET email = 'oleg.ivanov@example.com', birth_date = '2002-12-09' WHERE id = 16;
UPDATE persons SET email = 'anna.salnikovna@example.com', birth_date = '2005-08-13' WHERE id = 17;
UPDATE persons SET email = 'artem.baranov@example.com', birth_date = '2004-01-27' WHERE id = 18;
UPDATE persons SET email = 'vladislav.fedenev@example.com', birth_date = '2003-05-30' WHERE id = 19;
UPDATE persons SET email = 'matvey.vasilev@example.com', birth_date = '2004-10-02' WHERE id = 20;
UPDATE persons SET email = 'ibragim.kuzcenov@example.com', birth_date = '2003-04-19' WHERE id = 21;
UPDATE persons SET email = 'dmitriy.salnikov2@example.com', birth_date = '2004-09-11' WHERE id = 22;