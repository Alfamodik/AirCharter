CREATE TABLE IF NOT EXISTS airport_route_priorities (
    airport_id INT NOT NULL,
    priority_score INT NOT NULL DEFAULT 0,
    is_capital BOOLEAN NOT NULL DEFAULT FALSE,
    is_large_city BOOLEAN NOT NULL DEFAULT FALSE,
    note VARCHAR(255) NULL,

    PRIMARY KEY (airport_id),

    CONSTRAINT airport_route_priorities_ibfk_1
        FOREIGN KEY (airport_id) REFERENCES airports(id)
);

INSERT INTO airport_route_priorities (
    airport_id,
    priority_score,
    is_capital,
    is_large_city,
    note
)
SELECT
    airport.id,
    CASE
        WHEN airport.city IN (
            'Москва', 'Пекин', 'Токио', 'Сеул', 'Париж', 'Берлин', 'Лондон',
            'Анкара', 'Астана', 'Минск', 'Тбилиси', 'Ереван', 'Баку',
            'Ташкент', 'Бишкек', 'Душанбе', 'Ашхабад', 'Дубай'
        ) THEN 100
        WHEN airport.city IN (
            'Стамбул', 'Санкт-Петербург', 'Шанхай', 'Гуанчжоу', 'Осака',
            'Франкфурт', 'Мюнхен', 'Милан', 'Рим', 'Мадрид', 'Барселона',
            'Амстердам', 'Вена', 'Прага', 'Варшава', 'Хельсинки'
        ) THEN 75
        ELSE 50
    END AS priority_score,
    airport.city IN (
        'Москва', 'Пекин', 'Токио', 'Сеул', 'Париж', 'Берлин', 'Лондон',
        'Анкара', 'Астана', 'Минск', 'Тбилиси', 'Ереван', 'Баку',
        'Ташкент', 'Бишкек', 'Душанбе', 'Ашхабад'
    ) AS is_capital,
    airport.city IN (
        'Дубай', 'Стамбул', 'Санкт-Петербург', 'Шанхай', 'Гуанчжоу', 'Осака',
        'Франкфурт', 'Мюнхен', 'Милан', 'Рим', 'Мадрид', 'Барселона',
        'Амстердам', 'Вена', 'Прага', 'Варшава', 'Хельсинки'
    ) AS is_large_city,
    'initial route candidate priority' AS note
FROM airports airport
WHERE
    airport.city IN (
        'Москва', 'Пекин', 'Токио', 'Сеул', 'Париж', 'Берлин', 'Лондон',
        'Анкара', 'Астана', 'Минск', 'Тбилиси', 'Ереван', 'Баку',
        'Ташкент', 'Бишкек', 'Душанбе', 'Ашхабад', 'Дубай',
        'Стамбул', 'Санкт-Петербург', 'Шанхай', 'Гуанчжоу', 'Осака',
        'Франкфурт', 'Мюнхен', 'Милан', 'Рим', 'Мадрид', 'Барселона',
        'Амстердам', 'Вена', 'Прага', 'Варшава', 'Хельсинки'
    )
    AND airport.country NOT IN ('Соединенные Штаты', 'Канада')
ON DUPLICATE KEY UPDATE
    priority_score = VALUES(priority_score),
    is_capital = VALUES(is_capital),
    is_large_city = VALUES(is_large_city),
    note = VALUES(note);
