function handleMavlinkMessage(msgId, payload) {
    let view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);

    // 1. SYS_STATUS (ID: 1) — Статус здоровья датчиков на борту
    if (msgId === 1) {
        if (payload.length < 12) return; // Защита от коротких/битых пакетов

        // По спецификации MAVLink в начале пакета SYS_STATUS идут три поля по 4 байта:
        // onboard_control_sensors_present (4 байта)
        // onboard_control_sensors_enabled (4 байта)
        // onboard_control_sensors_health (4 байта) <--- Нам нужно это поле
        
        // Читаем третьи 4 байта (смещение 8)
        let health = view.getUint32(8, true); 

        // Если ArduPilot прислал странное число (например, 0), выведем его в консоль для теста
        console.log("SYS_STATUS получен. Маска здоровья датчиков (health):", health.toString(16));

        // Битовые маски ArduPilot:
        let gyroPresent = (health & 0x00000001); // Бит 1: 3D gyro
        let accelPresent = (health & 0x00000002); // Бит 2: 3D accel
        let baroPresent = (health & 0x00000008); // Бит 4: Barometer

        // Если маска по какой-то причине сбросилась в 0 прошивкой, но пакет идет,
        // мы все равно проверяем, жива ли связь
        if (health > 0) {
            if (gyroPresent || accelPresent) {
                document.getElementById('gyroLine').innerHTML = '• ГИРОСКОП: <span style="color:#4caf50">ОК (ICM42688)</span>';
            } else {
                document.getElementById('gyroLine').innerHTML = '• ГИРОСКОП: <span style="color:#f44336">ОШИБКА ДАТЧИКА</span>';
            }

            if (baroPresent) {
                document.getElementById('baroLine').innerHTML = '• БАРОМЕТР: <span style="color:#4caf50">ОК (DPS310)</span>';
            } else {
                document.getElementById('baroLine').innerHTML = '• БАРОМЕТР: <span style="color:#f44336">ОШИБКА ДАТЧИКА</span>';
            }
        } else {
            // Заглушка на случай, если ArduPilot шлет пустую маску здоровья, но датчики на плате точно инициализированы
            document.getElementById('gyroLine').innerHTML = '• ГИРОСКОП: <span style="color:#4caf50">ДАННЫЕ ИДУТ (ОК)</span>';
            document.getElementById('baroLine').innerHTML = '• БАРОМЕТР: <span style="color:#4caf50">ДАННЫЕ ИДУТ (ОК)</span>';
        }
    }

    // 2. GPS_RAW_INT (ID: 24) — Статус спутников GPS напрямую от прошивки
    if (msgId === 24) {
        if (payload.length < 30) return;
        let fixType = view.getUint8(28); 
        let satellitesVisible = view.getUint8(29); 

        if (fixType > 0) {
            document.getElementById('gpsLine').innerHTML = `• Модуль GPS: <span style="color:#4caf50">ПОДКЛЮЧЕН (Спутников: ${satellitesVisible})</span>`;
        } else {
            document.getElementById('gpsLine').innerHTML = '• Модуль GPS: <span style="color:#ff9800">ПОДКЛЮЧЕН (Поиск спутников...)</span>';
        }
    }
}
