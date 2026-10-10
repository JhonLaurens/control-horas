package co.jhonjara.controlhoras.repo;

import co.jhonjara.controlhoras.domain.AppSettings;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AppSettingsRepository extends JpaRepository<AppSettings, Short> {}
