-- Esquema inicial de Control de Horas
CREATE TABLE work_session (
    id          VARCHAR(40)  PRIMARY KEY,
    start_at    TIMESTAMPTZ  NOT NULL,
    end_at      TIMESTAMPTZ,
    note        VARCHAR(200) NOT NULL DEFAULT '',
    tag         VARCHAR(40)  NOT NULL DEFAULT '',
    extra       BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT ck_session_range CHECK (end_at IS NULL OR end_at > start_at)
);
CREATE INDEX ix_session_start ON work_session (start_at);
-- Solo puede existir una jornada en curso (sin fin)
CREATE UNIQUE INDEX ux_session_one_active ON work_session ((TRUE)) WHERE end_at IS NULL;

CREATE TABLE session_pause (
    id          BIGSERIAL    PRIMARY KEY,
    session_id  VARCHAR(40)  NOT NULL REFERENCES work_session (id) ON DELETE CASCADE,
    start_at    TIMESTAMPTZ  NOT NULL,
    end_at      TIMESTAMPTZ,
    CONSTRAINT ck_pause_range CHECK (end_at IS NULL OR end_at >= start_at)
);
CREATE INDEX ix_pause_session ON session_pause (session_id);

CREATE TABLE app_settings (
    id             SMALLINT     PRIMARY KEY CHECK (id = 1),
    sched_start    VARCHAR(5)   NOT NULL,
    sched_end      VARCHAR(5)   NOT NULL,
    lunch_min      INTEGER      NOT NULL CHECK (lunch_min BETWEEN 0 AND 240),
    night_start    VARCHAR(5),
    night_end      VARCHAR(5)   NOT NULL,
    workdays       VARCHAR(20)  NOT NULL,
    theme          VARCHAR(10)  NOT NULL,
    accent         INTEGER      NOT NULL,
    custom_accent  VARCHAR(7),
    hint           BOOLEAN      NOT NULL,
    goal_notified  VARCHAR(10),
    end_notified   VARCHAR(10),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
INSERT INTO app_settings (id, sched_start, sched_end, lunch_min, night_start, night_end, workdays, theme, accent, custom_accent, hint)
VALUES (1, '07:30', '17:30', 90, NULL, '06:00', '1,2,3,4,5', 'dark', 0, NULL, TRUE);
